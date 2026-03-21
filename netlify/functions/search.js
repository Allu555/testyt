const YTMusic = require('ytmusic-api').default;
const ytmusic = new YTMusic();

exports.handler = async (event, context) => {
    const q = event.queryStringParameters.q;
    const limit = parseInt(event.queryStringParameters.limit) || 20;

    if (!q) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing query parameter 'q'" })
        };
    }

    try {
        // Initialize the API (must be done once)
        await ytmusic.initialize();
        
        // Perform search
        const results = await ytmusic.searchSongs(q);
        
        // Map to the frontend's expected format
        const mappedResults = results.slice(0, limit).map(item => ({
            id: item.videoId,
            title: item.name,
            channelTitle: item.artist.name,
            thumbnail: item.thumbnails && item.thumbnails.length > 0 
                ? item.thumbnails[item.thumbnails.length - 1].url 
                : ""
        }));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(mappedResults)
        };
    } catch (error) {
        console.error('Netlify Function Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({ 
                error: error.message,
                detail: "Node.js function encountered an error." 
            })
        };
    }
};
