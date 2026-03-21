import json
from ytmusicapi import YTMusic

# Initialize YTMusic globally if possible (Netlify might reuse the instance)
yt = YTMusic()

def handler(event, context):
    # Get search query from event
    query_params = event.get('queryStringParameters', {})
    q = query_params.get('q', '')
    limit = int(query_params.get('limit', 20))

    if not q:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing search query 'q'"})
        }

    try:
        # Perform search
        results = yt.search(q, filter="songs", limit=limit)
        
        # Map to frontend format
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
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" # Help with CORS
            },
            "body": json.dumps(mapped_results)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
