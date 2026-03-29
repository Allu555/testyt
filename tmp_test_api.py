import requests
import json

url = "http://127.0.0.1:8000/api/import_spotify"
headers = {"Content-Type": "application/json"}
data = {"url": "https://open.spotify.com/playlist/6HDoiVzC2tzK7ZZik0Kfip?si=47f1c423528a47d7"}

print("Sending POST request to", url)
try:
    resp = requests.post(url, headers=headers, json=data)
    print("Status Code:", resp.status_code)
    try:
        print("Response JSON:", json.dumps(resp.json(), indent=2)[:500])
    except:
        print("Response Text:", resp.text[:500])
except Exception as e:
    print("Error:", str(e))
