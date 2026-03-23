const YTMusic = require('ytmusic-api').default || require('ytmusic-api');

function getHqThumbnail(url) {
    if (!url) return "";
    return url.replace(/w\d+-h\d+/g, 'w544-h544').replace(/=w\d+-h\d+/g, '=w544-h544');
}

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    const q = event.queryStringParameters.q;
    const limit = parseInt(event.queryStringParameters.limit) || 20;

    if (!q) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing query parameter 'q'" })
        };
    }

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        
        const results = await ytmusic.searchSongs(q);
        
        const mappedResults = results.slice(0, limit).map(item => ({
            id: item.videoId,
            title: item.name,
            channelTitle: item.artist ? item.artist.name : "Unknown Artist",
            thumbnail: item.thumbnails && item.thumbnails.length > 0 
                ? getHqThumbnail(item.thumbnails[item.thumbnails.length - 1].url) 
                : ""
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(mappedResults)
        };
    } catch (error) {
        console.error('Netlify Function Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                stack: error.stack,
                detail: "Node.js function encountered an error." 
            })
        };
    }
};
