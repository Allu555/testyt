import ytmusicapi
import collections
yt = ytmusicapi.YTMusic()
from concurrent.futures import ThreadPoolExecutor

track_list_raw = [{"title": "Habibi Drip", "subtitle": "Dabzee"}, {"title": "Test1", "subtitle": "TestArtist1"}, {"title": "Test2", "subtitle": "TestArtist2"}]

def fetch_yt_track(track):
    track_name = track.get("title", "")
    artist_name = track.get("subtitle", "")
    search_query = f"{track_name} {artist_name}"
    try:
        yt_results = yt.search(search_query, filter="songs", limit=1)
        if yt_results:
            return yt_results[0].get("title")
    except Exception as e:
        print(f"Error searching {search_query}: {e}")
    return None

with ThreadPoolExecutor(max_workers=20) as executor:
    results = list(executor.map(fetch_yt_track, track_list_raw))
    print(results)
