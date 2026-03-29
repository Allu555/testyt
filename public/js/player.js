export class Player {
    constructor(onStateChangeCallback, onReadyCallback, onTimeUpdateCallback, onErrorCallback) {
        this.player = null;
        this.isReady = false;
        this.onStateChangeCallback = onStateChangeCallback;
        this.onReadyCallback = onReadyCallback;
        this.onTimeUpdateCallback = onTimeUpdateCallback;
        this.onErrorCallback = onErrorCallback;
        this.progressInterval = null;
    }

    init() {
        // Assume YouTube API has already loaded via the callback to window.onYouTubeIframeAPIReady
        this.player = new window.YT.Player('ytplayer', {
            height: '100%',
            width: '100%',
            playerVars: {
                'playsinline': 1,
                'controls': 0, // hide player controls
                'disablekb': 1, // disable keyboard shortcuts
                'fs': 0, // hide fullscreen button
                'autoplay': 1, // force autoplay
            },
            events: {
                'onReady': this.onPlayerReady.bind(this),
                'onStateChange': this.onPlayerStateChange.bind(this),
                'onError': this.onPlayerError.bind(this)
            }
        });
    }

    onPlayerReady(event) {
        this.isReady = true;
        this.onReadyCallback();
    }

    onPlayerError(event) {
        console.error("YouTube Player Error:", event.data);
        if (this.onErrorCallback) {
            this.onErrorCallback(event.data);
        }
    }

    onPlayerStateChange(event) {
        if (event.data === window.YT.PlayerState.PLAYING) {
            this.startProgressTracker();
        } else {
            this.stopProgressTracker();
        }
        this.onStateChangeCallback(event.data);
    }

    loadSong(videoId) {
        if (this.isReady) {
            this.player.loadVideoById(videoId);
        }
    }

    play() {
        if (this.isReady) this.player.playVideo();
    }

    pause() {
        if (this.isReady) this.player.pauseVideo();
    }

    getDuration() {
        if (this.isReady) return this.player.getDuration();
        return 0;
    }

    getCurrentTime() {
        if (this.isReady) return this.player.getCurrentTime();
        return 0;
    }

    seekTo(seconds) {
        if (this.isReady) this.player.seekTo(seconds, true);
    }

    setVolume(volume) {
        if (this.isReady) this.player.setVolume(volume);
    }

    getVolume() {
        if (this.isReady) return this.player.getVolume();
        return 100;
    }

    startProgressTracker() {
        this.stopProgressTracker(); // Ensure no duplicates
        this.progressInterval = setInterval(() => {
            if (this.player.getPlayerState && this.player.getPlayerState() === YT.PlayerState.PLAYING) {
                const currentTime = this.player.getCurrentTime();
                const duration = this.player.getDuration();
                this.onTimeUpdateCallback(currentTime, duration);
            }
        }, 100);
    }

    stopProgressTracker() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
    }
}
