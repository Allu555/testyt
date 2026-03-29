// netlify/functions/import_spotify.js
exports.handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        const body = JSON.parse(event.body);
        const url = body.url;

        if (!url || !url.includes('spotify.com/playlist/')) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Invalid Spotify Playlist URL" })
            };
        }

        const playlistIdMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
        if (!playlistIdMatch) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Could not extract playlist ID" })
            };
        }

        const playlistId = playlistIdMatch[1];
        const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;

        // Node.js 18+ has global fetch
        const res = await fetch(embedUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Failed to fetch Spotify embed" })
            };
        }

        const html = await res.text();
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);

        if (!nextDataMatch) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Could not parse Spotify embed data" })
            };
        }

        const data = JSON.parse(nextDataMatch[1]);
        const entity = data?.props?.pageProps?.state?.data?.entity;

        if (!entity || !entity.trackList) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: "No tracks found in playlist" })
            };
        }

        const tracks = entity.trackList.map(t => {
            return {
                // Return without YT id, frontend will lazy load
                title: t.title,
                channelTitle: t.subtitle,
                thumbnail: t.coverArt?.sources?.[0]?.url || "https://placehold.co/400x400/222/666?text=Track",
                isSpotify: true // flag for frontend lazy load
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                title: entity.name || "Imported Playlist",
                tracks: tracks
            })
        };
    } catch (error) {
        console.error('Spotify Import Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
