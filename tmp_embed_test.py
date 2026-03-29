import requests
import re
import json

url = "https://open.spotify.com/embed/playlist/6HDoiVzC2tzK7ZZik0Kfip"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
resp = requests.get(url, headers=headers)

print("Status:", resp.status_code)
# The embed page usually has a script tag with id="resource" or similar containing the JSON
matches = re.findall(r'<script.*?id="resource".*?>(.*?)</script>', resp.text, re.DOTALL)
if not matches:
    matches = re.findall(r'<script.*?>(\{.*?\})</script>', resp.text, re.DOTALL)

for m in matches:
    try:
        data = json.loads(m.strip())
        if 'tracks' in data or 'entity' in data:
            print("Found valid JSON!")
            print(json.dumps(data)[:500])
            break
    except:
        pass
else:
    print("Could not find JSON data in embed page. Saving HTML to tmp_embed.html")
    with open("tmp_embed.html", "w", encoding="utf-8") as f:
        f.write(resp.text)
