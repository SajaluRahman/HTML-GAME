const MediaHandler = {
    stream: null,
    audioStream: null,

    async requestPermissions() {
        try {
            const constraints = {
                video: { facingMode: "user" },
                audio: true
            };

            // Try with user (front) camera first
            try {
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (e) {
                // Fallback to any camera if environment camera fails (e.g. desktop)
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
    }
};
