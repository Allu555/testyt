export class YouTubeAPI {
    constructor() {
        // For unified server (Koyeb/Render):
        // Local dev: localhost:8000
        // Production: relative to the domain root
        this.proxyUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8000' 
            : '';
    }

    // Stub out old key methods for backward compatibility with app.js
    getStoredKey() { return 'LOCAL_PROXY'; }
    setApiKey(key) { }
    getApiKey() { return 'LOCAL_PROXY'; }
    hasApiKey() { return true; }

    async search(query, limit = 20) {
        try {
            // For Netlify, the search function is at /api/search (via redirects)
            const endpoint = (this.proxyUrl === '') ? '/api/search' : `${this.proxyUrl}/search`;
            const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&limit=${limit}`);
            
            let errorMessage = 'Error fetching from Proxy';
            if (!response.ok) {
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.detail || errorMessage;
                } catch (e) {
                    errorMessage = `Server Error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            return data.map(item => ({
                id: item.id,
                title: this.decodeHtml(item.title),
                channelTitle: this.decodeHtml(item.channelTitle),
                thumbnail: item.thumbnail
            }));
        } catch (error) {
            console.error('Search error:', error);
            throw error; // Throw the actual error so the UI can show it
        }
    }

    async importSpotify(url) {
        try {
            const endpoint = (this.proxyUrl === '') ? '/api/import_spotify' : `${this.proxyUrl}/api/import_spotify`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            
            let errorMessage = 'Error fetching from Proxy';
            if (!response.ok) {
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.detail || errorMessage;
                } catch (e) {
                    errorMessage = `Server Error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            return {
                title: data.title || 'Imported Playlist',
                tracks: data.tracks.map(item => ({
                    id: item.id || null, // null if lazy loaded
                    title: this.decodeHtml(item.title),
                    channelTitle: this.decodeHtml(item.channelTitle),
                    thumbnail: item.thumbnail
                }))
            };
        } catch (error) {
            console.error('Spotify import error:', error);
            throw error;
        }
    }
    
    // Quick and dirty HTML entity decoder
    decodeHtml(html) {
        if (!html) return "";
        var txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }
}
