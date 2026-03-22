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
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error fetching from Local Proxy');
            }

            const data = await response.json();
            return data.map(item => ({
                id: item.id,
                title: this.decodeHtml(item.title),
                channelTitle: this.decodeHtml(item.channelTitle),
                thumbnail: item.thumbnail
            }));
        } catch (error) {
            console.error('Search error (Local Proxy):', error);
            throw new Error('Local Proxy Backend not running. Please start server.py first.');
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
