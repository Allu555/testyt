import requests

# 1. Get anonymous token
token_url = "https://open.spotify.com/get_access_token?reason=transport&productType=web_player"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
resp = requests.get(token_url, headers=headers)
if resp.status_code == 200:
    token_info = resp.json()
    access_token = token_info.get("accessToken")
    print("Got access token:", access_token[:10], "...")
    
    # 2. Get playlist
    playlist_id = "37i9dQZEVXbMDoHDwVN2tF"
    api_url = f"https://api.spotify.com/v1/playlists/{playlist_id}"
    api_headers = {"Authorization": f"Bearer {access_token}"}
    p_resp = requests.get(api_url, headers=api_headers)
    if p_resp.status_code == 200:
        data = p_resp.json()
        print("Playlist Name:", data.get("name"))
        tracks = data.get("tracks", {}).get("items", [])
        print("Total tracks:", len(tracks))
        for item in tracks[:3]:
            track = item.get("track")
            if track:
                print(f"- {track.get('name')} by {track.get('artists')[0].get('name')}")
    else:
        print("Failed to get playlist:", p_resp.status_code, p_resp.text)
else:
    print("Failed to get token:", resp.status_code)
