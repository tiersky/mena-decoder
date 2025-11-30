import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials in .env.local")
    exit(1)

supabase: Client = create_client(url, key)

def clean_row(row):
    """Convert row to dict and remove None values."""
    cleaned = {}
    for key, value in row.items():
        if pd.notna(value) and value != '':
            cleaned[key] = value
    return cleaned

def parse_date_ddmmyyyy(date_str):
    """Convert DD/MM/YYYY to YYYY-MM-DD format for database."""
    if pd.isna(date_str) or date_str == '':
        return None

    date_str = str(date_str).strip()

    # Match DD/MM/YYYY format (e.g., "01/04/2024" = April 1, 2024)
    import re
    match = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', date_str)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # If already in YYYY-MM-DD format, return as-is
    if re.match(r'^\d{4}-\d{2}-\d{2}', date_str):
        return date_str[:10]

    return date_str  # Return original if no match

def import_file(filename):
    print(f"\nImporting {filename}...")
    df = pd.read_csv(filename)

    # Fix date column: Convert DD/MM/YYYY to YYYY-MM-DD
    if 'date' in df.columns:
        print("Converting dates from DD/MM/YYYY to YYYY-MM-DD...")
        df['date'] = df['date'].apply(parse_date_ddmmyyyy)

        # Show sample dates for verification
        sample_dates = df['date'].dropna().unique()[:5]
        print(f"Sample converted dates: {list(sample_dates)}")

    print(f"Total rows: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    
    # Import in batches of 100
    batch_size = 100
    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i+batch_size]
        
        # Convert to list of dicts and clean
        records = [clean_row(row) for row in batch.to_dict('records')]
        
        try:
            result = supabase.table('unified_competitive_stats').insert(records, count='None', returning='minimal').execute()
            print(f".", end='', flush=True)
        except Exception as e:
            print(f"\nError at batch {i}: {e}")
            print(f"Sample record: {records[0] if records else 'empty'}")
            # Continue with next batch
            continue
    
    print(f"\nFinished importing {filename}")

def main():
    print("Clearing existing data...")
    try:
        # Delete all rows (this might fail if there's no data, that's okay)
        supabase.table('unified_competitive_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        print("Table cleared successfully")
    except Exception as e:
        print(f"Warning: Could not clear table (might be empty): {e}")
    
    # Import both files
    import_file('unified_overall.csv')
    import_file('unified_online.csv')
    
    # Verify
    print("\nVerifying import...")
    result = supabase.table('unified_competitive_stats').select('country', count='exact').execute()
    print(f"Total rows in database: {result.count}")
    
    # Get unique countries
    result = supabase.table('unified_competitive_stats').select('country').execute()
    countries = list(set([r['country'] for r in result.data if r.get('country')]))
    print(f"Unique countries: {sorted(countries)}")
    
    print("\nImport complete!")

if __name__ == "__main__":
    main()
