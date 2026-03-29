import requests
import json
import re

url = "https://open.spotify.com/embed/playlist/6HDoiVzC2tzK7ZZik0Kfip"
headers = {"User-Agent": "Mozilla/5.0"}
res = requests.get(url, headers=headers)
json_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', res.text)
data = json.loads(json_match.group(1))
entity = data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
track_list = entity.get("trackList", [])

if track_list:
    import pprint
    print("First track:")
    pprint.pprint(track_list[0])
