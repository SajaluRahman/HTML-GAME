const VoiceAnalyzer = {
    audioContext: null,
    analyser: null,
    source: null,
    dataArray: null,

    // Output values
    volume: 0,
    normalizedVolume: 0,
    isVocalizing: false,
    durationMs: 0,
    startTime: 0,
    pitch: 0,

    // Thresholds
    noiseGate: 12, // Must be loud enough to trigger jump (ignores background noise)
    maxVolume: 120, // Volume at which it is considered a full 1.0/100% effort

    async init(audioStream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();

        // High buffer size for better frequency resolution
        this.analyser.fftSize = 4096;
        this.analyser.smoothingTimeConstant = 0.3; // Low smoothing for quick reaction

        this.source = this.audioContext.createMediaStreamSource(audioStream);
        this.source.connect(this.analyser);
        // Do NOT connect source to destination! That would result in speaker feedback.

        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    },

    update(deltaTime) {
        if (!this.analyser) return;

        // Read frequency level from analyzer
        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate average volume across frequency spectrum
        let sum = 0;
        let maxAmp = 0;
        let dominantBin = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];

            // Ignore very low frequencies (background hum)
            if (i > 3 && i < 200) {
                if (this.dataArray[i] > maxAmp) {
                    maxAmp = this.dataArray[i];
                    dominantBin = i;
                }
            }
        }
        let avgVolume = sum / this.dataArray.length;
        this.volume = avgVolume;

        if (this.volume > this.noiseGate) {
            if (!this.isVocalizing) {
                // Just started making sound
                this.isVocalizing = true;
                this.startTime = performance.now();
                this.durationMs = 0;
            } else {
                // Continuing to make sound
                this.durationMs = performance.now() - this.startTime;
            }

            // Normalize volume between 0.0 and 1.0 clamped
            this.normalizedVolume = Math.min((this.volume - this.noiseGate) / (this.maxVolume - this.noiseGate), 1.0);

            // Calculate Pitch in Hertz
            this.pitch = dominantBin * (this.audioContext.sampleRate / this.analyser.fftSize);

        } else {
            // Quiet
            this.isVocalizing = false;
            this.durationMs = 0;
            this.normalizedVolume = 0;
            this.pitch = 0;
        }

        // Update UI Voice Meter
        const meterFill = document.getElementById('voice-meter-fill');
        if (meterFill) {
            // Visualize Pitch instead of volume, scaled from 0-1000Hz (capped)
            let pitchPercent = Math.min(this.pitch / 1000 * 100, 100);
            if (!this.isVocalizing) pitchPercent = 0;

            meterFill.style.height = `${pitchPercent}%`;

            // Low pitch = Green, Mid = Yellow, High = Red
            if (this.pitch > 350) {
                meterFill.style.background = '#F44336'; // Red
            } else if (this.pitch > 150) {
                meterFill.style.background = '#FFEB3B'; // Yellow
            } else {
                meterFill.style.background = '#4CAF50'; // Green
            }
        }
    }
};
