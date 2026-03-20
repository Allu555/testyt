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
                this.progressBar.style.background = `linear-gradient(to right, var(--accent) ${percentage}%, rgba(255, 255, 255, 0.3) ${percentage}%)`;
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
        this.nowPlayingTitle.textContent = song.title;
        this.nowPlayingChannel.textContent = song.channelTitle;
        if (song.thumbnail) {
            this.nowPlayingImg.src = song.thumbnail;
            this.nowPlayingImg.style.opacity = '1';
            this.npLargeArt.src = song.thumbnail;
        }
        this.updateFavoriteButton(isFavorite);
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
        } else {
            this.playPauseIcon.classList.remove('fa-pause');
            this.playPauseIcon.classList.add('fa-play');
        }
    }

    updateProgress(currentTime, duration) {
        if (duration > 0 && !this.isDraggingProgress) {
            this.progressBar.max = duration;
            this.progressBar.value = currentTime;
            this.currentTimeEl.textContent = this.formatTime(currentTime);
            this.totalTimeEl.textContent = this.formatTime(duration);

            // Dynamic wave progress coloring (Spotify Green to edge)
            const percentage = (currentTime / duration) * 100;
            this.progressBar.style.background = `linear-gradient(to right, var(--accent) ${percentage}%, rgba(255, 255, 255, 0.3) ${percentage}%)`;
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    showError(msg) {
        alert(msg);
    }
}
