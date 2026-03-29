import { YouTubeAPI } from './api.js';
import { Player } from './player.js';
import { StorageUtils } from './storage.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

class App {
    constructor() {
        this.api = new YouTubeAPI();
        this.ui = new UI();
        this.auth = new Auth();
        this.player = new Player(
            this.onPlayerStateChange.bind(this),
            this.onPlayerReady.bind(this),
            this.onTimeUpdate.bind(this),
            this.onPlayerError.bind(this)
        );

        this.currentPlaylist = [];
        this.currentPlaylistIndex = -1;
        this.currentSong = null;

        this.isShuffle = false;
        this.repeatMode = 'off'; // 'off', 'one', 'all'
        this.isMuted = false;
        this.lastVolume = 100;

        this.debounceTimeout = null;

        this.initAuth();
    }

    initAuth() {
        const overlay = document.getElementById('auth-overlay');
        const form = document.getElementById('auth-form');
        const userInp = document.getElementById('auth-username');
        const passInp = document.getElementById('auth-password');
        const errorEl = document.getElementById('auth-error');
        const toggleBtn = document.getElementById('auth-toggle-btn');
        const subtitle = document.getElementById('auth-subtitle');
        const submitBtn = document.getElementById('auth-submit-btn');

        let isLoginMode = true;

        if (this.auth.isLoggedIn()) {
            overlay.classList.add('hidden');
            this.init(); // Starts original app initialization
        } else {
            overlay.classList.remove('hidden');
        }

        toggleBtn.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            errorEl.classList.add('hidden');
            userInp.value = '';
            passInp.value = '';
            
            if (isLoginMode) {
                subtitle.textContent = 'Log in to view your playlists';
                submitBtn.textContent = 'Log In';
                toggleBtn.textContent = 'Sign Up';
                document.getElementById('auth-toggle-text').childNodes[0].nodeValue = "Don't have an account? ";
            } else {
                subtitle.textContent = 'Create a new account';
                submitBtn.textContent = 'Sign Up';
                toggleBtn.textContent = 'Log In';
                document.getElementById('auth-toggle-text').childNodes[0].nodeValue = "Already have an account? ";
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = userInp.value.trim();
            const pass = passInp.value.trim();

            let res;
            if (isLoginMode) {
                res = this.auth.login(user, pass);
            } else {
                res = this.auth.register(user, pass);
                if (res.success) {
                    res = this.auth.login(user, pass);
                }
            }

            if (res.success) {
                overlay.classList.add('hidden');
                // Reload cleanly to inject scoped local API storage settings
                location.reload(); 
            } else {
                errorEl.textContent = res.error;
                errorEl.classList.remove('hidden');
            }
        });

        // Add logout listener
        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.auth.logout();
                location.reload();
            });
        }
    }

    init() {
        // Initialize Player by loading YT IFrame Script
        this.initializeYTAPI();

        if (this.api.hasApiKey()) {
            this.updateApiKeyUI(true);
        }

        this.bindEvents();
        this.loadInitialData();
    }

    updateApiKeyUI(hasKey) {
        const section = document.querySelector('.api-key-section');
        if (hasKey && section) {
            // Destroy the password input field from the DOM completely!
            // This prevents Chrome from silently scanning hidden password fields and triggering popups.
            section.innerHTML = '';
            section.style.display = 'none';
        }
    }

    initializeYTAPI() {
        window.onYouTubeIframeAPIReady = () => {
            this.player.init();
        };

        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    loadInitialData() {
        this.renderHome();
        this.renderFavorites();
        this.renderPlaylists();
    }

    renderPlaylists() {
        const playlists = StorageUtils.getSavedPlaylists();
        const container = document.getElementById('playlists-results');
        if (!container) return;
        
        container.innerHTML = '';
        if (playlists.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">No saved playlists yet. Import one from the Home tab!</p>';
            return;
        }

        playlists.forEach(pl => {
            const card = document.createElement('div');
            card.className = 'song-card';
            const thumbUrl = pl.tracks.length > 0 && pl.tracks[0].thumbnail ? pl.tracks[0].thumbnail : '';
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${thumbUrl}" alt="Playlist">
                    <button class="card-play-btn"><i class="fas fa-play"></i></button>
                    <button class="card-delete-btn"><i class="fas fa-trash"></i></button>
                </div>
                <div class="card-title" title="${pl.title}">${pl.title}</div>
                <div class="card-channel">${pl.tracks.length} Tracks</div>
            `;
            
            card.querySelector('.card-play-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (pl.tracks.length > 0) this.playSong(pl.tracks[0], pl.tracks);
            });
            
            card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this playlist?')) {
                    StorageUtils.removePlaylist(pl.id);
                    this.renderPlaylists();
                }
            });
            
            card.addEventListener('click', () => {
                this.renderPlaylistDetail(pl);
            });
            
            container.appendChild(card);
            
            if (window.VanillaTilt) {
                window.VanillaTilt.init(card, { max: 15, speed: 400, glare: true, "max-glare": 0.25, scale: 1.05 });
            }
        });
    }

    renderPlaylistDetail(playlist) {
        this.currentViewedPlaylist = playlist;
        this.ui.switchView('playlist-detail-view');
        
        document.getElementById('detail-playlist-title').textContent = playlist.title;
        
        const container = document.getElementById('playlist-detail-results');
        this.ui.renderSongs(container, playlist.tracks, (song) => {
            this.playSong(song, playlist.tracks);
        });
    }

    renderImportedPlaylist(songs) {
        // If we want to show it on Home view, we can dynamically add a section
        let importedSection = document.getElementById('imported-results-section');
        if (songs.length === 0) {
            if (importedSection) importedSection.style.display = 'none';
            return;
        }
        
        if (!importedSection) {
            importedSection = document.createElement('div');
            importedSection.id = 'imported-results-section';
            importedSection.innerHTML = `
                <h2 style="margin-top: 30px; display: flex; justify-content: space-between; align-items: center;">
                    Imported Playlist 
                    <button id="play-all-imported-btn" class="btn-primary" style="font-size: 14px; padding: 6px 16px;"><i class="fas fa-play"></i> Play All</button>
                </h2>
                <div class="results-grid" id="imported-results"></div>
            `;
            // Insert after recent results
            const recentSection = document.getElementById('recent-results');
            recentSection.parentNode.insertBefore(importedSection, recentSection.nextSibling);

            document.getElementById('play-all-imported-btn').addEventListener('click', () => {
                if (this.currentImportedSongs && this.currentImportedSongs.length > 0) {
                    this.playSong(this.currentImportedSongs[0], this.currentImportedSongs);
                }
            });
        }
        
        importedSection.style.display = 'block';
        this.currentImportedSongs = songs;
        
        const container = document.getElementById('imported-results');
        this.ui.renderSongs(
            container, 
            songs, 
            (song) => this.playSong(song, songs)
        );
    }

    renderHome() {
        const recents = StorageUtils.getRecent();
        this.ui.renderSongs(
            this.ui.recentResultsContainer, 
            recents, 
            (song) => this.playSong(song, recents),
            (song) => {
                StorageUtils.removeRecent(song.id);
                this.renderHome();
            }
        );
    }

    renderFavorites() {
        const favs = StorageUtils.getFavorites();
        this.ui.renderSongs(
            this.ui.favoritesResultsContainer, 
            favs, 
            (song) => this.playSong(song, favs),
            (song) => {
                StorageUtils.removeFavorite(song.id);
                this.renderFavorites();
            }
        );
    }

    bindEvents() {
        // Navigation Options
        this.ui.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.target;
                this.ui.switchView(target);
                
                if (target === 'home-view') this.renderHome();
                if (target === 'favorites-view') this.renderFavorites();
                if (target === 'playlists-view') this.renderPlaylists();
            });
        });

        // Playlist Detail actions
        const backBtn = document.getElementById('back-to-playlists-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.ui.switchView('playlists-view');
                this.renderPlaylists();
            });
        }
        
        const playAllDetailBtn = document.getElementById('play-all-detail-btn');
        if (playAllDetailBtn) {
            playAllDetailBtn.addEventListener('click', () => {
                if (this.currentViewedPlaylist && this.currentViewedPlaylist.tracks.length > 0) {
                    this.playSong(this.currentViewedPlaylist.tracks[0], this.currentViewedPlaylist.tracks);
                }
            });
        }

        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.auth.logout();
                window.location.reload();
            });
        }

        // Search Input Setup with Debounce
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.debounceTimeout);
                const query = e.target.value.trim();
                if (query.length === 0) {
                    this.ui.searchResultsContainer.innerHTML = '';
                    this.ui.searchLoader.classList.add('hidden');
                    return;
                }

                this.debounceTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 600); // 600ms debounce
            });
        }

        // API Key Save Logic
        const saveKeyBtn = document.getElementById('save-api-key');
        if (saveKeyBtn) {
            const keyInput = document.getElementById('api-key-input');
            saveKeyBtn.addEventListener('click', () => {
                const key = keyInput.value.trim();
                if (key) {
                    this.api.setApiKey(key);
                    this.updateApiKeyUI(true);
                    alert("API Key Saved successfully!");
                }
            });
        }

        // Spotify Import Logic
        const spotImportBtn = document.getElementById('spotify-import-btn');
        if (spotImportBtn) {
            const spotInput = document.getElementById('spotify-input');
            const spotLoader = document.getElementById('spotify-loader');
            
            spotImportBtn.addEventListener('click', async () => {
                const url = spotInput.value.trim();
                if (!url) return;
                
                spotImportBtn.disabled = true;
                spotLoader.classList.remove('hidden');
                
                try {
                    const importedData = await this.api.importSpotify(url);
                    if (importedData && importedData.tracks && importedData.tracks.length > 0) {
                        spotInput.value = '';
                        StorageUtils.addPlaylist(importedData);
                        this.renderPlaylists();
                        alert("Playlist imported successfully! Check the Playlists tab.");
                    } else {
                        alert("No playable tracks found for this playlist.");
                    }
                } catch (err) {
                    alert(err.message);
                } finally {
                    spotImportBtn.disabled = false;
                    spotLoader.classList.add('hidden');
                }
            });
        }

        // Player UI Controls Setup
        document.getElementById('play-pause-btn').addEventListener('click', () => {
            if (!this.currentSong) return;
            const state = this.player.player ? this.player.player.getPlayerState() : -1;
            if (state === YT.PlayerState.PLAYING) {
                this.player.pause();
            } else {
                this.player.play();
            }
        });

        document.getElementById('next-btn').addEventListener('click', () => this.playNext());
        document.getElementById('next-btn-mobile').addEventListener('click', () => this.playNext());
        document.getElementById('prev-btn').addEventListener('click', () => this.playPrev());

        // Favorite current song logic
        document.getElementById('favorite-current-btn').addEventListener('click', () => {
            if (!this.currentSong) return;
            const isFav = StorageUtils.isFavorite(this.currentSong.id);
            if (isFav) {
                StorageUtils.removeFavorite(this.currentSong.id);
                this.ui.updateFavoriteButton(false);
            } else {
                StorageUtils.addFavorite(this.currentSong);
                this.ui.updateFavoriteButton(true);
            }
            if (!this.ui.views.favorites.classList.contains('hidden')) {
                this.renderFavorites();
            }
        });

        // Volume logic
        const volumeInputEl = document.getElementById('volume-slider');
        volumeInputEl.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value);
            this.player.setVolume(vol);
            this.ui.updateVolumeIcon(vol);
        });

        // Progress bar seeking
        const progressEl = document.getElementById('progress-bar');
        if (progressEl) {
            progressEl.addEventListener('change', (e) => {
                this.player.seekTo(parseFloat(e.target.value));
            });
        }

        // Shuffle & Repeat
        const shuffleBtn = document.getElementById('shuffle-btn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }

        const repeatBtn = document.getElementById('repeat-btn');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => this.toggleRepeat());
        }

        // Mute Toggle
        const volIcon = document.getElementById('volume-icon');
        if (volIcon) {
            volIcon.addEventListener('click', () => this.toggleMute());
        }

        // Extra Buttons Feedback
        const extraBtns = ['lyrics-btn', 'queue-btn', 'connect-btn'];
        extraBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    alert(`${id.charAt(0).toUpperCase() + id.slice(1).replace('-btn', '')} feature coming soon!`);
                });
            }
        });

        // Now Playing Fullscreen Toggle
        document.getElementById('toggle-np-btn').addEventListener('click', () => {
            if (!this.currentSong) return;
            this.ui.nowPlayingView.classList.remove('hidden');
        });
        document.getElementById('fs-toggle-btn').addEventListener('click', () => {
            if (!this.currentSong) return;
            this.ui.nowPlayingView.classList.remove('hidden');
        });
        document.getElementById('close-np-btn').addEventListener('click', () => {
            this.ui.nowPlayingView.classList.add('hidden');
        });

        // Apply Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Stop spacebar from scrolling page or triggering inputs
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                document.getElementById('play-pause-btn').click();
            }
        });

        // True Fullscreen Video Button
        const fsVideoBtn = document.getElementById('video-fs-btn');
        if (fsVideoBtn) {
            fsVideoBtn.addEventListener('click', () => {
                const vidPlayer = document.getElementById('ytplayer');
                if (vidPlayer) {
                    if (vidPlayer.requestFullscreen) {
                        vidPlayer.requestFullscreen();
                    } else if (vidPlayer.webkitRequestFullscreen) {
                        vidPlayer.webkitRequestFullscreen();
                    } else if (vidPlayer.msRequestFullscreen) {
                        vidPlayer.msRequestFullscreen();
                    }
                }
            });
        }

        // Visibility API to try and keep music playing when minimized
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                console.log("App minimized, attempting to keep playback...");
            }
        });
    }

    async performSearch(query) {
        this.ui.setLoading(true);
        try {
            const results = await this.api.search(query);
            this.ui.setLoading(false);
            this.ui.renderSongs(this.ui.searchResultsContainer, results, (song) => this.playSong(song, results));
        } catch (error) {
            this.ui.setLoading(false);
            this.ui.showError(error.message);
        }
    }

    async playSong(song, contextPlaylist = []) {
        this.currentSong = song;
        if (contextPlaylist.length > 0) {
            this.currentPlaylist = contextPlaylist;
            this.currentPlaylistIndex = this.currentPlaylist.findIndex(s => 
                s === song || (s.id && s.id === song.id) || (s.title === song.title && s.channelTitle === song.channelTitle)
            );
        }

        if (!song.id) {
            this.ui.setPlayingState(false);
            tRow = document.body;
            tRow.style.cursor = 'wait';
            try {
                const results = await this.api.search(`${song.title} ${song.channelTitle}`, 1);
                if (results && results.length > 0) {
                    song.id = results[0].id;
                } else {
                    console.warn(`Could not resolve YT ID for ${song.title}`);
                    tRow.style.cursor = 'default';
                    this.onPlayerError(100);
                    return;
                }
            } catch (err) {
                console.error("Resolution error:", err);
                tRow.style.cursor = 'default';
                this.onPlayerError(100);
                return;
            }
            tRow.style.cursor = 'default';
        }

        if (song.id) {
            StorageUtils.addRecent(song);
        }
        
        if (!this.ui.views.home.classList.contains('hidden')) {
            this.renderHome();
        }

        const isFav = StorageUtils.isFavorite(song.id);
        this.ui.updateNowPlaying(song, isFav);
        
        // Load and play in YT iframe wrapper
        this.player.loadSong(song.id);
    }

    playNext() {
        if (this.currentPlaylist.length === 0) return;
        
        let nextIndex;
        if (this.isShuffle) {
            nextIndex = Math.floor(Math.random() * this.currentPlaylist.length);
            // Try to avoid the same song if possible
            if (nextIndex === this.currentPlaylistIndex && this.currentPlaylist.length > 1) {
                nextIndex = (nextIndex + 1) % this.currentPlaylist.length;
            }
        } else {
            nextIndex = (this.currentPlaylistIndex + 1) % this.currentPlaylist.length;
        }

        this.currentPlaylistIndex = nextIndex;
        const nextSong = this.currentPlaylist[this.currentPlaylistIndex];
        this.playSong(nextSong, this.currentPlaylist);
    }

    playPrev() {
        if (this.currentPlaylist.length === 0) return;
        this.currentPlaylistIndex = (this.currentPlaylistIndex - 1 + this.currentPlaylist.length) % this.currentPlaylist.length;
        const prevSong = this.currentPlaylist[this.currentPlaylistIndex];
        this.playSong(prevSong, this.currentPlaylist);
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        this.ui.updateShuffleUI(this.isShuffle);
    }

    toggleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIdx = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIdx + 1) % modes.length];
        this.ui.updateRepeatUI(this.repeatMode);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.lastVolume = this.player.getVolume();
            this.player.setVolume(0);
            this.ui.updateVolumeIcon(0);
        } else {
            this.player.setVolume(this.lastVolume);
            this.ui.updateVolumeIcon(this.lastVolume);
        }
    }

    // Callbacks from Player
    onPlayerReady() {
        // Player is ready logic
    }

    onPlayerStateChange(state) {
        if (state === YT.PlayerState.PLAYING) {
            this.ui.setPlayingState(true);
            document.body.classList.add('is-pulsing');
        } else {
            this.ui.setPlayingState(false);
            if (state !== YT.PlayerState.BUFFERING) {
                document.body.classList.remove('is-pulsing');
            }
        }

        if (state === YT.PlayerState.ENDED) {
            if (this.repeatMode === 'one') {
                this.player.seekTo(0);
                this.player.play();
            } else if (this.repeatMode === 'all' || this.currentPlaylistIndex < this.currentPlaylist.length - 1 || this.isShuffle) {
                this.playNext();
            } else {
                this.ui.setPlayingState(false);
            }
        }
    }

    onPlayerError(errorCode) {
        console.warn(`YouTube Player Error: ${errorCode}. Skipping to next song...`);
        // 100 ensures video was removed, 101/150 means play on embedded players is blocked
        if (this.currentPlaylist && this.currentPlaylist.length > 1) {
            this.playNext();
        } else {
            this.ui.setPlayingState(false);
        }
    }

    onTimeUpdate(currentTime, duration) {
        this.ui.updateProgress(currentTime, duration);
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
