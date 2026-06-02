from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import logging
import os
import re
import json
import requests as http_requests
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

# ---------------------------------------------------------------------------
# Direct YouTube Music search (bypasses broken ytmusicapi v0.22.0)
# ---------------------------------------------------------------------------
YTM_BASE = "https://music.youtube.com"
YTM_SEARCH_EP = YTM_BASE + "/youtubei/v1/search"
YTM_PARAMS = {"prettyPrint": "false"}
YTM_CONTEXT = {
    "client": {
        "clientName": "WEB_REMIX",
        "clientVersion": "1.20231204.01.00",
        "hl": "en",
        "gl": "IN",
    }
}

def ytm_search(query, limit=20):
    """Search YouTube Music directly via their internal API."""
    payload = {
        "context": YTM_CONTEXT,
        "query": query,
        "params": "EgWKAQIIAWoOEAMQBBAJEAoQBRAREBU%3D",  # filter = songs
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": YTM_BASE,
        "Referer": YTM_BASE + "/",
    }
    resp = http_requests.post(YTM_SEARCH_EP, params=YTM_PARAMS,
                              headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    results = []
    try:
        tabs = data.get("contents", {}).get("tabbedSearchResultsRenderer", {}).get("tabs", [])
        if not tabs:
            # Alternate layout
            section_list = data.get("contents", {}).get("sectionListRenderer", {})
        else:
            section_list = tabs[0].get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {})

        for section in section_list.get("contents", []):
            shelf = section.get("musicShelfRenderer", {})
            for item in shelf.get("contents", []):
                flex_cols = item.get("musicResponsiveListItemRenderer", {}).get("flexColumns", [])
                if not flex_cols:
                    continue

                # Title from first column
                title_runs = flex_cols[0].get("musicResponsiveListItemFlexColumnRenderer", {}).get("text", {}).get("runs", [])
                title = title_runs[0].get("text", "") if title_runs else ""

                # Video ID from navigation endpoint
                video_id = None
                overlay = item.get("musicResponsiveListItemRenderer", {}).get("overlay", {})
                play_btn = overlay.get("musicItemThumbnailOverlayRenderer", {}).get("content", {}).get("musicPlayButtonRenderer", {})
                nav = play_btn.get("playNavigationEndpoint", {})
                video_id = nav.get("watchEndpoint", {}).get("videoId")
                
                if not video_id and title_runs:
                    nav2 = title_runs[0].get("navigationEndpoint", {})
                    video_id = nav2.get("watchEndpoint", {}).get("videoId")

                if not video_id:
                    continue

                # Artist from second column
                artist = "Unknown Artist"
                if len(flex_cols) > 1:
                    artist_runs = flex_cols[1].get("musicResponsiveListItemFlexColumnRenderer", {}).get("text", {}).get("runs", [])
                    artist_parts = [r.get("text", "") for r in artist_runs if r.get("text", "") not in ("•", " • ", " ")]
                    if artist_parts:
                        artist = artist_parts[0]

                # Thumbnail
                thumb = ""
                thumb_renderer = item.get("musicResponsiveListItemRenderer", {}).get("thumbnail", {}).get("musicThumbnailRenderer", {})
                thumbs = thumb_renderer.get("thumbnail", {}).get("thumbnails", [])
                if thumbs:
                    thumb = get_hq_thumbnail(thumbs[-1].get("url", ""))

                results.append({
                    "id": video_id,
                    "title": title,
                    "channelTitle": artist,
                    "thumbnail": thumb,
                })
                if len(results) >= limit:
                    break
            if len(results) >= limit:
                break
    except Exception as e:
        logger.error(f"Error parsing YTM response: {e}")

    return results

# Keep a YTMusic instance alive for Spotify import (it may still work for that)
try:
    from ytmusicapi import YTMusic
    yt = YTMusic()
    logger.info("YTMusic (legacy) initialized for Spotify import")
except Exception as e:
    logger.warning(f"YTMusic (legacy) init failed – Spotify import will use direct search: {e}")
    yt = None

@app.get("/search")
async def search(q: str = Query(...), limit: int = 20):
    try:
        logger.info(f"Searching for: {q}")
        results = ytm_search(q, limit=limit)
        logger.info(f"Found {len(results)} results")
        return results
    except Exception as e:
        logger.error(f"Search error: {e}")
        return []

@app.get("/health")
async def health():
    return {"status": "ok", "ytmusic": "initialized" if yt else "failed"}

@app.get("/api/movies/trending")
async def get_movies(limit: int = 20, q: str = None, page: int = 1):
    """Fetch movies from TMDB (no API key required for basic usage via proxy)."""
    try:
        TMDB_KEY = os.getenv("TMDB_API_KEY", "d4a7514dbba")  # Free public demo key
        
        # Try YTS first (it has IMDB codes directly)
        try:
            yts_url = f"https://yts.mx/api/v2/list_movies.json?limit={limit}&sort_by=download_count"
            if q:
                yts_url += f"&query_term={q}"
            yts_res = http_requests.get(yts_url, timeout=8)
            yts_data = yts_res.json()
            if yts_data.get("status") == "ok":
                movies = yts_data.get("data", {}).get("movies", [])
                if movies and len(movies) > 0:
                    logger.info(f"YTS returned {len(movies)} movies")
                    return movies
        except Exception as yts_err:
            logger.warning(f"YTS failed, falling back to TMDB: {yts_err}")

        # Fallback: Use TMDB
        if q:
            tmdb_url = f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_KEY}&query={q}&page={page}"
        else:
            tmdb_url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_KEY}&page={page}"
        
        res = http_requests.get(tmdb_url, timeout=10)
        data = res.json()
        
        results = data.get("results", [])
        
        # Map TMDB format to the format the frontend expects (YTS-like)
        mapped = []
        for m in results[:limit]:
            mapped.append({
                "id": m.get("id"),
                "title": m.get("title", "Unknown"),
                "year": (m.get("release_date") or "")[:4],
                "rating": round(m.get("vote_average", 0), 1),
                "summary": m.get("overview", ""),
                "synopsis": m.get("overview", ""),
                "imdb_code": None,  # Will be fetched on play
                "tmdb_id": m.get("id"),
                "medium_cover_image": f"https://image.tmdb.org/t/p/w300{m['poster_path']}" if m.get("poster_path") else "",
                "large_cover_image": f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else "",
                "background_image_original": f"https://image.tmdb.org/t/p/original{m['backdrop_path']}" if m.get("backdrop_path") else "",
                "background_image": f"https://image.tmdb.org/t/p/w1280{m['backdrop_path']}" if m.get("backdrop_path") else "",
            })
        
        logger.info(f"TMDB returned {len(mapped)} movies")
        return mapped
    except Exception as e:
        logger.error(f"Movie fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/movies/{tmdb_id}/imdb")
async def get_imdb_id(tmdb_id: int):
    """Get IMDB ID for a TMDB movie (needed for embed player)."""
    try:
        TMDB_KEY = os.getenv("TMDB_API_KEY", "d4a7514dbba")
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/external_ids?api_key={TMDB_KEY}"
        res = http_requests.get(url, timeout=10)
        data = res.json()
        return {"imdb_id": data.get("imdb_id")}
    except Exception as e:
        logger.error(f"IMDB lookup error: {e}")
        return {"imdb_id": None}


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
                    yt_results = ytm_search(search_query, limit=1)
                    if yt_results:
                        return yt_results[0]
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
                yt_results = ytm_search(search_query, limit=1)
                if yt_results:
                    return yt_results[0]
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

# Serve static files (CSS, JS, and Video) from the public/ folder
app.mount("/css", StaticFiles(directory="public/css"), name="css")
app.mount("/js", StaticFiles(directory="public/js"), name="js")
app.mount("/video", StaticFiles(directory="public/video"), name="video")

# Serve the index.html from the public/ folder
@app.get("/")
async def read_index():
    return FileResponse("public/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
