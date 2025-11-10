#!/usr/bin/env python3
"""
Booking.com Pricing & Availability Scraper

Scrapes pricing and availability data for competitive analysis.
Two modes: OCCUPANCY (track booking rates) and PRICING (analyze pricing strategies).
"""
import json
import csv
import asyncio
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from fake_useragent import UserAgent
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

# Import configuration
import config

BASE_URL = "https://www.booking.com"
USER_AGENT = UserAgent().random


def get_today_str():
    """Get today's date as string for tracking."""
    return datetime.now().strftime("%Y-%m-%d")


def load_daily_progress():
    """Load daily progress tracker."""
    if config.DAILY_PROGRESS_FILE.exists():
        try:
            with open(config.DAILY_PROGRESS_FILE, 'r') as f:
                content = f.read().strip()
                if content:
                    return json.loads(content)
        except (json.JSONDecodeError, Exception):
            pass
    return {"date": None, "completed_properties": []}


def archive_existing_data():
    """Archive existing pricing data and analysis before starting a new scrape."""
    if not config.ENABLE_ARCHIVING:
        return
    
    if not config.PRICING_CSV.exists():
        return
    
    # Get the date from the existing scrape_log to use the actual scrape date
    scrape_log_path = config.OUTPUT_DIR / "scrape_log.json"
    date_str = None
    
    if scrape_log_path.exists():
        try:
            with open(scrape_log_path, 'r') as f:
                scrape_log = json.load(f)
                if scrape_log and len(scrape_log) > 0:
                    # Get the most recent successful scrape timestamp
                    latest_entry = scrape_log[-1]  # Last entry is most recent
                    timestamp = latest_entry.get("timestamp", "")
                    if timestamp:
                        # Parse timestamp and format as YYYYMMDD
                        scrape_date = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        date_str = scrape_date.strftime("%Y%m%d")
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            print(f"Could not read scrape log date: {e}")
    
    # Fallback to yesterday if we couldn't get the scrape date
    if not date_str:
        yesterday = datetime.now() - timedelta(days=1)
        date_str = yesterday.strftime("%Y%m%d")
    
    archive_csv_filename = f"pricing_data_{date_str}.csv"
    archive_json_filename = f"pricing_analysis_{date_str}.json"
    archive_csv_path = config.ARCHIVE_DIR / archive_csv_filename
    archive_json_path = config.ARCHIVE_DIR / archive_json_filename
    
    # Archive CSV file (only if archive doesn't exist yet)
    if not archive_csv_path.exists():
        shutil.copy2(config.PRICING_CSV, archive_csv_path)
        print(f"Archived existing data to: {archive_csv_filename}")
    else:
        print(f"Archive already exists: {archive_csv_filename} (preserving existing archive)")
    
    # Archive analysis JSON file if it exists
    if config.ANALYSIS_JSON.exists() and not archive_json_path.exists():
        shutil.copy2(config.ANALYSIS_JSON, archive_json_path)
        print(f"Archived existing analysis to: {archive_json_filename}")
    
    # Clean up old archives (keep only MAX_ARCHIVE_FILES most recent)
    csv_archives = sorted(config.ARCHIVE_DIR.glob("pricing_data_*.csv"), reverse=True)
    json_archives = sorted(config.ARCHIVE_DIR.glob("pricing_analysis_*.json"), reverse=True)
    
    if len(csv_archives) > config.MAX_ARCHIVE_FILES:
        for old_file in csv_archives[config.MAX_ARCHIVE_FILES:]:
            old_file.unlink()
            print(f"Removed old archive: {old_file.name}")
    
    if len(json_archives) > config.MAX_ARCHIVE_FILES:
        for old_file in json_archives[config.MAX_ARCHIVE_FILES:]:
            old_file.unlink()
            print(f"Removed old archive: {old_file.name}")



def save_daily_progress(completed_properties):
    """Save daily progress tracker."""
    progress = {
        "date": get_today_str(),
        "completed_properties": completed_properties,
        "last_updated": datetime.now().isoformat()
    }
    with open(config.DAILY_PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)


def get_properties_to_scrape(all_hotels):
    """Determine which properties to scrape based on daily progress."""
    progress = load_daily_progress()
    today = get_today_str()

    # If it's a new day, start fresh
    if progress["date"] != today:
        print(f"New day detected - will scrape all {len(all_hotels)} properties")
        return all_hotels, [], True  # True indicates new day (should archive)

    # Same day - check if already completed
    completed = progress.get("completed_properties", [])

    if len(completed) >= len(all_hotels):
        print(f"All properties already scraped today ({today})")
        print("Run again tomorrow for fresh data.")
        return [], completed, False

    # Resume from where we left off
    remaining = [h for h in all_hotels if h["slug"] not in completed]
    print(f"Resuming: {len(completed)} already done, {len(remaining)} remaining")

    return remaining, completed, False  # False indicates same day (don't archive)


def format_date(date_obj):
    """Format date as YYYY-MM-DD for booking.com URLs."""
    return date_obj.strftime("%Y-%m-%d")


def extract_price_from_text(text):
    """Extract numeric price from text like 'R 1,234' or 'ZAR 1234.56'."""
    if not text:
        return None
    cleaned = re.sub(r'[^\d,.]', '', text)
    cleaned = cleaned.replace(',', '')
    try:
        return float(cleaned)
    except (ValueError, AttributeError):
        return None


def extract_rooms_json_from_html(html_content):
    """
    Extract b_rooms_available_and_soldout JSON from the page HTML.
    This is more reliable than DOM scraping as it uses Booking.com's own data structure.
    
    Returns:
        list: Room data extracted from the JavaScript object, or empty list if not found
    """
    # Find the start of b_rooms_available_and_soldout
    start_pattern = r'b_rooms_available_and_soldout:\s*(\[)'
    match = re.search(start_pattern, html_content)
    if not match:
        return []
    
    # Find the matching closing bracket
    start_pos = match.end() - 1  # Position of the opening [
    bracket_count = 0
    in_string = False
    escape_next = False
    
    for i, char in enumerate(html_content[start_pos:], start=start_pos):
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
        
        if not in_string:
            if char == '[' or char == '{':
                bracket_count += 1
            elif char == ']' or char == '}':
                bracket_count -= 1
                
                if bracket_count == 0:
                    # Found the matching closing bracket
                    json_str = html_content[start_pos:i+1]
                    try:
                        rooms_data = json.loads(json_str)
                        return rooms_data
                    except json.JSONDecodeError:
                        return []
    
    return []


def extract_room_details_from_json(rooms_data):
    """
    Extract room names and prices from the parsed b_rooms_available_and_soldout JSON.
    
    Returns:
        dict: Contains room_names list, room_prices list, and aggregated statistics
    """
    if not rooms_data:
        return {
            'room_names': [],
            'room_prices': [],
            'total_room_types': 0,
            'available_room_types': 0,
            'min_room_price': None,
            'max_room_price': None,
            'avg_room_price': None,
        }
    
    room_names = []
    room_prices = []
    total_room_types = len(rooms_data)
    available_room_types = 0
    
    for room in rooms_data:
        room_name = room.get('b_name', 'Unknown Room')
        # Always capture room name regardless of availability
        room_names.append(room_name)
        
        blocks = room.get('b_blocks', [])
        
        if blocks:
            # Use the first block's price (usually the cheapest/main rate)
            first_block = blocks[0]
            price_raw = first_block.get('b_raw_price', '')
            
            if price_raw:
                try:
                    price = float(price_raw)
                    room_prices.append(price)
                    available_room_types += 1  # Only count as available if has valid price
                except (ValueError, TypeError):
                    pass
    
    # Calculate statistics
    min_price = min(room_prices) if room_prices else None
    max_price = max(room_prices) if room_prices else None
    avg_price = round(sum(room_prices) / len(room_prices), 2) if room_prices else None
    
    return {
        'room_names': room_names,
        'room_prices': room_prices,
        'total_room_types': total_room_types,
        'available_room_types': available_room_types,
        'min_room_price': min_price,
        'max_room_price': max_price,
        'avg_room_price': avg_price,
    }


def extract_pricing_data(html: str, slug: str, check_in: str, check_out: str, nights: int):
    """
    Parse HTML for pricing and availability information.
    
    Uses multiple approaches:
    1. JSON extraction from b_rooms_available_and_soldout (preferred for available dates)
    2. JSON extraction from b_all_rooms for room names even when sold out
    3. DOM scraping for fallback

    NOTE: Extracts pricing BEFORE checking availability, so we capture
    prices even for sold-out dates when Booking.com displays them.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # APPROACH 1: Try JSON extraction first (most reliable for available rooms)
    rooms_json = extract_rooms_json_from_html(html)
    room_details = extract_room_details_from_json(rooms_json)
    
    # APPROACH 1B: If JSON is empty, try to extract b_all_rooms for room type info
    if not room_details['room_names']:
        # Try to find b_all_rooms which contains all room types even when sold out
        all_rooms_pattern = r'b_all_rooms:\s*(\{.*?\}),\s*\n'
        all_rooms_match = re.search(all_rooms_pattern, html, re.DOTALL)
        if all_rooms_match:
            try:
                all_rooms_data = json.loads(all_rooms_match.group(1))
                # Extract room names from the keys or room data
                room_names_from_all = []
                for room_id, room_info in all_rooms_data.items():
                    if isinstance(room_info, dict) and 'b_name' in room_info:
                        room_names_from_all.append(room_info['b_name'])
                if room_names_from_all:
                    room_details['room_names'] = room_names_from_all
                    room_details['total_room_types'] = len(room_names_from_all)
            except (json.JSONDecodeError, AttributeError):
                pass
    
    # If JSON extraction succeeded and found data, use those values
    if room_details['room_names']:
        total_room_types = room_details['total_room_types']
        available_room_types = room_details['available_room_types']
        sold_out_room_types = total_room_types - available_room_types
        min_room_price = room_details['min_room_price']
        max_room_price = room_details['max_room_price']
        avg_room_price = room_details['avg_room_price']
        room_prices = room_details['room_prices']
        room_names_list = room_details['room_names']
        
        # Use the minimum price as the main price
        price = min_room_price
        price_text = f"ZAR {price:,.2f}" if price else None
        
        # Availability is "available" if any rooms are available
        availability_status = "available" if available_room_types > 0 else "sold_out"
        
    else:
        # APPROACH 2: Fallback to DOM scraping (for sold-out dates or if JSON not available)
        # Try multiple selectors for price
        price_selectors = [
            "[data-testid='price-and-discounted-price']",
            ".prco-valign-middle-helper",
            ".bui-price-display__value",
            ".prco-inline-block-maker-helper",
            "[data-testid='recommended-price']",
            ".bui_price_headline",
            ".prco-text-nowrap-helper",
        ]

        price_text = None
        for selector in price_selectors:
            price_elem = soup.select_one(selector)
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                if price_text and any(char.isdigit() for char in price_text):
                    break

        # Check availability status
        availability_status = "available"

        # First check for property-level sold out indicators
        sold_out_indicators = [
            ".soldout_property",
            "[data-testid='soldout-property']",
            ".bui-banner--warning",
        ]

        property_sold_out = False
        for selector in sold_out_indicators:
            if soup.select_one(selector):
                property_sold_out = True
                break

        # Check for "no availability" text at property level
        no_avail_texts = ["no availability", "sold out", "not available", "fully booked"]
        page_text = soup.get_text().lower()
        for indicator in no_avail_texts:
            if indicator in page_text and "room" not in page_text[max(0, page_text.find(indicator)-50):page_text.find(indicator)+50]:
                property_sold_out = True
                break

        # Check if any rooms are available (more accurate for multi-room properties)
        # Look for room availability indicators and count room types
        room_table = soup.select_one("#hprt-table") or soup.select_one("[data-block-id='rooms-table']")
        
        total_room_types = 0
        available_room_types = 0
        sold_out_room_types = 0
        room_prices = []  # List of all available room prices
        room_names_list = []  # List of room names from DOM
        
        if room_table:
            # Find all room rows (each row represents a room type)
            room_rows = room_table.select("tr.js-rt-block-row, tr[data-block-id]")
            
            if not room_rows:
                # Fallback: count by price cells if no specific room rows found
                all_price_cells = room_table.select(".hprt-table-cell-price")
                
                for cell in all_price_cells:
                    price_elem = cell.select_one("[data-testid='price-and-discounted-price'], .bui-price-display__value")
                    if price_elem:
                        available_room_types += 1
                        room_price_text = price_elem.get_text(strip=True)
                        room_price = extract_price_from_text(room_price_text)
                        if room_price:
                            room_prices.append(room_price)
                
                total_room_types = len(room_table.select(".hprt-table-cell-roomtype, .hprt-roomtype-icon-link"))
                sold_out_room_types = max(0, total_room_types - available_room_types)
                
                # Extract room names
                room_name_elems = room_table.select(".hprt-roomtype-icon-link, .hprt-roomtype-name")
                for elem in room_name_elems:
                    name = elem.get_text(strip=True)
                    if name:
                        room_names_list.append(name)
            else:
                for row in room_rows:
                    total_room_types += 1
                    
                    # Extract room name
                    room_name_elem = row.select_one(".hprt-roomtype-icon-link, .hprt-roomtype-name, [data-testid='title']")
                    if room_name_elem:
                        room_name = room_name_elem.get_text(strip=True)
                        if room_name:
                            room_names_list.append(room_name)
                    
                    # Check if this room type has a bookable price
                    price_cell = row.select_one(".hprt-table-cell-price")
                    if price_cell:
                        price_elem = price_cell.select_one("[data-testid='price-and-discounted-price'], .bui-price-display__value")
                        if price_elem:
                            available_room_types += 1
                            room_price_text = price_elem.get_text(strip=True)
                            room_price = extract_price_from_text(room_price_text)
                            if room_price:
                                room_prices.append(room_price)
                        else:
                            sold_out_room_types += 1
                    else:
                        sold_out_room_types += 1
            
            # Determine availability based on room types
            if available_room_types > 0:
                availability_status = "available"
            else:
                availability_status = "sold_out"
        elif property_sold_out:
            # No room table and property-level sold out indicators
            availability_status = "sold_out"
        
        # Calculate occupancy rate and pricing statistics at property level
        min_room_price = None
        max_room_price = None
        avg_room_price = None
        
        if room_prices:
            min_room_price = min(room_prices)
            max_room_price = max(room_prices)
            avg_room_price = round(sum(room_prices) / len(room_prices), 2)
        
        price = extract_price_from_text(price_text)

    # Extract original price if discounted (DOM-based, as discount info not in JSON)
    original_price_elem = soup.select_one(".bui-price-display__original")
    original_price_text = original_price_elem.get_text(strip=True) if original_price_elem else None

    # Extract rating
    score_elem = soup.select_one("[data-testid='review-score'] .d10a6220b4")
    score = score_elem.get_text(strip=True) if score_elem else None

    # Extract review count
    review_elem = soup.select_one("[data-testid='review-score'] .e6208ee469")
    review_count = None
    if review_elem:
        review_text = review_elem.get_text(strip=True)
        match = re.search(r'([\d,]+)', review_text)
        if match:
            review_count = int(match.group(1).replace(',', ''))

    # Convert prices
    price = extract_price_from_text(price_text)
    original_price = extract_price_from_text(original_price_text)
    price_per_night = price / nights if price and nights > 0 else None

    # Check for discount
    has_discount = original_price is not None and price is not None and original_price > price
    discount_percentage = None
    if has_discount:
        discount_percentage = round(((original_price - price) / original_price) * 100, 2)

    # Calculate property occupancy rate
    property_occupancy_rate = None
    if total_room_types > 0:
        property_occupancy_rate = round((sold_out_room_types / total_room_types) * 100, 2)
    
    # Convert room names list to comma-separated string
    room_names = ', '.join(room_names_list) if room_names_list else ''

    return {
        "hotel_slug": slug,
        "check_in_date": check_in,
        "check_out_date": check_out,
        "nights": nights,
        "guests": config.GUESTS,
        "rooms": config.ROOMS,
        "availability": availability_status,
        "total_price": price,
        "original_price": original_price,
        "price_per_night": price_per_night,
        "has_discount": has_discount,
        "discount_percentage": discount_percentage,
        "rating_score": score,
        "review_count": review_count,
        "scrape_timestamp": datetime.now().isoformat(),
        "day_offset": None,
        "total_room_types": total_room_types,
        "available_room_types": available_room_types,
        "sold_out_room_types": sold_out_room_types,
        "property_occupancy_rate": property_occupancy_rate,
        "min_room_price": min_room_price,
        "max_room_price": max_room_price,
        "avg_room_price": avg_room_price,
        "room_names": room_names,
    }


async def fetch_pricing_for_date(context, slug: str, cc: str, check_in: str, check_out: str, nights: int):
    """Fetch pricing data for a specific property and date range."""
    url = (
        f"{BASE_URL}/hotel/{cc}/{slug}.en-gb.html"
        f"?checkin={check_in}"
        f"&checkout={check_out}"
        f"&group_adults={config.GUESTS}"
        f"&group_children=0"
        f"&no_rooms={config.ROOMS}"
    )

    page = await context.new_page()
    
    try:
        await page.goto(url, timeout=config.BROWSER_TIMEOUT, wait_until="domcontentloaded")
        
        # Wait for page to stabilize - Booking.com does client-side rendering
        await page.wait_for_timeout(3000)
        
        # Wait for page to be interactive (no more major navigation)
        await page.wait_for_load_state("load", timeout=10000)
        
        # Try to wait for room table (optional - won't fail if not found)
        try:
            await page.wait_for_selector("#hprt-table, [data-block-id='rooms-table']", timeout=3000, state="attached")
            # Give it a moment to fully render
            await page.wait_for_timeout(500)
        except:
            # No room table - this is normal for single-unit properties (villas, etc.)
            pass

        html = await page.content()
        pricing_data = extract_pricing_data(html, slug, check_in, check_out, nights)

        return pricing_data
    except Exception as e:
        print(f"   Warning: Error fetching {slug} for {check_in}: {str(e)}")
        return {
            "hotel_slug": slug,
            "check_in_date": check_in,
            "check_out_date": check_out,
            "nights": nights,
            "guests": config.GUESTS,
            "rooms": config.ROOMS,
            "availability": "error",
            "total_price": None,
            "original_price": None,
            "price_per_night": None,
            "has_discount": None,
            "discount_percentage": None,
            "rating_score": None,
            "review_count": None,
            "scrape_timestamp": datetime.now().isoformat(),
            "day_offset": None,
        }
    finally:
        await page.close()


async def fetch_all_pricing(play, slug: str, cc: str, hotel_name: str, save_batch_callback=None):
    """Fetch pricing data for all configured date ranges for a property.
    
    Args:
        play: Playwright instance
        slug: Hotel slug
        cc: Country code
        hotel_name: Hotel name
        save_batch_callback: Optional function to save data incrementally (receives list of pricing records)
    """
    all_pricing = []
    today = datetime.now().date()
    
    # Configuration for incremental saves
    SAVE_BATCH_SIZE = 10  # Save every N records

    print(f"-> Scraping {hotel_name} ({slug})")

    if config.OCCUPANCY_MODE:
        # OCCUPANCY MODE: Check every day for availability
        print(f"   Mode: Occupancy tracking (next {config.DAYS_AHEAD} days)")

        days_checked = 0
        for day_offset in range(0, config.DAYS_AHEAD + 1, config.OCCUPANCY_CHECK_INTERVAL):
            check_in_date = today + timedelta(days=day_offset)
            check_out_date = check_in_date + timedelta(days=config.OCCUPANCY_STAY_DURATION)

            check_in_str = format_date(check_in_date)
            check_out_str = format_date(check_out_date)

            if config.SHOW_PROGRESS and days_checked % config.PROGRESS_INTERVAL == 0:
                print(f"   -> Checking day {day_offset}/{config.DAYS_AHEAD}...")

            # Create fresh browser context for EACH date check to avoid detection
            browser = await play.chromium.launch(
                headless=config.HEADLESS,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox'
                ]
            )
            
            # Create context and apply comprehensive stealth scripts
            stealth_config = Stealth()
            context = await browser.new_context(
                user_agent=USER_AGENT,
                locale="en-GB",
                viewport={'width': 1920, 'height': 1080}
            )
            
            # Apply all stealth scripts to the context
            for script in stealth_config.enabled_scripts:
                await context.add_init_script(script)
            
            try:
                pricing = await fetch_pricing_for_date(
                    context, slug, cc, check_in_str, check_out_str, config.OCCUPANCY_STAY_DURATION
                )
                pricing["hotel_name"] = hotel_name
                pricing["day_offset"] = day_offset
                all_pricing.append(pricing)
                
                # Save incrementally every SAVE_BATCH_SIZE records
                if save_batch_callback and len(all_pricing) % SAVE_BATCH_SIZE == 0:
                    save_batch_callback(all_pricing[-SAVE_BATCH_SIZE:])
                    
            finally:
                await browser.close()

            days_checked += 1
            await asyncio.sleep(config.REQUEST_DELAY)

        # Calculate occupancy stats
        total_days = len(all_pricing)
        sold_out_days = sum(1 for p in all_pricing if p["availability"] == "sold_out")
        available_days = sum(1 for p in all_pricing if p["availability"] == "available")
        occupancy_rate = (sold_out_days / total_days * 100) if total_days > 0 else 0

        print(f"   Occupancy Rate: {occupancy_rate:.1f}% ({sold_out_days}/{total_days} days sold out)")

    else:
        # PRICING MODE: Check specific date combinations
        print(f"   Mode: Pricing analysis ({len(config.CHECK_IN_OFFSETS)} check-in dates)")

        for check_in_offset in config.CHECK_IN_OFFSETS:
            check_in_date = today + timedelta(days=check_in_offset)

            for duration in config.STAY_DURATIONS:
                check_out_date = check_in_date + timedelta(days=duration)

                check_in_str = format_date(check_in_date)
                check_out_str = format_date(check_out_date)

                print(f"   -> {check_in_str} to {check_out_str} ({duration} nights)")

                # Create fresh browser context for EACH date/duration combo
                browser = await play.chromium.launch(
                    headless=config.HEADLESS,
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--no-sandbox'
                    ]
                )
                
                # Create context and apply comprehensive stealth scripts
                stealth_config = Stealth()
                context = await browser.new_context(
                    user_agent=USER_AGENT,
                    locale="en-GB",
                    viewport={'width': 1920, 'height': 1080}
                )
                
                # Apply all stealth scripts to the context
                for script in stealth_config.enabled_scripts:
                    await context.add_init_script(script)
                
                try:
                    pricing = await fetch_pricing_for_date(
                        context, slug, cc, check_in_str, check_out_str, duration
                    )
                    pricing["hotel_name"] = hotel_name
                    all_pricing.append(pricing)
                    
                    # Save incrementally every SAVE_BATCH_SIZE records
                    if save_batch_callback and len(all_pricing) % SAVE_BATCH_SIZE == 0:
                        save_batch_callback(all_pricing[-SAVE_BATCH_SIZE:])
                        
                finally:
                    await browser.close()

                await asyncio.sleep(config.REQUEST_DELAY)
    
    # Save any remaining records that didn't make a full batch
    if save_batch_callback and len(all_pricing) % SAVE_BATCH_SIZE != 0:
        remaining = len(all_pricing) % SAVE_BATCH_SIZE
        save_batch_callback(all_pricing[-remaining:])

    return all_pricing


async def main():
    """Main execution function."""
    config.ensure_directories()

    # Load hotels configuration
    all_hotels = json.loads(config.HOTELS_FILE.read_text(encoding="utf-8"))

    # Check daily progress - determine what to scrape
    hotels_to_scrape, already_completed, is_new_day = get_properties_to_scrape(all_hotels)

    if not hotels_to_scrape:
        # All done for today
        return

    all_data = []
    completed_slugs = list(already_completed)  # Track what we've completed

    # Fieldnames for CSV
    fieldnames = [
        "hotel_name", "hotel_slug", "check_in_date", "check_out_date",
        "nights", "guests", "rooms", "day_offset", "availability", "total_price",
        "original_price", "price_per_night", "has_discount",
        "discount_percentage", "rating_score", "review_count",
        "total_room_types", "available_room_types", "sold_out_room_types", 
        "property_occupancy_rate", "min_room_price", "max_room_price", 
        "avg_room_price", "room_names", "scrape_timestamp"
    ]

    # Archive and start fresh if it's a new day
    # Append to existing file if resuming same-day scraping
    if is_new_day:
        archive_existing_data()
        csv_mode = "w"
    else:
        csv_mode = "a" if config.PRICING_CSV.exists() else "w"
    
    if csv_mode == "w":
        with config.PRICING_CSV.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

    print("="*70)
    print(f"BOOKING.COM PRICING SCRAPER - {config.get_mode_name()}")
    print("="*70)
    print(f"Total properties: {len(all_hotels)}")
    print(f"Already completed today: {len(already_completed)}")
    print(f"To scrape now: {len(hotels_to_scrape)}")

    if config.OCCUPANCY_MODE:
        print(f"Days to check: {config.DAYS_AHEAD} (every {config.OCCUPANCY_CHECK_INTERVAL} day)")
        print(f"Standard stay: 2 nights")
    else:
        print(f"Check-in offsets: {config.CHECK_IN_OFFSETS}")
        print(f"Stay durations: {config.STAY_DURATIONS} nights")

    print(f"Guests: {config.GUESTS}, Rooms: {config.ROOMS}")
    print(f"Saving incrementally every 10 records to: {config.PRICING_CSV.name}")
    print("="*70)
    print()

    # Helper function for incremental saves
    def save_batch(batch_data):
        """Save a batch of pricing records to CSV."""
        with config.PRICING_CSV.open("a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writerows(batch_data)

    async with async_playwright() as p:
        for i, hotel in enumerate(hotels_to_scrape, 1):
            slug = hotel["slug"]
            cc = hotel["cc"]
            name = hotel["name"]

            total_done = len(already_completed) + i
            print(f"[{total_done}/{len(all_hotels)}] Scraping {name}...")

            try:
                pricing_data = await fetch_all_pricing(p, slug, cc, name, save_batch_callback=save_batch)

                if pricing_data:
                    available = sum(1 for p in pricing_data if p["availability"] == "available")
                    sold_out = sum(1 for p in pricing_data if p["availability"] == "sold_out")
                    print(f"   OK: {len(pricing_data)} records | Available: {available}, Sold out: {sold_out}")
                    print(f"   Data saved incrementally during scraping")

                    all_data.extend(pricing_data)

                    # Mark as completed and save progress
                    completed_slugs.append(slug)
                    save_daily_progress(completed_slugs)
                    print(f"   Progress saved ({len(completed_slugs)}/{len(all_hotels)} complete)\n")
                else:
                    print(f"   Warning: No data for {name}\n")
                    # Still mark as attempted
                    completed_slugs.append(slug)
                    save_daily_progress(completed_slugs)

            except Exception as e:
                print(f"   ERROR: {name} - {str(e)}")
                print(f"   Progress saved. You can resume later.\n")
                # Don't mark as completed if there was an error
                break

    # Final summary
    if all_data:
        print("\n" + "="*70)
        print(f"COMPLETE: {len(all_data)} new records saved to {config.PRICING_CSV.name}")

        # Occupancy summary (only for newly scraped properties)