window.Audio = {
    ctx: null,
    masterGain: null,
    muted: false,
    initialized: false,

    init() {
        if (this.initialized) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Audio init failed:', e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 0.3;
        }
        return this.muted;
    },

    playTone(freq, duration, type, volume) {
        if (!this.ctx || this.muted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type || 'square';
            osc.frequency.value = freq;
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(volume || 0.2, this.ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    },

    playShoot() {
        this.playTone(220, 0.08, 'square', 0.12);
        this.playTone(110, 0.12, 'sawtooth', 0.08);
    },

    playEnemyShoot() {
        this.playTone(180, 0.06, 'square', 0.06);
    },

    playExplosion() {
        if (!this.ctx || this.muted) return;
        try {
            const noise = this.ctx.createBufferSource();
            const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
            }
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.4;
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            noise.start();
            noise.stop(this.ctx.currentTime + 0.4);
        } catch (e) {}
    },

    playBigExplosion() {
        this.playExplosion();
        if (!this.ctx || this.muted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.6);
            gain.gain.value = 0.3;
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.6);
        } catch (e) {}
    },

    playHit() {
        this.playTone(400, 0.04, 'square', 0.08);
    },

    playPlayerDamage() {
        this.playTone(150, 0.15, 'sawtooth', 0.15);
        this.playTone(100, 0.2, 'square', 0.1);
    },

    playPickup() {
        this.playTone(660, 0.08, 'sine', 0.15);
        setTimeout(() => this.playTone(880, 0.12, 'sine', 0.15), 60);
    },

    playClick() {
        this.playTone(800, 0.03, 'square', 0.08);
    },

    playLevelComplete() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((n, i) => {
            setTimeout(() => this.playTone(n, 0.2, 'sine', 0.15), i * 120);
        });
    },

    playGameOver() {
        const notes = [400, 350, 300, 200];
        notes.forEach((n, i) => {
            setTimeout(() => this.playTone(n, 0.3, 'sawtooth', 0.15), i * 150);
        });
    },

    playVictory() {
        const notes = [523, 659, 784, 1047, 1319];
        notes.forEach((n, i) => {
            setTimeout(() => this.playTone(n, 0.25, 'sine', 0.18), i * 100);
        });
    },

    playEngine() {
        // Subtle engine hum - called periodically
        this.playTone(60, 0.15, 'sawtooth', 0.03);
    },

    playBossAlert() {
        this.playTone(200, 0.2, 'sawtooth', 0.2);
        setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.2), 300);
    },
};
