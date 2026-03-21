from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import logging
import os

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
            thumbnail_url = thumbnails[-1].get("url") if thumbnails else ""
            
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

# Serve static files (CSS and JS) from the public/ folder
app.mount("/css", StaticFiles(directory="public/css"), name="css")
app.mount("/js", StaticFiles(directory="public/js"), name="js")

# Serve the index.html from the public/ folder
@app.get("/")
async def read_index():
    return FileResponse("public/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
