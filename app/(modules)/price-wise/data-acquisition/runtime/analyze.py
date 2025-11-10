#!/usr/bin/env python3
"""
Booking.com Pricing Analysis & Reporting

Analyzes pricing data and generates comprehensive competitive intelligence reports.
"""
import pandas as pd
import numpy as np
import json
from datetime import datetime

# Import configuration
import config


def load_pricing_data():
    """Load and prepare pricing data."""
    if not config.PRICING_CSV.exists():
        raise FileNotFoundError(f"Pricing data not found: {config.PRICING_CSV}\nRun scrape.py first.")

    df = pd.read_csv(config.PRICING_CSV)

    # Convert dates
    df['check_in_date'] = pd.to_datetime(df['check_in_date'])
    df['check_out_date'] = pd.to_datetime(df['check_out_date'])
    df['scrape_timestamp'] = pd.to_datetime(df['scrape_timestamp'])

    # Add calculated fields
    df['is_available'] = df['availability'] == 'available'
    df['is_sold_out'] = df['availability'] == 'sold_out'
    df['month'] = df['check_in_date'].dt.month
    df['month_name'] = df['check_in_date'].dt.strftime('%B')
    df['day_of_week'] = df['check_in_date'].dt.day_name()
    df['weeks_ahead'] = ((df['check_in_date'] - df['scrape_timestamp'].dt.normalize()) / pd.Timedelta(days=7)).astype(int)

    return df


def calculate_occupancy_metrics(df):
    """Calculate occupancy metrics by property with room-level insights."""
    if df.empty:
        return pd.DataFrame()

    metrics = []

    for hotel in df['hotel_name'].unique():
        hotel_df = df[df['hotel_name'] == hotel]

        total = len(hotel_df)
        available = hotel_df['is_available'].sum()
        sold_out = hotel_df['is_sold_out'].sum()

        # Room-level metrics (average across all date checks)
        room_df = hotel_df[hotel_df['total_room_types'] > 0]
        avg_total_rooms = room_df['total_room_types'].mean() if len(room_df) > 0 else 0
        avg_available_rooms = room_df['available_room_types'].mean() if len(room_df) > 0 else 0
        avg_sold_out_rooms = room_df['sold_out_room_types'].mean() if len(room_df) > 0 else 0
        avg_room_occupancy = room_df['property_occupancy_rate'].mean() if len(room_df) > 0 else 0

        metrics.append({
            'hotel_name': hotel,
            'total_checks': total,
            'available': available,
            'sold_out': sold_out,
            'occupancy_rate': (sold_out / total * 100) if total > 0 else 0,
            'availability_rate': (available / total * 100) if total > 0 else 0,
            # Room-level insights
            'avg_total_room_types': avg_total_rooms,
            'avg_available_room_types': avg_available_rooms,
            'avg_sold_out_room_types': avg_sold_out_rooms,
            'avg_room_occupancy_rate': avg_room_occupancy,
        })

    if not metrics:
        return pd.DataFrame()

    return pd.DataFrame(metrics).sort_values('occupancy_rate', ascending=False)


def calculate_pricing_metrics(df):
    """Calculate pricing statistics by property with room-level pricing insights."""
    df_priced = df[df['is_available'] & df['total_price'].notna()]

    if df_priced.empty:
        return pd.DataFrame()

    metrics = []

    for hotel in df['hotel_name'].unique():
        hotel_df = df_priced[df_priced['hotel_name'] == hotel]

        if len(hotel_df) == 0:
            continue

        # Room-level pricing (where available)
        room_priced = hotel_df[hotel_df['min_room_price'].notna()]
        
        metrics.append({
            'hotel_name': hotel,
            'avg_price_per_night': hotel_df['price_per_night'].mean(),
            'min_price': hotel_df['price_per_night'].min(),
            'max_price': hotel_df['price_per_night'].max(),
            'median_price': hotel_df['price_per_night'].median(),
            'std_price': hotel_df['price_per_night'].std(),
            'discount_frequency': (hotel_df['has_discount'].sum() / len(hotel_df) * 100),
            'avg_discount': hotel_df[hotel_df['has_discount'] == True]['discount_percentage'].mean(),
            'avg_rating': hotel_df['rating_score'].mean(),
            'sample_size': len(hotel_df),
            # Room-level pricing insights
            'avg_min_room_price': room_priced['min_room_price'].mean() if len(room_priced) > 0 else None,
            'avg_max_room_price': room_priced['max_room_price'].mean() if len(room_priced) > 0 else None,
            'avg_room_price_avg': room_priced['avg_room_price'].mean() if len(room_priced) > 0 else None,
            'room_price_range': (room_priced['max_room_price'].mean() - room_priced['min_room_price'].mean()) if len(room_priced) > 0 else None,
        })

    if not metrics:
        return pd.DataFrame()

    return pd.DataFrame(metrics).sort_values('avg_price_per_night', ascending=False)


def compare_to_reference(pricing_df, occupancy_df):
    """Compare all properties to reference property."""
    ref = config.REFERENCE_PROPERTY

    ref_pricing = pricing_df[pricing_df['hotel_name'] == ref]
    ref_occupancy = occupancy_df[occupancy_df['hotel_name'] == ref]

    if ref_pricing.empty or ref_occupancy.empty:
        print(f"Warning: {ref} not found in data")
        return pd.DataFrame()

    ref_price = ref_pricing['avg_price_per_night'].values[0]
    ref_occ = ref_occupancy['occupancy_rate'].values[0]

    comparisons = []

    for _, row in pricing_df.iterrows():
        hotel = row['hotel_name']

        if hotel == ref:
            continue

        occ_row = occupancy_df[occupancy_df['hotel_name'] == hotel]
        if occ_row.empty:
            continue

        price_diff = row['avg_price_per_night'] - ref_price
        price_diff_pct = (price_diff / ref_price * 100) if ref_price > 0 else 0
        occ_diff = occ_row['occupancy_rate'].values[0] - ref_occ

        comparisons.append({
            'hotel_name': hotel,
            'avg_price': row['avg_price_per_night'],
            'price_vs_ref': price_diff,
            'price_vs_ref_pct': price_diff_pct,
            'occupancy': occ_row['occupancy_rate'].values[0],
            'occ_vs_ref': occ_diff,
            'position': 'Higher Price' if price_diff > 0 else 'Lower Price',
            'demand': 'Higher Demand' if occ_diff > 0 else 'Lower Demand',
        })

    return pd.DataFrame(comparisons).sort_values('price_vs_ref_pct')


def analyze_pricing_by_availability(df):
    """Analyze pricing patterns for available vs sold-out dates."""
    df_with_price = df[df['total_price'].notna()].copy()

    analysis = []

    for hotel in df['hotel_name'].unique():
        hotel_df = df_with_price[df_with_price['hotel_name'] == hotel]

        available = hotel_df[hotel_df['availability'] == 'available']
        sold_out = hotel_df[hotel_df['availability'] == 'sold_out']

        if len(available) == 0:
            continue

        analysis.append({
            'hotel_name': hotel,
            'avg_price_available': available['price_per_night'].mean(),
            'avg_price_sold_out': sold_out['price_per_night'].mean() if len(sold_out) > 0 else None,
            'price_variance': available['price_per_night'].std() if len(available) > 1 else 0,
            'uses_dynamic_pricing': available['price_per_night'].std() > available['price_per_night'].mean() * 0.15 if len(available) > 1 else False,
        })

    return pd.DataFrame(analysis)


def analyze_room_inventory(df):
    """Analyze room-level inventory and pricing strategies."""
    # Filter to records with room data
    room_df = df[df['total_room_types'] > 0].copy()
    
    if room_df.empty:
        return pd.DataFrame()
    
    analysis = []
    
    for hotel in room_df['hotel_name'].unique():
        hotel_data = room_df[room_df['hotel_name'] == hotel]
        
        # Available dates only
        available_dates = hotel_data[hotel_data['is_available']]
        
        if len(available_dates) == 0:
            continue
        
        # Calculate room inventory metrics
        avg_total = available_dates['total_room_types'].mean()
        avg_available = available_dates['available_room_types'].mean()
        avg_sold_out = available_dates['sold_out_room_types'].mean()
        avg_occ_rate = available_dates['property_occupancy_rate'].mean()
        
        # Price range analysis
        has_pricing = available_dates[available_dates['min_room_price'].notna()]
        if len(has_pricing) > 0:
            avg_min = has_pricing['min_room_price'].mean()
            avg_max = has_pricing['max_room_price'].mean()
            avg_avg = has_pricing['avg_room_price'].mean()
            price_spread = avg_max - avg_min
            price_spread_pct = (price_spread / avg_min * 100) if avg_min > 0 else 0
        else:
            avg_min = avg_max = avg_avg = price_spread = price_spread_pct = None
        
        # Inventory strategy insights
        low_inventory = (avg_available / avg_total * 100) if avg_total > 0 else 0
        
        analysis.append({
            'hotel_name': hotel,
            'avg_total_room_types': avg_total,
            'avg_available_room_types': avg_available,
            'avg_sold_out_room_types': avg_sold_out,
            'avg_room_occupancy_rate': avg_occ_rate,
            'low_inventory_pct': 100 - low_inventory,  # % of rooms sold out
            'avg_min_room_price': avg_min,
            'avg_max_room_price': avg_max,
            'avg_room_price': avg_avg,
            'room_price_spread': price_spread,
            'room_price_spread_pct': price_spread_pct,
            'uses_room_tiering': price_spread_pct > 50 if price_spread_pct else False,  # Wide price range = tiered pricing
            'sample_size': len(available_dates),
        })
    
    return pd.DataFrame(analysis).sort_values('avg_room_occupancy_rate', ascending=False)


def generate_json_summary(pricing_metrics, occupancy_metrics, comparison, room_inventory=None, scrape_timestamp=None):
    """Generate JSON summary with all analysis data including room-level insights."""
    
    # Replace NaN with None for valid JSON
    pricing_metrics = pricing_metrics.replace({np.nan: None}) if not pricing_metrics.empty else pricing_metrics
    occupancy_metrics = occupancy_metrics.replace({np.nan: None}) if not occupancy_metrics.empty else occupancy_metrics
    comparison = comparison.replace({np.nan: None}) if not comparison.empty else comparison
    
    # Convert DataFrames to list of dicts
    pricing_list = pricing_metrics.to_dict('records') if not pricing_metrics.empty else []
    occupancy_list = occupancy_metrics.to_dict('records') if not occupancy_metrics.empty else []
    comparison_list = comparison.to_dict('records') if not comparison.empty else []
    
    # Room inventory insights
    room_inventory_list = []
    if room_inventory is not None and not room_inventory.empty:
        room_inventory = room_inventory.replace({np.nan: None})
        room_inventory_list = room_inventory.to_dict('records')
    
    # Use scrape timestamp if provided, otherwise use current time
    generated_at = scrape_timestamp if scrape_timestamp else datetime.now().isoformat()
    
    # Build analysis object
    analysis = {
        'generated_at': generated_at,
        'reference_property': config.REFERENCE_PROPERTY,
        'mode': config.get_mode_name(),
        'pricing_metrics': pricing_list,
        'occupancy_metrics': occupancy_list,
        'comparison': comparison_list,
        'room_inventory': room_inventory_list,  # NEW: Room-level insights
    }
    
    # Save to JSON file
    with open(config.ANALYSIS_JSON, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)
    
    return analysis


def main():
    """Main execution."""
    config.ensure_directories()

    print("="*70)
    print("BOOKING.COM PRICING ANALYSIS")
    print("="*70)

    print("Loading pricing data...")
    df = load_pricing_data()

    if df.empty:
        print("\nNo pricing data available to analyze.")
        print("Run the scraper first to collect data.")
        return

    print("Calculating occupancy metrics...")
    occupancy_metrics = calculate_occupancy_metrics(df)

    print("Calculating pricing metrics...")
    pricing_metrics = calculate_pricing_metrics(df)

    if pricing_metrics.empty and occupancy_metrics.empty:
        print("\nInsufficient data for analysis.")
        return

    print(f"Comparing to {config.REFERENCE_PROPERTY}...")
    comparison = compare_to_reference(pricing_metrics, occupancy_metrics)

    print("Analyzing pricing patterns...")
    pricing_avail = analyze_pricing_by_availability(df)

    print("Analyzing room inventory and pricing strategies...")
    room_inventory = analyze_room_inventory(df)

    print("Generating analysis...")

    # Get the most recent scrape timestamp from the data
    scrape_timestamp = df['scrape_timestamp'].max().isoformat()

    # JSON analysis export
    json_summary = generate_json_summary(pricing_metrics, occupancy_metrics, comparison, room_inventory, scrape_timestamp)
    print(f"OK: Analysis saved to {config.ANALYSIS_JSON}")

    # Console summary
    print("\n" + "="*70)
    print("KEY INSIGHTS")
    print("="*70)

    ref_pricing = pricing_metrics[pricing_metrics['hotel_name'] == config.REFERENCE_PROPERTY]
    ref_occupancy = occupancy_metrics[occupancy_metrics['hotel_name'] == config.REFERENCE_PROPERTY]
    ref_room = room_inventory[room_inventory['hotel_name'] == config.REFERENCE_PROPERTY] if not room_inventory.empty else pd.DataFrame()

    if not ref_pricing.empty:
        print(f"\n{config.REFERENCE_PROPERTY}:")
        print(f"  Price/Night: R {ref_pricing['avg_price_per_night'].values[0]:,.2f}")
        print(f"  Occupancy: {ref_occupancy['occupancy_rate'].values[0]:.1f}%")
        
        # Room-level insights
        if not ref_room.empty:
            print(f"\n  Room Inventory:")
            print(f"    Total Room Types: {ref_room['avg_total_room_types'].values[0]:.1f}")
            print(f"    Available Rooms: {ref_room['avg_available_room_types'].values[0]:.1f}")
            print(f"    Room Occupancy: {ref_room['avg_room_occupancy_rate'].values[0]:.1f}%")
            
            if ref_room['avg_min_room_price'].values[0]:
                print(f"  Room Pricing:")
                print(f"    Min Room Price: R {ref_room['avg_min_room_price'].values[0]:,.2f}")
                print(f"    Max Room Price: R {ref_room['avg_max_room_price'].values[0]:,.2f}")
                print(f"    Avg Room Price: R {ref_room['avg_room_price'].values[0]:,.2f}")
                print(f"    Price Spread: {ref_room['room_price_spread_pct'].values[0]:.1f}%")

    if not comparison.empty:
        print(f"\nMarket Position:")
        cheaper = len(comparison[comparison['price_vs_ref'] < 0])
        expensive = len(comparison[comparison['price_vs_ref'] > 0])
        print(f"  {cheaper} competitors cheaper | {expensive} more expensive")
    
    # Room inventory insights summary
    if not room_inventory.empty:
        print(f"\nRoom Inventory Intelligence:")
        print(f"  Properties with room data: {len(room_inventory)}")
        
        # High occupancy properties
        high_occ = room_inventory[room_inventory['avg_room_occupancy_rate'] > 70]
        if len(high_occ) > 0:
            print(f"  High room occupancy (>70%): {len(high_occ)} properties")
            for _, prop in high_occ.head(3).iterrows():
                print(f"    - {prop['hotel_name']}: {prop['avg_room_occupancy_rate']:.1f}% occupancy")
        
        # Wide price spread (tiered pricing)
        tiered = room_inventory[room_inventory['uses_room_tiering'] == True]
        if len(tiered) > 0:
            print(f"  Using tiered pricing (>50% price spread): {len(tiered)} properties")

    print("\n" + "="*70)
    print("Analysis complete!")
    print("="*70)


if __name__ == "__main__":
    main()