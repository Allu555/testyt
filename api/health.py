from fastapi import FastAPI
from ytmusicapi import YTMusic
app = FastAPI()
yt = YTMusic()

@app.get("/api/health")
async def health():
    return {"status": "ok", "ytmusic": "initialized"}
