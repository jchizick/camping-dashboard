import os
import requests
import xml.etree.ElementTree as ET
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), '../camping-dashboard/.env.local'))

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

TRIP_ID = 'trip-maple-lake-001'
FEED_URL = 'https://weather.gc.ca/rss/battleboard/onrm31_e.xml'

def scrape_weather_alerts():
    print(f"Fetching ATOM feed from {FEED_URL}...")
    response = requests.get(FEED_URL)
    response.raise_for_status()
    
    root = ET.fromstring(response.content)
    namespace = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', namespace)
    if not entries:
        entries = root.findall('entry')
        
    if not entries:
        print("No entries found in feed.")
        return
        
    entry = entries[0]
    
    title_elem = entry.find('atom:title', namespace) if entry.find('atom:title', namespace) is not None else entry.find('title')
    summary_elem = entry.find('atom:summary', namespace) if entry.find('atom:summary', namespace) is not None else entry.find('summary')
    
    title = title_elem.text if title_elem is not None else 'Weather Update'
    summary = summary_elem.text if summary_elem is not None else 'No details provided.'
    
    severity = 'info'
    if 'No alerts in effect' in title or 'No alerts in effect' in summary:
        severity = 'info'
    elif 'warning' in title.lower():
        severity = 'critical'
    elif 'watch' in title.lower() or 'statement' in title.lower():
        severity = 'warning'

    alert_data = {
        'trip_id': TRIP_ID,
        'title': 'Environment Canada',
        'body': title,
        'severity': severity,
        'source': 'Environment Canada',
        'is_active': True,
        'created_at': datetime.utcnow().isoformat()
    }
    
    print("Deleting old alerts for source 'Environment Canada'...")
    supabase.table('alerts').delete().eq('trip_id', TRIP_ID).eq('source', 'Environment Canada').execute()
    
    print("Inserting into Supabase:", alert_data)
    result = supabase.table('alerts').insert(alert_data).execute()
    print("Done.")

if __name__ == '__main__':
    scrape_weather_alerts()
