class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = '#795548'; // Dirt brown
        this.topColor = '#8BC34A'; // Grass green
    }

    update(speed, deltaTime) {
        // Move left based on game speed
        this.x -= speed * (deltaTime / 16);
    }

    draw(ctx) {
        ctx.fillStyle = this.color;

        // Slight rounded corners for a mobile game feel
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, [0, 0, 10, 10]);
        ctx.fill();

        // Grass top
        ctx.fillStyle = this.topColor;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, 15, [10, 10, 0, 0]);
        ctx.fill();

        // Simple grass detail overlay
        ctx.fillStyle = '#689F38';
        ctx.fillRect(this.x, this.y + 15, this.width, 5);
    }
}

class Goat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 45;
        this.height = 45;

        this.velocityY = 0;
        this.gravity = 0.8;
        this.isGrounded = false;

        // Image
        this.image = new Image();
        this.image.src = 'assets/goat.png'; // Handled via AI gen
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
            // Walking wobble
            this.wobble += 0.2 * timeScale;
        } else {
            // Airborne fixed wobble
            this.wobble = Math.PI / 4; // Tilted up slightly
        }
    }

    draw(ctx) {
        ctx.save();

        // Offset to center of goat for rotation
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Apply wobble rotation
        let rotation = 0;
        if (this.isGrounded) {
            rotation = Math.sin(this.wobble) * 0.1;
        } else {
            // Angle based on velocity
            rotation = Math.min(Math.max(this.velocityY * 0.05, -0.5), 0.5);
        }
        ctx.rotate(rotation);

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
