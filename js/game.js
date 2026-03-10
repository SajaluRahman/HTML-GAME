const Game = {
    canvas: null,
    ctx: null,

    // Game State
    isRunning: false,
    isGameOver: false,
    score: 0,
    distanceTraveled: 0,
    gameSpeed: 4,
    baseSpeed: 4,

    // Entities
    goat: null,
    platforms: [],

    // Time tracking
    lastTime: 0,

    // UI Elements
    startScreen: null,
    hudScreen: null,
    gameOverScreen: null,
    scoreVal: null,
    finalScore: null,

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.startScreen = document.getElementById('start-screen');
        this.hudScreen = document.getElementById('hud-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.scoreVal = document.getElementById('score-val');
        this.finalScore = document.getElementById('final-score');

        // Handle Resize
        window.addEventListener('resize', () => this.resize());
        this.resize();

        // Bind buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGainingPermissions());
        document.getElementById('restart-btn').addEventListener('click', () => this.resetGame());
    },

    resize() {
        const container = document.getElementById('app-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    },

    async startGainingPermissions() {
        const startBtn = document.getElementById('start-btn');
        startBtn.textContent = "Requesting System Permissions...";
        startBtn.disabled = true;

        const success = await MediaHandler.requestPermissions();
        if (success) {
            // Must init audio context here on user interaction
            SFX.init();
            this.startScreen.classList.remove('active');
            this.resetGame();
        } else {
            const errorMsg = document.getElementById('start-error');
            errorMsg.textContent = "Camera/Mic access denied or unavailable. Please check permissions and refresh.";
            errorMsg.style.display = 'block';
            startBtn.textContent = "Allow Mic & Camera to Start";
            startBtn.disabled = false;
        }
    },

    spawnPlatform(xOverride) {
        let rightMostX = 0;
        if (this.platforms.length > 0) {
            const lastPlat = this.platforms[this.platforms.length - 1];
            rightMostX = lastPlat.x + lastPlat.width;
        }

        if (xOverride !== undefined) rightMostX = xOverride;

        // Gap up to 250px depending on speed feeling
        const minGap = 80;
        const maxGap = 280;
        const gap = minGap + Math.random() * (maxGap - minGap);

        const minWidth = 120;
        const maxWidth = 350;
        const width = minWidth + Math.random() * (maxWidth - minWidth);

        // Y position (height), kept manageable for jumping
        const minY = this.canvas.height * 0.45;
        const maxY = this.canvas.height * 0.75;

        let y = minY + Math.random() * (maxY - minY);

        // Avoid drastic height changes if we have previous platforms
        if (this.platforms.length > 0) {
            const prevY = this.platforms[this.platforms.length - 1].y;
            // Cap height difference
            if (Math.abs(y - prevY) > 150) {
                y = prevY + (y > prevY ? 150 : -150);
            }
        }

        const heightPadding = 300; // Draw down past screen bottom
        const plat = new Platform(rightMostX + gap, y, width, this.canvas.height - y + heightPadding);
        this.platforms.push(plat);
    },

    resetGame() {
        this.gameOverScreen.classList.remove('active');
        this.hudScreen.classList.add('active');

        this.score = 0;
        this.distanceTraveled = 0;
        this.gameSpeed = this.baseSpeed;
        this.isGameOver = false;
        this.isRunning = true;

        // Starting goat position, a bit to the left
        this.goat = new Goat(this.canvas.width * 0.15, this.canvas.height * 0.3);

        this.platforms = [];
        // First platform is always safe right under the goat
        this.platforms.push(new Platform(0, this.canvas.height * 0.6, this.canvas.width * 0.6, this.canvas.height * 0.4 + 200));

        for (let i = 0; i < 4; i++) {
            this.spawnPlatform();
        }

        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.loop(time));
    },

    loop(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Protect against huge delta times (e.g. backgrounding tab)
        if (deltaTime < 100) {
            this.update(deltaTime);
            this.draw();
        }

        if (!this.isGameOver) {
            requestAnimationFrame((time) => this.loop(time));
        }
    },

    update(deltaTime) {
        VoiceAnalyzer.update(deltaTime);
        const voiceData = {
            isVocalizing: VoiceAnalyzer.isVocalizing,
            normalizedVolume: VoiceAnalyzer.normalizedVolume, // Still present but maybe we use it for something else
            pitch: VoiceAnalyzer.pitch
        };

        // Base state: don't move unless making sound
        this.gameSpeed = 0;

        // Only trigger movement if vocalizing
        if (voiceData.isVocalizing) {

            // Movement speed based slightly on volume to make it feel responsive, but fixed base
            this.gameSpeed = this.baseSpeed + (voiceData.normalizedVolume * 2);

            // Determine Jump based on Pitch
            // Assuming low pitch < 200, high pitch > 200 (tuneable)
            if (this.goat.isGrounded) {
                if (voiceData.pitch > 250) {
                    // High Pitch -> Jump! Intensity scales with pitch difference
                    let intensity = Math.min((voiceData.pitch - 250) / 400, 1.0);
                    this.goat.jump(intensity);
                }
            }
        }

        this.goat.update(deltaTime, voiceData);

        // Reset grounded state for collision checking
        this.goat.isGrounded = false;

        // Useful goat bounds
        const goatBottom = this.goat.y + this.goat.height;
        const goatRight = this.goat.x + this.goat.width;

        for (let i = 0; i < this.platforms.length; i++) {
            const plat = this.platforms[i];

            plat.update(this.gameSpeed, deltaTime);

            // Only land on platform if moving downwards or horizontal
            if (this.goat.velocityY >= 0) {
                // Generous bounding box X collision (forgiving for player)
                if (goatRight - 15 > plat.x && this.goat.x + 15 < plat.x + plat.width) {
                    // Check Y axis: If goat bottom is near platform top, snap to it
                    // The 20px threshold covers fast falls in a single frame
                    if (goatBottom >= plat.y && goatBottom - this.goat.velocityY * (deltaTime / 16) <= plat.y + 20) {
                        this.goat.isGrounded = true;
                        this.goat.y = plat.y - this.goat.height;
                        this.goat.velocityY = 0;
                        break;
                    }
                }
            }
        }

        // Remove off-screen platforms
        if (this.platforms.length > 0 && this.platforms[0].x + this.platforms[0].width < 0) {
            this.platforms.shift();
        }

        // Keep a buffer of platforms ahead
        if (this.platforms.length < 5) {
            this.spawnPlatform();
        }

        // Scoring based on distance
        this.distanceTraveled += this.gameSpeed * (deltaTime / 16);
        this.score = Math.floor(this.distanceTraveled / 60);
        this.scoreVal.textContent = this.score;

        // Dead? (Fell off screen)
        if (this.goat.y > this.canvas.height + 200) {
            this.die();
        }
    },

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Background is transparent because video sits behind canvas

        for (let plat of this.platforms) {
            plat.draw(this.ctx);
        }

        this.goat.draw(this.ctx);
    },

    die() {
        this.isGameOver = true;
        this.isRunning = false;

        this.hudScreen.classList.remove('active');
        this.gameOverScreen.classList.add('active');
        this.finalScore.textContent = this.score;

        SFX.playGameOver();
    }
};

window.onload = () => {
    Game.init();
};
