class Boss {
    constructor() {
        this.name = CONFIG.BOSS.name;
        this.width = CONFIG.BOSS.width;
        this.height = CONFIG.BOSS.height;
        this.x = CONFIG.CANVAS.width / 2 - this.width / 2;
        this.y = -this.height;
        this.targetY = 80;
        this.hp = CONFIG.BOSS.hp;
        this.maxHp = CONFIG.BOSS.maxHp;
        this.active = true;
        this.state = 'entering';
        this.stateTimer = 0;
        this.phase = 1;
        this.moveDir = 1;
        this.moveSpeed = CONFIG.BOSS.moveSpeed;
        this.score = CONFIG.BOSS.score;
        this.angle = 0;
        this.alertPhase = 0;
        this.isFlashing = false;
        this.flashTimer = 0;
        this.dying = false;
        this.dyingTimer = 0;
        this.coreColor = '#ff0000';
        this.beamCharging = false;
        this.beamChargeTime = 0;
        this.beamActive = false;
        this.beamTimer = 0;
        this.beamAngle = 0;
        this.spiralAngle = 0;
        this.dashCooldown = 0;
        this.sweepDir = 1;
        this.sweepProgress = 0;
        this.treadOffset = 0;
    }

    get hpRatio() {
        return this.hp / this.maxHp;
    }

    takeDamage(amount, game) {
        if (this.state === 'entering' || this.state === 'dying') return;

        this.hp -= amount;
        this.flashTimer = 0.08;

        if (game) {
            game.particles.emitHit(
                this.x + this.width / 2 + Utils.random(-this.width / 3, this.width / 3),
                this.y + this.height / 2 + Utils.random(-this.height / 3, this.height / 3),
                '#ffaa00'
            );
        }

        if (this.hp <= this.maxHp * 0.66 && this.phase === 1) {
            this.advancePhase(game);
        } else if (this.hp <= this.maxHp * 0.33 && this.phase === 2) {
            this.advancePhase(game);
        }

        if (this.hp <= 0) {
            this.die(game);
        }
    }

    advancePhase(game) {
        this.phase++;
        this.state = 'phase' + this.phase;
        this.stateTimer = 0;
        game.shake(0.5);
        Audio.playBossAlert();
    }

    die(game) {
        this.state = 'dying';
        this.dying = true;
        this.dyingTimer = 0;
        this.active = true;
    }

    update(dt, game) {
        this.stateTimer += dt;
        this.angle += dt;
        this.treadOffset += dt * 40;

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.isFlashing = this.flashTimer > 0;
        }

        if (this.state === 'entering') {
            this.y = Utils.lerp(this.y, this.targetY, 0.02);
            if (Math.abs(this.y - this.targetY) < 2) {
                this.y = this.targetY;
                this.state = 'phase1';
                this.stateTimer = 0;
                Audio.playBossAlert();
                game.shake(0.5);
            }
            return;
        }

        if (this.state === 'dying') {
            this.dyingTimer += dt;
            this.y += Math.sin(this.dyingTimer * 3) * 20 * dt;
            this.x += Math.cos(this.dyingTimer * 4) * 40 * dt;

            if (Math.floor(this.dyingTimer * 8) !== Math.floor((this.dyingTimer - dt) * 8)) {
                const pos = [
                    { x: 0.3, y: 0.4 },
                    { x: 0.7, y: 0.3 },
                    { x: 0.5, y: 0.6 },
                    { x: 0.2, y: 0.7 },
                    { x: 0.8, y: 0.5 },
                    { x: 0.4, y: 0.2 }
                ];
                const p = pos[Math.floor(this.dyingTimer * 8) % pos.length];
                game.particles.emitExplosion(
                    this.x + this.width * p.x,
                    this.y + this.height * p.y,
                    25, '#ff4444'
                );
                Audio.playExplosion(true);
                game.shake(0.2);
            }

            if (this.dyingTimer > 2) {
                this.active = false;
            }
            return;
        }

        switch (this.state) {
            case 'phase1':
                this.updatePhase1(dt, game);
                break;
            case 'phase2':
                this.updatePhase2(dt, game);
                break;
            case 'phase3':
                this.updatePhase3(dt, game);
                break;
        }
    }

    updatePhase1(dt, game) {
        this.x += this.moveDir * this.moveSpeed * 0.5 * dt;
        if (this.x <= 20 || this.x >= CONFIG.CANVAS.width - this.width - 20) {
            this.moveDir *= -1;
        }

        const attackTimer = this.stateTimer;

        if (attackTimer % 4 > 3.8 && !this.beamCharging && !this.beamActive) {
            this.beamCharging = true;
            this.beamChargeTime = 0;
            Audio.playBossLaser();
        }

        if (this.beamCharging) {
            this.beamChargeTime += dt;
            if (this.beamChargeTime > 0.8) {
                this.beamCharging = false;
                this.beamActive = true;
                this.beamTimer = 0.5;
                this.firePhase1Beams(game);
            }
        }

        if (this.beamActive) {
            this.beamTimer -= dt;
            if (this.beamTimer <= 0) {
                this.beamActive = false;
            }
        }

        if (attackTimer % 3 > 2.8) {
            this.firePhase1Bullets(game);
        }

        if (attackTimer % 8 > 7.8) {
            this.spawnMinions(game);
        }

        this.fireSpiralBullets(dt, game, 8, 150);
    }

    firePhase1Beams(game) {
        Audio.playBossLaser();
        game.shake(0.3);
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        for (let i = -1; i <= 1; i++) {
            game.bullets.push(new Bullet(cx + i * 40, cy, 0, 600, {
                damage: 15,
                color: '#ff00ff',
                size: 9
            }));
        }
    }

    firePhase1Bullets(game) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        const bulletCount = 8;
        for (let i = 0; i < bulletCount; i++) {
            const angle = (i / bulletCount) * Math.PI * 2 + this.angle;
            game.bullets.push(new Bullet(cx, cy,
                Math.cos(angle) * 180, Math.sin(angle) * 180, {
                damage: CONFIG.BULLET_TYPES.boss.damage,
                color: CONFIG.BULLET_TYPES.boss.color,
                size: CONFIG.BULLET_TYPES.boss.size
            }));
        }
    }

    fireSpiralBullets(dt, game, count, speed) {
        this.spiralAngle += dt * 3;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const bulletsPerFrame = 1;
        for (let i = 0; i < bulletsPerFrame; i++) {
            const angle = this.spiralAngle + (i / count) * Math.PI * 2;
            game.bullets.push(new Bullet(cx, cy,
                Math.cos(angle) * speed, Math.sin(angle) * speed, {
                damage: CONFIG.BULLET_TYPES.boss.damage * 0.7,
                color: '#ff44ff',
                size: 5
            }));
        }
    }

    spawnMinions(game) {
        for (let i = 0; i < 2; i++) {
            const enemy = new Enemy('scout', 0, 0, game.difficulty);
            enemy.initPosition(
                this.x + Utils.random(0, this.width),
                this.y + this.height
            );
            game.enemies.push(enemy);
        }
    }

    updatePhase2(dt, game) {
        this.x += this.moveDir * this.moveSpeed * 1.2 * dt;
        if (this.x <= 20 || this.x >= CONFIG.CANVAS.width - this.width - 20) {
            this.moveDir *= -1;
        }

        this.dashCooldown -= dt;
        if (this.dashCooldown <= 0) {
            this.dashCooldown = 5;
            this.dashTowardPlayer(game);
        }

        const attackTimer = this.stateTimer;

        if (attackTimer % 2.5 > 2.3) {
            this.firePhase2Gatling(game);
        }

        if (attackTimer % 5 > 4.8) {
            this.firePhase2Missiles(game);
        }

        if (attackTimer % 3.5 > 3.3) {
            this.firePhase2Spread(game);
        }

        this.fireSpiralBullets(dt, game, 12, 200);
    }

    dashTowardPlayer(game) {
        if (!game.player || !game.player.active) return;
        Audio.playBossLaser();
        game.shake(0.4);
        const targetX = game.player.x + game.player.width / 2;
        const cx = this.x + this.width / 2;
        this.moveDir = targetX > cx ? 1 : -1;
    }

    firePhase2Gatling(game) {
        Audio.playBossLaser();
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        if (game.player && game.player.active) {
            const angle = Utils.angle(cx, cy,
                game.player.x + game.player.width / 2,
                game.player.y + game.player.height / 2);
            for (let i = -1; i <= 1; i++) {
                const a = angle + i * 0.1;
                game.bullets.push(new Bullet(cx + i * 30, cy,
                    Math.cos(a) * 450, Math.sin(a) * 450, {
                    damage: CONFIG.BULLET_TYPES.boss.damage,
                    color: '#ff0088',
                    size: 4
                }));
            }
        }
    }

    firePhase2Missiles(game) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        for (let i = -1; i <= 1; i++) {
            game.bullets.push(new Bullet(cx + i * 60, cy,
                Utils.random(-50, 50), 150, {
                damage: CONFIG.BULLET_TYPES.boss.damage * 1.5,
                color: '#ff4400',
                size: 6
            }));
        }
    }

    firePhase2Spread(game) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        if (game.player && game.player.active) {
            const angle = Utils.angle(cx, cy,
                game.player.x + game.player.width / 2,
                game.player.y + game.player.height / 2);
            for (let i = -2; i <= 2; i++) {
                const a = angle + i * 0.15;
                game.bullets.push(new Bullet(cx, cy,
                    Math.cos(a) * 250, Math.sin(a) * 250, {
                    damage: CONFIG.BULLET_TYPES.boss.damage,
                    color: '#ff44ff',
                    size: 5
                }));
            }
        }
    }

    updatePhase3(dt, game) {
        this.sweepProgress += dt * 0.5;
        if (this.sweepProgress > 1) {
            this.sweepProgress = 0;
            this.sweepDir *= -1;
        }
        this.x = this.sweepDir > 0
            ? Utils.lerp(CONFIG.CANVAS.width - this.width - 20, 20, this.sweepProgress)
            : Utils.lerp(20, CONFIG.CANVAS.width - this.width - 20, this.sweepProgress);
        this.x = Utils.clamp(this.x, 20, CONFIG.CANVAS.width - this.width - 20);

        const attackTimer = this.stateTimer;

        if (attackTimer % 2 > 1.8) {
            this.firePhase3Burst(game);
        }

        if (attackTimer % 6 > 5.8) {
            this.firePhase3Lasers(game);
        }

        if (attackTimer % 10 > 9.8) {
            this.spawnPhase3Reinforcements(game);
        }

        this.fireSpiralBullets(dt, game, 16, 250);
    }

    firePhase3Burst(game) {
        Audio.playBossLaser();
        game.shake(0.2);
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        for (let burst = 0; burst < 3; burst++) {
            setTimeout(() => {
                const bulletCount = 16;
                for (let i = 0; i < bulletCount; i++) {
                    const angle = (i / bulletCount) * Math.PI * 2 + Math.random() * 0.3;
                    game.bullets.push(new Bullet(cx, cy,
                        Math.cos(angle) * 220, Math.sin(angle) * 220, {
                        damage: CONFIG.BULLET_TYPES.boss.damage,
                        color: '#ff0088',
                        size: 6
                    }));
                }
            }, burst * 100);
        }
    }

    firePhase3Lasers(game) {
        Audio.playBossLaser();
        game.shake(0.3);
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        for (let i = 0; i < 5; i++) {
            const x = Utils.random(50, CONFIG.CANVAS.width - 50);
            const startX = cx + (x - cx) * 0.3;
            for (let j = 0; j < 5; j++) {
                game.bullets.push(new Bullet(startX + Utils.random(-20, 20), cy,
                    (x - startX) / 0.3, 700, {
                    damage: CONFIG.BULLET_TYPES.boss.damage * 1.2,
                    color: '#ff00ff',
                    size: 7
                }));
            }
        }
    }

    spawnPhase3Reinforcements(game) {
        for (let i = 0; i < 4; i++) {
            const enemy = new Enemy('heavy', 0, 0, game.difficulty);
            enemy.initPosition(
                Utils.random(100, CONFIG.CANVAS.width - 100),
                -50
            );
            game.enemies.push(enemy);
        }
        for (let i = 0; i < 2; i++) {
            const enemy = new Enemy('elite', 0, 0, game.difficulty);
            enemy.initPosition(
                Utils.random(100, CONFIG.CANVAS.width - 100),
                -50
            );
            game.enemies.push(enemy);
        }
    }

    draw(ctx) {
        if (!this.active) return;

        if (this.state === 'dying') {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - this.dyingTimer / 2);
            this.drawBody(ctx);
            ctx.restore();
            return;
        }

        this.drawBody(ctx);

        if (this.beamCharging) {
            this.drawBeamCharge(ctx);
        }
        if (this.beamActive) {
            this.drawBeam(ctx);
        }
    }

    drawBody(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.save();
        ctx.translate(cx, cy);

        const flash = this.isFlashing ? 0.7 : 1;
        const corePulse = 0.8 + Math.sin(this.angle * 4) * 0.2;
        const hw = this.width / 2;
        const hh = this.height / 2;

        // === 第一阶段：无光晕元素 ===
        ctx.shadowBlur = 0;

        // 巨型履带（两侧）
        const treadW = 26;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-hw, -hh + 6, treadW, this.height - 12);
        ctx.fillRect(hw - treadW, -hh + 6, treadW, this.height - 12);

        // 履带节纹滚动
        ctx.fillStyle = '#3a2222';
        const seg = 6;
        const offset = (this.treadOffset % seg + seg) % seg;
        for (let y = -hh + 6 - seg + offset; y < hh - 6; y += seg) {
            ctx.fillRect(-hw + 2, y, treadW - 4, 3);
            ctx.fillRect(hw - treadW + 2, y, treadW - 4, 3);
        }

        // 主装甲车身
        ctx.fillStyle = this.isFlashing ? '#ffffff' : '#1a0a0a';
        ctx.strokeStyle = this.coreColor;
        ctx.lineWidth = 3;
        ctx.fillRect(-hw + treadW - 2, -hh + 4, this.width - treadW * 2 + 4, this.height - 8);
        ctx.strokeRect(-hw + treadW - 2, -hh + 4, this.width - treadW * 2 + 4, this.height - 8);

        // 装甲板纹理
        ctx.strokeStyle = '#550000';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = -hh + 20 + i * 28;
            ctx.beginPath();
            ctx.moveTo(-hw + treadW, y);
            ctx.lineTo(hw - treadW, y);
            ctx.stroke();
        }

        // 铆钉装饰
        ctx.fillStyle = '#440000';
        for (let i = 0; i < 6; i++) {
            const x = -hw + treadW + 10 + i * 35;
            ctx.beginPath();
            ctx.arc(x, -hh + 12, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, hh - 12, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 底部炮口（朝下，无光晕）
        ctx.fillStyle = '#ff4444';
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(i * 60, hh - 15, 7, 0, Math.PI * 2);
            ctx.fill();
        }

        // === 第二阶段：带光晕元素 ===
        ctx.shadowColor = this.coreColor;
        ctx.shadowBlur = 20 * flash;

        // 主装甲描边加亮
        ctx.strokeStyle = this.coreColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(-hw + treadW - 2, -hh + 4, this.width - treadW * 2 + 4, this.height - 8);

        // 中央主炮塔：能量核心
        ctx.shadowBlur = 30 * corePulse;
        ctx.fillStyle = this.coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, 22 * corePulse, 0, Math.PI * 2);
        ctx.fill();

        // 核心内层
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffff88';
        ctx.beginPath();
        ctx.arc(0, 0, 11 * corePulse, 0, Math.PI * 2);
        ctx.fill();

        // 核心高光
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-3, -3, 4, 0, Math.PI * 2);
        ctx.fill();

        // 阶段标记：侧炮塔
        if (this.phase >= 2) {
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(-hw + 10, -10, 16, 20);
            ctx.fillRect(hw - 26, -10, 16, 20);
        }

        if (this.phase >= 3) {
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 25;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            const pulse = Math.sin(this.angle * 8) * 0.3 + 0.7;
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.42, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // 名称标签
        ctx.save();
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillText(this.name + ' - Phase ' + this.phase, cx, this.y - 15);
        ctx.restore();
    }

    drawBeamCharge(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        const chargeProgress = this.beamChargeTime / 0.8;

        ctx.save();
        ctx.strokeStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 20 * chargeProgress;
        ctx.lineWidth = 2 + chargeProgress * 4;

        for (let i = -1; i <= 1; i++) {
            ctx.globalAlpha = chargeProgress;
            ctx.beginPath();
            ctx.moveTo(cx + i * 40, cy);
            ctx.lineTo(cx + i * 40, cy + 500 * chargeProgress);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawBeam(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;

        ctx.save();
        for (let i = -1; i <= 1; i++) {
            const bx = cx + i * 40;
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 30;
            ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
            ctx.fillRect(bx - 15, cy, 30, CONFIG.CANVAS.height - cy);

            ctx.fillStyle = '#ff88ff';
            ctx.fillRect(bx - 6, cy, 12, CONFIG.CANVAS.height - cy);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(bx - 2, cy, 4, CONFIG.CANVAS.height - cy);
        }
        ctx.restore();
    }
};
