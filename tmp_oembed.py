import requests
url = "https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/6HDoiVzC2tzK7ZZik0Kfip"
res = requests.get(url)
print(res.status_code)
print(res.json())
