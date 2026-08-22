class Particle {
    constructor(x, y, vx, vy, life, color, size, gravity) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.gravity = gravity || 0;
        this.age = 0;
        this.active = true;
    }

    update(dt) {
        this.age += dt;
        if (this.age >= this.life) {
            this.active = false;
            return;
        }
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        const t = this.age / this.life;
        const alpha = 1 - t;
        const currentSize = this.size * (1 - t * 0.5);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - currentSize / 2, this.y - currentSize / 2, currentSize, currentSize);
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 250;
    }

    emit(x, y, count, config) {
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) {
                break;
            }
            const angle = config.angle !== undefined
                ? config.angle + Utils.random(-config.spread || 0, config.spread || 0)
                : Utils.random(0, Math.PI * 2);
            const speed = Utils.random(config.minSpeed || 50, config.maxSpeed || 200);
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                Utils.random(config.minLife || 0.2, config.maxLife || 0.8),
                config.color,
                Utils.random(config.minSize || 1, config.maxSize || 4),
                config.gravity || 0
            ));
        }
    }

    emitExplosion(x, y, size, color) {
        const count = size > 30 ? 25 : size > 15 ? 15 : 8;
        this.emit(x, y, count, {
            minSpeed: size * 2,
            maxSpeed: size * 6,
            minLife: 0.3,
            maxLife: 0.7,
            color: color || '#ff6600',
            minSize: 2,
            maxSize: size > 30 ? 6 : 4,
            spread: Math.PI * 2
        });

        this.emit(x, y, Math.floor(count / 2), {
            minSpeed: size,
            maxSpeed: size * 3,
            minLife: 0.4,
            maxLife: 0.8,
            color: '#ffffff',
            minSize: 1,
            maxSize: 2
        });
    }

    // 坦克尾气/尘烟
    emitEngine(x, y, color) {
        this.emit(x, y, 1, {
            angle: Math.PI / 2,
            spread: 0.3,
            minSpeed: 30,
            maxSpeed: 100,
            minLife: 0.1,
            maxLife: 0.25,
            color: color || '#998866',
            minSize: 1,
            maxSize: 2
        });
    }

    emitHit(x, y, color) {
        this.emit(x, y, 4, {
            minSpeed: 60,
            maxSpeed: 150,
            minLife: 0.1,
            maxLife: 0.2,
            color: color || '#ffffff',
            minSize: 1,
            maxSize: 2,
            spread: Math.PI * 2
        });
    }

    emitPickup(x, y, color) {
        this.emit(x, y, 10, {
            angle: -Math.PI / 2,
            spread: Math.PI,
            minSpeed: 60,
            maxSpeed: 150,
            minLife: 0.3,
            maxLife: 0.5,
            color: color || '#ffff00',
            minSize: 2,
            maxSize: 3
        });
    }

    emitShieldBreak(x, y) {
        for (let i = 0; i < 8; i++) {
            if (this.particles.length >= this.maxParticles) break;
            const angle = (i / 8) * Math.PI * 2;
            this.particles.push(new Particle(
                x + Math.cos(angle) * 20,
                y + Math.sin(angle) * 20,
                Math.cos(angle) * 120,
                Math.sin(angle) * 120,
                0.4,
                '#00aaff',
                3
            ));
        }
    }

    emitSkillBurst(x, y, radius) {
        for (let i = 0; i < 30; i++) {
            if (this.particles.length >= this.maxParticles) break;
            const angle = (i / 30) * Math.PI * 2;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * radius * 2,
                Math.sin(angle) * radius * 2,
                0.5,
                '#ffcc00',
                4
            ));
        }
        for (let i = 0; i < 15; i++) {
            if (this.particles.length >= this.maxParticles) break;
            const angle = Utils.random(0, Math.PI * 2);
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * Utils.random(100, 300),
                Math.sin(angle) * Utils.random(100, 300),
                0.6,
                '#ffff00',
                3
            ));
        }
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
        ctx.save();
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].draw(ctx);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    clear() {
        this.particles.length = 0;
    }
};
