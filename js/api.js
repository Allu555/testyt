export class YouTubeAPI {
    constructor() {
        // Automatically detect if we are on Vercel and use the serverless API, 
        // otherwise connect to the local Python proxy.
        if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('now.sh')) {
            this.proxyUrl = '/api'; 
        } else {
            this.proxyUrl = `http://${window.location.hostname || 'localhost'}:8000`;
        }
    }

    // Stub out old key methods for backward compatibility with app.js
    getStoredKey() { return 'LOCAL_PROXY'; }
    setApiKey(key) { }
    getApiKey() { return 'LOCAL_PROXY'; }
    hasApiKey() { return true; }

    async search(query, limit = 20) {
        try {
            const response = await fetch(`${this.proxyUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
            
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
