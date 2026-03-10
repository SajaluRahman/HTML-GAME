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
        this.bonusScore = 0; // Added for coins
        this.gameSpeed = this.baseSpeed;
        this.isGameOver = false;
        this.isRunning = true;
        this.isDead = false;
        this.particles = [];

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
        if (this.isDead) {
            // Update particles for explosion
            if (this.particles) {
                for (let p of this.particles) {
                    p.x += p.vx * (deltaTime / 16);
                    p.y += p.vy * (deltaTime / 16);
                    p.vy += 0.5 * (deltaTime / 16); // gravity
                    p.life -= 0.02 * (deltaTime / 16); // fade out
                }
            }
            return; // Skip rest of game logic while exploding
        }

        VoiceAnalyzer.update(deltaTime);
        const voiceData = {
            isVocalizing: VoiceAnalyzer.isVocalizing,
            normalizedVolume: VoiceAnalyzer.normalizedVolume, // Still present but maybe we use it for something else
            pitch: VoiceAnalyzer.pitch
        };

        // Base state: don't move unless making sound
        this.gameSpeed = 0;

        // Jump mechanics based on Pitch
        if (voiceData.isVocalizing) {

            // Move forward when vocalizing
            this.gameSpeed = this.baseSpeed;

            const minPitch = 80;
            const maxPitch = 800; // Increased max threshold for "very very high" pitch

            let pitchRange = Math.max(0, voiceData.pitch - minPitch);
            let intensity = Math.min(pitchRange / (maxPitch - minPitch), 1.0);

            // Allow intensity to scale up to 1.5x for massive jumps, but floor at 0.2 for tiny hops
            intensity = Math.max(0.2, intensity * 1.5);

            // Allow jump only if grounded AND we haven't already jumped during this sound burst
            if (this.goat.isGrounded && !this.goat.hasJumpedThisBurst) {
                this.goat.jump(intensity);
                this.goat.hasJumpedThisBurst = true; // Block further jumps until sound stops
                this.goat.maxIntensityThisBurst = intensity;
            } else if (!this.goat.isGrounded && this.goat.hasJumpedThisBurst) {
                // If mid-air and the user dramatically spikes pitch...
                if (intensity > (this.goat.maxIntensityThisBurst || 0) + 0.2) {
                    this.goat.jump(intensity, true); // Force a mid-air jump boost
                    this.goat.maxIntensityThisBurst = intensity; // Update high watermark
                }
            }
        } else {
            // Sound stopped, reset the jump burst blocker so we can jump again next time
            this.goat.hasJumpedThisBurst = false;
            this.goat.maxIntensityThisBurst = 0;
        }

        this.goat.update(deltaTime, voiceData);

        // Reset grounded state for collision checking
        this.goat.isGrounded = false;

        // Useful goat bounds (tighter hitbox for fairness since sprite is 150x150)
        const gX = this.goat.x + 40;
        const gY = this.goat.y + 40;
        const gW = this.goat.width - 80;
        const gH = this.goat.height - 40; // less off the bottom for ground checks
        const goatBottom = this.goat.y + this.goat.height;
        const goatRight = this.goat.x + this.goat.width;

        for (let i = 0; i < this.platforms.length; i++) {
            const plat = this.platforms[i];

            plat.update(this.gameSpeed, deltaTime);

            // Only land on platform if moving downwards or horizontal
            if (this.goat.velocityY >= 0) {
                // Generous bounding box X collision (forgiving for player)
                if (goatRight - 30 > plat.x && this.goat.x + 30 < plat.x + plat.width) {
                    // Check Y axis: If goat bottom is near platform top, snap to it
                    // The 20px threshold covers fast falls in a single frame
                    if (goatBottom >= plat.y && goatBottom - this.goat.velocityY * (deltaTime / 16) <= plat.y + 20) {
                        this.goat.isGrounded = true;
                        this.goat.y = plat.y - this.goat.height;
                        this.goat.velocityY = 0;
                    }
                }
            }

            // Check Coins
            for (let c of plat.coins) {
                if (!c.collected) {
                    const cX = plat.x + c.xOffset;
                    const cY = plat.y - c.yOffset;
                    // AABB collision
                    if (gX < cX + c.width && gX + gW > cX &&
                        gY < cY + c.height && gY + gH > cY) {
                        c.collected = true;
                        this.bonusScore += 2; // Points per coin
                    }
                }
            }

            // Check Mines
            for (let m of plat.mines) {
                if (!m.hit) {
                    const mX = plat.x + m.xOffset;
                    const mY = plat.y - m.yOffset;
                    // Tighter AABB for mines to be fair (15px inset on the 70px sprite)
                    const mHitX = mX + 15;
                    const mHitY = mY + 15;
                    const mHitW = m.width - 30;
                    const mHitH = m.height - 30;

                    if (gX < mHitX + mHitW && gX + gW > mHitX &&
                        gY < mHitY + mHitH && gY + gH > mHitY) {
                        m.hit = true;
                        this.die(); // Eliminate goat
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

        // Scoring based on distance + bonus
        this.distanceTraveled += this.gameSpeed * (deltaTime / 16);
        this.score = Math.floor(this.distanceTraveled / 60) + (this.bonusScore || 0);
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

        if (!this.isDead) {
            this.goat.draw(this.ctx);
        }

        // Draw explosion particles
        if (this.isDead && this.particles) {
            for (let p of this.particles) {
                if (p.life > 0) {
                    this.ctx.globalAlpha = Math.max(0, p.life);
                    this.ctx.fillStyle = p.color;
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            this.ctx.globalAlpha = 1.0;
        }
    },

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.gameSpeed = 0;
        SFX.playGameOver();

        // Spawn firework particles
        this.particles = [];
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: this.goat.x + this.goat.width / 2,
                y: this.goat.y + this.goat.height / 2,
                vx: (Math.random() - 0.5) * 30,
                vy: (Math.random() - 0.5) * 30 - 10, // Initial upward burst
                life: 1.0,
                color: ['#ff0000', '#ff8800', '#ffff00', '#ffffff', '#ff00ff'][Math.floor(Math.random() * 5)],
                size: Math.random() * 8 + 4
            });
        }

        // Delay game over screen to let animation play
        setTimeout(() => {
            this.isGameOver = true;
            this.isRunning = false;

            this.hudScreen.classList.remove('active');
            this.gameOverScreen.classList.add('active');
            this.finalScore.textContent = this.score;
        }, 1500);
    }
};

window.onload = () => {
    Game.init();
};
