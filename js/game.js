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
    humanTypeBag: [],
    lastHumanType: -1,

    // Time tracking
    lastTime: 0,
    gameStartTime: 0,
    activePlayTime: 0,

    // UI Elements
    startScreen: null,
    hudScreen: null,
    gameOverScreen: null,
    scoreVal: null,
    finalScore: null,
    timerVal: null,

    // Recording & Screenshot
    mediaRecorder: null,
    recordedChunks: [],
    recordStream: null,

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.startScreen = document.getElementById('start-screen');
        this.hudScreen = document.getElementById('hud-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.scoreVal = document.getElementById('score-val');
        this.finalScore = document.getElementById('final-score');
        this.timerVal = document.getElementById('timer-val');

        // Handle Resize
        window.addEventListener('resize', () => this.resize());
        this.resize();

        // Bind buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGainingPermissions());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGainingPermissions());

        // Screenshot & Recording Actions
        document.getElementById('screenshot-btn').addEventListener('click', () => this.takeScreenshot());
        document.getElementById('save-screenshot-btn').addEventListener('click', () => this.saveScreenshot());
        document.getElementById('share-screenshot-btn').addEventListener('click', () => this.shareScreenshot());
        document.getElementById('record-btn').addEventListener('click', (e) => this.toggleRecording(e.target));

        // Champion screen buttons
        document.getElementById('champion-restart-btn').addEventListener('click', () => this.startGainingPermissions());
        document.getElementById('champion-screenshot-btn').addEventListener('click', () => this.takeChampionScreenshot());
        document.getElementById('champion-save-btn').addEventListener('click', () => this.saveChampionScreenshot());
        document.getElementById('champion-share-btn').addEventListener('click', () => this.shareChampionScreenshot());
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
            SFX.init(VoiceAnalyzer.audioContext, VoiceAnalyzer.mediaStreamDestination);
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

        // Only allow humans if 20 seconds have passed since game start
        const timeElapsed = (performance.now() - this.gameStartTime) / 1000;
        const allowHumans = timeElapsed > 20;

        // Determine human types if allowed
        let humanTypes = [];
        if (allowHumans && width > 120 && Math.random() < 0.8) { // 80% chance, platforms > 120px
            const numHumans = Math.floor(Math.random() * 2) + 1; // 1 to 2 humans max
            // shameer.png = index 3, shameer2.png = index 6 (conflict pair)
            const SHAMEER_IDX = 3;
            const SHAMEER2_IDX = 6;
            for (let i = 0; i < numHumans; i++) {
                let type = this.getNextHumanType();
                // If this is the 2nd human, check for shameer conflict
                if (i > 0 && humanTypes.length > 0) {
                    const first = humanTypes[0];
                    const isShameerConflict =
                        (first === SHAMEER_IDX && type === SHAMEER2_IDX) ||
                        (first === SHAMEER2_IDX && type === SHAMEER_IDX);
                    if (isShameerConflict) {
                        // Re-pick: get another one (put this one back conceptually)
                        type = this.getNextHumanType();
                        // If still conflicting, just skip the 2nd human
                        const stillConflict =
                            (first === SHAMEER_IDX && type === SHAMEER2_IDX) ||
                            (first === SHAMEER2_IDX && type === SHAMEER_IDX);
                        if (stillConflict) continue;
                    }
                }
                humanTypes.push(type);
            }
        }

        const plat = new Platform(rightMostX + gap, y, width, this.canvas.height - y + heightPadding, allowHumans, humanTypes);

        // Place Quikzii champion coin after 2 minutes (only once)
        // Place Quikzii champion coin after 2 minutes of ACTIVE play
        if (!this.quikziiSpawned && this.activePlayTime >= 120 && width >= 150) {
            const coinSize = 100;
            const qX = (width - coinSize) / 2; // Center on platform
            plat.quikziiCoin = {
                xOffset: qX,
                yOffset: coinSize + 20, // Float above platform
                width: coinSize,
                height: coinSize,
                collected: false
            };
            this.quikziiSpawned = true;
        }

        this.platforms.push(plat);
    },

    resetGame() {
        this.gameOverScreen.classList.remove('active');
        document.getElementById('champion-screen').classList.remove('active');
        this.hudScreen.classList.add('active');

        this.score = 0;
        this.distanceTraveled = 0;
        this.bonusScore = 0; // Added for coins
        this.gameSpeed = this.baseSpeed;
        this.isGameOver = false;
        this.humanTypeBag = []; // Reset variety bag
        this.lastHumanType = -1;
        this.isRunning = true;
        this.isDead = false;
        this.particles = [];
        this.quikziiSpawned = false; // Track if champion coin has been placed
        this.isChampion = false; // Track win state
        this.activePlayTime = 0; // Cumulative time vocalizing/moving

        // Starting goat position, a bit to the left
        this.goat = new Goat(this.canvas.width * 0.15, this.canvas.height * 0.3);

        this.platforms = [];
        // First platform is always safe right under the goat
        this.platforms.push(new Platform(0, this.canvas.height * 0.6, this.canvas.width * 0.6, this.canvas.height * 0.4 + 200));

        for (let i = 0; i < 4; i++) {
            this.spawnPlatform();
        }

        // Hide screenshot preview cleanly
        document.getElementById('screenshot-preview-container').style.display = 'none';
        document.getElementById('screenshot-btn').style.display = 'inline-block';

        // Reset champion screenshot state
        document.getElementById('champion-screenshot-preview-container').style.display = 'none';
        document.getElementById('champion-screenshot-btn').style.display = 'inline-block';

        // Reset record button state
        const recordBtn = document.getElementById('record-btn');
        recordBtn.textContent = '⏺ Record';
        recordBtn.style.background = 'linear-gradient(135deg, #e53935, #b71c1c)';

        this.lastTime = performance.now();
        this.gameStartTime = performance.now();
        SFX.startBGM();
        requestAnimationFrame((time) => this.loop(time));
    },

    toggleRecording(btn) {
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            // Stop recording
            this.mediaRecorder.stop();
            btn.textContent = '⏺ Record';
            btn.style.background = 'linear-gradient(135deg, #e53935, #b71c1c)'; // Red
        } else {
            // Start recording
            this.recordedChunks = [];
            btn.textContent = '⏹ Stop Recording';
            btn.style.background = 'linear-gradient(135deg, #43a047, #1b5e20)'; // Green
            this.startRecording();
        }
    },

    startRecording() {
        try {
            const canvasStream = this.canvas.captureStream(30); // 30 FPS

            const tracks = [
                ...canvasStream.getVideoTracks()
            ];

            // Add the combined audio track from VoiceAnalyzer (Mic + SFX)
            if (VoiceAnalyzer.mediaStreamDestination) {
                tracks.push(...VoiceAnalyzer.mediaStreamDestination.stream.getAudioTracks());
            }

            const combinedStream = new MediaStream(tracks);

            this.mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `goat_jump_gameplay_${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            };

            this.mediaRecorder.start();
        } catch (e) {
            console.error("Recording failed or not supported", e);
        }
    },

    getNextHumanType() {
        if (this.humanTypeBag.length === 0) {
            // Refill bag dynamically based on human sources
            const available = humanSources.map((_, i) => i);

            // Randomly shuffle the available indices
            for (let i = available.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [available[i], available[j]] = [available[j], available[i]];
            }

            // If the first element of new bag is same as last element picked, swap it with another
            if (available[0] === this.lastHumanType && available.length > 1) {
                [available[0], available[1]] = [available[1], available[0]];
            }

            this.humanTypeBag = available;
        }

        const nextType = this.humanTypeBag.pop();
        this.lastHumanType = nextType;
        return nextType;
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

            // Check Quikzii Champion Coin
            if (plat.quikziiCoin && !plat.quikziiCoin.collected) {
                const qc = plat.quikziiCoin;
                const qX = plat.x + qc.xOffset;
                const qBounce = Math.sin(performance.now() / 300) * 12;
                const qY = plat.y - qc.yOffset + qBounce;
                if (gX < qX + qc.width && gX + gW > qX &&
                    gY < qY + qc.height && gY + gH > qY) {
                    qc.collected = true;
                    this.win(); // Champion!
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

        // Timer update (Active Play Time)
        if (this.gameSpeed > 0) {
            this.activePlayTime += deltaTime / 1000;
        }
        const minutes = Math.floor(this.activePlayTime / 60);
        const seconds = Math.floor(this.activePlayTime % 60);
        this.timerVal.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Dead? (Fell off screen)
        if (this.goat.y > this.canvas.height + 200) {
            this.die();
        }
    },

    draw() {
        // Draw video background so it gets captured in CanvasStream
        const video = document.getElementById('bg-camera');
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
            // Calculate object-fit: cover equivalent for canvas drawing to prevent stretching
            const videoRatio = video.videoWidth / video.videoHeight;
            const canvasRatio = this.canvas.width / this.canvas.height;
            let drawWidth, drawHeight, startX, startY;

            if (videoRatio > canvasRatio) {
                drawHeight = this.canvas.height;
                drawWidth = video.videoWidth * (this.canvas.height / video.videoHeight);
                startX = (this.canvas.width - drawWidth) / 2;
                startY = 0;
            } else {
                drawWidth = this.canvas.width;
                drawHeight = video.videoHeight * (this.canvas.width / video.videoWidth);
                startX = 0;
                startY = (this.canvas.height - drawHeight) / 2;
            }

            // Mirror the video on the canvas for recording so it matches the live feed
            this.ctx.save();
            this.ctx.scale(-1, 1);
            // Draw video with proper aspect ratio, inverted X to account for scale(-1, 1)
            this.ctx.drawImage(video, -startX - drawWidth, startY, drawWidth, drawHeight);
            this.ctx.restore();
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

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

        // Add UI to Canvas if Recording
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            this.ctx.save();

            // 1. Draw Logos (Bottom Left)
            const logoSize = 60;
            const padding = 20;
            const startX = padding;
            const startY = this.canvas.height - logoSize - padding - 30; // Above ticker

            if (logo1ImageLoaded) this.ctx.drawImage(logo1Image, startX, startY, logoSize, logoSize);
            if (logo2ImageLoaded) this.ctx.drawImage(logo2Image, startX + logoSize + 10, startY, logoSize, logoSize);
            if (quikziiImageLoaded) this.ctx.drawImage(quikziiImage, startX + (logoSize + 10) * 2, startY, logoSize, logoSize);

            // 2. Draw Timer (Top Right)
            const mins = Math.floor(this.activePlayTime / 60);
            const secs = Math.floor(this.activePlayTime % 60);
            const timerText = `${mins}:${secs.toString().padStart(2, '0')}`;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.font = 'bold 24px Arial, sans-serif';
            const textWidth = this.ctx.measureText(`Time: ${timerText}`).width;

            // Timer Background
            this.ctx.beginPath();
            if (this.ctx.roundRect) {
                this.ctx.roundRect(this.canvas.width - textWidth - 40, 20, textWidth + 20, 40, 10);
            } else {
                this.ctx.rect(this.canvas.width - textWidth - 40, 20, textWidth + 20, 40);
            }
            this.ctx.fill();

            this.ctx.fillStyle = '#FFD700'; // Gold
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`Time: ${timerText}`, this.canvas.width - 30, 48);

            this.ctx.restore();
        }
    },

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.gameSpeed = 0;
        SFX.playGameOver();
        SFX.stopBGM();

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

            // Stop recording
            if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
                this.mediaRecorder.stop();
                const recordBtn = document.getElementById('record-btn');
                recordBtn.textContent = '⏺ Record';
                recordBtn.style.background = 'linear-gradient(135deg, #e53935, #b71c1c)';
            }

            // Turn off Microphone
            MediaHandler.stopAudio();

            this.hudScreen.classList.remove('active');
            this.gameOverScreen.classList.add('active');
            this.finalScore.textContent = this.score;
        }, 1500);
    },

    win() {
        if (this.isDead || this.isChampion) return;
        this.isChampion = true;
        this.gameSpeed = 0;
        SFX.stopBGM();

        // Celebration particles (golden)
        this.particles = [];
        for (let i = 0; i < 80; i++) {
            this.particles.push({
                x: this.goat.x + this.goat.width / 2,
                y: this.goat.y + this.goat.height / 2,
                vx: (Math.random() - 0.5) * 25,
                vy: (Math.random() - 0.5) * 25 - 12,
                life: 1.0,
                color: ['#FFD700', '#FFA500', '#FFEB3B', '#FFE082', '#FFF176'][Math.floor(Math.random() * 5)],
                size: Math.random() * 10 + 4
            });
        }
        this.isDead = true; // Reuse for particle animation

        setTimeout(() => {
            this.isGameOver = true;
            this.isRunning = false;

            // Stop recording
            if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
                this.mediaRecorder.stop();
                const recordBtn = document.getElementById('record-btn');
                recordBtn.textContent = '⏺ Record';
                recordBtn.style.background = 'linear-gradient(135deg, #e53935, #b71c1c)';
            }

            MediaHandler.stopAudio();
            this.hudScreen.classList.remove('active');

            // Show champion screen instead of game over
            const championScreen = document.getElementById('champion-screen');
            document.getElementById('champion-score').textContent = this.score;
            championScreen.classList.add('active');
        }, 1500);
    },

    takeScreenshot() {
        // Redraw immediately to ensure we have the clean frame
        this.draw();

        // Imprint the final score and text onto the canvas directly so it gets saved in the image
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        const overlayW = 300, overlayH = 160;
        const overlayX = this.canvas.width / 2 - overlayW / 2;
        const overlayY = this.canvas.height / 2 - overlayH / 2;

        if (this.ctx.roundRect) {
            this.ctx.beginPath();
            this.ctx.roundRect(overlayX, overlayY, overlayW, overlayH, 20);
            this.ctx.fill();
        } else {
            // Fallback for older browsers
            this.ctx.fillRect(overlayX, overlayY, overlayW, overlayH);
        }

        this.ctx.fillStyle = '#ffeb3b';
        this.ctx.font = 'bold 36px "Segoe UI", Tahoma, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Goat Jump Final Score`, this.canvas.width / 2, overlayY + 50);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px "Segoe UI", Tahoma, sans-serif';
        this.ctx.fillText(`${this.score}`, this.canvas.width / 2, overlayY + 110);
        this.ctx.restore();

        // Capture as Blob immediately for reliable saving
        this.canvas.toBlob((blob) => {
            this.lastScreenshotBlob = blob;
        }, 'image/png');

        const dataUrl = this.canvas.toDataURL("image/png");
        document.getElementById('screenshot-preview').src = dataUrl;
        document.getElementById('screenshot-preview-container').style.display = 'block';
        document.getElementById('screenshot-btn').style.display = 'none';

        // Redraw one more time to clean the superimposed UI off the live game canvas behind the modal
        this.draw();
    },

    saveScreenshot() {
        if (!this.lastScreenshotBlob) return;

        const url = URL.createObjectURL(this.lastScreenshotBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `goat_jump_score_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    },

    async shareScreenshot() {
        const dataUrl = document.getElementById('screenshot-preview').src;
        if (!dataUrl) return;

        try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], `goat_jump_score_${Date.now()}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'My Goat Jump Score!',
                    text: `I scored ${this.score} in Goat Jump Voice Challenge! 🐐`,
                    files: [file]
                });
            } else {
                alert("Sharing files is not supported on this browser/device.");
            }
        } catch (err) {
            console.error(err);
        }
    },

    takeChampionScreenshot() {
        this.draw();

        // Champion overlay
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.roundRect(this.canvas.width / 2 - 160, this.canvas.height / 2 - 100, 320, 200, 20);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 28px "Segoe UI", Tahoma, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`🏆 Champion of Quikzee!`, this.canvas.width / 2, this.canvas.height / 2 - 40);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 22px "Segoe UI", Tahoma, sans-serif';
        this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);

        this.ctx.fillStyle = '#FFEB3B';
        this.ctx.font = 'bold 16px "Segoe UI", Tahoma, sans-serif';
        this.ctx.fillText(`Goat Jump Voice Challenge`, this.canvas.width / 2, this.canvas.height / 2 + 50);
        this.ctx.restore();

        // Capture as Blob immediately for reliable saving
        this.canvas.toBlob((blob) => {
            this.lastChampionScreenshotBlob = blob;
        }, 'image/png');

        const dataUrl = this.canvas.toDataURL("image/png");
        document.getElementById('champion-screenshot-preview').src = dataUrl;
        document.getElementById('champion-screenshot-preview-container').style.display = 'block';
        document.getElementById('champion-screenshot-btn').style.display = 'none';

        this.draw();
    },

    saveChampionScreenshot() {
        if (!this.lastChampionScreenshotBlob) return;

        const url = URL.createObjectURL(this.lastChampionScreenshotBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `quikzee_champion_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    },

    async shareChampionScreenshot() {
        const dataUrl = document.getElementById('champion-screenshot-preview').src;
        if (!dataUrl) return;

        try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], `quikzee_champion_${Date.now()}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Champion of Quikzee! 🏆',
                    text: `I'm the Champion of Quikzee with a score of ${this.score}! 🐐🏆`,
                    files: [file]
                });
            } else {
                alert("Sharing files is not supported on this browser/device.");
            }
        } catch (err) {
            console.error(err);
        }
    }
};

window.onload = () => {
    Game.init();
};
