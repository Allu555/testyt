function getHqThumbnail(url) {
    if (!url) return '';
    return url.replace(/w\d+-h\d+/g, 'w544-h544').replace(/=w\d+-h\d+/g, '=w544-h544');
}

export class UI {
    constructor() {
        this.views = {
            home: document.getElementById('home-view'),
            search: document.getElementById('search-view'),
            favorites: document.getElementById('favorites-view'),
            playlists: document.getElementById('playlists-view'),
            playlistDetail: document.getElementById('playlist-detail-view'),
            movies: document.getElementById('movies-view'),
            admin: document.getElementById('admin-view'),
            profile: document.getElementById('profile-view'),
            leaderboard: document.getElementById('leaderboard-view')
        };
        this.navItems = document.querySelectorAll('.nav-item');
        
        // Player UI
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.playPauseIcon = this.playPauseBtn.querySelector('i');
        this.progressBar = document.getElementById('progress-bar');
        this.currentTimeEl = document.getElementById('current-time');
        this.totalTimeEl = document.getElementById('total-time');

        // Now Playing view equivalents
        this.npPlayPauseBtn = document.getElementById('np-play-pause-btn');
        if (this.npPlayPauseBtn) this.npPlayPauseIcon = this.npPlayPauseBtn.querySelector('i');
        this.npProgressBar = document.getElementById('np-progress-bar');
        this.npCurrentTimeEl = document.getElementById('np-current-time');
        this.npTotalTimeEl = document.getElementById('np-total-time');
        
        this.isDraggingProgress = false;
        this.progressBar.addEventListener('mousedown', () => this.isDraggingProgress = true);
        this.progressBar.addEventListener('touchstart', () => this.isDraggingProgress = true);
        this.progressBar.addEventListener('mouseup', () => { setTimeout(() => this.isDraggingProgress = false, 100) });
        this.progressBar.addEventListener('touchend', () => { setTimeout(() => this.isDraggingProgress = false, 100) });

        this.progressBar.addEventListener('input', () => {
            const val = parseFloat(this.progressBar.value);
            const max = parseFloat(this.progressBar.max);
            if (max > 0) {
                const percentage = (val / max) * 100;
                this.progressBar.style.setProperty('--progress-percent', `${percentage}%`);
                this.currentTimeEl.textContent = this.formatTime(val);
                if (this.npProgressBar) {
                    this.npProgressBar.value = val;
                    this.npProgressBar.style.setProperty('--progress-percent', `${percentage}%`);
                }
                if (this.npCurrentTimeEl) this.npCurrentTimeEl.textContent = this.formatTime(val);
            }
        });

        if (this.npProgressBar) {
            this.npProgressBar.addEventListener('mousedown', () => this.isDraggingProgress = true);
            this.npProgressBar.addEventListener('touchstart', () => this.isDraggingProgress = true);
            this.npProgressBar.addEventListener('mouseup', () => { setTimeout(() => this.isDraggingProgress = false, 100) });
            this.npProgressBar.addEventListener('touchend', () => { setTimeout(() => this.isDraggingProgress = false, 100) });

            this.npProgressBar.addEventListener('input', () => {
                const val = parseFloat(this.npProgressBar.value);
                const max = parseFloat(this.npProgressBar.max);
                if (max > 0) {
                    const percentage = (val / max) * 100;
                    this.npProgressBar.style.setProperty('--progress-percent', `${percentage}%`);
                    if (this.npCurrentTimeEl) this.npCurrentTimeEl.textContent = this.formatTime(val);
                    
                    // Sync back to main progress bar
                    this.progressBar.value = val;
                    this.progressBar.style.setProperty('--progress-percent', `${percentage}%`);
                    this.currentTimeEl.textContent = this.formatTime(val);
                }
            });
        }
        
        this.nowPlayingTitle = document.getElementById('now-playing-title');
        this.nowPlayingChannel = document.getElementById('now-playing-channel');
        this.nowPlayingImg = document.getElementById('now-playing-img');
        
        // Fullscreen Now Playing Overlay
        this.nowPlayingView = document.getElementById('now-playing-view');
        this.npLargeArt = document.getElementById('np-large-art');
        this.playerBar = document.querySelector('.player-bar');
        this.isPlayerActive = false;
        
        // Results Containers
        this.searchResultsContainer = document.getElementById('search-results');
        this.recentResultsContainer = document.getElementById('recent-results');
        this.favoritesResultsContainer = document.getElementById('favorites-results');
        this.searchLoader = document.getElementById('search-loader');

        // Close Now Playing on background click (optional, but good for mobile)
        this.nowPlayingView.addEventListener('click', (e) => {
            if (e.target === this.nowPlayingView) {
                this.nowPlayingView.classList.add('hidden');
            }
        });

        // Apply mobile layout adjustments on load and resize
        this.applyMobileLayout = this.applyMobileLayout.bind(this);
        window.addEventListener('resize', this.applyMobileLayout);
        document.addEventListener('DOMContentLoaded', this.applyMobileLayout);
        // Also run immediately
        this.applyMobileLayout();
    }

    applyMobileLayout() {
        const isMobile = window.innerWidth <= 900;
        const player = this.playerBar;
        document.body.classList.toggle('player-active', this.isPlayerActive);
        if (isMobile) {
            document.body.classList.add('mobile');
            if (player) player.classList.remove('hidden');
        } else {
            document.body.classList.remove('mobile');
            if (player) player.classList.remove('hidden');
        }
    }

    switchView(viewId) {
        // Update nav active state
        this.navItems.forEach(item => {
            if (item.dataset.target === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Toggle sections
        Object.values(this.views).forEach(view => {
            if (view.id === viewId) {
                view.classList.remove('hidden');
                view.classList.add('active');
            } else {
                view.classList.remove('active');
                view.classList.add('hidden');
            }
        });

        // Show admin greeting only on home view when prepared
        const adminGreet = document.getElementById('admin-greeting');
        if (adminGreet) {
            const ready = adminGreet.dataset.ready === 'true';
            if (viewId === 'home-view' && ready) {
                adminGreet.classList.remove('hidden');
                adminGreet.setAttribute('aria-hidden', 'false');
            } else {
                adminGreet.classList.add('hidden');
                adminGreet.setAttribute('aria-hidden', 'true');
            }
        }
    }

    renderSkeletons(container, count = 6) {
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const skel = document.createElement('div');
            skel.className = 'song-card skeleton';
            skel.style.pointerEvents = 'none';
            skel.innerHTML = `
                <div class="card-img-container" style="background: rgba(255,255,255,0.05); border-radius: 12px; width: 100%; aspect-ratio: 1; animation: pulse 1.5s infinite;"></div>
                <div class="card-text" style="padding-top: 12px;">
                    <div class="card-title" style="height: 14px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 8px; width: 80%; animation: pulse 1.5s infinite;"></div>
                    <div class="card-artist" style="height: 12px; background: rgba(255,255,255,0.05); border-radius: 4px; width: 60%; animation: pulse 1.5s infinite;"></div>
                </div>
            `;
            container.appendChild(skel);
        }
    }

    renderSongs(container, songs, onPlay, onDelete = null) {
        container.innerHTML = '';
        if (songs.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">No songs found.</p>';
            return;
        }

        songs.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card';
            const thumbnail = song.thumbnail ? getHqThumbnail(song.thumbnail) : '';
            const placeholderHtml = !song.thumbnail ? `<div class="card-img-placeholder"><i class="fas fa-music"></i></div>` : '';
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${thumbnail}" alt="${song.title}" loading="lazy"
                         onerror="this.onerror=null; this.dataset.broken='true'; this.style.display='none'; if (!this.parentNode.querySelector('.card-img-placeholder')) { const placeholder=document.createElement('div'); placeholder.className='card-img-placeholder'; placeholder.innerHTML='<i class=\\'fas fa-music\\'></i>'; this.parentNode.appendChild(placeholder); }">
                    ${placeholderHtml}
                </div>
                <div class="card-text">
                    <div class="card-title" title="${song.title}">${song.title}</div>
                    <div class="card-channel" title="${song.channelTitle}">${song.channelTitle}</div>
                </div>
                <button class="card-play-btn"><i class="fas fa-play"></i></button>
                ${onDelete ? '<button class="card-delete-btn"><i class="fas fa-times"></i></button>' : ''}
            `;
            
            // Add click event for play
            const playBtn = card.querySelector('.card-play-btn');
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onPlay(song);
            });

            // Handle optional delete
            if (onDelete) {
                const delBtn = card.querySelector('.card-delete-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onDelete(song);
                });
            }

            // Card root click maps to play as well
            card.addEventListener('click', () => onPlay(song));

            container.appendChild(card);
            
            // Clean Spotify-style hover (no 3D tilt)
        });
    }

    renderArtists(container, artists, onArtistClick) {
        container.innerHTML = '';
        if (artists.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); width: 100%; text-align: center;">No top artists recorded.</p>';
            return;
        }

        artists.forEach(artist => {
            const card = document.createElement('div');
            card.className = 'artist-card';
            
            const initial = artist.name.charAt(0).toUpperCase();
            
            card.innerHTML = `
                <div class="artist-avatar-container">
                    <img src="" alt="${artist.name}" loading="lazy" style="opacity:0;transition:opacity 0.3s ease;">
                </div>
                <div class="artist-name" title="${artist.name}">${artist.name}</div>
            `;
            
            const imgEl = card.querySelector('img');
            const setPlaceholder = () => {
                const avCont = card.querySelector('.artist-avatar-container');
                avCont.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1DB954 0%,#0d7a36 100%);color:#000;font-weight:800;font-size:28px;border-radius:50%;">${initial}</div>`;
            };
            
            // Try iTunes first; if artist has a yt thumbnail, try that too
            const tryUrl = artist.thumbnail && !artist.thumbnail.includes('unsplash.com') ? artist.thumbnail : null;
            
            const loadFromItunes = () => {
                fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist.name)}&media=music&entity=album&limit=1`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.results && data.results.length > 0) {
                            const url = data.results[0].artworkUrl100.replace('100x100bb.jpg', '300x300bb.jpg');
                            imgEl.src = url;
                            imgEl.onload = () => { imgEl.style.opacity = '1'; };
                            imgEl.onerror = setPlaceholder;
                        } else { setPlaceholder(); }
                    })
                    .catch(setPlaceholder);
            };
            
            if (tryUrl) {
                imgEl.src = tryUrl;
                imgEl.onload = () => { imgEl.style.opacity = '1'; };
                imgEl.onerror = loadFromItunes;
            } else {
                loadFromItunes();
            }
            
            card.addEventListener('click', () => onArtistClick(artist.name));
            container.appendChild(card);
        });
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.searchResultsContainer.innerHTML = '';
            this.searchLoader.classList.remove('hidden');
        } else {
            this.searchLoader.classList.add('hidden');
        }
    }

    updateNowPlaying(song, isFavorite) {
        // Mini player
        this.nowPlayingTitle.textContent = song.title; // Assuming this is the mini player title
        this.nowPlayingChannel.textContent = song.channelTitle; // Assuming this is the mini player artist/channel
        if (song.thumbnail) {
            this.nowPlayingImg.src = getHqThumbnail(song.thumbnail);
            this.nowPlayingImg.style.display = 'block';
            this.nowPlayingImg.style.opacity = '1';
            
            // Hide the placeholder icon more robustly
            const artworkContainer = this.nowPlayingImg.closest('.artwork-placeholder');
            if (artworkContainer) {
                const placeholder = artworkContainer.querySelector('.placeholder-icon');
                if (placeholder) placeholder.style.display = 'none';
            }
        }
        // The original updateFavoriteButton call is still relevant for the mini player
        this.updateFavoriteButton(isFavorite);

        // Large Now Playing View
        const npTitle = document.getElementById('np-title');
        const npArtist = document.getElementById('np-artist');
        // npLargeArt is already a class property: this.npLargeArt
        
        if (npTitle) npTitle.textContent = song.title;
        if (npArtist) npArtist.textContent = song.channelTitle; // Assuming channelTitle maps to artist for large view
        if (this.npLargeArt && song.thumbnail) this.npLargeArt.src = getHqThumbnail(song.thumbnail);

        if (this.playerBar) {
            this.isPlayerActive = true;
            document.body.classList.add('player-active');
            this.playerBar.classList.remove('hidden');
        }

        // Dynamic Ambient Color Sync
        this.updateAmbientColors(song);
    }

    updateAmbientColors(song) {
        if (!song.thumbnail) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = getHqThumbnail(song.thumbnail);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 10;
            canvas.height = 10;
            
            ctx.drawImage(img, 0, 0, 10, 10);
            const data = ctx.getImageData(0, 0, 10, 10).data;
            
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i+1];
                b += data[i+2];
            }
            
            r = Math.floor(r / (data.length / 4));
            g = Math.floor(g / (data.length / 4));
            b = Math.floor(b / (data.length / 4));
            
            // Brightness boost for the glow
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness < 50) {
                r = Math.min(255, r + 40);
                g = Math.min(255, g + 40);
                b = Math.min(255, b + 40);
            }

            document.documentElement.style.setProperty('--ambient-1', `rgba(${r}, ${g}, ${b}, 0.36)`);
            document.documentElement.style.setProperty('--ambient-2', `rgba(${g}, ${b}, ${r}, 0.22)`);
            document.documentElement.style.setProperty('--ambient-3', `rgba(${Math.floor(r / 2.5)}, ${Math.floor(g / 2.5)}, ${Math.floor(b / 2.5)}, 1)`);
            
            if (window.app && window.app.visualizer) {
                window.app.visualizer.updateColors(r, g, b);
            }
        };
    }

    updateFavoriteButton(isFavorite) {
        const btn = document.getElementById('favorite-current-btn');
        const icon = btn.querySelector('i');
        if (isFavorite) {
            btn.classList.add('active');
            icon.classList.remove('far');
            icon.classList.add('fas');
        } else {
            btn.classList.remove('active');
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    }

    setPlayingState(isPlaying) {
        document.body.classList.toggle('is-playing', isPlaying);

        if (isPlaying) {
            this.playPauseIcon.classList.remove('fa-play');
            this.playPauseIcon.classList.add('fa-pause');
            this.playPauseBtn.classList.add('playing');
            if (this.npPlayPauseIcon) {
                this.npPlayPauseIcon.classList.remove('fa-play');
                this.npPlayPauseIcon.classList.add('fa-pause');
            }
        } else {
            this.playPauseIcon.classList.remove('fa-pause');
            this.playPauseIcon.classList.add('fa-play');
            this.playPauseBtn.classList.remove('playing');
            if (this.npPlayPauseIcon) {
                this.npPlayPauseIcon.classList.remove('fa-pause');
                this.npPlayPauseIcon.classList.add('fa-play');
            }
        }

        if (this.playerBar) {
            document.body.classList.toggle('player-active', this.isPlayerActive);
            if (document.body.classList.contains('mobile')) {
                this.playerBar.classList.remove('hidden');
            } else {
                this.playerBar.classList.remove('hidden');
            }
        }
    }

    updateProgress(currentTime, duration) {
        if (duration > 0 && !this.isDraggingProgress) {
            this.progressBar.max = duration;
            this.progressBar.value = currentTime;
            this.currentTimeEl.textContent = this.formatTime(currentTime);
            this.totalTimeEl.textContent = this.formatTime(duration);

            if (this.npProgressBar) {
                this.npProgressBar.max = duration;
                this.npProgressBar.value = currentTime;
            }
            if (this.npCurrentTimeEl) this.npCurrentTimeEl.textContent = this.formatTime(currentTime);
            if (this.npTotalTimeEl) this.npTotalTimeEl.textContent = this.formatTime(duration);

            // Dynamic heartbeat wave progress coloring (using CSS masks for the waveform)
            const percentage = (currentTime / duration) * 100;
            this.progressBar.style.setProperty('--progress-percent', `${percentage}%`);
            
            if (this.npProgressBar) {
                this.npProgressBar.style.setProperty('--progress-percent', `${percentage}%`);
            }
            // If the duration is known, we can also update the mask size dynamically if needed, 
            // but the current repeat-x logic in CSS is usually sufficient.
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    updateVolumeIcon(volume) {
        const volumeIcon = document.getElementById('volume-icon');
        if (!volumeIcon) return;
        
        volumeIcon.className = 'fas';
        if (volume === 0) {
            volumeIcon.classList.add('fa-volume-mute');
            volumeIcon.style.color = 'var(--accent)';
        } else {
            volumeIcon.style.color = '';
            if (volume < 50) {
                volumeIcon.classList.add('fa-volume-down');
            } else {
                volumeIcon.classList.add('fa-volume-up');
            }
        }
    }

    updateShuffleUI(isActive) {
        const btn = document.getElementById('shuffle-btn');
        const npBtn = document.getElementById('np-shuffle-btn');
        if (btn) {
            if (isActive) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (npBtn) {
            if (isActive) npBtn.classList.add('active');
            else npBtn.classList.remove('active');
        }
    }

    updateRepeatUI(mode) {
        const btn = document.getElementById('repeat-btn');
        const npBtn = document.getElementById('np-repeat-btn');
        const icon = btn ? btn.querySelector('i') : null;
        const npIcon = npBtn ? npBtn.querySelector('i') : null;

        const updateBtn = (b, i) => {
            if (!b || !i) return;
            b.classList.remove('active');
            i.className = 'fas fa-redo-alt'; // default
            
            if (mode === 'all') {
                b.classList.add('active');
            } else if (mode === 'one') {
                b.classList.add('active');
                i.className = 'fas fa-redo'; // Slightly different icon or add a '1' badge
            }
        };

        updateBtn(btn, icon);
        updateBtn(npBtn, npIcon);
    }

    showError(msg) {
        // Aesthetic toast not implemented yet, using alert for now
        alert(msg);
    }
}
