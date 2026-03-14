const SFX = {
    ctx: null,
    recordingDestination: null,
    bgm: null,
    bgmSource: null,

    init(context, destination) {
        this.ctx = context;
        this.recordingDestination = destination;

        // Initialize BGM
        this.bgm = new Audio('assets/audio.mpeg');
        this.bgm.loop = true;

        if (this.ctx) {
            this.bgmSource = this.ctx.createMediaElementSource(this.bgm);

            // Create a GainNode for BGM to control playback volume independently of recording
            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // Lower volume to prevent mic feedback

            this.bgmSource.connect(this.bgmGain);
            this.bgmGain.connect(this.ctx.destination); // Play to speakers at lower volume

            if (this.recordingDestination) {
                // Keep recording volume higher or balanced
                this.bgmSource.connect(this.recordingDestination);
            }
        }
    },

    startBGM() {
        if (!this.bgm) return;
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        this.bgm.currentTime = 0;
        this.bgm.play().catch(e => console.error("BGM play failed:", e));
    },

    stopBGM() {
        if (!this.bgm) return;
        this.bgm.pause();
        this.bgm.currentTime = 0;
    },

    playJump(intensity) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination); // Play to speakers
        if (this.recordingDestination) {
            gainNode.connect(this.recordingDestination); // Pipe to recordings
        }

        osc.type = 'sine';

        const now = this.ctx.currentTime;

        // Base jump sound parameters dependent on intensity
        const startFreq = 300 + (intensity * 200);
        const endFreq = 600 + (intensity * 600);
        const duration = 0.2 + (intensity * 0.2); // 0.2s to 0.4s

        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

        // Volume ramping
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    },

    playGameOver() {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination); // Play to speakers
        if (this.recordingDestination) {
            gainNode.connect(this.recordingDestination); // Pipe to recordings
        }

        osc.type = 'sawtooth';

        const now = this.ctx.currentTime;

        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5); // Descending pitch

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.start(now);
        osc.stop(now + 0.5);
    }
};
