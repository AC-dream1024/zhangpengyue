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
                    size: 3
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
                        size: 3
                    }));
                }
                break;

            case 'elite':
                for (let i = -1; i <= 1; i++) {
                    game.bullets.push(new Bullet(cx, cy,
                        i * 120, 260, {
                        damage: CONFIG.BULLET_TYPES.enemy.damage,
                        color: this.color,
                        size: 4
                    }));
                }
                break;

            case 'heavy':
                for (let i = -2; i <= 2; i++) {
                    game.bullets.push(new Bullet(cx + i * 12, cy,
                        i * 60, 250, {
                        damage: CONFIG.BULLET_TYPES.enemy.damage * 0.8,
                        color: this.color,
                        size: 4
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

        // 无shadowBlur：直接设置样式由子方法绘制
        const isFrozen = this.freezeTimer > 0;
        ctx.fillStyle = isFrozen ? '#446688' : '#1a1a2e';
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

        // 冰冻特效：额外描边
        if (isFrozen) {
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#88ccff';
            ctx.stroke();
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

    drawScout(ctx) {
        const s = this.width / 2;
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.lineTo(-s, -s * 0.5);
        ctx.lineTo(-s * 0.5, -s * 0.3);
        ctx.lineTo(0, -s * 0.7);
        ctx.lineTo(s * 0.5, -s * 0.3);
        ctx.lineTo(s, -s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawFighter(ctx) {
        const w = this.width / 2;
        const h = this.height / 2;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(-w, 0);
        ctx.lineTo(-w * 0.7, -h * 0.5);
        ctx.lineTo(-w * 0.3, -h * 0.6);
        ctx.lineTo(w * 0.3, -h * 0.6);
        ctx.lineTo(w * 0.7, -h * 0.5);
        ctx.lineTo(w, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.4);
        ctx.lineTo(-5, h * 0.2);
        ctx.lineTo(5, h * 0.2);
        ctx.closePath();
        ctx.fill();
    }

    drawElite(ctx) {
        const r = this.width / 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.PI / 2;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    drawHeavy(ctx) {
        const w = this.width / 2;
        const h = this.height / 2;
        ctx.beginPath();
        ctx.moveTo(-w, h);
        ctx.lineTo(-w, -h * 0.8);
        ctx.lineTo(-w * 0.7, -h);
        ctx.lineTo(w * 0.7, -h);
        ctx.lineTo(w, -h * 0.8);
        ctx.lineTo(w, h);
        ctx.lineTo(w * 0.5, h * 0.7);
        ctx.lineTo(-w * 0.5, h * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.fillRect(-w * 0.6, -h * 0.3, w * 1.2, h * 0.4);

        // 引擎火焰：双层描边模拟发光，避免shadowBlur
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(-w * 0.3, h);
        ctx.lineTo(-w * 0.15, h + 6);
        ctx.lineTo(0, h);
        ctx.lineTo(w * 0.15, h + 6);
        ctx.lineTo(w * 0.3, h);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-w * 0.35, h);
        ctx.lineTo(-w * 0.18, h + 8);
        ctx.lineTo(0, h);
        ctx.lineTo(w * 0.18, h + 8);
        ctx.lineTo(w * 0.35, h);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    drawKamikaze(ctx) {
        const s = this.width / 2;
        ctx.rotate(this.age * 8);
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.lineTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
};