from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

yt = YTMusic()

@app.get("/api/search")
async def search(q: str = Query(...), limit: int = 20):
    try:
        results = yt.search(q, filter="songs", limit=limit)
        mapped_results = []
        for item in results:
            video_id = item.get("videoId")
            if not video_id: continue
            artists = item.get("artists", [])
            artist_names = [a.get("name") for a in artists if a.get("name")]
            thumbnails = item.get("thumbnails", [])
            mapped_results.append({
                "id": video_id,
                "title": item.get("title", "Unknown Title"),
                "channelTitle": ", ".join(artist_names) if artist_names else "Unknown Artist",
                "thumbnail": thumbnails[-1].get("url") if thumbnails else ""
            })
        return mapped_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
