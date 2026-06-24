/**
 * LyricsManager — Fetches synced lyrics from lrclib.net and
 * provides real-time time-synced scrolling display.
 */
export class LyricsManager {
    constructor() {
        this.panel = null;
        this.content = null;
        this.lyricsData = []; // [{ time: seconds, text: string }]
        this.plainLyrics = '';
        this.currentLineIndex = -1;
        this.isVisible = false;
        this.isFetching = false;
        this.currentTrackKey = '';
    }

    init() {
        this.panel = document.getElementById('lyrics-panel');
        this.content = document.getElementById('lyrics-content');
        this.closeBtn = document.getElementById('lyrics-close-btn');
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hide());
        }

        // Close on backdrop click (mobile)
        if (this.panel) {
            this.panel.addEventListener('click', (e) => {
                if (e.target === this.panel) this.hide();
            });
        }
    }

    /**
     * Fetch lyrics for a given track.
     * @param {string} title - Song title
     * @param {string} artist - Artist name
     */
    async fetchLyrics(title, artist) {
        const trackKey = `${title}|||${artist}`;
        if (trackKey === this.currentTrackKey) return; // Already loaded
        this.currentTrackKey = trackKey;

        this.lyricsData = [];
        this.plainLyrics = '';
        this.currentLineIndex = -1;

        if (!this.content) return;

        this.content.innerHTML = `
            <div class="lyrics-loading">
                <div class="lyrics-loading-spinner"></div>
                <span>Searching lyrics...</span>
            </div>
        `;

        this.isFetching = true;

        try {
            // Clean up title — remove things like "(Official Video)", "[Lyrics]", etc.
            const cleanTitle = title
                .replace(/\(.*?\)/g, '')
                .replace(/\[.*?\]/g, '')
                .replace(/official\s*(music\s*)?video/gi, '')
                .replace(/lyrics?\s*video/gi, '')
                .replace(/audio/gi, '')
                .replace(/ft\.?.*/gi, '')
                .replace(/feat\.?.*/gi, '')
                .trim();

            const cleanArtist = artist
                .replace(/\s*-\s*Topic$/i, '')
                .replace(/VEVO$/i, '')
                .trim();

            const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;

            const response = await fetch(url);

            // Check if we're still on the same track
            if (this.currentTrackKey !== trackKey) return;

            if (!response.ok) {
                // Try a search endpoint as fallback
                return await this._searchFallback(cleanTitle, cleanArtist, trackKey);
            }

            const data = await response.json();

            if (this.currentTrackKey !== trackKey) return;

            if (data.syncedLyrics) {
                this.lyricsData = this._parseLRC(data.syncedLyrics);
                this._renderSyncedLyrics();
            } else if (data.plainLyrics) {
                this.plainLyrics = data.plainLyrics;
                this._renderPlainLyrics();
            } else {
                this._renderNotFound();
            }
        } catch (err) {
            console.warn('Lyrics fetch error:', err);
            if (this.currentTrackKey === trackKey) {
                // Try search fallback
                try {
                    const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
                    const cleanArtist = artist.replace(/\s*-\s*Topic$/i, '').trim();
                    await this._searchFallback(cleanTitle, cleanArtist, trackKey);
                } catch(e) {
                    this._renderNotFound();
                }
            }
        } finally {
            this.isFetching = false;
        }
    }

    async _searchFallback(title, artist, trackKey) {
        try {
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(title + ' ' + artist)}`;
            const resp = await fetch(searchUrl);

            if (this.currentTrackKey !== trackKey) return;

            if (!resp.ok) {
                this._renderNotFound();
                return;
            }

            const results = await resp.json();
            if (this.currentTrackKey !== trackKey) return;

            if (results && results.length > 0) {
                const best = results[0];
                if (best.syncedLyrics) {
                    this.lyricsData = this._parseLRC(best.syncedLyrics);
                    this._renderSyncedLyrics();
                } else if (best.plainLyrics) {
                    this.plainLyrics = best.plainLyrics;
                    this._renderPlainLyrics();
                } else {
                    this._renderNotFound();
                }
            } else {
                this._renderNotFound();
            }
        } catch(e) {
            if (this.currentTrackKey === trackKey) {
                this._renderNotFound();
            }
        }
    }

    /**
     * Parse LRC format: [mm:ss.xx] text
     */
    _parseLRC(lrcString) {
        const lines = lrcString.split('\n');
        const parsed = [];

        for (const line of lines) {
            const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const ms = parseInt(match[3].padEnd(3, '0'));
                const time = minutes * 60 + seconds + ms / 1000;
                const text = match[4].trim();
                if (text) {
                    parsed.push({ time, text });
                }
            }
        }

        return parsed.sort((a, b) => a.time - b.time);
    }

    _renderSyncedLyrics() {
        if (!this.content) return;
        this.content.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'lyrics-synced-wrapper';

        // Top spacer
        const spacerTop = document.createElement('div');
        spacerTop.className = 'lyrics-spacer';
        wrapper.appendChild(spacerTop);

        this.lyricsData.forEach((line, idx) => {
            const el = document.createElement('div');
            el.className = 'lyrics-line';
            el.dataset.index = idx;
            el.textContent = line.text;
            el.addEventListener('click', () => {
                // Seek to this line's timestamp if player supports it
                if (window.app && window.app.player) {
                    window.app.player.seekTo(line.time);
                    this.update(line.time); // Immediately update UI
                }
            });
            wrapper.appendChild(el);
        });

        // Bottom spacer
        const spacerBottom = document.createElement('div');
        spacerBottom.className = 'lyrics-spacer';
        wrapper.appendChild(spacerBottom);

        this.content.appendChild(wrapper);
    }

    _renderPlainLyrics() {
        if (!this.content) return;
        this.content.innerHTML = `
            <div class="lyrics-plain-wrapper">
                <div class="lyrics-plain-badge">
                    <i class="fas fa-align-left"></i> Plain Lyrics
                </div>
                <pre class="lyrics-plain-text">${this._escapeHtml(this.plainLyrics)}</pre>
            </div>
        `;
    }

    _renderNotFound() {
        if (!this.content) return;
        this.content.innerHTML = `
            <div class="lyrics-not-found">
                <i class="fas fa-microphone-slash"></i>
                <h3>Lyrics Not Available</h3>
                <p>We couldn't find lyrics for this track.</p>
            </div>
        `;
    }

    /**
     * Update the active lyric line based on current playback time.
     * Called from onTimeUpdate.
     */
    update(currentTime) {
        if (this.lyricsData.length === 0 || !this.isVisible) return;

        // Find the current line
        let newIndex = -1;
        for (let i = this.lyricsData.length - 1; i >= 0; i--) {
            if (currentTime >= this.lyricsData[i].time - 0.2) {
                newIndex = i;
                break;
            }
        }

        if (newIndex !== this.currentLineIndex) {
            this.currentLineIndex = newIndex;
            this._highlightLine(newIndex);
        }
    }

    _highlightLine(index) {
        if (!this.content) return;
        const lines = this.content.querySelectorAll('.lyrics-line');
        lines.forEach((el, i) => {
            el.classList.remove('lyrics-line-active', 'lyrics-line-past');
            if (i === index) {
                el.classList.add('lyrics-line-active');
            } else if (i < index) {
                el.classList.add('lyrics-line-past');
            }
        });

        // Scroll active line into view
        if (index >= 0 && lines[index]) {
            lines[index].scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }

    show() {
        if (this.panel) {
            this.panel.classList.add('lyrics-panel-visible');
            this.isVisible = true;
            // notify others that lyrics became visible
            try { document.dispatchEvent(new CustomEvent('lyrics-visibility', { detail: { visible: true } })); } catch (e) {}
        }
    }

    hide() {
        if (this.panel) {
            this.panel.classList.remove('lyrics-panel-visible');
            this.isVisible = false;
            // notify others that lyrics became hidden
            try { document.dispatchEvent(new CustomEvent('lyrics-visibility', { detail: { visible: false } })); } catch (e) {}
        }
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
