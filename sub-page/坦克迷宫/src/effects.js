// ====== Bullet & Particle System ======

class Bullet {
    constructor(x, y, angle, config) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.vx = Math.cos(angle) * config.speed;
        this.vy = Math.sin(angle) * config.speed;
        this.damage = config.damage;
        this.fromPlayer = config.fromPlayer || false;
        this.size = config.size || 4;
        this.color = config.color || (this.fromPlayer ? CONFIG.COLORS.bullet : CONFIG.COLORS.enemyBullet);
        this.range = config.range || 500;
        this.traveled = 0;
        this.active = true;
        this.life = 0;
        this.maxLife = CONFIG.GAME.bulletLifeMax;
        this.freeze = config.freeze || false;
        this.trailX = x;
        this.trailY = y;
    }

    update(dt, maze, game) {
        if (!this.active) return;

        this.trailX = this.x;
        this.trailY = this.y;

        const moveX = this.vx * dt;
        const moveY = this.vy * dt;
        this.x += moveX;
        this.y += moveY;
        this.traveled += Math.sqrt(moveX * moveX + moveY * moveY);
        this.life += dt;

        // Check range
        if (this.traveled > this.range) {
            this.active = false;
            game.particles.emitSpark(this.x, this.y, this.color, 3);
            return;
        }

        // Check life
        if (this.life > this.maxLife) {
            this.active = false;
            return;
        }

        // Check wall collision (use point check at bullet center)
        if (maze.isWallPixel(this.x, this.y)) {
            this.active = false;
            game.particles.emitSpark(this.x, this.y, this.color, 6);
            Audio.playHit();
            return;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();

        // Trail
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size * 0.8;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(this.trailX, this.trailY);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();

        // Bullet head
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x - this.size,
            y: this.y - this.size,
            width: this.size * 2,
            height: this.size * 2,
        };
    }
}


class Particle {
    constructor(x, y, vx, vy, color, life, size, type) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.type = type || 'spark';
        this.active = true;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = Utils.random(-5, 5);
    }

    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.94;
        this.vy *= 0.94;
        this.life -= dt;
        this.rotation += this.rotSpeed * dt;
        if (this.life <= 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        const t = this.life / this.maxLife;
        const alpha = t;
        const size = this.size * (this.type === 'smoke' ? (1 + (1 - t) * 2) : t);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);

        if (this.type === 'smoke') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'debris') {
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            ctx.fillRect(-size / 2, -size / 2, size, size);
        } else if (this.type === 'fire') {
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // spark
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}


class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, options) {
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= CONFIG.PARTICLE.maxParticles) break;
            const angle = options.angle !== undefined
                ? options.angle + Utils.random(-options.spread || 0, options.spread || 0)
                : Utils.random(0, Math.PI * 2);
            const speed = Utils.random(options.speedMin || 50, options.speedMax || 200);
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                options.color || '#ffaa00',
                Utils.random(options.lifeMin || 0.3, options.lifeMax || 0.8),
                Utils.random(options.sizeMin || 2, options.sizeMax || 5),
                options.type || 'spark'
            ));
        }
    }

    emitExplosion(x, y, scale) {
        scale = scale || 1;
        // Fire core
        this.emit(x, y, Math.floor(8 * scale), {
            color: '#ff6600',
            speedMin: 60 * scale, speedMax: 200 * scale,
            lifeMin: 0.3, lifeMax: 0.6,
            sizeMin: 3 * scale, sizeMax: 7 * scale,
            type: 'fire'
        });
        this.emit(x, y, Math.floor(6 * scale), {
            color: '#ffcc00',
            speedMin: 80 * scale, speedMax: 250 * scale,
            lifeMin: 0.2, lifeMax: 0.5,
            sizeMin: 2 * scale, sizeMax: 5 * scale,
            type: 'fire'
        });
        // Debris
        this.emit(x, y, Math.floor(6 * scale), {
            color: '#554433',
            speedMin: 100 * scale, speedMax: 300 * scale,
            lifeMin: 0.4, lifeMax: 0.9,
            sizeMin: 2 * scale, sizeMax: 4 * scale,
            type: 'debris'
        });
        // Smoke
        this.emit(x, y, Math.floor(5 * scale), {
            color: 'rgba(80, 70, 50, 0.6)',
            speedMin: 20 * scale, speedMax: 80 * scale,
            lifeMin: 0.6, lifeMax: 1.2,
            sizeMin: 4 * scale, sizeMax: 8 * scale,
            type: 'smoke'
        });
    }

    emitHit(x, y, color) {
        this.emit(x, y, 4, {
            color: color || '#ffaa00',
            speedMin: 50, speedMax: 150,
            lifeMin: 0.15, lifeMax: 0.35,
            sizeMin: 1.5, sizeMax: 3,
            type: 'spark'
        });
    }

    emitSpark(x, y, color, count) {
        this.emit(x, y, count || 5, {
            color: color || '#ffcc00',
            speedMin: 40, speedMax: 120,
            lifeMin: 0.1, lifeMax: 0.3,
            sizeMin: 1, sizeMax: 2.5,
            type: 'spark'
        });
    }

    emitMuzzleFlash(x, y, angle, color) {
        this.emit(x, y, 3, {
            color: color || '#ffdd44',
            angle: angle,
            spread: 0.4,
            speedMin: 100, speedMax: 200,
            lifeMin: 0.08, lifeMax: 0.18,
            sizeMin: 2, sizeMax: 4,
            type: 'fire'
        });
    }

    emitDust(x, y) {
        this.emit(x, y, 2, {
            color: 'rgba(100, 85, 50, 0.4)',
            speedMin: 10, speedMax: 40,
            lifeMin: 0.3, lifeMax: 0.6,
            sizeMin: 2, sizeMax: 4,
            type: 'smoke'
        });
    }

    update(dt) {
        let writeIdx = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.update(dt);
            if (p.active) {
                this.particles[writeIdx++] = p;
            }
        }
        this.particles.length = writeIdx;
    }

    draw(ctx) {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].draw(ctx);
        }
        ctx.globalAlpha = 1;
    }

    clear() {
        this.particles = [];
    }
}

window.Bullet = Bullet;
window.ParticleSystem = ParticleSystem;
