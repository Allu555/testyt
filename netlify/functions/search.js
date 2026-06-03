function getHqThumbnail(url) {
    if (!url) return "";
    return url.replace(/w\d+-h\d+/g, 'w544-h544').replace(/=w\d+-h\d+/g, '=w544-h544');
}

const YTM_BASE = "https://music.youtube.com";
const YTM_SEARCH_EP = `${YTM_BASE}/youtubei/v1/search`;
const YTM_CONTEXT = {
    client: {
        clientName: "WEB_REMIX",
        clientVersion: "1.20231204.01.00",
        hl: "en",
        gl: "IN",
    },
};

function textRuns(runs = []) {
    return runs.map(run => run.text || "").filter(Boolean);
}

async function searchYouTubeMusic(query, limit) {
    const response = await fetch(`${YTM_SEARCH_EP}?prettyPrint=false`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": YTM_BASE,
            "Referer": `${YTM_BASE}/`,
        },
        body: JSON.stringify({
            context: YTM_CONTEXT,
            query,
            params: "EgWKAQIIAWoOEAMQBBAJEAoQBRAREBU%3D",
        }),
    });

    if (!response.ok) {
        throw new Error(`YouTube Music search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
    const sectionList = tabs.length
        ? tabs[0]?.tabRenderer?.content?.sectionListRenderer
        : data?.contents?.sectionListRenderer;

    const results = [];
    for (const section of sectionList?.contents || []) {
        const shelf = section?.musicShelfRenderer;
        if (!shelf) continue;

        for (const item of shelf.contents || []) {
            const renderer = item?.musicResponsiveListItemRenderer;
            const flexColumns = renderer?.flexColumns || [];
            if (!renderer || !flexColumns.length) continue;

            const titleRuns = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            const title = titleRuns[0]?.text || "";

            const playEndpoint = renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
            const titleEndpoint = titleRuns[0]?.navigationEndpoint;
            const videoId = playEndpoint?.watchEndpoint?.videoId || titleEndpoint?.watchEndpoint?.videoId;
            if (!title || !videoId) continue;

            const artistRuns = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            const artistParts = textRuns(artistRuns).filter(part => !["•", " • ", " "].includes(part));
            const thumbnail = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url || "";

            results.push({
                id: videoId,
                title,
                channelTitle: artistParts[0] || "Unknown Artist",
                thumbnail: getHqThumbnail(thumbnail),
            });

            if (results.length >= limit) return results;
        }
    }

    return results;
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
        const mappedResults = await searchYouTubeMusic(q, limit);

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
