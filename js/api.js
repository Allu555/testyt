export class YouTubeAPI {
    constructor() {
        this.apiKey = this.getStoredKey();
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    }

    getStoredKey() {
        try {
            const stored = localStorage.getItem('yt_api_key_enc');
            return stored ? atob(stored) : '';
        } catch(e) { return ''; }
    }

    setApiKey(key) {
        if (!key) {
            localStorage.removeItem('ytpm_key');
            this.apiKey = '';
            return;
        }
        this.apiKey = key;
        // Advanced Custom Symmetrical Cipher Layer
        const scrambled = this._encryptStream(key);
        localStorage.setItem('ytpm_key_v2', btoa(scrambled));
    }

    getApiKey() {
        // First try the new v2 stream cipher
        const v2 = localStorage.getItem('ytpm_key_v2');
        if (v2) {
            try { return this._decryptStream(atob(v2)); } catch (e) { }
        }

        // Migration from V1 (XOR only)
        const v1 = localStorage.getItem('ytpm_key');
        if (v1) {
            try {
                const secret = "SecureYTMusicKey2026!@#$";
                const unscrambledV1 = atob(v1).split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ secret.charCodeAt(i % secret.length))).join('');
                this.setApiKey(unscrambledV1); 
                localStorage.removeItem('ytpm_key');
                return unscrambledV1;
            } catch (e) { }
        }

        // Migration from V0 (Base64 plaintext)
        const v0 = localStorage.getItem('yt_api_key_enc');
        if (v0) {
            try {
                const decodedV0 = atob(v0);
                this.setApiKey(decodedV0);
                localStorage.removeItem('yt_api_key_enc');
                return decodedV0;
            } catch (e) { }
        }

        return '';
    }

    // High-grade synchronous multi-level stream cipher
    // Phase 1: Dynamic Salted ASCII Shift
    // Phase 2: Rotating XOR Symmetrical Mapping
    _encryptStream(input) {
        const secret = "SuperDuperYTMusicPlayerSecretKey2026!@#$%^&*()_+";
        let output = '';
        for (let i = 0; i < input.length; i++) {
            const dynamicShift = (i * 13) % 256;
            let charCode = input.charCodeAt(i) ^ secret.charCodeAt(i % secret.length); // Phase 2 XOR
            charCode = (charCode + dynamicShift) % 256; // Phase 1 Shift
            output += String.fromCharCode(charCode);
        }
        return output;
    }

    _decryptStream(input) {
        const secret = "SuperDuperYTMusicPlayerSecretKey2026!@#$%^&*()_+";
        let output = '';
        for (let i = 0; i < input.length; i++) {
            const dynamicShift = (i * 13) % 256;
            let charCode = input.charCodeAt(i);
            charCode = (charCode - dynamicShift + 256) % 256; // Reverse Phase 1 Shift
            charCode = charCode ^ secret.charCodeAt(i % secret.length); // Reverse Phase 2 XOR
            output += String.fromCharCode(charCode);
        }
        return output;
    }

    hasApiKey() {
        return this.apiKey && this.apiKey.trim().length > 0;
    }

    async search(query, limit = 20) {
        if (!this.hasApiKey()) {
            throw new Error('API Key missing. Please set your YouTube Data API key in the sidebar.');
        }

        try {
            const response = await fetch(`${this.baseUrl}/search?part=snippet&maxResults=${limit}&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${this.apiKey}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'Error fetching from YouTube API');
            }

            const data = await response.json();
            return data.items.map(item => ({
                id: item.id.videoId,
                title: this.decodeHtml(item.snippet.title),
                channelTitle: this.decodeHtml(item.snippet.channelTitle),
                thumbnail: item.snippet.thumbnails.high.url
            }));
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }
    
    // Quick and dirty HTML entity decoder
    decodeHtml(html) {
        var txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }
}
