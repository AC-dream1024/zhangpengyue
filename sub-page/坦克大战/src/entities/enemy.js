class Enemy {
    constructor(type, x, y, difficulty) {
        this.type = type;
        this.config = CONFIG.ENEMY_TYPES[type];
        this.difficulty = difficulty || 1;

        this.width = this.config.width;
        this.height = this.config.height;
        this.maxHp = Math.ceil(this.config.hp * this.difficulty);
        this.hp = this.maxHp;
        this.speed = this.config.speed * (0.9 + this.difficulty * 0.1);
        this.score = this.config.score;
        this.color = this.config.color;
        this.fireRate = this.config.fireRate;
        this.fireTimer = Utils.random(0.5, this.fireRate || 2);
        this.active = true;
        this.vx = 0;
        this.vy = this.speed;
        this.age = 0;
        this.movePattern = this.getMovePattern();
        this.isKamikaze = type === 'kamikaze';
        this.freezeTimer = 0;
        this.angle = 0;
        this.treadOffset = 0;
    }

    getMovePattern() {
        switch (this.type) {
            case 'scout': return 'straight';
            case 'fighter': return 'sine';
            case 'elite': return 'circle';
            case 'heavy': return 'slow';
            case 'kamikaze': return 'chase';
            default: return 'straight';
        }
    }

    initPosition(x, y) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
    }

    takeDamage(amount, game) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.die(game);
        }
    }

    die(game) {
        this.active = false;
        game.onEnemyKilled(this);
        game.particles.emitExplosion(this.x + this.width / 2, this.y + this.height / 2,
            Math.max(10, this.width / 2), this.color);
        Audio.playExplosion(this.width > 40);

        if (Utils.chance(CONFIG.POWERUP.dropRate)) {
            const types = ['P', 'S', 'B', 'H', 'F', 'M', 'G'];
            const type = Utils.chance(0.1) ? 'L' : Utils.choice(types);
            game.powerups.push(new PowerUp(
                this.x + this.width / 2,
                this.y + this.height / 2,
                type
            ));
        }
    }

    update(dt, game) {
        if (!this.active) return;

        this.age += dt;
        this.treadOffset += dt * this.speed * 0.5;

        if (this.freezeTimer > 0) {
            this.freezeTimer -= dt;
            this.vx *= 0.95;
            this.vy *= 0.95;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            return;
        }

        switch (this.movePattern) {
            case 'straight':
                this.y += this.speed * dt;
                break;
            case 'sine':
                this.y += this.speed * dt;
                this.x = this.startX + Math.sin(this.age * 2) * 80;
                break;
            case 'circle':
                this.y += this.speed * 0.7 * dt;
                this.x = this.startX + Math.sin(this.age * 1.5) * 120;
                break;
            case 'slow':
                this.y += this.speed * dt;
                this.y = Math.min(this.y, 120);
                this.x += Math.sin(this.age * 0.8) * 30 * dt;
                break;
            case 'chase':
                if (game.player && game.player.active) {
                    const target = game.player.x + game.player.width / 2;
                    const dx = target - (this.x + this.width / 2);
                    this.vx = Utils.clamp(dx * 2, -this.speed, this.speed);
                    this.x += this.vx * dt;
                    this.y += this.speed * 1.2 * dt;
                } else {
                    this.y += this.speed * dt;
                }
                break;
        }

        if (this.x < 0) this.x = 0;
        if (this.x > CONFIG.CANVAS.width - this.width) this.x = CONFIG.CANVAS.width - this.width;

        if (this.y > CONFIG.CANVAS.height + 50) {
            this.active = false;
            return;
        }

        if (this.isKamikaze && game.player && game.player.active) {
            if (Utils.aabb(this, game.player)) {
                this.die(game);
                game.player.takeDamage(30, game);
            }
        }

        if (this.fireRate > 0) {
            this.fireTimer -= dt;
            if (this.fireTimer <= 0) {
                this.shoot(game);
                this.fireTimer = this.fireRate * Utils.random(0.8, 1.2);
            }
        }
    }

    shoot(game) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;

        switch (this.type) {
            case 'scout':
                game.bullets.push(new Bullet(cx, cy, 0, 280, {
                    damage: CONFIG.BULLET_TYPES.enemy.damage,
                    color: this.color,
                    size: 4
                }));
                break;

            case 'fighter':
                if (game.player && game.player.active) {
                    const angle = Utils.angle(cx, cy, game.player.x + game.player.width / 2,
                        game.player.y + game.player.height / 2);
                    game.bullets.push(new Bullet(cx, cy,
                        Math.cos(angle) * 260, Math.sin(angle) * 260, {
                        damage: CONFIG.BULLET_TYPES.enemy.damage,
                        color: this.color,
                        size: 4
                    }));
                }
                break;

            case 'elite':
                for (let i = -1; i <= 1; i++) {
                    game.bullets.push(new Bullet(cx, cy,
                        i * 120, 260, {
                        damage: CONFIG.BULLET_TYPES.enemy.damage,
                        color: this.color,
                        size: 5
                    }));
                }
                break;

            case 'heavy':
                for (let i = -2; i <= 2; i++) {
                    game.bullets.push(new Bullet(cx + i * 12, cy,
                        i * 60, 250, {
                        damage: CONFIG.BULLET_TYPES.enemy.damage * 0.8,
                        color: this.color,
                        size: 5
                    }));
                }
                break;
        }
    }

    applyFreeze(duration) {
        this.freezeTimer = duration;
    }

    draw(ctx) {
        if (!this.active) return;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.save();
        ctx.translate(cx, cy);

        const isFrozen = this.freezeTimer > 0;
        ctx.fillStyle = isFrozen ? '#446688' : '#2a1a1a';
        ctx.strokeStyle = isFrozen ? '#88ccff' : this.color;
        ctx.lineWidth = 2;

        switch (this.type) {
            case 'scout':
                this.drawScout(ctx);
                break;
            case 'fighter':
                this.drawFighter(ctx);
                break;
            case 'elite':
                this.drawElite(ctx);
                break;
            case 'heavy':
                this.drawHeavy(ctx);
                break;
            case 'kamikaze':
                this.drawKamikaze(ctx);
                break;
        }

        if (isFrozen) {
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#88ccff';
            ctx.strokeRect(-this.width / 2 - 2, -this.height / 2 - 2, this.width + 4, this.height + 4);
            ctx.globalAlpha = 1;
        }

        if (this.hp < this.maxHp) {
            const barWidth = this.width * 0.8;
            const barHeight = 3;
            const barY = -this.height / 2 - 8;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-barWidth / 2, barY, barWidth * (this.hp / this.maxHp), barHeight);
        }

        ctx.restore();
    }

    // 通用：绘制履带
    drawTreads(ctx, w, h) {
        ctx.fillStyle = '#1a1a1a';
        const treadW = w * 0.18;
        ctx.fillRect(-w / 2, -h / 2, treadW, h);
        ctx.fillRect(w / 2 - treadW, -h / 2, treadW, h);

        // 履带节纹（滚动效果）
        ctx.fillStyle = '#3a3a3a';
        const seg = 4;
        const offset = (this.treadOffset % seg + seg) % seg;
        for (let y = -h / 2 - seg + offset; y < h / 2; y += seg) {
            ctx.fillRect(-w / 2 + 1, y, treadW - 2, 2);
            ctx.fillRect(w / 2 - treadW + 1, y, treadW - 2, 2);
        }
    }

    drawScout(ctx) {
        // 轻型侦察车：小车身 + 炮塔朝下
        const w = this.width;
        const h = this.height;
        this.drawTreads(ctx, w * 0.85, h);

        ctx.fillStyle = '#3a2222';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.fillRect(-w * 0.3, -h * 0.4, w * 0.6, h * 0.8);
        ctx.strokeRect(-w * 0.3, -h * 0.4, w * 0.6, h * 0.8);

        // 炮塔
        ctx.fillStyle = this.color;
        ctx.fillRect(-w * 0.18, -h * 0.2, w * 0.36, h * 0.3);

        // 炮管朝下
        ctx.fillStyle = '#222';
        ctx.fillRect(-2, h * 0.1, 4, h * 0.35);
    }

    drawFighter(ctx) {
        // 中型坦克
        const w = this.width;
        const h = this.height;
        this.drawTreads(ctx, w * 0.85, h);

        ctx.fillStyle = '#3a1818';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.fillRect(-w * 0.32, -h * 0.42, w * 0.64, h * 0.84);
        ctx.strokeRect(-w * 0.32, -h * 0.42, w * 0.64, h * 0.84);

        // 炮塔（圆形）
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.22, 0, Math.PI * 2);
        ctx.fill();

        // 炮管朝下
        ctx.fillStyle = '#222';
        ctx.fillRect(-3, 0, 6, h * 0.45);

        // 装甲细节
        ctx.strokeStyle = '#551111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w * 0.32, -h * 0.15);
        ctx.lineTo(w * 0.32, -h * 0.15);
        ctx.stroke();
    }

    drawElite(ctx) {
        // 重型坦克：六边形炮塔
        const w = this.width;
        const h = this.height;
        this.drawTreads(ctx, w * 0.88, h);

        ctx.fillStyle = '#2a0e0e';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.fillRect(-w * 0.34, -h * 0.42, w * 0.68, h * 0.84);
        ctx.strokeRect(-w * 0.34, -h * 0.42, w * 0.68, h * 0.84);

        // 六边形炮塔
        ctx.fillStyle = this.color;
        ctx.beginPath();
        const r = w * 0.26;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 双炮管
        ctx.fillStyle = '#222';
        ctx.fillRect(-7, 0, 5, h * 0.45);
        ctx.fillRect(2, 0, 5, h * 0.45);

        // 核心
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    drawHeavy(ctx) {
        // 坦克歼击车：大车身 + 粗炮管
        const w = this.width;
        const h = this.height;
        this.drawTreads(ctx, w * 0.9, h);

        ctx.fillStyle = '#221111';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.5;
        ctx.fillRect(-w * 0.36, -h * 0.44, w * 0.72, h * 0.88);
        ctx.strokeRect(-w * 0.36, -h * 0.44, w * 0.72, h * 0.88);

        // 装甲板纹理
        ctx.strokeStyle = '#552222';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const y = -h * 0.3 + i * h * 0.25;
            ctx.beginPath();
            ctx.moveTo(-w * 0.36, y);
            ctx.lineTo(w * 0.36, y);
            ctx.stroke();
        }

        // 大炮塔
        ctx.fillStyle = this.color;
        ctx.fillRect(-w * 0.24, -h * 0.18, w * 0.48, h * 0.34);

        // 粗炮管朝下
        ctx.fillStyle = '#222';
        ctx.fillRect(-5, h * 0.1, 10, h * 0.4);

        // 炮口
        ctx.fillStyle = '#441111';
        ctx.fillRect(-7, h * 0.45, 14, 4);
    }

    drawKamikaze(ctx) {
        // 自爆卡车：旋转的菱形 + 警示色
        const s = this.width / 2;
        ctx.rotate(this.age * 8);

        ctx.fillStyle = '#2a1500';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.lineTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 危险标记
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
    }
};
