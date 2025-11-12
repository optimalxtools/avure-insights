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
        hotel_df = df[df['hotel_name'] == hotel].sort_values('check_in_date')

        total_checks = len(hotel_df)
        available_checks = hotel_df['is_available'].sum()
        sold_out_checks = hotel_df['is_sold_out'].sum()

        room_samples = []
        current_total_rooms = None

        for row in hotel_df.itertuples():
            total_rooms_raw = getattr(row, 'total_room_types', None)
            available_rooms_raw = getattr(row, 'available_room_types', None)

            if total_rooms_raw is not None and not pd.isna(total_rooms_raw) and total_rooms_raw > 0:
                current_total_rooms = float(total_rooms_raw)

            total_rooms = None
            if total_rooms_raw is not None and not pd.isna(total_rooms_raw) and total_rooms_raw > 0:
                total_rooms = float(total_rooms_raw)
            elif current_total_rooms is not None:
                total_rooms = float(current_total_rooms)

            available_rooms = None
            if available_rooms_raw is not None and not pd.isna(available_rooms_raw):
                available_rooms = float(available_rooms_raw)
            elif getattr(row, 'availability', '') == 'sold_out':
                available_rooms = 0.0
            elif total_rooms is not None:
                available_rooms = float(total_rooms)

            if total_rooms is None and available_rooms is None:
                # No usable signal for this row
                continue

            room_samples.append({
                'total_raw': float(total_rooms_raw) if total_rooms_raw is not None and not pd.isna(total_rooms_raw) else None,
                'total': total_rooms,
                'available': available_rooms,
            })

        totals_observed = [sample['total_raw'] for sample in room_samples if sample['total_raw'] is not None]
        room_type_estimate = float(max(totals_observed)) if totals_observed else None

        available_values = []
        sold_values = []
        occupancy_values = []

        for sample in room_samples:
            total_for_calc = room_type_estimate if room_type_estimate is not None else sample['total']
            if total_for_calc is None or total_for_calc <= 0:
                continue

            available = sample['available']
            if available is None:
                continue

            total_for_calc = float(total_for_calc)
            available = float(available)

            if room_type_estimate is not None:
                available = min(max(available, 0.0), room_type_estimate)
                total_for_calc = room_type_estimate
            else:
                available = min(max(available, 0.0), total_for_calc)

            sold = max(total_for_calc - available, 0.0)

            available_values.append(available)
            sold_values.append(sold)
            occupancy_values.append((sold / total_for_calc) * 100 if total_for_calc > 0 else 0.0)

        total_values_for_avg = [sample['total'] for sample in room_samples if sample['total'] is not None]

        if room_type_estimate is not None:
            avg_total_rooms = room_type_estimate
        else:
            avg_total_rooms = float(np.mean(total_values_for_avg)) if total_values_for_avg else 0.0

        avg_available_rooms = float(np.mean(available_values)) if available_values else 0.0
        avg_sold_out_rooms = float(np.mean(sold_values)) if sold_values else 0.0
        avg_room_occupancy = float(np.mean(occupancy_values)) if occupancy_values else 0.0

        property_occ_rate = (sold_out_checks / total_checks * 100) if total_checks > 0 else 0
        has_room_signal = bool(room_type_estimate is not None and room_type_estimate > 1 and occupancy_values)

        preferred_occupancy_rate = avg_room_occupancy if has_room_signal and avg_room_occupancy > 0 else property_occ_rate
        preferred_occupancy_source = 'room' if has_room_signal and avg_room_occupancy > 0 else 'property'

        metrics.append({
            'hotel_name': hotel,
            'total_checks': total_checks,
            'available': int(available_checks),
            'sold_out': int(sold_out_checks),
            'occupancy_rate': property_occ_rate,
            'availability_rate': (available_checks / total_checks * 100) if total_checks > 0 else 0,
            # Preferred & property-level context
            'preferred_occupancy_rate': preferred_occupancy_rate,
            'preferred_occupancy_source': preferred_occupancy_source,
            'property_occupancy_rate': property_occ_rate,
            'room_type_count_estimate': room_type_estimate,
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

    def as_per_night(row, key):
        value = row.get(key)
        if pd.isna(value):
            return np.nan
        nights = row.get('nights')
        if pd.notna(nights) and nights > 0:
            return float(value) / float(nights)
        price_per_night = row.get('price_per_night')
        if pd.notna(price_per_night):
            return float(price_per_night)
        return float(value)

    for hotel in df['hotel_name'].unique():
        hotel_df = df_priced[df_priced['hotel_name'] == hotel]

        if len(hotel_df) == 0:
            continue

        # Room-level pricing (where available)
        room_priced = hotel_df[hotel_df['min_room_price'].notna()].copy()
        if len(room_priced) > 0:
            room_priced['min_room_price_per_night'] = room_priced.apply(lambda row: as_per_night(row, 'min_room_price'), axis=1)
            room_priced['max_room_price_per_night'] = room_priced.apply(lambda row: as_per_night(row, 'max_room_price'), axis=1)
            room_priced['avg_room_price_per_night'] = room_priced.apply(lambda row: as_per_night(row, 'avg_room_price'), axis=1)
            # Fallback if avg reported as NaN but min/max exist
            if room_priced['avg_room_price_per_night'].isna().all():
                room_priced['avg_room_price_per_night'] = (room_priced['min_room_price_per_night'] + room_priced['max_room_price_per_night']) / 2
        property_avg_price = hotel_df['price_per_night'].mean()
        property_min_price = hotel_df['price_per_night'].min()
        property_max_price = hotel_df['price_per_night'].max()
        property_price_range = property_max_price - property_min_price if pd.notna(property_min_price) and pd.notna(property_max_price) else None

        avg_min_room_price = room_priced['min_room_price_per_night'].mean() if len(room_priced) > 0 else None
        avg_max_room_price = room_priced['max_room_price_per_night'].mean() if len(room_priced) > 0 else None
        avg_room_price_avg = room_priced['avg_room_price_per_night'].mean() if len(room_priced) > 0 else None
        room_price_range = (room_priced['max_room_price_per_night'].mean() - room_priced['min_room_price_per_night'].mean()) if len(room_priced) > 0 else None

        room_type_counts = hotel_df['total_room_types'].dropna() if 'total_room_types' in hotel_df.columns else pd.Series(dtype=float)
        room_type_estimate = float(room_type_counts.max()) if len(room_type_counts) > 0 else None
        has_room_signal = len(room_priced) > 0 and avg_room_price_avg is not None and not np.isnan(avg_room_price_avg) and room_type_estimate is not None and room_type_estimate > 1

        if has_room_signal:
            preferred_price = float(avg_room_price_avg)
            preferred_source = 'room'
            preferred_range = (avg_max_room_price - avg_min_room_price) if avg_min_room_price is not None and avg_max_room_price is not None else room_price_range
        else:
            preferred_price = float(property_avg_price) if pd.notna(property_avg_price) else None
            preferred_source = 'property'
            preferred_range = property_price_range

        metrics.append({
            'hotel_name': hotel,
            'avg_price_per_night': property_avg_price,
            'min_price': property_min_price,
            'max_price': property_max_price,
            'median_price': hotel_df['price_per_night'].median(),
            'std_price': hotel_df['price_per_night'].std(),
            'discount_frequency': (hotel_df['has_discount'].sum() / len(hotel_df) * 100),
            'avg_discount': hotel_df[hotel_df['has_discount'] == True]['discount_percentage'].mean(),
            'avg_rating': hotel_df['rating_score'].mean(),
            'sample_size': len(hotel_df),
            # Preferred & property-level context
            'preferred_price_per_night': preferred_price,
            'preferred_price_source': preferred_source,
            'preferred_price_range': preferred_range,
            'property_avg_price_per_night': property_avg_price,
            'property_min_price': property_min_price,
            'property_max_price': property_max_price,
            'room_type_count_estimate': room_type_estimate,
            # Room-level pricing insights
            'avg_min_room_price': avg_min_room_price,
            'avg_max_room_price': avg_max_room_price,
            'avg_room_price_avg': avg_room_price_avg,
            'room_price_range': room_price_range,
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

    ref_price_series = ref_pricing['preferred_price_per_night'] if 'preferred_price_per_night' in ref_pricing.columns else pd.Series([np.nan])
    ref_price = ref_price_series.values[0] if pd.notna(ref_price_series.values[0]) else ref_pricing['avg_price_per_night'].values[0]
    ref_property_price = ref_pricing['property_avg_price_per_night'].values[0] if 'property_avg_price_per_night' in ref_pricing.columns and pd.notna(ref_pricing['property_avg_price_per_night'].values[0]) else ref_price

    ref_occ_series = ref_occupancy['preferred_occupancy_rate'] if 'preferred_occupancy_rate' in ref_occupancy.columns else ref_occupancy['occupancy_rate']
    ref_occ = ref_occ_series.values[0]
    ref_property_occ = ref_occupancy['property_occupancy_rate'].values[0] if 'property_occupancy_rate' in ref_occupancy.columns and pd.notna(ref_occupancy['property_occupancy_rate'].values[0]) else ref_occ

    ref_room_price = None
    if 'avg_room_price_avg' in ref_pricing.columns and pd.notna(ref_pricing['avg_room_price_avg'].values[0]):
        ref_room_price = ref_pricing['avg_room_price_avg'].values[0]
    ref_room_occ = None
    if 'avg_room_occupancy_rate' in ref_occupancy.columns and pd.notna(ref_occupancy['avg_room_occupancy_rate'].values[0]):
        ref_room_occ = ref_occupancy['avg_room_occupancy_rate'].values[0]

    comparisons = []

    for _, row in pricing_df.iterrows():
        hotel = row['hotel_name']

        if hotel == ref:
            continue

        occ_row = occupancy_df[occupancy_df['hotel_name'] == hotel]
        if occ_row.empty:
            continue

        preferred_price = row.get('preferred_price_per_night', np.nan)
        if pd.isna(preferred_price):
            preferred_price = row.get('avg_price_per_night', np.nan)
        property_price = row.get('property_avg_price_per_night', preferred_price)
        if pd.isna(property_price):
            property_price = preferred_price
        price_diff = preferred_price - ref_price
        price_diff_pct = (price_diff / ref_price * 100) if ref_price > 0 else 0

        property_price_diff = property_price - ref_property_price if ref_property_price else None
        property_price_diff_pct = (property_price_diff / ref_property_price * 100) if property_price_diff is not None and ref_property_price else None

        preferred_occ = occ_row['preferred_occupancy_rate'].values[0] if 'preferred_occupancy_rate' in occ_row.columns else occ_row['occupancy_rate'].values[0]
        property_occ = occ_row['property_occupancy_rate'].values[0] if 'property_occupancy_rate' in occ_row.columns and pd.notna(occ_row['property_occupancy_rate'].values[0]) else occ_row['occupancy_rate'].values[0]
        if pd.isna(property_occ):
            property_occ = preferred_occ
        occ_diff = preferred_occ - ref_occ
        property_occ_diff = property_occ - ref_property_occ if ref_property_occ is not None else None

        room_price = None
        room_price_diff = None
        room_price_diff_pct = None
        if 'avg_room_price_avg' in pricing_df.columns and pd.notna(row.get('avg_room_price_avg')) and ref_room_price is not None:
            room_price = row['avg_room_price_avg']
            room_price_diff = room_price - ref_room_price
            room_price_diff_pct = (room_price_diff / ref_room_price * 100) if ref_room_price > 0 else 0

        room_occ = None
        room_occ_diff = None
        if 'avg_room_occupancy_rate' in occ_row.columns and pd.notna(occ_row['avg_room_occupancy_rate'].values[0]) and ref_room_occ is not None:
            room_occ = occ_row['avg_room_occupancy_rate'].values[0]
            room_occ_diff = room_occ - ref_room_occ

        comparisons.append({
            'hotel_name': hotel,
            'avg_price': preferred_price,
            'price_vs_ref': price_diff,
            'price_vs_ref_pct': price_diff_pct,
            'preferred_price_vs_ref': price_diff,
            'preferred_price_vs_ref_pct': price_diff_pct,
            'property_avg_price': property_price,
            'property_price_vs_ref': property_price_diff,
            'property_price_vs_ref_pct': property_price_diff_pct,
            'occupancy': preferred_occ,
            'occ_vs_ref': occ_diff,
            'preferred_occ_vs_ref': occ_diff,
            'property_occupancy': property_occ,
            'property_occ_vs_ref': property_occ_diff,
            'position': 'Higher Price' if price_diff > 0 else 'Lower Price',
            'demand': 'Higher Demand' if occ_diff > 0 else 'Lower Demand',
            'room_avg_price': room_price,
            'room_price_vs_ref': room_price_diff,
            'room_price_vs_ref_pct': room_price_diff_pct,
            'room_occupancy': room_occ,
            'room_occ_vs_ref': room_occ_diff,
            'preferred_price_source': row.get('preferred_price_source', 'property'),
            'preferred_occupancy_source': occ_row['preferred_occupancy_source'].values[0] if 'preferred_occupancy_source' in occ_row.columns else 'property',
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
    if df.empty:
        return pd.DataFrame()

    analysis = []

    for hotel in df['hotel_name'].unique():
        hotel_data = df[df['hotel_name'] == hotel].sort_values('check_in_date')

        room_samples = []
        current_total_rooms = None

        for row in hotel_data.itertuples():
            total_rooms = getattr(row, 'total_room_types', None)
            available_rooms = getattr(row, 'available_room_types', None)

            if total_rooms and total_rooms > 0:
                current_total_rooms = total_rooms
            elif current_total_rooms:
                total_rooms = current_total_rooms
            else:
                # No room information available yet for this property
                continue

            if available_rooms is None or pd.isna(available_rooms):
                available_rooms = 0 if getattr(row, 'availability', '') == 'sold_out' else total_rooms

            sold_out_rooms = max(total_rooms - available_rooms, 0)
            occupancy_pct = (sold_out_rooms / total_rooms * 100) if total_rooms else 0
            nights = getattr(row, 'nights', None)

            def normalise_price(value):
                if value is None or pd.isna(value):
                    return None
                if nights and not pd.isna(nights) and nights > 0:
                    return float(value) / float(nights)
                price_per_night = getattr(row, 'price_per_night', None)
                if price_per_night is not None and not pd.isna(price_per_night):
                    return float(price_per_night)
                return float(value)

            room_samples.append({
                'total': total_rooms,
                'available': available_rooms,
                'sold_out': sold_out_rooms,
                'occupancy_pct': occupancy_pct,
                'min_price': normalise_price(getattr(row, 'min_room_price', None)),
                'max_price': normalise_price(getattr(row, 'max_room_price', None)),
                'avg_price': normalise_price(getattr(row, 'avg_room_price', None)),
            })

        if not room_samples:
            continue

        totals = [sample['total'] for sample in room_samples if sample['total'] is not None]
        available_values = [sample['available'] for sample in room_samples if sample['available'] is not None]
        sold_values = [sample['sold_out'] for sample in room_samples if sample['sold_out'] is not None]
        occupancy_values = [sample['occupancy_pct'] for sample in room_samples]

        avg_total = float(np.mean(totals)) if totals else 0.0
        avg_available = float(np.mean(available_values)) if available_values else 0.0
        avg_sold_out = float(np.mean(sold_values)) if sold_values else 0.0
        avg_room_occupancy = float(np.mean(occupancy_values)) if occupancy_values else 0.0
        max_total_rooms = max(totals) if totals else None

        priced_samples = [sample for sample in room_samples if sample['min_price'] is not None and sample['max_price'] is not None]
        if priced_samples:
            min_values = [sample['min_price'] for sample in priced_samples if sample['min_price'] is not None]
            max_values = [sample['max_price'] for sample in priced_samples if sample['max_price'] is not None]
            avg_values = [sample['avg_price'] for sample in priced_samples if sample['avg_price'] is not None]

            avg_min = float(np.mean(min_values)) if min_values else None
            avg_max = float(np.mean(max_values)) if max_values else None
            if avg_values:
                avg_avg = float(np.mean(avg_values))
            elif min_values and max_values:
                avg_avg = float(np.mean([(mn + mx) / 2 for mn, mx in zip(min_values, max_values)]))
            elif min_values:
                avg_avg = float(np.mean(min_values))
            else:
                avg_avg = None

            if avg_min is not None and avg_max is not None:
                price_spread = avg_max - avg_min
                price_spread_pct = (price_spread / avg_min * 100) if avg_min > 0 else 0.0
            else:
                price_spread = None
                price_spread_pct = None
        else:
            avg_min = None
            avg_max = None
            avg_avg = None
            price_spread = None
            price_spread_pct = None

        analysis.append({
            'hotel_name': hotel,
            'avg_total_room_types': avg_total,
            'avg_available_room_types': avg_available,
            'avg_sold_out_room_types': avg_sold_out,
            'avg_room_occupancy_rate': avg_room_occupancy,
            'low_inventory_pct': avg_room_occupancy,
            'avg_min_room_price': avg_min,
            'avg_max_room_price': avg_max,
            'avg_room_price': avg_avg,
            'room_price_spread': price_spread,
            'room_price_spread_pct': price_spread_pct,
            'uses_room_tiering': bool(price_spread_pct and price_spread_pct > 50),
            'sample_size': len(room_samples),
            'room_type_count_estimate': float(max_total_rooms) if max_total_rooms is not None else None,
        })

    if not analysis:
        return pd.DataFrame()

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