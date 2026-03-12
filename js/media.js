const MediaHandler = {
    stream: null,
    audioStream: null,

    async requestPermissions() {
        try {
            // Request the best native uncompressed quality by NOT specifying exact dimensions
            const constraints = {
                video: {
                    facingMode: "user"
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false, // Keep raw so squeals/pitches track better
                    autoGainControl: false
                }
            };

            // Try with user (front) camera first
            try {
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (e) {
                console.warn("Front camera failed, falling back to any camera", e);
                // Fallback: Any facing mode
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            }

            // Set video to background element
            const videoEl = document.getElementById('bg-camera');
            // Extract video tracks only for the video element to avoid audio feedback
            const videoStream = new MediaStream(this.stream.getVideoTracks());
            videoEl.srcObject = videoStream;

            // Set up audio analyzer
            const audioStream = new MediaStream(this.stream.getAudioTracks());
            this.audioStream = audioStream;

            // Initialize Audio Analyzer
            await VoiceAnalyzer.init(audioStream);

            return true;
        } catch (err) {
            console.error("Error accessing media devices.", err);
            return false;
        }
    },

    stopAudio() {
        if (this.stream) {
            const audioTracks = this.stream.getAudioTracks();
            audioTracks.forEach(track => {
                track.stop();
                console.log("Microphone track stopped.");
            });
        }
    }
};
