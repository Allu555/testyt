import requests
import re
import json

url = "https://open.spotify.com/embed/playlist/6HDoiVzC2tzK7ZZik0Kfip"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
resp = requests.get(url, headers=headers)

match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', resp.text)
if match:
    data = json.loads(match.group(1))
    track_list = data["props"]["pageProps"]["state"]["data"]["entity"]["trackList"]
    print(f"Extracted {len(track_list)} tracks exact!")
    for t in track_list[:5]:
        print(f"- {t.get('title')} by {t.get('subtitle')}")
else:
    print("Could not find __NEXT_DATA__ script.")
