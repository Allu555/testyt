import requests
print("Testing /api/search...")
try:
    res1 = requests.get('https://testyt1.netlify.app/api/search?q=Pehle%20Bhi%20Main', timeout=15)
    print("Search status:", res1.status_code)
    print("Search length:", len(res1.text))
    if res1.status_code != 200:
        print("Search text:", res1.text[:200])
except Exception as e:
    print("Search Error:", e)

print("\nTesting /api/import_spotify...")
try:
    res2 = requests.post('https://testyt1.netlify.app/api/import_spotify', json={'url': 'https://open.spotify.com/playlist/6HDoiVzC2tzK7ZZik0Kfip'}, timeout=15)
    print("Import status:", res2.status_code)
    if res2.status_code != 200:
        print("Import text:", res2.text[:200])
except Exception as e:
    print("Import Error:", e)
