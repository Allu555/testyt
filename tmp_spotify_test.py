import requests
import re
import json

url = "https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF"
headers = {"User-Agent": "Mozilla/5.0"}
resp = requests.get(url, headers=headers)

if resp.status_code == 200:
    print("Fetched successfully. Length:", len(resp.text))
    # Look for any JSON-like structures that might contain tracks
    matches = re.findall(r'<script.*?>(\{.*?\})</script>', resp.text, re.DOTALL)
    print("Found JSON scripts:", len(matches))
    for m in matches:
        if 'Spotify.Entity' in m or 'trackList' in m.lower():
            print("Found potential tracklist in script of length:", len(m))
            print(m[:200])
else:
    print(f"Failed to fetch: {resp.status_code}")
