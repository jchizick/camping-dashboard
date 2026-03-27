import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), '../camping-dashboard/.env.local'))

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not url or not key:
    raise ValueError("Missing Supabase credentials in .env.local")

supabase: Client = create_client(url, key)

TRIP_ID = 'trip-maple-lake-001'
ALERTS_URL = 'https://www.ontarioparks.ca/park/algonquin/backcountry/alerts'

def scrape_and_push():
    print(f"Scraping Algonquin alerts from {ALERTS_URL}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
    }
    response = requests.get(ALERTS_URL, headers=headers)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'lxml' if 'lxml' in response.text else 'html.parser')
    
    # Grab the main page content
    main_div = soup.find('main') or soup.body
    text = main_div.get_text(separator=' ', strip=True) if main_div else ''
    
    # Try to extract something useful. Without exact class names, just give a summary.
    text_sample = text[:250] + ("..." if len(text) > 250 else "")
    
    if "No active" in text_sample or text == "":
        text_sample = "Currently checking. Please see Ontario Parks site for full details."
        severity = 'info'
    else:
        severity = 'warning'
        
    alert_data = {
        'trip_id': TRIP_ID,
        'title': 'Ontario Parks: Algonquin Backcountry',
        'body': text_sample,
        'severity': severity,
        'source': 'Ontario Parks',
        'is_active': True,
        'created_at': datetime.utcnow().isoformat()
    }
    
    print("Deleting old alerts for source 'Ontario Parks'...")
    supabase.table('alerts').delete().eq('trip_id', TRIP_ID).eq('source', 'Ontario Parks').execute()
    
    print("Inserting into Supabase:", alert_data)
    result = supabase.table('alerts').insert(alert_data).execute()
    print("Done.")

if __name__ == '__main__':
    scrape_and_push()
