// Load all tree varieties
const treeImages = [];
const treeSources = ['assets/coconut_tree2.png', 'assets/tree_mango4.png', 'assets/tree_banana2.png', 'assets/tree_jackfruit3.png', 'assets/tree_rubber2.png', 'assets/tree_flag2.png'];
let loadedTrees = 0;

for (let i = 0; i < treeSources.length; i++) {
    const img = new Image();
    img.src = treeSources[i];
    img.onload = () => { loadedTrees++; };
    treeImages.push(img);
}

// Load all human varieties
const humanImages = [];
const humanSources = ['assets/lalan.png', 'assets/abu.png', 'assets/pappan.png', 'assets/shameer.png', 'assets/ponnappan.png', 'assets/dude.png'];
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

// Load Quikzii Champion Coin
const quikziiImage = new Image();
quikziiImage.src = 'assets/quikzii.png';
let quikziiImageLoaded = false;
quikziiImage.onload = () => { quikziiImageLoaded = true; };

class Platform {
    constructor(x, y, width, height, allowHumans = false, humanTypes = []) {
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
        this.quikziiCoin = null; // Special champion coin, set by Game after 2 min

        // Only put trees/farmers/hazards on most platforms
        if (width > 100) {
            let occupiedRegions = []; // Store {start, end} to prevent overlaps

            // 1. SPAWN HUMANS (Priority placement) - Only if allowed (20s delay)
            if (allowHumans && humanTypes.length > 0) {
                const numHumans = Math.min(humanTypes.length, 2); // Cap at 2

                for (let j = 0; j < numHumans; j++) {
                    const hScale = 1.1;
                    const fWidth = 180 * hScale;
                    const hitWidth = fWidth * 0.3;

                    let humanX = 10;
                    let placed = false;

                    for (let attempt = 0; attempt < 20; attempt++) {
                        const maxHumanX = width - fWidth - 10;
                        humanX = 10 + Math.random() * Math.max(0, maxHumanX - 10);

                        let coreStart = humanX + (fWidth - hitWidth) / 2;
                        let coreEnd = coreStart + hitWidth;

                        // Ensure human is on platform
                        if (coreStart < 0 || coreEnd > width) continue;

                        let overlap = false;
                        for (let region of occupiedRegions) {
                            if (!(coreEnd < region.start || coreStart > region.end)) {
                                overlap = true;
                                break;
                            }
                        }

                        if (!overlap) {
                            placed = true;
                            occupiedRegions.push({ start: coreStart, end: coreEnd });
                            break;
                        }
                    }

                    if (placed) {
                        const facingRight = Math.random() > 0.5;
                        const humanType = humanTypes[j];

                        this.farmers.push({
                            xOffset: humanX,
                            facingRight: facingRight,
                            typeIndex: humanType,
                            scale: hScale
                        });
                    }
                }
            }

            // 2. SPAWN TREES (Secondary placement)
            // If humans are present, trees are rarer (max 1)
            const humanPresent = this.farmers.length > 0;
            const treeChance = allowHumans ? (humanPresent ? 0.3 : 0.6) : 0.9;

            if (width > 120 && Math.random() < treeChance) {
                const maxTrees = humanPresent ? 1 : 2;
                const numTrees = Math.floor(Math.random() * maxTrees) + 1;

                let availableTrees = [];
                for (let i = 0; i < treeSources.length; i++) availableTrees.push(i);

                for (let i = 0; i < numTrees; i++) {
                    const treeScale = 0.7 + Math.random() * 0.3;
                    const tWidth = 250 * treeScale;
                    const hitWidth = tWidth * 0.4;

                    let treeX = 10;
                    let placed = false;

                    const margin = 30;
                    const maxTreeX = width - tWidth + margin;
                    const minTreeX = -margin;

                    for (let attempt = 0; attempt < 20; attempt++) {
                        treeX = minTreeX + Math.random() * Math.max(0, maxTreeX - minTreeX);

                        let coreStart = treeX + (tWidth - hitWidth) / 2;
                        let coreEnd = coreStart + hitWidth;

                        if (coreStart < 0 || coreEnd > width) continue;

                        let overlap = false;
                        for (let region of occupiedRegions) {
                            if (!(coreEnd < region.start || coreStart > region.end)) {
                                overlap = true;
                                break;
                            }
                        }

                        if (!overlap) {
                            placed = true;
                            occupiedRegions.push({ start: coreStart, end: coreEnd });
                            break;
                        }
                    }

                    if (placed) {
                        const randomIndex = Math.floor(Math.random() * availableTrees.length);
                        const treeType = availableTrees.length > 0 ? availableTrees.splice(randomIndex, 1)[0] : Math.floor(Math.random() * treeSources.length);

                        this.trees.push({
                            xOffset: treeX,
                            scale: treeScale,
                            typeIndex: treeType
                        });
                    }
                }
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
                const hover = 30 + Math.sin(c * 1) * 15; // Lower hover so it touches the grass
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
                yOffset: 30, // Sit lower into the grass
                width: 70,
                height: 70,
                hit: false
            });
        }
    }

    update(speed, deltaTime) {
        // Move left based on game speed
        this.x -= speed * (deltaTime / 16);
    }

    draw(ctx) {
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

        // Draw background elements (Trees) first so goat/grass is in front
        if (loadedTrees > 0) {
            for (const tree of this.trees) {
                const img = treeImages[tree.typeIndex];
                if (!img) continue; // Skip if this specific image isn't loaded yet

                // Tree original size
                const tWidth = 250 * tree.scale;
                const tHeight = 450 * tree.scale; // Even taller trees
                const tX = this.x + tree.xOffset;
                // Move tree to surface and push down +40px to bury roots/transparent margin
                const tY = this.y - tHeight + 40;

                ctx.drawImage(img, tX, tY, tWidth, tHeight);
            }
        }

        // Draw humans if any are loaded
        if (loadedHumans > 0) {
            for (const human of this.farmers) {
                const img = humanImages[human.typeIndex];
                if (!img) continue; // Skip if this specific image isn't loaded yet

                const fWidth = 180 * human.scale;
                const fHeight = 300 * human.scale; // Even taller humans
                const fX = this.x + human.xOffset;
                // Humans natively resting their bounding box on edge, push +20px to bury blank feet space
                const fY = this.y - fHeight + 20;

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
        // (Removed duplicate grass detail overlay)
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

        // Draw Quikzii Champion Coin (big round glowing coin)
        if (this.quikziiCoin && !this.quikziiCoin.collected && quikziiImageLoaded) {
            const q = this.quikziiCoin;
            const qX = this.x + q.xOffset;
            const bounce = Math.sin(performance.now() / 300) * 12;
            const qY = this.y - q.yOffset + bounce;
            const size = q.width;
            const centerX = qX + size / 2;
            const centerY = qY + size / 2;
            const radius = size / 2;

            // Glowing aura behind
            const pulseScale = 1.0 + Math.sin(performance.now() / 400) * 0.15;
            const glowRadius = radius * 1.6 * pulseScale;
            const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, glowRadius);
            glow.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
            glow.addColorStop(0.5, 'rgba(255, 165, 0, 0.2)');
            glow.addColorStop(1, 'rgba(255, 165, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Golden circle border
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.fill();

            // Clip to circle and draw image
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(quikziiImage, qX, qY, size, size);
            ctx.restore();
        }
    }
}

class Goat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 100;
        this.height = 100;

        this.velocityY = 0;
        this.gravity = 0.8;
        this.isGrounded = false;

        // Image
        this.image = new Image();
        this.image.src = 'assets/aad.png'; // Updated avatar
        this.imageLoaded = false;
        this.image.onload = () => { this.imageLoaded = true; };

        // Animation
        this.wobble = 0;
    }

    jump(intensity, force = false) {
        if (this.isGrounded || force) {
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
                // If voice stops completely, fall faster (but not too aggressively)
                currentGravity = this.gravity * 2.0;
                if (this.velocityY < 0) {
                    // Reduce upward momentum if user stops voice on the way up
                    this.velocityY *= 0.5;
                }
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
