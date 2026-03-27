import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../camping-dashboard/.env.local'))

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

TRIP_ID = 'trip-maple-lake-001'

def clear_alerts():
    print("Fetching alerts to clear...")
    response = supabase.table('alerts').select('*').eq('trip_id', TRIP_ID).neq('source', 'manual').execute()
    data = response.data
    
    if not data:
        print("No non-manual alerts to clear.")
        return
        
    print(f"Found {len(data)} alerts to clear.")
    for row in data:
        supabase.table('alerts').delete().eq('id', row['id']).execute()
        print(f"Deleted: {row['title']}")
        
if __name__ == '__main__':
    clear_alerts()
    print("Done clearing alerts.")
