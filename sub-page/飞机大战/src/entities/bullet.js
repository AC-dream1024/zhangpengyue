class Bullet {
    constructor(x, y, vx, vy, config) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = config.damage || 10;
        this.color = config.color || '#00ffff';
        this.size = config.size || 3;
        this.width = this.size * 2;
        this.height = this.size * 2;
        this.fromPlayer = config.fromPlayer || false;
        this.life = config.life || 3;
        this.age = 0;
        this.active = true;
        this.pierce = config.pierce || false;
        this.homing = config.homing || false;
        this.freeze = config.freeze || false;
        this.target = null;
        this.trailX = x;
        this.trailY = y;
    }

    update(dt, game) {
        this.age += dt;
        if (this.age > this.life) {
            this.active = false;
            return;
        }

        if (this.homing && this.fromPlayer) {
            if (!this.target || !this.target.active) {
                this.target = this.findNearestEnemy(game);
            }
            if (this.target) {
                const angle = Utils.angle(this.x, this.y, this.target.x + this.target.width / 2, this.target.y + this.target.height / 2);
                const targetSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                const steer = 8 * dt;
                const targetVx = Math.cos(angle) * targetSpeed;
                const targetVy = Math.sin(angle) * targetSpeed;
                this.vx += (targetVx - this.vx) * steer;
                this.vy += (targetVy - this.vy) * steer;
            }
        }

        this.trailX = this.x;
        this.trailY = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.x < -20 || this.x > CONFIG.CANVAS.width + 20 ||
            this.y < -20 || this.y > CONFIG.CANVAS.height + 20) {
            this.active = false;
        }
    }

    findNearestEnemy(game) {
        let nearest = null;
        let minDist = Infinity;
        for (let i = 0; i < game.enemies.length; i++) {
            const e = game.enemies[i];
            if (!e.active) continue;
            const dx = this.x - (e.x + e.width / 2);
            const dy = this.y - (e.y + e.height / 2);
            const d = dx * dx + dy * dy;
            if (d < minDist) {
                minDist = d;
                nearest = e;
            }
        }
        if (game.boss && game.boss.active) {
            const e = game.boss;
            const dx = this.x - (e.x + e.width / 2);
            const dy = this.y - (e.y + e.height / 2);
            const d = dx * dx + dy * dy;
            if (d < minDist) {
                nearest = e;
            }
        }
        return nearest;
    }

    draw(ctx) {
        // 轻量拖尾：单条线段，无shadowBlur
        if (this.fromPlayer) {
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size * 0.8;
            ctx.beginPath();
            ctx.moveTo(this.trailX, this.trailY);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // 子弹本体：仅大子弹使用shadowBlur
        if (this.size > 5) {
            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.size * 2;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};
