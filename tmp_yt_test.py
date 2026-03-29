from ytmusicapi import YTMusic
yt = YTMusic()
query = "Hindi"
print(f"Searching ytmusic for playlists matching: {query}")
results = yt.search(query, filter="playlists", limit=1)
if results:
    playlist_id = results[0]['browseId']
    print(f"Found playlist: {results[0]['title']} (ID: {playlist_id})")
    tracks = yt.get_playlist(playlist_id, limit=20)
    print(f"Extracted {len(tracks['tracks'])} tracks")
    for t in tracks['tracks'][:3]:
        print(f"- {t['title']} by {t['artists'][0]['name']}")
else:
    print("No playlists found")
