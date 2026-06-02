/**
 * AudioVisualizer — Canvas-based music-synced visual effects.
 * Since YouTube IFrame API doesn't expose Web Audio API data,
 * we estimate beats from playback velocity and create reactive visuals.
 */
export class AudioVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isPlaying = false;
        this.intensity = 0;
        this.targetIntensity = 0;

        // Color from album art
        this.color = { r: 29, g: 185, b: 84 };
        this.targetColor = { r: 29, g: 185, b: 84 };

        // Beat estimation
        this.lastTime = 0;
        this.beatPhase = 0;
        this.bpm = 120; // default estimated BPM
        this.energy = 0;
        this.smoothEnergy = 0;

        // Particles
        this.particles = [];
        this.maxParticles = 80;

        // Orbs
        this.orbs = [];
        this.orbCount = 5;

        // Waveform
        this.wavePoints = 64;
        this.waveData = new Array(this.wavePoints).fill(0);

        this._resizeHandler = this._handleResize.bind(this);
    }

    init() {
        this.canvas = document.getElementById('visualizer-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this._handleResize();
        window.addEventListener('resize', this._resizeHandler);

        this._initParticles();
        this._initOrbs();
        this._startLoop();
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        window.removeEventListener('resize', this._resizeHandler);
    }

    updateColors(r, g, b) {
        this.targetColor = { r, g, b };
    }

    setPlaying(playing) {
        this.isPlaying = playing;
        this.targetIntensity = playing ? 1.0 : 0.15;
    }

    /**
     * Called every ~100ms from the player progress tracker.
     * We estimate "energy" from how quickly time is advancing (stable = playing).
     */
    update(currentTime, duration) {
        if (duration <= 0) return;

        const timeDelta = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Simulate beat from progress
        const progress = currentTime / duration;
        this.beatPhase += 0.05;

        // Generate pseudo-energy spikes
        const beatEnergy = Math.abs(Math.sin(this.beatPhase * this.bpm / 30)) * 0.6;
        const progressEnergy = Math.abs(Math.sin(progress * Math.PI * 8)) * 0.3;
        const randomSpike = Math.random() > 0.92 ? 0.5 : 0;

        this.energy = beatEnergy + progressEnergy + randomSpike;
        this.smoothEnergy += (this.energy - this.smoothEnergy) * 0.12;

        // Update waveform data
        for (let i = 0; i < this.wavePoints; i++) {
            const freq = (i / this.wavePoints) * Math.PI * 2;
            this.waveData[i] = (
                Math.sin(this.beatPhase * 2 + freq) * 0.3 +
                Math.sin(this.beatPhase * 3.7 + freq * 2.1) * 0.2 +
                Math.sin(this.beatPhase * 1.3 + freq * 0.5) * 0.15
            ) * this.smoothEnergy * this.intensity;
        }
    }

    /* ─── Private ─── */

    _handleResize() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;
        this.canvas.width = parent.offsetWidth * (window.devicePixelRatio || 1);
        this.canvas.height = parent.offsetHeight * (window.devicePixelRatio || 1);
        this.canvas.style.width = parent.offsetWidth + 'px';
        this.canvas.style.height = parent.offsetHeight + 'px';
    }

    _initParticles() {
        this.particles = [];
        // Adjust particle count for performance
        const count = window.innerWidth < 768 ? 35 : this.maxParticles;
        for (let i = 0; i < count; i++) {
            this.particles.push(this._createParticle());
        }
    }

    _createParticle() {
        const w = this.canvas?.width || 1000;
        const h = this.canvas?.height || 800;
        return {
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            size: Math.random() * 3 + 1,
            alpha: Math.random() * 0.5 + 0.1,
            life: Math.random(),
        };
    }

    _initOrbs() {
        this.orbs = [];
        const w = this.canvas?.width || 1000;
        const h = this.canvas?.height || 800;
        for (let i = 0; i < this.orbCount; i++) {
            this.orbs.push({
                x: Math.random() * w,
                y: Math.random() * h,
                radius: 80 + Math.random() * 200,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                phase: Math.random() * Math.PI * 2,
                speed: 0.003 + Math.random() * 0.008,
            });
        }
    }

    _startLoop() {
        const loop = () => {
            this.animationId = requestAnimationFrame(loop);
            this._draw();
        };
        loop();
    }

    _draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Smooth color transition
        this.color.r += (this.targetColor.r - this.color.r) * 0.02;
        this.color.g += (this.targetColor.g - this.color.g) * 0.02;
        this.color.b += (this.targetColor.b - this.color.b) * 0.02;

        // Smooth intensity
        this.intensity += (this.targetIntensity - this.intensity) * 0.04;

        const r = Math.round(this.color.r);
        const g = Math.round(this.color.g);
        const b = Math.round(this.color.b);

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Draw layers
        this._drawOrbs(ctx, w, h, r, g, b);
        this._drawParticles(ctx, w, h, r, g, b);
        this._drawRadialWave(ctx, w, h, r, g, b);
    }

    _drawOrbs(ctx, w, h, r, g, b) {
        this.orbs.forEach(orb => {
            orb.phase += orb.speed;
            orb.x += orb.vx + Math.sin(orb.phase) * 0.4;
            orb.y += orb.vy + Math.cos(orb.phase * 0.7) * 0.3;

            // Wrap around
            if (orb.x < -orb.radius) orb.x = w + orb.radius;
            if (orb.x > w + orb.radius) orb.x = -orb.radius;
            if (orb.y < -orb.radius) orb.y = h + orb.radius;
            if (orb.y > h + orb.radius) orb.y = -orb.radius;

            const breathe = 1 + Math.sin(orb.phase * 2) * 0.15 * this.intensity;
            const orbRadius = orb.radius * breathe + this.smoothEnergy * 40;
            const alpha = (0.04 + this.smoothEnergy * 0.08) * this.intensity;

            const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orbRadius);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
            grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orbRadius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        });
    }

    _drawParticles(ctx, w, h, r, g, b) {
        this.particles.forEach(p => {
            // Movement influenced by energy
            const energyBoost = 1 + this.smoothEnergy * 3 * this.intensity;
            p.x += p.vx * energyBoost;
            p.y += p.vy * energyBoost;

            // Wrap
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;

            // Pulse size with energy
            const pulseSize = p.size + this.smoothEnergy * 2.5 * this.intensity;
            const alpha = p.alpha * this.intensity * (0.3 + this.smoothEnergy * 0.7);

            ctx.beginPath();
            ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fill();
        });

        // Draw connections between nearby particles
        if (this.intensity > 0.3) {
            const maxDist = 120 * (window.devicePixelRatio || 1);
            for (let i = 0; i < this.particles.length; i++) {
                for (let j = i + 1; j < this.particles.length; j++) {
                    const dx = this.particles[i].x - this.particles[j].x;
                    const dy = this.particles[i].y - this.particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < maxDist) {
                        const lineAlpha = (1 - dist / maxDist) * 0.12 * this.intensity * this.smoothEnergy;
                        ctx.beginPath();
                        ctx.moveTo(this.particles[i].x, this.particles[i].y);
                        ctx.lineTo(this.particles[j].x, this.particles[j].y);
                        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${lineAlpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
        }
    }

    _drawRadialWave(ctx, w, h, r, g, b) {
        if (this.intensity < 0.1) return;

        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = Math.min(w, h) * 0.18;

        ctx.save();
        ctx.globalAlpha = this.intensity * 0.6;

        // Draw two rings
        for (let ring = 0; ring < 2; ring++) {
            const ringOffset = ring * 25;
            const ringAlpha = ring === 0 ? 1 : 0.4;

            ctx.beginPath();
            for (let i = 0; i <= this.wavePoints; i++) {
                const idx = i % this.wavePoints;
                const angle = (idx / this.wavePoints) * Math.PI * 2;
                const waveVal = this.waveData[idx] || 0;
                const radius = baseRadius + ringOffset + waveVal * 120;

                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.25 * ringAlpha})`;
            ctx.lineWidth = ring === 0 ? 2 : 1;
            ctx.stroke();

            // Fill with subtle gradient
            const fillGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius + ringOffset + 60);
            fillGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.02 * ringAlpha})`);
            fillGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = fillGrad;
            ctx.fill();
        }

        ctx.restore();
    }
}
