from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Allow CORS for all origins (especially for Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize YTMusic
yt = None
try:
    yt = YTMusic()
    logger.info("YTMusic initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize YTMusic: {e}")

@app.get("/")
async def root():
    return {"message": "YTPlayer API is running", "endpoints": ["/api/search", "/api/health"]}

@app.api_route("/", methods=["GET"])
async def root(request: Request):
    return {"message": "YTPlayer API is running", "url": str(request.url), "endpoints": ["/search", "/health", "/debug"]}

@app.get("/api")
async def api_root(request: Request):
    return {"message": "API Root reached", "url": str(request.url)}

@app.get("/debug")
@app.get("/api/debug")
async def debug(request: Request):
    import os
    try:
        files = os.listdir('.')
        return {
            "current_dir": os.getcwd(),
            "files": files,
            "url": str(request.url),
            "index_exists": os.path.exists('index.html') or os.path.exists('../index.html')
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/search")
@app.get("/api/search")
async def search(request: Request, q: str = Query(...), limit: int = 20):
    if not yt:
        raise HTTPException(status_code=500, detail="YTMusic not initialized")
    
    try:
        logger.info(f"Searching for: {q}")
        results = yt.search(q, filter="songs", limit=limit)
        
        mapped_results = []
        for item in results:
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
        
        return mapped_results
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e), headers={"X-Debug-URL": str(request.url)})

@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "ytmusic": "initialized" if yt else "failed"}

@app.api_route("/{path_name:path}", methods=["GET"])
async def catch_all(request: Request, path_name: str = None):
    return {
        "detail": "Path Not Found in FastAPI",
        "path_received": path_name,
        "url": str(request.url),
        "msg": "If you see this, FastAPI is working but the route didn't match."
    }
