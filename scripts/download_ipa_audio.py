import os
import requests
from bs4 import BeautifulSoup
import time
import hashlib
import random
import json

URL = "https://commons.wikimedia.org/wiki/General_phonetics"
OUTPUT_DIR = "/Users/umitcanevleksiz/Documents/Programming/senior/app/public/ipa/sounds"
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://commons.wikimedia.org/wiki/General_phonetics",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
}

def get_soup(url):
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return BeautifulSoup(r.text, 'html.parser')

def get_wikimedia_url(filename):
    filename = filename.replace(" ", "_").replace("?", "%3F")
    md5_hash = hashlib.md5(filename.encode('utf-8')).hexdigest()
    part1 = md5_hash[0]
    part2 = md5_hash[0:2]
    return f"https://upload.wikimedia.org/wikipedia/commons/{part1}/{part2}/{filename}"

def download_file(filename, output_path):
    file_url = get_wikimedia_url(filename)
    max_retries = 5
    base_delay = 5
    
    for attempt in range(max_retries):
        try:
            r = requests.get(file_url, headers=HEADERS, stream=True)
            if r.status_code == 429:
                wait_time = base_delay * (attempt + 1) + random.uniform(0, 2)
                print(f"Rate limited (429). Waiting {wait_time:.1f}s...")
                time.sleep(wait_time)
                continue
            
            if r.status_code == 404:
                return False

            r.raise_for_status()
            with open(output_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        except Exception as e:
            print(f"Error {filename}: {e}")
            time.sleep(2)
    return False

def main():
    print(f"Scanning {URL}...")
    try:
        soup = get_soup(URL)
    except:
        print("Failed to load page")
        return

    links = soup.find_all('a', href=True)
    existing_files = set(os.listdir(OUTPUT_DIR))
    downloaded_map = {}
    
    tasks = []
    seen = set()
    
    for link in links:
        href = link['href']
        text = link.get_text().strip()
        title = link.get('title', '')
        
        if "Blank vowel trapezoid" in title or "Blank_vowel_trapezoid" in title:
             img_out = os.path.join(OUTPUT_DIR, "../", "Blank_vowel_trapezoid.png")
             if not os.path.exists(img_out):
                 download_file("Blank_vowel_trapezoid.png", img_out)

        if not href.startswith('/wiki/File:'): continue
        if len(text) > 3 or len(text) == 0: continue
        
        filename = title.replace('File:', '')
        safe_text = text.replace('/', '_')
        ext = os.path.splitext(filename)[1] or ".ogg"
        out_name = f"{safe_text}{ext}"
        
        if text not in seen:
            tasks.append((text, filename, out_name))
            seen.add(text)
            
    print(f"Found {len(tasks)} symbols.")
    
    count = 0
    for text, filename, out_name in tasks:
        out_path = os.path.join(OUTPUT_DIR, out_name)
        
        if out_name in existing_files:
            downloaded_map[text] = out_name
            continue
            
        success = download_file(filename, out_path)
        if success:
            downloaded_map[text] = out_name
            print(f"Downloaded {text}")
            count += 1
            time.sleep(1) # Slower and safer
        else:
            print(f"Failed {text}")
            
    # Save map
    map_path = os.path.join(OUTPUT_DIR, "../ipa_map.json")
    with open(map_path, 'w') as f:
        json.dump(downloaded_map, f, indent=2)

if __name__ == "__main__":
    main()
