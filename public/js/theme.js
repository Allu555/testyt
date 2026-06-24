class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        this.loadTheme();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        const modal = document.getElementById('theme-modal');
        const closeBtn = document.getElementById('close-theme-btn');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                modal.classList.remove('hidden');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        // Color Picker
        const colorBtns = document.querySelectorAll('.theme-color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                this.setAccentColor(color);
                
                // Update custom color picker value to match if it's a valid hex
                const customColorInput = document.getElementById('custom-theme-color');
                if (customColorInput && color.startsWith('#')) {
                    customColorInput.value = color;
                }
            });
        });

        // Custom Color Picker
        const customColorInput = document.getElementById('custom-theme-color');
        if (customColorInput) {
            customColorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                this.setAccentColor(color);
            });
        }

        // Background Picker
        const bgBtns = document.querySelectorAll('#theme-bg-picker .theme-option-btn');
        bgBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bg = e.target.dataset.bg;
                this.setBackgroundStyle(bg);
                bgBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Radius Picker
        const radiusBtns = document.querySelectorAll('#theme-radius-picker .theme-option-btn');
        radiusBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const radius = e.target.dataset.radius;
                this.setBorderRadius(radius);
                radiusBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    setAccentColor(color) {
        document.documentElement.style.setProperty('--accent', color);
        localStorage.setItem('theme_accent', color);
    }

    setBackgroundStyle(style) {
        const root = document.documentElement;
        
        // Reset to default dark theme values first
        root.style.setProperty('--bg-base', '#000000');
        root.style.setProperty('--bg-elevated', '#121212');
        root.style.setProperty('--bg-surface', '#181818');
        root.style.setProperty('--bg-card', '#181818');
        root.style.setProperty('--bg-card-hover', '#282828');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#b3b3b3');
        root.style.setProperty('--text-muted', '#6a6a6a');
        root.style.setProperty('--bg-gradient-top', 'rgba(0,0,0,0.4)');
        root.style.setProperty('--ambient-3', 'rgba(24,24,24,0.6)');

        switch (style) {
            case 'midnight':
                root.style.setProperty('--bg-base', '#020617');
                root.style.setProperty('--bg-elevated', '#0f172a');
                root.style.setProperty('--bg-surface', '#1e293b');
                root.style.setProperty('--bg-card', '#1e293b');
                root.style.setProperty('--bg-card-hover', '#334155');
                root.style.setProperty('--bg-gradient-top', 'rgba(15,23,42,0.6)');
                root.style.setProperty('--ambient-3', 'rgba(30,41,59,0.7)');
                break;
            case 'amoled':
                root.style.setProperty('--bg-base', '#000000');
                root.style.setProperty('--bg-elevated', '#000000');
                root.style.setProperty('--bg-surface', '#050505');
                root.style.setProperty('--bg-card', '#0a0a0a');
                root.style.setProperty('--bg-card-hover', '#111111');
                root.style.setProperty('--bg-gradient-top', 'rgba(0,0,0,0.6)');
                root.style.setProperty('--ambient-3', 'rgba(5,5,5,0.8)');
                break;
            case 'light':
                root.style.setProperty('--bg-base', '#f5f5f7');
                root.style.setProperty('--bg-elevated', '#ffffff');
                root.style.setProperty('--bg-surface', '#ffffff');
                root.style.setProperty('--bg-card', '#ffffff');
                root.style.setProperty('--bg-card-hover', '#f0f0f0');
                root.style.setProperty('--text-primary', '#1d1d1f');
                root.style.setProperty('--text-secondary', '#86868b');
                root.style.setProperty('--text-muted', '#a1a1a6');
                root.style.setProperty('--bg-gradient-top', 'rgba(255,255,255,0.9)');
                root.style.setProperty('--ambient-3', 'rgba(245,245,247,0.4)');
                break;
            default: // deep dark
                break;
        }

        localStorage.setItem('theme_bg', style);
    }

    setBorderRadius(radius) {
        document.documentElement.style.setProperty('--radius-sm', radius === '0px' ? '0px' : (radius === '24px' ? '12px' : '4px'));
        document.documentElement.style.setProperty('--radius-md', radius === '0px' ? '0px' : (radius === '24px' ? '16px' : '8px'));
        document.documentElement.style.setProperty('--radius-lg', radius);
        document.documentElement.style.setProperty('--radius-full', radius === '0px' ? '0px' : '9999px');
        
        localStorage.setItem('theme_radius', radius);
    }

    loadTheme() {
        const accent = localStorage.getItem('theme_accent');
        const bg = localStorage.getItem('theme_bg') || 'default';
        const radius = localStorage.getItem('theme_radius') || '8px';

        if (accent) this.setAccentColor(accent);
        this.setBackgroundStyle(bg);
        this.setBorderRadius(radius);

        // Update active states on buttons
        setTimeout(() => {
            document.querySelectorAll('#theme-bg-picker .theme-option-btn').forEach(b => {
                if (b.dataset.bg === bg) b.classList.add('active');
            });
            document.querySelectorAll('#theme-radius-picker .theme-option-btn').forEach(b => {
                if (b.dataset.radius === radius) b.classList.add('active');
            });
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});
