// netlify/functions/import_spotify.js
function getHqThumbnail(url) {
    if (!url) return "";
    return url.replace(/w\d+-h\d+/g, 'w544-h544').replace(/=w\d+-h\d+/g, '=w544-h544');
}

function getBestImage(sources = []) {
    if (!Array.isArray(sources) || sources.length === 0) return "";
    return sources
        .filter(source => source && source.url)
        .sort((a, b) => ((b.width || b.maxWidth || 0) * (b.height || b.maxHeight || 0)) - ((a.width || a.maxWidth || 0) * (a.height || a.maxHeight || 0)))[0]?.url || "";
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

function cleanSearchText(value = "") {
    return value
        .replace(/\u00a0/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\b(feat\.?|ft\.?)\b/gi, "")
        .replace(/[()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildTrackQueries(title, channelTitle) {
    return [...new Set([
        `${title} ${channelTitle}`,
        `${title} ${channelTitle} audio`,
        `${title} song`,
        title
    ].filter(Boolean))];
}

async function searchYouTubeMusic(query, limit = 4) {
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

    if (!response.ok) return [];

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

async function resolveSpotifyTrack(track, playlistThumbnail) {
    const title = cleanSearchText(track.title);
    const channelTitle = cleanSearchText(track.subtitle);
    const trackThumbnail = getBestImage(track.coverArt?.sources || track.albumOfTrack?.coverArt?.sources || track.images);
    let ytResults = [];

    for (const query of buildTrackQueries(title, channelTitle)) {
        ytResults = await searchYouTubeMusic(query, 4);
        if (ytResults.length) break;
    }

    const best = ytResults[0];

    return {
        id: best?.id || null,
        title,
        channelTitle,
        thumbnail: trackThumbnail || best?.thumbnail || playlistThumbnail,
        fallbackIds: ytResults.slice(1).map(result => result.id),
        isSpotify: true
    };
}

async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const current = index++;
            results[current] = await mapper(items[current], current);
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}

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

        const playlistThumbnail = getBestImage(entity.coverArt?.sources || entity.visualIdentity?.image) || "https://placehold.co/400x400/222/666?text=Track";
        const tracks = await mapWithConcurrency(
            entity.trackList,
            4,
            track => resolveSpotifyTrack(track, playlistThumbnail)
        );

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
