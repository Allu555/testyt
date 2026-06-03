import { YouTubeAPI } from './api.js?v=7';
import { Player } from './player.js?v=4';
import { StorageUtils } from './storage.js?v=4';
import { UI } from './ui.js?v=7';
import { Auth } from './auth.js?v=4';
import { AdminCharts } from './admin-charts.js';
import { AudioVisualizer } from './visualizer.js';
import { LyricsManager } from './lyrics.js';

// Helper function to compress and resize image before storing in localStorage
function compressAndResizeImage(file, maxWidth = 256, maxHeight = 256) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Invalid image file'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Use JPEG format with 0.8 quality to keep it compact
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(compressedDataUrl);
            };
            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

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

        this.adminCharts = new AdminCharts();
        this.visualizer = new AudioVisualizer();
        this.lyrics = new LyricsManager();

        this.currentPlaylist = [];
        this.currentPlaylistIndex = -1;
        this.currentSong = null;

        this.isShuffle = false;
        this.repeatMode = 'off'; // 'off', 'one', 'all'
        this.isMuted = false;
        this.lastVolume = 100;

        this.debounceTimeout = null;
        this._previousView = null;

        this.initAuth();
        this.visualizer.init();
        this.lyrics.init();
        
        // Export app instance for lyrics component to access seekTo
        window.app = this;
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
            
            // Populate user profile widget
            const activeUser = this.auth.getActiveUser();
            if (activeUser && activeUser.username) {
                const displayName = document.getElementById('user-display-name');
                const avatarContainer = document.getElementById('user-avatar-container');
                const homeAvatar = document.getElementById('home-avatar');
                const homeGreeting = document.getElementById('home-greeting');
                const homeTimeLabel = document.querySelector('.home-time-label');
                const settingsAvatarPreview = document.getElementById('settings-avatar-preview');

                if (displayName) displayName.textContent = activeUser.username;
                // Update greeting name
                if (homeGreeting) homeGreeting.textContent = activeUser.username;
                // Update time-of-day label
                if (homeTimeLabel) {
                    const h = new Date().getHours();
                    homeTimeLabel.textContent = h < 12 ? 'Good morning ☀️' : h < 18 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
                }
                
                const setAvatar = (container) => {
                    if (!container) return;
                    if (activeUser.profilePic) {
                        container.innerHTML = `<img src="${activeUser.profilePic}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="Profile">`;
                    } else {
                        container.innerHTML = `<span style="font-weight: 800;">${activeUser.username.charAt(0).toUpperCase()}</span>`;
                    }
                    // Also ensure the home-avatar-wrap has the right class
                    if (container.id === 'home-avatar') {
                        container.classList.add('home-avatar-wrap');
                    }
                };

                setAvatar(avatarContainer);
                setAvatar(homeAvatar);
                setAvatar(settingsAvatarPreview);
                setAvatar(document.getElementById('profile-page-avatar'));
                // Populate top-right admin greeting if present
                const adminGreet = document.getElementById('admin-greeting');
                const adminNameEl = document.getElementById('admin-greet-name');
                const adminAvatarEl = document.getElementById('admin-greet-avatar');
                const adminInitial = document.getElementById('admin-greet-initial');
                const greetLine = document.getElementById('admin-greet-line');
                if (adminGreet && adminNameEl) {
                    // Prepare greeting content but keep it hidden; UI.switchView will show it only on home
                    adminGreet.dataset.ready = 'true';
                    adminGreet.setAttribute('aria-hidden', 'true');
                    adminNameEl.textContent = activeUser.username;
                    // Set avatar or initial
                    if (activeUser.profilePic) {
                        adminAvatarEl.innerHTML = `<img src="${activeUser.profilePic}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
                    } else if (adminInitial) {
                        adminInitial.textContent = activeUser.username.charAt(0).toUpperCase();
                    }
                    // Update time-of-day greeting emoji if available
                    if (greetLine) {
                        const h = new Date().getHours();
                        greetLine.textContent = h < 12 ? 'Good morning ☀️' : h < 18 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
                    }
                    // Make the greeting clickable (go to profile)
                    adminGreet.style.cursor = 'pointer';
                    adminGreet.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.ui && typeof this.ui.switchView === 'function') {
                            this.ui.switchView('profile-view');
                        }
                    });
                }

                const navAdmin = document.getElementById('nav-admin');
                if (navAdmin) {
                    if (activeUser.username === 'admin') {
                        navAdmin.classList.remove('hidden');
                    } else {
                        navAdmin.classList.add('hidden');
                    }
                }
            }

            // Settings Modal & Profile Pic Upload logic
            const avatarContainer = document.getElementById('user-avatar-container');
            const homeAvatar = document.getElementById('home-avatar');
            const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
            const settingsAvatarChangeText = document.getElementById('settings-avatar-change-text');
            const fileUpload = document.getElementById('profile-pic-upload');
            const profileWidget = document.getElementById('user-profile-widget');
            
            // Lyrics toggle buttons (both desktop player bar and mobile now playing view overlay)
            const syncLyricsButtonState = (isVisible) => {
                const b1 = document.getElementById('lyrics-btn');
                const b2 = document.getElementById('np-lyrics-btn');
                if (b1) b1.classList.toggle('active', isVisible);
                if (b2) b2.classList.toggle('active', isVisible);
            };

            const toggleLyricsAction = () => {
                const nowPlaying = this.ui.nowPlayingView || document.getElementById('now-playing-view');
                // If lyrics are going to be shown, remember the current active view so we can restore it later
                if (!this.lyrics.isVisible) {
                    try {
                        const activeView = Object.values(this.ui.views).find(v => v && v.classList && v.classList.contains('active'));
                        this._previousView = activeView ? activeView.id : null;
                    } catch (e) { this._previousView = null; }
                }

                if (nowPlaying && !nowPlaying.classList.contains('hidden')) {
                    this.lyrics.toggle();
                    if (this.lyrics.isVisible) {
                        nowPlaying.classList.add('lyrics-open');
                    } else {
                        nowPlaying.classList.remove('lyrics-open');
                    }
                } else {
                    this.ui.switchView('now-playing-view');
                    setTimeout(() => {
                        this.lyrics.show();
                        const np = this.ui.nowPlayingView || document.getElementById('now-playing-view');
                        if (np) np.classList.add('lyrics-open');
                        syncLyricsButtonState(true);
                    }, 50);
                }
                syncLyricsButtonState(this.lyrics.isVisible);
            };

            const lyricsBtn = document.getElementById('lyrics-btn');
            const npLyricsBtn = document.getElementById('np-lyrics-btn');
            if (lyricsBtn) lyricsBtn.addEventListener('click', toggleLyricsAction);
            if (npLyricsBtn) npLyricsBtn.addEventListener('click', toggleLyricsAction);

            // Listen for lyrics visibility changes triggered from the LyricsManager
            document.addEventListener('lyrics-visibility', (ev) => {
                const visible = ev && ev.detail && ev.detail.visible;
                // sync button states
                syncLyricsButtonState(visible);
                // update now-playing overlay class
                const np = this.ui.nowPlayingView || document.getElementById('now-playing-view');
                if (np) np.classList.toggle('lyrics-open', !!visible);
                // when lyrics are closed, restore previous view (or fallback to home)
                if (!visible) {
                    try {
                        if (this._previousView && this._previousView !== 'now-playing-view') {
                            this.ui.switchView(this._previousView);
                        } else {
                            this.ui.switchView('home-view');
                        }
                    } catch (e) {
                        try { this.ui.switchView('home-view'); } catch (ee) {}
                    }
                    this._previousView = null;
                }
            });
            
            // Settings Overlay
            const settingsOverlay = document.getElementById('settings-overlay');
            const closeSettingsBtn = document.getElementById('close-settings-btn');
            const saveSettingsBtn = document.getElementById('settings-save-btn');

            if (fileUpload) {
                const triggerUpload = (e) => {
                    e.stopPropagation(); // prevent opening settings modal
                    fileUpload.click();
                };

                if (avatarContainer) avatarContainer.addEventListener('click', triggerUpload);
                if (settingsAvatarPreview) settingsAvatarPreview.addEventListener('click', triggerUpload);
                if (settingsAvatarChangeText) settingsAvatarChangeText.addEventListener('click', triggerUpload);

                const profilePageAvatar = document.getElementById('profile-page-avatar');
                if (profilePageAvatar) profilePageAvatar.addEventListener('click', triggerUpload);

                fileUpload.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            const dataUrl = await compressAndResizeImage(file);
                            if (activeUser && activeUser.username) {
                                this.auth.setProfilePicture(activeUser.username, dataUrl);
                                location.reload(); // Quick refresh to update all instances
                            }
                        } catch (err) {
                            console.error('Error uploading profile picture:', err);
                            alert('Failed to process image. Please try a different file.');
                        }
                    }
                });
            }

            if (homeAvatar) {
                homeAvatar.style.cursor = 'pointer';
                homeAvatar.title = 'View your profile details';
                homeAvatar.addEventListener('click', () => {
                    this.ui.switchView('profile-view');
                    this.renderProfile();
                });
            }

            if (profileWidget && settingsOverlay) {
                profileWidget.style.cursor = 'pointer';
                profileWidget.addEventListener('click', () => {
                    settingsOverlay.classList.remove('hidden');
                });
                closeSettingsBtn.addEventListener('click', () => {
                    settingsOverlay.classList.add('hidden');
                    document.getElementById('settings-error').classList.add('hidden');
                    document.getElementById('settings-success').classList.add('hidden');
                });
                saveSettingsBtn.addEventListener('click', () => {
                    const oldPass = document.getElementById('settings-old-pass').value;
                    const newPass = document.getElementById('settings-new-pass').value;
                    const errEl = document.getElementById('settings-error');
                    const sucEl = document.getElementById('settings-success');
                    
                    errEl.classList.add('hidden');
                    sucEl.classList.add('hidden');

                    const res = this.auth.updatePassword(activeUser.username, oldPass, newPass);
                    if (res.success) {
                        sucEl.textContent = 'Password updated successfully!';
                        sucEl.classList.remove('hidden');
                        setTimeout(() => settingsOverlay.classList.add('hidden'), 1500);
                    } else {
                        errEl.textContent = res.error;
                        errEl.classList.remove('hidden');
                    }
                });
            }

            // Make profile widget open login overlay when not logged in
            if (profileWidget) {
                profileWidget.addEventListener('click', (e) => {
                    e.preventDefault();
                    const overlayEl = document.getElementById('auth-overlay');
                    if (!this.auth.isLoggedIn()) {
                        if (overlayEl) {
                            overlayEl.classList.remove('hidden');
                            const usernameInput = document.getElementById('auth-username');
                            if (usernameInput) usernameInput.focus();
                        }
                    }
                });
            }

            this.init(); // Starts original app initialization
        } else {
            overlay.classList.remove('hidden');
        }

        const authProfilePicContainer = document.getElementById('auth-profile-pic-container');
        const regProfilePic = document.getElementById('reg-profile-pic');
        const regAvatarPreview = document.getElementById('reg-avatar-preview');
        let tempRegProfilePic = null;

        if (regAvatarPreview && regProfilePic) {
            regAvatarPreview.addEventListener('click', () => regProfilePic.click());
            regProfilePic.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        tempRegProfilePic = await compressAndResizeImage(file);
                        regAvatarPreview.innerHTML = `<img src="${tempRegProfilePic}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                    } catch (err) {
                        console.error('Error resizing registration profile picture:', err);
                        alert('Failed to process image. Please try a different file.');
                    }
                }
            });
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
                if (authProfilePicContainer) authProfilePicContainer.classList.add('hidden');
            } else {
                subtitle.textContent = 'Create a new account';
                submitBtn.textContent = 'Sign Up';
                toggleBtn.textContent = 'Log In';
                document.getElementById('auth-toggle-text').childNodes[0].nodeValue = "Already have an account? ";
                if (authProfilePicContainer) authProfilePicContainer.classList.remove('hidden');
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
                res = this.auth.register(user, pass, tempRegProfilePic);
                if (res.success) {
                    res = this.auth.login(user, pass);
                }
            }

            if (res.success) {
                if (isLoginMode) {
                    StorageUtils.addAdminLog(user, 'login', 'Logged in successfully');
                } else {
                    StorageUtils.addAdminLog(user, 'register', 'Created a new account');
                    StorageUtils.addAdminLog(user, 'login', 'Logged in successfully');
                }
                overlay.classList.add('hidden');
                // Reload cleanly to inject scoped local API storage settings
                location.reload(); 
            } else {
                errorEl.textContent = res.error;
                errorEl.classList.remove('hidden');
                if (toggleBtn) {
                    toggleBtn.style.cursor = 'pointer';
                    toggleBtn.setAttribute('role', 'button');
                    toggleBtn.tabIndex = 0;
                    toggleBtn.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') toggleBtn.click();
                    });
                }
            }
        });

        // Add logout listener
        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const activeUser = this.auth.getActiveUser();
                if (activeUser && activeUser.username) {
                    StorageUtils.addAdminLog(activeUser.username, 'logout', 'Logged out successfully');
                }
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
                </div>
                <div class="card-text">
                    <div class="card-title" title="${pl.title}">${pl.title}</div>
                    <div class="card-channel">${pl.tracks.length} Tracks</div>
                </div>
                <button class="card-play-btn"><i class="fas fa-play"></i></button>
                <button class="card-delete-btn"><i class="fas fa-trash"></i></button>
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
            
            // Clean Spotify-style hover (no 3D tilt)
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

        this.hydrateImportedPlaylistImages(playlist);
    }

    async hydrateImportedPlaylistImages(playlist) {
        const tracks = playlist.tracks || [];
        if (playlist._hydratingImages || playlist.spotifyImagesHydrated || tracks.length < 2) return;

        const thumbnails = tracks.map(track => track.thumbnail).filter(Boolean);
        const repeatedThumbnail = thumbnails.length > 1 && new Set(thumbnails).size === 1;
        const needsResolution = repeatedThumbnail || tracks.some(track => track.isSpotify && !track.id);
        if (!needsResolution) return;

        playlist._hydratingImages = true;
        try {
            for (const track of tracks) {
                if (!track.title) continue;
                await this.resolvePlayableSong(track, { forceThumbnail: repeatedThumbnail });
            }

            playlist.spotifyImagesHydrated = true;
            playlist._hydratingImages = false;
            StorageUtils.savePlaylists(StorageUtils.getSavedPlaylists().map(saved => (
                saved.id === playlist.id ? playlist : saved
            )));

            if (this.currentViewedPlaylist && this.currentViewedPlaylist.id === playlist.id) {
                this.renderPlaylistDetail(playlist);
            }
            this.renderPlaylists();
        } catch (err) {
            console.warn('Could not refresh imported playlist images:', err);
        } finally {
            playlist._hydratingImages = false;
        }
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
        const activeUser = this.auth.getActiveUser();
        
        // 1. Recents
        const recents = StorageUtils.getRecent();
        const recentsContainer = document.getElementById('recent-results');
        if (recentsContainer) {
            this.ui.renderSongs(
                recentsContainer, 
                recents, 
                (song) => this.playSong(song, recents),
                (song) => {
                    StorageUtils.removeRecent(song.id);
                    this.renderHome();
                }
            );
        }

        // 2. Dynamic stats aggregation across all users to compute popular songs and artists
        const users = this.auth.getUsers();
        const usernames = Object.keys(users);
        
        const allSongPlays = {};
        const artistPlays = {};
        const songMetadata = {};

        usernames.forEach(uname => {
            const recentKey = uname + '_ytpm_recent';
            const favoritesKey = uname + '_ytpm_favorites';
            let recentList = [];
            let favoritesList = [];
            try {
                const rec = localStorage.getItem(recentKey);
                recentList = rec ? JSON.parse(rec) : [];
            } catch(e){}
            try {
                const fav = localStorage.getItem(favoritesKey);
                favoritesList = fav ? JSON.parse(fav) : [];
            } catch(e){}

            // Count plays from recents
            recentList.forEach(song => {
                allSongPlays[song.id] = (allSongPlays[song.id] || 0) + 1.5; // play count weight
                songMetadata[song.id] = song;
                
                const artist = song.channelTitle || 'Unknown Artist';
                artistPlays[artist] = (artistPlays[artist] || 0) + 1.5;
            });

            // Count favorites
            favoritesList.forEach(song => {
                allSongPlays[song.id] = (allSongPlays[song.id] || 0) + 2.5; // favorite weight
                songMetadata[song.id] = song;
                
                const artist = song.channelTitle || 'Unknown Artist';
                artistPlays[artist] = (artistPlays[artist] || 0) + 2.5;
            });
        });

        // Popular songs sorted by computed weight
        let popularSongs = Object.keys(allSongPlays)
            .map(id => ({ ...songMetadata[id], score: allSongPlays[id] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        // Fallbacks if empty
        if (popularSongs.length === 0) {
            popularSongs = [
                { id: "kJQP7kiw5Fk", title: "Despacito", channelTitle: "Luis Fonsi ft. Daddy Yankee", thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/0.jpg" },
                { id: "JGwWNGJdvx8", title: "Shape of You", channelTitle: "Ed Sheeran", thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/0.jpg" },
                { id: "OPf0YbXqDm0", title: "Uptown Funk", channelTitle: "Mark Ronson ft. Bruno Mars", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/0.jpg" },
                { id: "YykjpeuMNEk", title: "Closer", channelTitle: "The Chainsmokers", thumbnail: "https://i.ytimg.com/vi/YykjpeuMNEk/0.jpg" },
                { id: "i0p1bmr0EmE", title: "Perfect", channelTitle: "Ed Sheeran", thumbnail: "https://i.ytimg.com/vi/i0p1bmr0EmE/0.jpg" }
            ];
        }

        // Render Popular Songs
        const popularContainer = document.getElementById('home-popular-songs');
        if (popularContainer) {
            this.ui.renderSongs(popularContainer, popularSongs, (song) => this.playSong(song, popularSongs));
        }

        // Top Artists sorted by weight
        let topArtists = Object.keys(artistPlays)
            .map(name => ({ name, score: artistPlays[name] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        // Fallback artists if empty
        if (topArtists.length === 0) {
            topArtists = [
                { name: "Shaan Rahman", thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&q=80" },
                { name: "A. R. Rahman", thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&q=80" },
                { name: "The Weeknd", thumbnail: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=120&q=80" },
                { name: "Taylor Swift", thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&q=80" },
                { name: "Billie Eilish", thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=120&q=80" }
            ];
        }

        // Render Top Artists
        const artistsContainer = document.getElementById('home-top-artists');
        if (artistsContainer) {
            this.ui.renderArtists(artistsContainer, topArtists, (artistName) => {
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.value = artistName;
                    this.ui.switchView('search-view');
                    this.performSearch(artistName);
                }
            });
        }

        // 3. Most Liked (Active User's Favorites)
        const favs = StorageUtils.getFavorites();
        const likedContainer = document.getElementById('home-most-liked');
        if (likedContainer) {
            this.ui.renderSongs(
                likedContainer, 
                favs, 
                (song) => this.playSong(song, favs)
            );
        }
    }

    renderProfile() {
        const activeUser = this.auth.getActiveUser();
        if (!activeUser) return;

        const usernameEl = document.getElementById('profile-page-username');
        const joinedEl = document.getElementById('profile-page-joined');
        const avatarEl = document.getElementById('profile-page-avatar');
        const adminBtn = document.getElementById('profile-admin-btn');

        if (usernameEl) usernameEl.textContent = activeUser.username;
        
        let regDate = 'Unknown';
        if (activeUser.createdAt) {
            try {
                const date = new Date(activeUser.createdAt);
                regDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
            } catch(e){}
        }
        if (joinedEl) joinedEl.textContent = `Member since ${regDate}`;

        if (avatarEl) {
            if (activeUser.profilePic) {
                avatarEl.innerHTML = `<img src="${activeUser.profilePic}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="Profile">`;
            } else {
                avatarEl.innerHTML = activeUser.username.charAt(0).toUpperCase();
            }
        }

        if (adminBtn) {
            if (activeUser.username === 'admin') {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }

        const recents = StorageUtils.getRecent();
        const favorites = StorageUtils.getFavorites();
        const playlists = StorageUtils.getSavedPlaylists();

        const playsStat = document.getElementById('profile-stat-plays');
        const likesStat = document.getElementById('profile-stat-likes');
        const playlistsStat = document.getElementById('profile-stat-playlists');

        if (playsStat) playsStat.textContent = recents.length;
        if (likesStat) likesStat.textContent = favorites.length;
        if (playlistsStat) playlistsStat.textContent = playlists.length;

        const recentActivityContainer = document.getElementById('profile-recent-activity');
        if (recentActivityContainer) {
            this.ui.renderSongs(
                recentActivityContainer,
                recents.slice(0, 10),
                (song) => this.playSong(song, recents),
                (song) => {
                    StorageUtils.removeRecent(song.id);
                    this.renderProfile();
                }
            );
        }

        const likedContainer = document.getElementById('profile-most-liked');
        if (likedContainer) {
            this.ui.renderSongs(
                likedContainer,
                favorites.slice(0, 10),
                (song) => this.playSong(song, favorites)
            );
        }

        const userSongPlays = {};
        const userArtistPlays = {};
        const userSongMetadata = {};

        recents.forEach(song => {
            userSongPlays[song.id] = (userSongPlays[song.id] || 0) + 1.5;
            userSongMetadata[song.id] = song;
            const artist = song.channelTitle || 'Unknown Artist';
            userArtistPlays[artist] = (userArtistPlays[artist] || 0) + 1.5;
        });

        favorites.forEach(song => {
            userSongPlays[song.id] = (userSongPlays[song.id] || 0) + 2.5;
            userSongMetadata[song.id] = song;
            const artist = song.channelTitle || 'Unknown Artist';
            userArtistPlays[artist] = (userArtistPlays[artist] || 0) + 2.5;
        });

        const popularSongs = Object.keys(userSongPlays)
            .map(id => ({ ...userSongMetadata[id], score: userSongPlays[id] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        const popularContainer = document.getElementById('profile-popular-songs');
        if (popularContainer) {
            this.ui.renderSongs(
                popularContainer,
                popularSongs,
                (song) => this.playSong(song, popularSongs)
            );
        }

        const topArtists = Object.keys(userArtistPlays)
            .map(name => ({ name, score: userArtistPlays[name] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        const artistsContainer = document.getElementById('profile-top-artists');
        if (artistsContainer) {
            this.ui.renderArtists(artistsContainer, topArtists, (artistName) => {
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.value = artistName;
                    this.ui.switchView('search-view');
                    this.performSearch(artistName);
                }
            });
        }
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

    renderAdminDashboard() {
        const activeUser = this.auth.getActiveUser();
        if (!activeUser || activeUser.username !== 'admin') {
            this.ui.switchView('home-view');
            this.renderHome();
            return;
        }

        const users = this.auth.getUsers();
        const usernames = Object.keys(users);
        
        let totalPlays = 0;
        let totalPlaylists = 0;
        let totalLikes = 0;

        const usersData = usernames.map(uname => {
            const recentKey = uname + '_ytpm_recent';
            const playlistsKey = uname + '_ytpm_playlists';
            const favoritesKey = uname + '_ytpm_favorites';

            let playsList = [];
            let playlistsList = [];
            let favoritesList = [];

            try {
                const recent = localStorage.getItem(recentKey);
                playsList = recent ? JSON.parse(recent) : [];
            } catch(e){}
            try {
                const playlists = localStorage.getItem(playlistsKey);
                playlistsList = playlists ? JSON.parse(playlists) : [];
            } catch(e){}
            try {
                const favorites = localStorage.getItem(favoritesKey);
                favoritesList = favorites ? JSON.parse(favorites) : [];
            } catch(e){}

            totalPlays += playsList.length;
            totalPlaylists += playlistsList.length;
            totalLikes += favoritesList.length;

            return {
                username: uname,
                profilePic: users[uname].profilePic,
                createdAt: users[uname].createdAt || 'Unknown',
                playlistsCount: playlistsList.length,
                likesCount: favoritesList.length,
                playsCount: playsList.length,
                playlists: playlistsList,
                likes: favoritesList,
                recents: playsList
            };
        });

        document.getElementById('admin-stat-users').textContent = usernames.length;
        document.getElementById('admin-stat-plays').textContent = totalPlays;
        document.getElementById('admin-stat-playlists').textContent = totalPlaylists;
        document.getElementById('admin-stat-likes').textContent = totalLikes;

        const tableBody = document.getElementById('admin-users-table-body');
        tableBody.innerHTML = '';

        usersData.forEach(ud => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.05);';
            
            let regDate = 'Unknown';
            if (ud.createdAt && ud.createdAt !== 'Unknown') {
                try {
                    const date = new Date(ud.createdAt);
                    regDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                } catch(e){}
            }

            const avatarHTML = ud.profilePic 
                ? `<img src="${ud.profilePic}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-highlight); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; text-transform: uppercase;">${ud.username.charAt(0)}</div>`;

            tr.innerHTML = `
                <td style="padding: 12px 8px; display: flex; align-items: center; gap: 8px;">
                    ${avatarHTML}
                    <span style="font-weight: 600; color: var(--text-primary);">${ud.username}</span>
                    ${ud.username === 'admin' ? '<span style="font-size: 9px; background: var(--accent); color: #000; padding: 1px 4px; border-radius: 4px; font-weight: 700; margin-left: 4px;">ADMIN</span>' : ''}
                </td>
                <td style="padding: 12px 8px; color: var(--text-secondary);">${regDate}</td>
                <td style="padding: 12px 8px; text-align: center; color: var(--text-primary); font-weight: 500;">${ud.playlistsCount}</td>
                <td style="padding: 12px 8px; text-align: center; color: var(--text-primary); font-weight: 500;">${ud.likesCount}</td>
                <td style="padding: 12px 8px; text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="admin-view-user-btn btn-primary" data-user="${ud.username}" style="padding: 4px 10px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.08); color: white;"><i class="fas fa-eye"></i> View</button>
                        ${ud.username !== 'admin' ? `
                            <button class="admin-reset-user-btn btn-primary" data-user="${ud.username}" style="padding: 4px 10px; font-size: 11px; font-weight: 600; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2);"><i class="fas fa-key"></i> Key</button>
                            <button class="admin-delete-user-btn btn-primary" data-user="${ud.username}" style="padding: 4px 10px; font-size: 11px; font-weight: 600; background: rgba(233, 20, 41, 0.15); color: var(--danger); border: 1px solid rgba(233, 20, 41, 0.2);"><i class="fas fa-trash-alt"></i> Del</button>
                        ` : ''}
                    </div>
                </td>
            `;

            tr.querySelector('.admin-view-user-btn').addEventListener('click', () => this.showAdminUserDetails(ud));
            
            if (ud.username !== 'admin') {
                tr.querySelector('.admin-reset-user-btn').addEventListener('click', () => {
                    const newPass = prompt(`Enter a new password for user "${ud.username}":`);
                    if (newPass !== null) {
                        const result = this.auth.resetUserPassword(ud.username, newPass);
                        if (result.success) {
                            alert(`Password for user "${ud.username}" has been successfully updated.`);
                            StorageUtils.addAdminLog('admin', 'reset_password', `Password reset for user "${ud.username}"`);
                            this.renderAdminDashboard();
                        } else {
                            alert(`Error: ${result.error}`);
                        }
                    }
                });

                tr.querySelector('.admin-delete-user-btn').addEventListener('click', () => {
                    if (confirm(`Are you absolutely sure you want to delete user "${ud.username}" and all their playlists, likes, and history? This action is irreversible.`)) {
                        const result = this.auth.deleteUser(ud.username);
                        if (result.success) {
                            StorageUtils.deleteUserData(ud.username);
                            StorageUtils.addAdminLog('admin', 'delete_user', `Deleted user account "${ud.username}"`);
                            alert(`User "${ud.username}" has been deleted.`);
                            this.renderAdminDashboard();
                        } else {
                            alert(`Error: ${result.error}`);
                        }
                    }
                });
            }

            tableBody.appendChild(tr);
        });

        const logsConsole = document.getElementById('admin-logs-console');
        const logs = StorageUtils.getAdminLogs();
        
        // Render charts
        if (this.adminCharts) {
            this.adminCharts.render(usersData, logs);
        }

        if (logsConsole) {
            logsConsole.innerHTML = '';
            if (logs.length === 0) {
                logsConsole.innerHTML = '<span style="color: var(--text-muted);">Console active. No events recorded yet.</span>';
            } else {
                logs.forEach(log => {
                    let logTime = '';
                    try {
                        const d = new Date(log.timestamp);
                        logTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    } catch(e){}
                    
                    const logSpan = document.createElement('div');
                    logSpan.style.marginBottom = '4px';
                    
                    let actionColor = '#34d399';
                    if (log.action === 'login' || log.action === 'logout') actionColor = '#60a5fa';
                    if (log.action === 'register' || log.action === 'import_playlist') actionColor = '#fbbf24';
                    if (log.action === 'delete_user') actionColor = '#f87171';
                    if (log.action === 'reset_password') actionColor = '#c084fc';

                    logSpan.innerHTML = `
                        <span style="color: var(--text-muted); font-size: 10px;">[${logTime}]</span> 
                        <span style="color: #fff; font-weight: 600;">${log.username}</span> 
                        <span style="color: ${actionColor}; font-weight: 500;">${log.action}</span> 
                        <span style="color: var(--text-secondary);">${log.details || ''}</span>
                    `;
                    logsConsole.appendChild(logSpan);
                });
            }
        }

        const topSongsContainer = document.getElementById('admin-top-songs');
        const songLikesMap = {};
        usersData.forEach(ud => {
            ud.likes.forEach(song => {
                const key = song.title + ' | ' + song.channelTitle;
                if (!songLikesMap[key]) {
                    songLikesMap[key] = {
                        title: song.title,
                        artist: song.channelTitle,
                        likes: 0,
                        thumbnail: song.thumbnail
                    };
                }
                songLikesMap[key].likes++;
            });
        });

        const sortedSongs = Object.values(songLikesMap).sort((a,b) => b.likes - a.likes).slice(0, 5);
        if (topSongsContainer) {
            topSongsContainer.innerHTML = '';
            if (sortedSongs.length === 0) {
                topSongsContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">No liked songs recorded yet.</span>';
            } else {
                sortedSongs.forEach((song, idx) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: var(--radius);';
                    
                    const songThumb = song.thumbnail 
                        ? `<img src="${song.thumbnail}" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover;">`
                        : `<div style="width: 32px; height: 32px; border-radius: 4px; background: var(--bg-highlight); display: flex; align-items: center; justify-content: center; font-size: 12px;"><i class="fas fa-music"></i></div>`;
                    
                    row.innerHTML = `
                        <div style="font-weight: 700; color: var(--accent); font-size: 14px; width: 16px;">#${idx+1}</div>
                        ${songThumb}
                        <div style="flex: 1; min-width: 0; text-align: left;">
                            <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${song.title}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${song.artist}</div>
                        </div>
                        <div style="font-size: 12px; color: var(--accent); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                            <i class="fas fa-heart"></i> ${song.likes}
                        </div>
                    `;
                    topSongsContainer.appendChild(row);
                });
            }
        }

        const topUsersContainer = document.getElementById('admin-top-users');
        const sortedUsers = [...usersData].sort((a,b) => (b.likesCount + b.playsCount) - (a.likesCount + a.playsCount)).slice(0, 5);
        if (topUsersContainer) {
            topUsersContainer.innerHTML = '';
            if (sortedUsers.length === 0) {
                topUsersContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">No user activity recorded yet.</span>';
            } else {
                sortedUsers.forEach((user, idx) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: var(--radius);';
                    
                    const userAvatar = user.profilePic 
                        ? `<img src="${user.profilePic}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
                        : `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-highlight); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; text-transform: uppercase;">${user.username.charAt(0)}</div>`;
                    
                    row.innerHTML = `
                        <div style="font-weight: 700; color: #a78bfa; font-size: 14px; width: 16px;">#${idx+1}</div>
                        ${userAvatar}
                        <div style="flex: 1; min-width: 0; text-align: left;">
                            <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${user.username}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">${user.playsCount} Plays • ${user.likesCount} Likes</div>
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">
                            Score: ${user.playsCount + user.likesCount}
                        </div>
                    `;
                    topUsersContainer.appendChild(row);
                });
            }
        }
    }

    showAdminUserDetails(userData) {
        const overlay = document.getElementById('admin-user-details-overlay');
        const avatar = document.getElementById('admin-details-avatar');
        const title = document.getElementById('admin-details-title');
        const subtitle = document.getElementById('admin-details-subtitle');
        
        const playlistsContainer = document.getElementById('admin-details-playlists');
        const likesContainer = document.getElementById('admin-details-likes');
        const recentsContainer = document.getElementById('admin-details-recents');

        if (!overlay) return;

        title.textContent = `Profile: ${userData.username}`;
        
        let regDate = 'Unknown';
        if (userData.createdAt && userData.createdAt !== 'Unknown') {
            try {
                const date = new Date(userData.createdAt);
                regDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
            } catch(e){}
        }
        subtitle.textContent = `Registered on ${regDate}`;

        if (userData.profilePic) {
            avatar.innerHTML = `<img src="${userData.profilePic}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatar.innerHTML = userData.username.charAt(0).toUpperCase();
        }

        playlistsContainer.innerHTML = '';
        if (userData.playlists.length === 0) {
            playlistsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 12px;">No playlists created.</span>';
        } else {
            userData.playlists.forEach(pl => {
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius); font-size: 13px;';
                div.innerHTML = `
                    <div style="font-weight: 600; color: var(--text-primary);"><i class="fas fa-layer-group" style="color: var(--accent); margin-right: 6px;"></i> ${pl.title}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${pl.tracks.length} tracks</div>
                `;
                playlistsContainer.appendChild(div);
            });
        }

        likesContainer.innerHTML = '';
        if (userData.likes.length === 0) {
            likesContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 12px;">No liked songs.</span>';
        } else {
            userData.likes.forEach(song => {
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius); font-size: 13px;';
                
                const thumb = song.thumbnail 
                    ? `<img src="${song.thumbnail}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover;">`
                    : `<div style="width: 24px; height: 24px; border-radius: 4px; background: var(--bg-highlight); display: flex; align-items: center; justify-content: center;"><i class="fas fa-music" style="font-size: 10px;"></i></div>`;
                
                div.innerHTML = `
                    ${thumb}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${song.title}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${song.channelTitle}</div>
                    </div>
                `;
                likesContainer.appendChild(div);
            });
        }

        recentsContainer.innerHTML = '';
        if (userData.recents.length === 0) {
            recentsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 12px;">No recently played history.</span>';
        } else {
            userData.recents.forEach(song => {
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius); font-size: 13px;';
                
                const thumb = song.thumbnail 
                    ? `<img src="${song.thumbnail}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover;">`
                    : `<div style="width: 24px; height: 24px; border-radius: 4px; background: var(--bg-highlight); display: flex; align-items: center; justify-content: center;"><i class="fas fa-music" style="font-size: 10px;"></i></div>`;
                
                div.innerHTML = `
                    ${thumb}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${song.title}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${song.channelTitle}</div>
                    </div>
                `;
                recentsContainer.appendChild(div);
            });
        }

        overlay.classList.remove('hidden');
    }

    async renderDiscover(query = null) {
        const container = document.getElementById('discover-results');
        const loader = document.getElementById('discover-loader');
        const heroBanner = document.getElementById('discover-hero-banner');
        const sectionTitle = document.getElementById('discover-section-title');

        if (!container) return;
        container.innerHTML = '';
        if (loader) loader.classList.remove('hidden');

        const users = this.auth.getUsers();
        const usernames = Object.keys(users);
        const allSongPlays = {};
        const songMetadata = {};

        usernames.forEach(uname => {
            const recentKey = uname + '_ytpm_recent';
            const favoritesKey = uname + '_ytpm_favorites';
            let recentList = [];
            let favoritesList = [];
            try { recentList = JSON.parse(localStorage.getItem(recentKey)) || []; } catch (e) {}
            try { favoritesList = JSON.parse(localStorage.getItem(favoritesKey)) || []; } catch (e) {}

            recentList.forEach(song => {
                allSongPlays[song.id] = (allSongPlays[song.id] || 0) + 1.5;
                songMetadata[song.id] = song;
            });
            favoritesList.forEach(song => {
                allSongPlays[song.id] = (allSongPlays[song.id] || 0) + 2.5;
                songMetadata[song.id] = song;
            });
        });

        let discoverSongs = Object.keys(allSongPlays)
            .map(id => ({ ...songMetadata[id], score: allSongPlays[id] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);

        if (discoverSongs.length === 0) {
            discoverSongs = [
                { id: 'kJQP7kiw5Fk', title: 'Despacito', channelTitle: 'Luis Fonsi ft. Daddy Yankee', thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/0.jpg' },
                { id: 'JGwWNGJdvx8', title: 'Shape of You', channelTitle: 'Ed Sheeran', thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/0.jpg' },
                { id: 'OPf0YbXqDm0', title: 'Uptown Funk', channelTitle: 'Mark Ronson ft. Bruno Mars', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/0.jpg' },
                { id: 'YykjpeuMNEk', title: 'Closer', channelTitle: 'The Chainsmokers', thumbnail: 'https://i.ytimg.com/vi/YykjpeuMNEk/0.jpg' },
                { id: 'i0p1bmr0EmE', title: 'Perfect', channelTitle: 'Ed Sheeran', thumbnail: 'https://i.ytimg.com/vi/i0p1bmr0EmE/0.jpg' }
            ];
        }

        if (query) {
            const lower = query.toLowerCase();
            discoverSongs = discoverSongs.filter(song =>
                (song.title || '').toLowerCase().includes(lower) ||
                (song.channelTitle || '').toLowerCase().includes(lower)
            );
        }

        if (loader) loader.classList.add('hidden');
        if (sectionTitle) sectionTitle.textContent = query ? `Discover results for "${query}"` : 'Discover fresh music';
        if (heroBanner) heroBanner.style.display = query ? 'none' : 'block';

        if (!query && discoverSongs.length > 0) {
            const topSong = discoverSongs[0];
            const heroBg = document.getElementById('discover-hero-bg');
            if (heroBg) heroBg.src = topSong.thumbnail || 'https://placehold.co/900x500/111827/94a3b8?text=Discover+Music';
            const heroTitle = document.getElementById('discover-hero-title');
            if (heroTitle) heroTitle.textContent = 'Your top pick today';
            const heroDesc = document.getElementById('discover-hero-desc');
            if (heroDesc) heroDesc.textContent = `Start with ${topSong.title} by ${topSong.channelTitle}.`;
            const playBtn = document.getElementById('discover-hero-play');
            if (playBtn) playBtn.onclick = () => this.playSong(topSong, discoverSongs);
        }

        if (discoverSongs.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">No discover recommendations found.</p>';
            return;
        }

        this.ui.renderSongs(container, discoverSongs, (song) => this.playSong(song, discoverSongs));
    }

    playMovie(imdb_code, title, tmdb_id = null) {
        const overlay = document.getElementById('movie-player-overlay');
        const iframe = document.getElementById('movie-iframe');
        const overlayTitle = document.getElementById('movie-player-title');
        
        // If we have a TMDB ID but no IMDB code, fetch the IMDB ID first
        if (!imdb_code && tmdb_id) {
            overlayTitle.textContent = `Loading ${title || 'movie'}...`;
            overlay.classList.remove('hidden');
            
            const proxyUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:8000' : '';
            
            fetch(`${proxyUrl}/api/movies/${tmdb_id}/imdb`)
                .then(r => r.json())
                .then(data => {
                    if (data.imdb_id) {
                        this._loadMovieStream(data.imdb_id, tmdb_id, title, iframe, overlayTitle);
                    } else {
                        // Fall back to TMDB ID based embed
                        this._loadMovieStream(null, tmdb_id, title, iframe, overlayTitle);
                    }
                })
                .catch(() => {
                    this._loadMovieStream(null, tmdb_id, title, iframe, overlayTitle);
                });
            
            // Pause music if any is playing
            if (this.currentSong && typeof this.player.pause === 'function') {
                this.player.pause();
                this.ui.setPlayingState(false);
            }
            return;
        }
        
        if (!imdb_code && !tmdb_id) {
            alert('Movie stream not available. Missing ID.');
            return;
        }

        overlay.classList.remove('hidden');
        this._loadMovieStream(imdb_code, tmdb_id, title, iframe, overlayTitle);
        
        // Pause music if any is playing
        if (this.currentSong && typeof this.player.pause === 'function') {
            this.player.pause();
            this.ui.setPlayingState(false);
        }
    }

    _loadMovieStream(imdb_code, tmdb_id, title, iframe, overlayTitle) {
        // Multiple embed sources for reliability
        const sources = [];
        if (imdb_code) {
            sources.push({ name: 'VidSrc PRO', url: `https://vidsrc.pro/embed/movie/${imdb_code}` });
            sources.push({ name: 'VidSrc ICU', url: `https://vidsrc.icu/embed/movie/${imdb_code}` });
            sources.push({ name: 'AutoEmbed', url: `https://autoembed.cc/movie/imdb/${imdb_code}` });
            sources.push({ name: 'MultiEmbed', url: `https://multiembed.mov/?video_id=${imdb_code}&tmdb=0` });
            sources.push({ name: 'VidSrc XYZ', url: `https://vidsrc.xyz/embed/movie?imdb=${imdb_code}` });
        }
        if (tmdb_id) {
            sources.push({ name: 'VidSrc (TMDB)', url: `https://vidsrc.pro/embed/movie/${tmdb_id}` });
            sources.push({ name: 'AutoEmbed (TMDB)', url: `https://autoembed.cc/movie/tmdb/${tmdb_id}` });
            sources.push({ name: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${tmdb_id}&tmdb=1` });
        }

        this._currentMovieSources = sources;
        this._currentMovieSourceIndex = 0;

        // Build or update server selector
        this._buildServerSelector(sources, iframe);

        // Load first source
        if (sources.length > 0) {
            iframe.src = sources[0].url;
            if (title) overlayTitle.textContent = title;
        } else {
            overlayTitle.textContent = 'Stream not available';
        }
    }

    _buildServerSelector(sources, iframe) {
        let selectorContainer = document.getElementById('movie-server-selector');
        if (!selectorContainer) {
            // Create it inside the movie player header
            const header = document.querySelector('.movie-player-header');
            if (header) {
                selectorContainer = document.createElement('div');
                selectorContainer.id = 'movie-server-selector';
                selectorContainer.style.cssText = 'display:flex; gap:6px; align-items:center; flex-wrap:wrap;';
                // Insert before the close button
                const closeBtn = document.getElementById('close-movie-player');
                header.insertBefore(selectorContainer, closeBtn);
            }
        }
        if (!selectorContainer) return;

        selectorContainer.innerHTML = '';
        sources.forEach((src, idx) => {
            const btn = document.createElement('button');
            btn.textContent = src.name;
            btn.className = 'server-btn' + (idx === 0 ? ' active' : '');
            btn.style.cssText = `
                padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15);
                background: ${idx === 0 ? 'rgba(139, 92, 246, 0.6)' : 'rgba(255,255,255,0.08)'};
                color: white; font-size: 11px; cursor: pointer; font-family: inherit;
                transition: all 0.2s ease;
            `;
            btn.addEventListener('click', () => {
                iframe.src = src.url;
                selectorContainer.querySelectorAll('.server-btn').forEach(b => {
                    b.style.background = 'rgba(255,255,255,0.08)';
                    b.classList.remove('active');
                });
                btn.style.background = 'rgba(139, 92, 246, 0.6)';
                btn.classList.add('active');
            });
            selectorContainer.appendChild(btn);
        });
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
                if (target === 'movies-view') this.renderDiscover();
                if (target === 'admin-view') this.renderAdminDashboard();
                if (target === 'profile-view') this.renderProfile();
            });
        });

        const sliderButtons = document.querySelectorAll('.slider-btn');
        sliderButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = button.dataset.target;
                const container = document.getElementById(targetId);
                if (!container) return;
                const direction = button.classList.contains('next-btn') ? 1 : -1;
                const distance = Math.min(container.clientWidth * 0.75, 420);
                container.scrollBy({ left: direction * distance, behavior: 'smooth' });
            });
        });

        // Close Admin User Details Modal
        const closeAdminDetailsBtn = document.getElementById('close-admin-details-btn');
        if (closeAdminDetailsBtn) {
            closeAdminDetailsBtn.addEventListener('click', () => {
                document.getElementById('admin-user-details-overlay').classList.add('hidden');
            });
        }

        // Clear Activity Logs
        const clearLogsBtn = document.getElementById('admin-clear-logs-btn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all activity logs?')) {
                    StorageUtils.clearAdminLogs();
                    StorageUtils.addAdminLog('admin', 'clear_logs', 'Activity logs database cleared');
                    this.renderAdminDashboard();
                }
            });
        }

        // Playlist Detail actions
        const backBtn = document.getElementById('back-to-playlists-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.ui.switchView('playlists-view');
                this.renderPlaylists();
            });
        }
        
        const closeMovieBtn = document.getElementById('close-movie-player');
        if (closeMovieBtn) {
            closeMovieBtn.addEventListener('click', () => {
                const overlay = document.getElementById('movie-player-overlay');
                const iframe = document.getElementById('movie-iframe');
                overlay.classList.add('hidden');
                iframe.src = ''; // Stop video playback
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

        // Profile Page Bindings
        const profileLogoutBtn = document.getElementById('profile-logout-btn');
        if (profileLogoutBtn) {
            profileLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const activeUser = this.auth.getActiveUser();
                if (activeUser && activeUser.username) {
                    StorageUtils.addAdminLog(activeUser.username, 'logout', 'Logged out successfully from profile page');
                }
                this.auth.logout();
                window.location.reload();
            });
        }

        const profileAdminBtn = document.getElementById('profile-admin-btn');
        if (profileAdminBtn) {
            profileAdminBtn.addEventListener('click', () => {
                this.ui.switchView('admin-view');
                this.renderAdminDashboard();
            });
        }

        const profileSaveBtn = document.getElementById('profile-save-btn');
        if (profileSaveBtn) {
            profileSaveBtn.addEventListener('click', () => {
                const oldPass = document.getElementById('profile-old-pass').value;
                const newPass = document.getElementById('profile-new-pass').value;
                const errEl = document.getElementById('profile-settings-error');
                const sucEl = document.getElementById('profile-settings-success');
                const activeUser = this.auth.getActiveUser();
                
                if (errEl) errEl.classList.add('hidden');
                if (sucEl) sucEl.classList.add('hidden');

                const res = this.auth.updatePassword(activeUser.username, oldPass, newPass);
                if (res.success) {
                    if (sucEl) {
                        sucEl.textContent = 'Password updated successfully!';
                        sucEl.classList.remove('hidden');
                    }
                    document.getElementById('profile-old-pass').value = '';
                    document.getElementById('profile-new-pass').value = '';
                } else {
                    if (errEl) {
                        errEl.textContent = res.error;
                        errEl.classList.remove('hidden');
                    }
                }
            });
        }

        // Discover Search Input Setup with Debounce
        this.discoverDebounceTimeout = null;
        const discoverSearchInput = document.getElementById('discover-search-input');
        if (discoverSearchInput) {
            discoverSearchInput.addEventListener('input', (e) => {
                clearTimeout(this.discoverDebounceTimeout);
                const query = e.target.value.trim();
                this.discoverDebounceTimeout = setTimeout(() => {
                    this.renderDiscover(query || null);
                }, 600);
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
                        const activeUser = this.auth.getActiveUser();
                        if (activeUser && activeUser.username) {
                            StorageUtils.addAdminLog(activeUser.username, 'import_playlist', `${importedData.title} (${importedData.tracks.length} tracks)`);
                        }
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
        const togglePlayPause = () => {
            if (!this.currentSong) return;
            const state = this.player.player ? this.player.player.getPlayerState() : -1;
            if (state === YT.PlayerState.PLAYING) {
                this.player.pause();
            } else {
                this.player.play();
            }
        };
        document.getElementById('play-pause-btn').addEventListener('click', togglePlayPause);
        const npPlayPauseBtn = document.getElementById('np-play-pause-btn');
        if (npPlayPauseBtn) npPlayPauseBtn.addEventListener('click', togglePlayPause);

        document.getElementById('next-btn').addEventListener('click', () => this.playNext());
        document.getElementById('next-btn-mobile').addEventListener('click', () => this.playNext());
        const npNextBtn = document.getElementById('np-next-btn');
        if (npNextBtn) npNextBtn.addEventListener('click', () => this.playNext());

        document.getElementById('prev-btn').addEventListener('click', () => this.playPrev());
        const npPrevBtn = document.getElementById('np-prev-btn');
        if (npPrevBtn) npPrevBtn.addEventListener('click', () => this.playPrev());

        // Favorite current song logic
        const toggleFav = () => {
            if (!this.currentSong) return;
            const isFav = StorageUtils.isFavorite(this.currentSong.id);
            const activeUser = this.auth.getActiveUser();
            const username = activeUser ? activeUser.username : 'Guest';
            if (isFav) {
                StorageUtils.removeFavorite(this.currentSong.id);
                this.ui.updateFavoriteButton(false);
                StorageUtils.addAdminLog(username, 'unlike', this.currentSong.title);
            } else {
                StorageUtils.addFavorite(this.currentSong);
                this.ui.updateFavoriteButton(true);
                StorageUtils.addAdminLog(username, 'like', this.currentSong.title);
            }
            if (!this.ui.views.favorites.classList.contains('hidden')) {
                this.renderFavorites();
            }
        };
        document.getElementById('favorite-current-btn').addEventListener('click', toggleFav);
        const npFavBtn = document.getElementById('np-fav-btn');
        if (npFavBtn) npFavBtn.addEventListener('click', toggleFav);

        // Share current song
        const shareCurrent = async () => {
            if (!this.currentSong) return alert('No song selected to share');
            const url = this.currentSong.url || (this.currentSong.id ? `https://youtu.be/${this.currentSong.id}` : location.href);
            const shareText = `${this.currentSong.title} — ${this.currentSong.channelTitle}`;
            if (navigator.share) {
                try {
                    await navigator.share({ title: shareText, text: shareText, url });
                    return;
                } catch (e) {
                    // fallthrough to clipboard
                }
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(url);
                    alert('Song link copied to clipboard');
                    return;
                } catch (e) {
                    // fallback
                }
            }
            // final fallback
            prompt('Copy this link to share:', url);
        };

        const npShareBtn = document.getElementById('np-share-btn');
        if (npShareBtn) npShareBtn.addEventListener('click', shareCurrent);

        // Add current song to queue
        const addCurrentToQueue = (song) => {
            if (!song) return alert('No song selected');
            if (!this.currentPlaylist || !Array.isArray(this.currentPlaylist) || this.currentPlaylist.length === 0) {
                this.currentPlaylist = [song];
                this.currentPlaylistIndex = 0;
            } else {
                const insertAt = Math.max(0, this.currentPlaylistIndex + 1);
                this.currentPlaylist.splice(insertAt, 0, song);
            }
            const activeUser = this.auth.getActiveUser();
            const username = activeUser ? activeUser.username : 'Guest';
            StorageUtils.addAdminLog(username, 'queue_add', song.title);
            alert('Added to queue');
        };

        const npQueueBtn = document.getElementById('np-queue-btn');
        if (npQueueBtn) npQueueBtn.addEventListener('click', () => addCurrentToQueue(this.currentSong));

        // Volume logic
        const volumeInputEl = document.getElementById('volume-slider');
        volumeInputEl.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value);
            this.player.setVolume(vol);
            this.ui.updateVolumeIcon(vol);
        });

        // Progress bar seeking
        const handleSeek = (e) => {
            this.player.seekTo(parseFloat(e.target.value));
        };
        const progressEl = document.getElementById('progress-bar');
        if (progressEl) {
            progressEl.addEventListener('change', handleSeek);
        }
        const npProgressEl = document.getElementById('np-progress-bar');
        if (npProgressEl) {
            npProgressEl.addEventListener('change', handleSeek);
        }

        // Shuffle & Repeat
        const shuffleBtn = document.getElementById('shuffle-btn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }
        const npShuffleBtn = document.getElementById('np-shuffle-btn');
        if (npShuffleBtn) {
            npShuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }

        const repeatBtn = document.getElementById('repeat-btn');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => this.toggleRepeat());
        }
        const npRepeatBtn = document.getElementById('np-repeat-btn');
        if (npRepeatBtn) {
            npRepeatBtn.addEventListener('click', () => this.toggleRepeat());
        }

        // Mute Toggle
        const volIcon = document.getElementById('volume-icon');
        if (volIcon) {
            volIcon.addEventListener('click', () => this.toggleMute());
        }

        // Extra Buttons Feedback
        const extraBtns = ['queue-btn', 'connect-btn'];
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
            const tRow = document.body;
            tRow.style.cursor = 'wait';
            try {
                const resolved = await this.resolvePlayableSong(song);
                if (!resolved) {
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
            const activeUser = this.auth.getActiveUser();
            if (activeUser && activeUser.username) {
                StorageUtils.addAdminLog(activeUser.username, 'play', `${song.title} - ${song.channelTitle}`);
            }
        }
        
        if (!this.ui.views.home.classList.contains('hidden')) {
            this.renderHome();
        }

        const isFav = StorageUtils.isFavorite(song.id);
        this.ui.updateNowPlaying(song, isFav);
        
        // Load and play in YT iframe wrapper
        this.player.loadSong(song.id);
        
        // Fetch lyrics
        if (this.lyrics) {
            this.lyrics.fetchLyrics(song.title, song.channelTitle);
        }
    }

    buildResolutionQueries(song) {
        const clean = (value = '') => value
            .replace(/\s+/g, ' ')
            .replace(/\b(feat\.?|ft\.?)\b/gi, '')
            .replace(/[()[\]{}]/g, ' ')
            .trim();

        const title = clean(song.title);
        const artist = clean(song.channelTitle);
        const queries = [
            `${title} ${artist}`,
            `${title} ${artist} audio`,
            `${title} song`,
            title
        ].filter(Boolean);

        return [...new Set(queries)];
    }

    async resolvePlayableSong(song, options = {}) {
        const candidates = [];
        const seenIds = new Set();

        for (const query of this.buildResolutionQueries(song)) {
            const results = await this.api.search(query, 8);
            for (const result of results || []) {
                if (!result.id || seenIds.has(result.id)) continue;
                seenIds.add(result.id);
                candidates.push(result);
            }
            if (candidates.length >= 3) break;
        }

        if (!candidates.length) return false;

        const [best, ...fallbacks] = candidates;
        song.id = best.id;
        song.fallbackIds = fallbacks.map(result => result.id);
        if ((!song.thumbnail || options.forceThumbnail || song.isSpotify) && best.thumbnail) {
            song.thumbnail = best.thumbnail;
        }
        this.persistResolvedSong(song);
        return true;
    }

    persistResolvedSong(song) {
        const playlists = StorageUtils.getSavedPlaylists();
        let changed = false;

        playlists.forEach(playlist => {
            (playlist.tracks || []).forEach(track => {
                const sameTrack = track === song ||
                    (track.title === song.title && track.channelTitle === song.channelTitle);
                if (!sameTrack) return;

                track.id = song.id;
                track.fallbackIds = song.fallbackIds || [];
                if (song.thumbnail) track.thumbnail = song.thumbnail;
                changed = true;
            });
        });

        if (changed) {
            StorageUtils.savePlaylists(playlists);
        }
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
            if (this.visualizer) this.visualizer.setPlaying(true);
        } else {
            this.ui.setPlayingState(false);
            if (state !== YT.PlayerState.BUFFERING) {
                document.body.classList.remove('is-pulsing');
            }
            if (this.visualizer) this.visualizer.setPlaying(false);
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
        console.warn(`YouTube Player Error: ${errorCode} on ID: ${this.currentSong?.id || 'Unknown'}.`);
        
        // Try fallback alternative videos for the same song if embedding was blocked (usually error 101 or 150)
        if (this.currentSong && this.currentSong.fallbackIds && this.currentSong.fallbackIds.length > 0) {
            const nextBestId = this.currentSong.fallbackIds.shift();
            console.log(`Trying alternative fallback video: ${nextBestId}`);
            this.currentSong.id = nextBestId;
            this.persistResolvedSong(this.currentSong);
            this.player.loadSong(nextBestId);
            return;
        }
        
        // Out of fallbacks, skip to next song in playlist
        console.warn(`No more valid fallbacks. Skipping to next song...`);
        if (this.currentPlaylist && this.currentPlaylist.length > 1) {
            this.playNext();
        } else {
            this.ui.setPlayingState(false);
        }
    }

    onTimeUpdate(currentTime, duration) {
        this.ui.updateProgress(currentTime, duration);
        if (this.visualizer) this.visualizer.update(currentTime, duration);
        if (this.lyrics) this.lyrics.update(currentTime);
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
