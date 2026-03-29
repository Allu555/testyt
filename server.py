from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import logging
import os
import re
from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

# Load environment variables
load_dotenv()

def get_hq_thumbnail(url):
    """Upscale YouTube Music thumbnail URL to high resolution (544x544)."""
    if not url:
        return ""
    # Replace w{N}-h{N} patterns with larger size
    url = re.sub(r'w\d+-h\d+', 'w544-h544', url)
    # Also handle =w{N}-h{N} style params
    url = re.sub(r'=w\d+-h\d+', '=w544-h544', url)
    return url

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Allow CORS for the local dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize YTMusic
# In a real app, you might want to provide headers for authenticated requests,
# but for search, unauthenticated usually works fine.
try:
    yt = YTMusic()
    logger.info("YTMusic initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize YTMusic: {e}")
    yt = None

@app.get("/search")
async def search(q: str = Query(...), limit: int = 20):
    if not yt:
        raise HTTPException(status_code=500, detail="YTMusic not initialized")
    
    try:
        logger.info(f"Searching for: {q}")
        # Search for songs
        results = yt.search(q, filter="songs", limit=limit)
        
        # Map to the format expected by the frontend
        # Front-end expects: { id, title, channelTitle, thumbnail }
        mapped_results = []
        for item in results:
            # ytmusicapi search results for 'songs' usually have 'videoId', 'title', 'artists', 'thumbnails'
            video_id = item.get("videoId")
            if not video_id:
                continue
                
            artists = item.get("artists", [])
            artist_names = [a.get("name") for a in artists if a.get("name")]
            channel_title = ", ".join(artist_names) if artist_names else "Unknown Artist"
            
            thumbnails = item.get("thumbnails", [])
            thumbnail_url = get_hq_thumbnail(thumbnails[-1].get("url")) if thumbnails else ""
            
            mapped_results.append({
                "id": video_id,
                "title": item.get("title", "Unknown Title"),
                "channelTitle": channel_title,
                "thumbnail": thumbnail_url
            })
        
        logger.info(f"Found {len(mapped_results)} results")
        return mapped_results
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "ytmusic": "initialized" if yt else "failed"}

@app.post("/api/import_spotify")
async def import_spotify(payload: dict):
    if not yt:
        raise HTTPException(status_code=500, detail="YTMusic not initialized")
    
    spotify_url = payload.get("url")
    if not spotify_url or "spotify.com/playlist" not in spotify_url:
        raise HTTPException(status_code=400, detail="Invalid Spotify playlist URL")
    
    client_id = os.getenv("SPOTIPY_CLIENT_ID")
    client_secret = os.getenv("SPOTIPY_CLIENT_SECRET")
    
    # If credentials exist, use official API
    if client_id and client_secret and client_id != "your_client_id_here":
        try:
            # Initialize spotipy
            auth_manager = SpotifyClientCredentials(client_id=client_id, client_secret=client_secret)
            sp = spotipy.Spotify(auth_manager=auth_manager)
            
            # Extract playlist ID
            match = re.search(r'playlist/([a-zA-Z0-9]+)', spotify_url)
            if not match:
                raise HTTPException(status_code=400, detail="Could not extract playlist ID")
            
            playlist_id = match.group(1)
            logger.info(f"Fetching Spotify playlist: {playlist_id}")
            
            # Fetch tracks
            playlist_info = sp.playlist(playlist_id, fields="name")
            playlist_metadata_title = playlist_info.get("name", "Imported Playlist")
            
            results = sp.playlist_tracks(playlist_id)
            tracks = results.get('items', [])
            
            while results['next']:
                results = sp.next(results)
                tracks.extend(results.get('items', []))
            
            logger.info(f"Spotipy: Found {len(tracks)} tracks. Searching YT Music concurrently...")
            from concurrent.futures import ThreadPoolExecutor
            
            def fetch_spotipy_track(item):
                track = item.get("track")
                if not track:
                    return None
                    
                track_name = track.get("name")
                artists = track.get("artists", [])
                artist_name = artists[0].get("name") if artists else ""
                
                search_query = f"{track_name} {artist_name}"
                try:
                    yt_results = yt.search(search_query, filter="songs", limit=1)
                    if yt_results:
                        yt_song = yt_results[0]
                        video_id = yt_song.get("videoId")
                        if video_id:
                            yt_artists = yt_song.get("artists", [])
                            yt_artist_names = [a.get("name") for a in yt_artists if a.get("name")]
                            channel_title = ", ".join(yt_artist_names) if yt_artist_names else artist_name
                            
                            thumbnails = yt_song.get("thumbnails", [])
                            thumbnail_url = get_hq_thumbnail(thumbnails[-1].get("url")) if thumbnails else ""
                            
                            return {
                                "id": video_id,
                                "title": yt_song.get("title", track_name),
                                "channelTitle": channel_title,
                                "thumbnail": thumbnail_url
                            }
                except Exception as e:
                    logger.error(f"Error searching for '{search_query}' (Spotipy): {e}")
                return None

            yt_tracks = []
            
            # Use smaller max_workers and slight sleep to avoid YouTube 429 limits
            import time
            def fetch_with_sleep(item):
                time.sleep(0.1)
                return fetch_spotipy_track(item)

            with ThreadPoolExecutor(max_workers=5) as executor:
                pool_results = list(executor.map(fetch_with_sleep, tracks))
                
            for res in pool_results:
                if res:
                    yt_tracks.append(res)
            
            return {
                "title": playlist_metadata_title,
                "tracks": yt_tracks
            }
        except Exception as e:
            logger.error(f"Error importing from Spotify API: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # Fallback: Extract exact track list from Spotify embed widget (No API keys needed)
    logger.info("Spotify API credentials missing. Attempting exact track extraction via embed...")
    try:
        import requests
        import json
        
        # We need the playlist ID for the embed URL
        match = re.search(r'playlist/([a-zA-Z0-9]+)', spotify_url)
        if not match:
            raise HTTPException(status_code=400, detail="Could not extract playlist ID")
            
        playlist_id = match.group(1)
        embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
        
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        res = requests.get(embed_url, headers=headers, timeout=10)
        
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail="Could not fetch Spotify embed metadata.")
            
        # Extract the NEXT_DATA JSON
        json_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', res.text)
        if not json_match:
             raise HTTPException(status_code=500, detail="Could not parse Spotify embed data.")
             
        data = json.loads(json_match.group(1))
        entity = data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
        track_list_raw = entity.get("trackList", [])
        playlist_title = entity.get("name", "Imported Playlist")
        
        if not track_list_raw:
             raise HTTPException(status_code=404, detail="No tracks found in this playlist.")
             
        logger.info(f"Fallback: Found {len(track_list_raw)} tracks from embed. Searching YT Music concurrently...")
        
        from concurrent.futures import ThreadPoolExecutor
        
        def fetch_yt_track(track):
            track_name = track.get("title", "")
            artist_name = track.get("subtitle", "")
            if not track_name:
                return None
                
            search_query = f"{track_name} {artist_name}"
            # Clean up weird spaces some times present in embed like non-breaking spaces
            search_query = search_query.replace('\xa0', ' ').replace('&amp;', '&')
            
            try:
                yt_results = yt.search(search_query, filter="songs", limit=1)
                
                if yt_results:
                    yt_song = yt_results[0]
                    video_id = yt_song.get("videoId")
                    if video_id:
                        yt_artists = yt_song.get("artists", [])
                        yt_artist_names = [a.get("name") for a in yt_artists if a.get("name")]
                        channel_title = ", ".join(yt_artist_names) if yt_artist_names else artist_name
                        
                        thumbnails = yt_song.get("thumbnails", [])
                        thumbnail_url = get_hq_thumbnail(thumbnails[-1].get("url")) if thumbnails else ""
                        
                        return {
                            "id": video_id,
                            "title": yt_song.get("title", track_name),
                            "channelTitle": channel_title,
                            "thumbnail": thumbnail_url
                        }
            except Exception as e:
                logger.error(f"Error searching for '{search_query}': {e}")
            return None

        yt_tracks = []
        import time
        def fetch_with_sleep_fallback(track):
            time.sleep(0.1)
            return fetch_yt_track(track)

        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(fetch_with_sleep_fallback, track_list_raw))
            
        for res in results:
            if res:
                yt_tracks.append(res)
                    
        return {
            "title": playlist_title,
            "tracks": yt_tracks
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in Spotify fallback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files (CSS and JS) from the public/ folder
app.mount("/css", StaticFiles(directory="public/css"), name="css")
app.mount("/js", StaticFiles(directory="public/js"), name="js")

# Serve the index.html from the public/ folder
@app.get("/")
async def read_index():
    return FileResponse("public/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
