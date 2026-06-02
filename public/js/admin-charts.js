/**
 * AdminCharts — Chart.js powered analytics for the admin dashboard.
 * Reads admin logs + per-user localStorage data and renders interactive charts.
 */
export class AdminCharts {
    constructor() {
        this.charts = {};
        this.counters = {};
    }

    /** Destroy old charts before re-rendering */
    destroyAll() {
        Object.values(this.charts).forEach(c => { try { c.destroy(); } catch(e){} });
        this.charts = {};
    }

    /**
     * Main entry: render all admin charts.
     * @param {Array} usersData — array of { username, playsCount, likesCount, playlistsCount, ... }
     * @param {Array} logs — admin activity logs
     */
    render(usersData, logs) {
        this.destroyAll();
        this._renderActivityTimeline(logs);
        this._renderEngagementDonut(usersData);
        this._renderTopArtists(usersData);
        this._renderListeningHeatmap(logs);
        this._animateCounters();
    }

    /* ─── Activity Timeline (Line Chart — last 7 days) ─── */
    _renderActivityTimeline(logs) {
        const ctx = document.getElementById('chart-activity-timeline');
        if (!ctx) return;

        const days = [];
        const playCounts = [];
        const loginCounts = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days.push(d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));

            const dayLogs = logs.filter(l => {
                try { return l.timestamp.slice(0, 10) === key; } catch(e) { return false; }
            });
            playCounts.push(dayLogs.filter(l => l.action === 'play').length);
            loginCounts.push(dayLogs.filter(l => l.action === 'login').length);
        }

        this.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [
                    {
                        label: 'Plays',
                        data: playCounts,
                        borderColor: '#1DB954',
                        backgroundColor: 'rgba(29, 185, 84, 0.08)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#1DB954',
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#1ed760',
                    },
                    {
                        label: 'Logins',
                        data: loginCounts,
                        borderColor: '#a78bfa',
                        backgroundColor: 'rgba(167, 139, 250, 0.06)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#a78bfa',
                        pointHoverRadius: 5,
                    }
                ]
            },
            options: this._baseOptions('Activity — Last 7 Days')
        });
    }

    /* ─── Engagement Donut ─── */
    _renderEngagementDonut(usersData) {
        const ctx = document.getElementById('chart-engagement-donut');
        if (!ctx) return;

        let totalPlays = 0, totalLikes = 0, totalPlaylists = 0;
        usersData.forEach(u => {
            totalPlays += u.playsCount || 0;
            totalLikes += u.likesCount || 0;
            totalPlaylists += u.playlistsCount || 0;
        });

        // Avoid empty chart
        if (totalPlays + totalLikes + totalPlaylists === 0) {
            totalPlays = 1; // placeholder
        }

        this.charts.engagement = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Plays', 'Liked Songs', 'Playlists'],
                datasets: [{
                    data: [totalPlays, totalLikes, totalPlaylists],
                    backgroundColor: [
                        'rgba(139, 92, 246, 0.85)',
                        'rgba(244, 63, 94, 0.85)',
                        'rgba(251, 191, 36, 0.85)'
                    ],
                    borderColor: [
                        'rgba(139, 92, 246, 1)',
                        'rgba(244, 63, 94, 1)',
                        'rgba(251, 191, 36, 1)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 12,
                    spacing: 4,
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#b3b3b3',
                            font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        }
                    },
                    tooltip: this._tooltipConfig(),
                },
                animation: {
                    animateRotate: true,
                    duration: 1200,
                    easing: 'easeOutQuart',
                }
            }
        });
    }

    /* ─── Top Artists Bar Chart ─── */
    _renderTopArtists(usersData) {
        const ctx = document.getElementById('chart-top-artists');
        if (!ctx) return;

        // Aggregate artist play counts from all users' recents
        const artistMap = {};
        usersData.forEach(u => {
            (u.recents || []).forEach(song => {
                const artist = song.channelTitle || 'Unknown';
                artistMap[artist] = (artistMap[artist] || 0) + 1;
            });
        });

        const sorted = Object.entries(artistMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const labels = sorted.map(s => s[0].length > 18 ? s[0].slice(0, 16) + '…' : s[0]);
        const data = sorted.map(s => s[1]);

        const gradient_colors = [
            'rgba(29, 185, 84, 0.85)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(52, 211, 153, 0.75)',
            'rgba(110, 231, 183, 0.7)',
            'rgba(139, 92, 246, 0.75)',
            'rgba(167, 139, 250, 0.7)',
            'rgba(196, 181, 253, 0.65)',
            'rgba(221, 214, 254, 0.6)',
        ];

        this.charts.artists = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Times Played',
                    data,
                    backgroundColor: gradient_colors.slice(0, data.length),
                    borderColor: gradient_colors.slice(0, data.length).map(c => c.replace(/[\d.]+\)$/, '1)')),
                    borderWidth: 1.5,
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 40,
                }]
            },
            options: {
                ...this._baseOptions('Most Played Artists'),
                indexAxis: 'y',
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                        ticks: { color: '#6a6a6a', font: { family: "'Inter', sans-serif", size: 11 } },
                        beginAtZero: true,
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#b3b3b3', font: { family: "'Inter', sans-serif", size: 12, weight: '500' } },
                    }
                }
            }
        });
    }

    /* ─── Listening Heatmap (Bar chart by hour) ─── */
    _renderListeningHeatmap(logs) {
        const ctx = document.getElementById('chart-listening-heatmap');
        if (!ctx) return;

        const hourCounts = new Array(24).fill(0);
        const playLogs = logs.filter(l => l.action === 'play');
        playLogs.forEach(l => {
            try {
                const h = new Date(l.timestamp).getHours();
                hourCounts[h]++;
            } catch(e) {}
        });

        const labels = hourCounts.map((_, i) => {
            const h = i % 12 || 12;
            return `${h}${i < 12 ? 'a' : 'p'}`;
        });

        // Generate gradient colors based on intensity
        const maxVal = Math.max(...hourCounts, 1);
        const bgColors = hourCounts.map(v => {
            const intensity = v / maxVal;
            return `rgba(29, 185, 84, ${0.15 + intensity * 0.7})`;
        });

        this.charts.heatmap = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Plays',
                    data: hourCounts,
                    backgroundColor: bgColors,
                    borderColor: bgColors.map(c => c.replace(/[\d.]+\)$/, '1)')),
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                ...this._baseOptions('Listening Hours'),
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6a6a6a', font: { family: "'Inter', sans-serif", size: 10 }, maxRotation: 0 },
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                        ticks: { color: '#6a6a6a', font: { family: "'Inter', sans-serif", size: 11 }, stepSize: 1 },
                        beginAtZero: true,
                    }
                }
            }
        });
    }

    /* ─── Animated Counters ─── */
    _animateCounters() {
        document.querySelectorAll('[data-counter-target]').forEach(el => {
            const target = parseInt(el.textContent) || 0;
            if (target === 0) return;
            el.textContent = '0';
            const duration = 1200;
            const startTime = performance.now();

            const tick = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.floor(eased * target);
                if (progress < 1) requestAnimationFrame(tick);
                else el.textContent = target;
            };
            requestAnimationFrame(tick);
        });
    }

    /* ─── Shared Config ─── */
    _baseOptions(titleText) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#b3b3b3',
                        font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
                        usePointStyle: true,
                        padding: 16,
                    }
                },
                tooltip: this._tooltipConfig(),
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: { color: '#6a6a6a', font: { family: "'Inter', sans-serif", size: 11 } },
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: { color: '#6a6a6a', font: { family: "'Inter', sans-serif", size: 11 }, stepSize: 1 },
                    beginAtZero: true,
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart',
            }
        };
    }

    _tooltipConfig() {
        return {
            backgroundColor: 'rgba(24, 24, 24, 0.95)',
            titleColor: '#fff',
            bodyColor: '#b3b3b3',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: "'Inter', sans-serif", size: 13, weight: '600' },
            bodyFont: { family: "'Inter', sans-serif", size: 12 },
            displayColors: true,
            boxPadding: 4,
        };
    }
}
