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
            this.onTimeUpdate.bind(this)
        );

        this.currentPlaylist = [];
        this.currentPlaylistIndex = -1;
        this.currentSong = null;

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
            });
        });

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
        });

        // Progress bar seeking
        const progressEl = document.getElementById('progress-bar');
        progressEl.addEventListener('change', (e) => {
            this.player.seekTo(parseFloat(e.target.value));
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

    playSong(song, contextPlaylist = []) {
        this.currentSong = song;
        if (contextPlaylist.length > 0) {
            this.currentPlaylist = contextPlaylist;
            this.currentPlaylistIndex = this.currentPlaylist.findIndex(s => s.id === song.id);
        }

        StorageUtils.addRecent(song);
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
        this.currentPlaylistIndex = (this.currentPlaylistIndex + 1) % this.currentPlaylist.length;
        const nextSong = this.currentPlaylist[this.currentPlaylistIndex];
        this.playSong(nextSong, this.currentPlaylist);
    }

    playPrev() {
        if (this.currentPlaylist.length === 0) return;
        this.currentPlaylistIndex = (this.currentPlaylistIndex - 1 + this.currentPlaylist.length) % this.currentPlaylist.length;
        const prevSong = this.currentPlaylist[this.currentPlaylistIndex];
        this.playSong(prevSong, this.currentPlaylist);
    }

    // Callbacks from Player
    onPlayerReady() {
        // Player is ready logic
    }

    onPlayerStateChange(state) {
        if (state === YT.PlayerState.PLAYING) {
            this.ui.setPlayingState(true);
            document.body.classList.add('is-pulsing');
        } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
            this.ui.setPlayingState(false);
            document.body.classList.remove('is-pulsing');
        }

        if (state === YT.PlayerState.ENDED) {
            this.playNext(); // Autoplay
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
