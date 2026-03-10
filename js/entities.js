const treeImage = new Image();
treeImage.src = 'assets/coconut_tree2.png';
let treeImageLoaded = false;
treeImage.onload = () => { treeImageLoaded = true; };

// Load all human varieties
const humanImages = [];
const humanSources = ['assets/lalan.png', 'assets/abu.png', 'assets/pappan.png', 'assets/shameer.png', 'assets/ponnappan.png'];
let loadedHumans = 0;

for (let i = 0; i < humanSources.length; i++) {
    const img = new Image();
    img.src = humanSources[i];
    img.onload = () => { loadedHumans++; };
    humanImages.push(img);
}

// Load Collectibles and Hazards
const coinImage = new Image();
coinImage.src = 'assets/coin2.png';
let coinImageLoaded = false;
coinImage.onload = () => { coinImageLoaded = true; };

const mineImage = new Image();
mineImage.src = 'assets/mine2.png';
let mineImageLoaded = false;
mineImage.onload = () => { mineImageLoaded = true; };

class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        // Kerala themed colors: richer soil, deeper tropical greens
        this.color = Math.random() > 0.5 ? '#5d4037' : '#4e342e'; // Darker dirt/laterite soil
        this.topColor = '#33691E'; // Deep tropical grass green
        this.highlightColor = '#558B2F'; // Lighter grass patches

        // Generate random trees on this platform
        this.trees = [];
        this.farmers = [];
        this.coins = [];
        this.mines = [];

        // Only put trees/farmers/hazards on reasonably wide platforms
        if (width > 150) {
            const numTrees = Math.floor(Math.random() * 2) + 1; // 1 to 2 trees
            for (let i = 0; i < numTrees; i++) {
                // Keep trees away from the very edges
                const treeX = 20 + Math.random() * (width - 60);
                const treeScale = 0.6 + Math.random() * 0.4; // 0.6 to 1.0 scale
                this.trees.push({
                    xOffset: treeX,
                    scale: treeScale
                });
            }

            // 30% chance to spawn humans on a platform
            if (Math.random() > 0.7) {
                // Spawn 1 to 3 humans
                const numHumans = Math.floor(Math.random() * 3) + 1;
                for (let j = 0; j < numHumans; j++) {
                    const humanX = 30 + Math.random() * (width - 60);
                    const facingRight = Math.random() > 0.5;
                    // Pick a random human index (0-3)
                    const humanType = Math.floor(Math.random() * humanSources.length);
                    // Scale some randomly
                    const hScale = 0.8 + Math.random() * 0.4;

                    this.farmers.push({
                        xOffset: humanX,
                        facingRight: facingRight,
                        typeIndex: humanType,
                        scale: hScale
                    });
                }
            }

            // Collectibles: Coins
            // 60% chance to spawn a line/arc of coins
            if (Math.random() > 0.4) {
                const numCoins = Math.floor(Math.random() * 4) + 1;
                const startX = 20 + Math.random() * (width / 2); // Start somewhere leftish
                for (let c = 0; c < numCoins; c++) {
                    // Slight arc: calculate Y offset based on distance from middle
                    const cX = startX + (c * 50);
                    const hover = 60 + Math.sin(c * 1) * 40; // Float above ground 60-100px
                    this.coins.push({
                        xOffset: cX,
                        yOffset: hover,
                        width: 40,
                        height: 40,
                        collected: false
                    });
                }
            }

            // Hazards: Mines
            // 30% chance to spawn 1 mine
            if (Math.random() > 0.7 && this.coins.length === 0) { // Keep away from coin paths mostly
                const mineX = 50 + Math.random() * (width - 100);
                this.mines.push({
                    xOffset: mineX,
                    yOffset: 30, // Roll on ground
                    width: 50,
                    height: 50,
                    hit: false
                });
            }
        }
    }

    update(speed, deltaTime) {
        // Move left based on game speed
        this.x -= speed * (deltaTime / 16);
    }

    draw(ctx) {
        // Draw background elements (Trees) first so goat/grass is in front
        if (treeImageLoaded) {
            for (const tree of this.trees) {
                // Tree original size assume ~120x160 from generator
                const tWidth = 200 * tree.scale;
                const tHeight = 250 * tree.scale;
                const tX = this.x + tree.xOffset;
                const tY = this.y - tHeight + 20; // Anchor it slightly deep into the grass

                ctx.drawImage(treeImage, tX, tY, tWidth, tHeight);
            }
        }

        // Draw humans if any are loaded
        if (loadedHumans > 0) {
            for (const human of this.farmers) {
                const img = humanImages[human.typeIndex];
                if (!img) continue; // Skip if this specific image isn't loaded yet

                const fWidth = 90 * human.scale;
                const fHeight = 110 * human.scale;
                const fX = this.x + human.xOffset;
                const fY = this.y - fHeight + 15; // Anchor on grass

                ctx.save();
                if (!human.facingRight) {
                    // Flip image horizontally
                    ctx.translate(fX + fWidth, fY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0, fWidth, fHeight);
                } else {
                    ctx.drawImage(img, fX, fY, fWidth, fHeight);
                }
                ctx.restore();
            }
        }

        // Main block (Dirt/Soil)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // A little less rounded for a more rugged look
        ctx.roundRect(this.x, this.y, this.width, this.height, [0, 0, 5, 5]);
        ctx.fill();

        // Grass top layer
        ctx.fillStyle = this.topColor;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, 20, [5, 5, 0, 0]);
        ctx.fill();

        // Tropical grass detail overlay (Kerala style patchy grass)
        ctx.fillStyle = this.highlightColor;
        ctx.fillRect(this.x + 10, this.y + 15, this.width - 20, 5);
        ctx.fillStyle = '#689F38'; // Occasional light patch
        ctx.fillRect(this.x + this.width * 0.3, this.y, this.width * 0.4, 8);

        // Draw Coins
        if (coinImageLoaded) {
            for (let i = 0; i < this.coins.length; i++) {
                const coin = this.coins[i];
                if (!coin.collected) {
                    const cX = this.x + coin.xOffset;
                    // Add a bounce using time and index offset so they don't bounce identically
                    const bounce = Math.sin(performance.now() / 200 + i) * 10;
                    const cY = this.y - coin.yOffset + bounce; // Float and bounce
                    ctx.drawImage(coinImage, cX, cY, coin.width, coin.height);
                }
            }
        }

        // Draw Mines
        if (mineImageLoaded) {
            for (const mine of this.mines) {
                if (!mine.hit) {
                    const mX = this.x + mine.xOffset;
                    const mY = this.y - mine.yOffset; // On ground
                    // Add slight rotation for visual interest
                    ctx.save();
                    ctx.translate(mX + mine.width / 2, mY + mine.height / 2);
                    // Slow rotation over time based on x position
                    ctx.rotate(this.x * 0.01);
                    ctx.drawImage(mineImage, -mine.width / 2, -mine.height / 2, mine.width, mine.height);
                    ctx.restore();
                }
            }
        }
    }
}

class Goat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 110;
        this.height = 110;

        this.velocityY = 0;
        this.gravity = 0.8;
        this.isGrounded = false;

        // Image
        this.image = new Image();
        this.image.src = 'assets/pinki2.png'; // Updated avatar
        this.imageLoaded = false;
        this.image.onload = () => { this.imageLoaded = true; };

        // Animation
        this.wobble = 0;
    }

    jump(intensity) {
        if (this.isGrounded) {
            // Base jump + intensity bonus
            const jumpPower = -8 - (intensity * 6);
            this.velocityY = jumpPower;
            this.isGrounded = false;
            SFX.playJump(intensity);
        }
    }

    update(deltaTime, voiceData) {
        let timeScale = deltaTime / 16;

        // Apply modified gravity based on voice
        let currentGravity = this.gravity;

        if (!this.isGrounded) {
            if (voiceData.isVocalizing) {
                // Sound is playing.

                // If it reached the peak and is about to fall, stop falling (hover)
                if (this.velocityY >= 0) {
                    this.velocityY = 0;
                    currentGravity = 0;
                } else {
                    // If still moving upwards from a jump, reduce gravity
                    currentGravity = this.gravity * 0.5;
                }
            } else {
                // If voice stops, fall fast!
                currentGravity += 0.5; // Heavy gravity
            }
        }

        this.velocityY += currentGravity * timeScale;
        this.y += this.velocityY * timeScale;

        // Animation update
        if (this.isGrounded) {
            // Walking wobble speed based on game speed roughly
            this.wobble += 0.2 * timeScale;
            // Reset stretch scale when walking
            this.scaleX = 1.0 + Math.sin(this.wobble * 2) * 0.05; // Gentle breathing/walking bounce
            this.scaleY = 1.0 - Math.sin(this.wobble * 2) * 0.05;
        } else {
            // Airborne fixed wobble
            this.wobble = Math.PI / 4; // Tilted up slightly

            // Squash and stretch based on velocity
            if (this.velocityY < 0) {
                // Jumping up -> Stretch tall and thin
                this.scaleX = 0.8;
                this.scaleY = 1.2;
            } else if (this.velocityY === 0) {
                // Hovering -> Normal, maybe a little fat
                this.scaleX = 1.1;
                this.scaleY = 0.9;
            } else {
                // Falling -> Stretch thick and flat
                this.scaleX = 1.1;
                this.scaleY = 0.9;
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // Offset to center of goat for rotation & scaling
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Apply wobble rotation
        let rotation = 0;
        if (this.isGrounded) {
            rotation = Math.sin(this.wobble) * 0.15; // Increased wobble
        } else {
            // Angle based on velocity
            rotation = Math.min(Math.max(this.velocityY * 0.05, -0.5), 0.5);
        }
        ctx.rotate(rotation);

        // Apply stretch animation scale
        if (this.scaleX && this.scaleY) {
            ctx.scale(this.scaleX, this.scaleY);
        }

        if (this.imageLoaded) {
            // Draw sprite bounding box adjusted
            ctx.drawImage(this.image, -this.width / 2 - 10, -this.height / 2 - 10, this.width + 20, this.height + 20);
        } else {
            // Fallback square
            ctx.fillStyle = 'white';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            // Eye
            ctx.fillStyle = 'black';
            ctx.fillRect(this.width / 2 - 10, -this.height / 2 + 5, 5, 5);
        }

        ctx.restore();
    }
}
