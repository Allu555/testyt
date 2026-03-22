export class UI {
    constructor() {
        this.views = {
            home: document.getElementById('home-view'),
            search: document.getElementById('search-view'),
            favorites: document.getElementById('favorites-view')
        };
        this.navItems = document.querySelectorAll('.nav-item');
        
        // Player UI
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.playPauseIcon = this.playPauseBtn.querySelector('i');
        this.progressBar = document.getElementById('progress-bar');
        this.currentTimeEl = document.getElementById('current-time');
        this.totalTimeEl = document.getElementById('total-time');
        
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
            }
        });
        
        this.nowPlayingTitle = document.getElementById('now-playing-title');
        this.nowPlayingChannel = document.getElementById('now-playing-channel');
        this.nowPlayingImg = document.getElementById('now-playing-img');
        
        // Fullscreen Now Playing Overlay
        this.nowPlayingView = document.getElementById('now-playing-view');
        this.npLargeArt = document.getElementById('np-large-art');
        
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
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${song.thumbnail}" alt="${song.title}">
                    <button class="card-play-btn"><i class="fas fa-play"></i></button>
                    ${onDelete ? '<button class="card-delete-btn"><i class="fas fa-times"></i></button>' : ''}
                </div>
                <div class="card-title" title="${song.title}">${song.title}</div>
                <div class="card-channel" title="${song.channelTitle}">${song.channelTitle}</div>
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
            
            // Apply stunning 3D hover physics using VanillaTilt
            if (window.VanillaTilt) {
                window.VanillaTilt.init(card, {
                    max: 15,
                    speed: 400,
                    glare: true,
                    "max-glare": 0.25,
                    scale: 1.05
                });
            }
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
            this.nowPlayingImg.src = song.thumbnail;
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
        if (this.npLargeArt && song.thumbnail) this.npLargeArt.src = song.thumbnail;

        // Dynamic Ambient Color Sync
        this.updateAmbientColors(song);
    }

    updateAmbientColors(song) {
        if (!song.thumbnail) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = song.thumbnail;
        
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

            document.documentElement.style.setProperty('--ambient-1', `rgba(${r}, ${g}, ${b}, 0.15)`);
            document.documentElement.style.setProperty('--ambient-2', `rgba(${g}, ${b}, ${r}, 0.08)`);
            document.documentElement.style.setProperty('--ambient-3', `rgba(${Math.floor(r/4)}, ${Math.floor(g/4)}, ${Math.floor(b/4)}, 1)`);
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
        if (isPlaying) {
            this.playPauseIcon.classList.remove('fa-play');
            this.playPauseIcon.classList.add('fa-pause');
            this.playPauseBtn.classList.add('playing');
        } else {
            this.playPauseIcon.classList.remove('fa-pause');
            this.playPauseIcon.classList.add('fa-play');
            this.playPauseBtn.classList.remove('playing');
        }
    }

    updateProgress(currentTime, duration) {
        if (duration > 0 && !this.isDraggingProgress) {
            this.progressBar.max = duration;
            this.progressBar.value = currentTime;
            this.currentTimeEl.textContent = this.formatTime(currentTime);
            this.totalTimeEl.textContent = this.formatTime(duration);

            // Dynamic heartbeat wave progress coloring (using CSS masks for the waveform)
            const percentage = (currentTime / duration) * 100;
            this.progressBar.style.setProperty('--progress-percent', `${percentage}%`);
            
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
        } else if (volume < 50) {
            volumeIcon.classList.add('fa-volume-down');
        } else {
            volumeIcon.classList.add('fa-volume-up');
        }
    }

    showError(msg) {
        // Aesthetic toast not implemented yet, using alert for now
        alert(msg);
    }
}
