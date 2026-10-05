class Player {
    constructor(tankType = 'judgment', upgrades = {}) {
        const typeConfig = CONFIG.TANK_TYPES[tankType] || CONFIG.TANK_TYPES.judgment;
        const stats = typeConfig.stats;

        this.tankType = tankType;
        this.tankConfig = typeConfig;

        this.width = stats.width;
        this.height = stats.height;
        this.x = CONFIG.CANVAS.width / 2 - this.width / 2;
        this.y = CONFIG.CANVAS.height - this.height - 40;
        this.baseSpeed = stats.speed;
        this.speed = stats.speed;
        this.baseHp = stats.hp;
        this.maxHp = stats.maxHp;
        this.hp = stats.hp;
        this.shield = stats.shield;
        this.maxShield = stats.maxShield;
        this.baseFireRate = stats.fireRate;
        this.fireRate = stats.fireRate;
        this.fireTimer = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.powerLevel = 1;
        this.maxPowerLevel = CONFIG.PLAYER_BASE.maxPowerLevel;
        this.active = true;
        this.weapon = typeConfig.weaponAffinity;
        this.hasHoming = typeConfig.weaponAffinity === 'homing';
        this.hasFreeze = false;
        this.magnet = false;
        this.magnetTimer = 0;
        this.bombs = 2;
        this.lives = 0;
        this.energy = 0;
        this.energyMax = stats.energyMax;
        this.energyRegenRate = stats.energyRegen;
        this.energyWasFull = false;
        this.skillReadyTriggered = false;
        this.angle = -Math.PI / 2;
        this.treadFrame = 0;

        this.damageBomb = stats.bombDamage;
        this.damageSkill = stats.skillDamage;

        this.color = typeConfig.color;
        this.accentColor = typeConfig.accentColor;
        this.glowColor = typeConfig.glowColor;

        this.baseScoreMult = 1.0;
        this.skillClearRadius = 120;

        this.applyUpgrades(upgrades || {});
    }

    applyUpgrades(upgrades) {
        if (upgrades.hpBoost) {
            const lv = upgrades.hpBoost;
            this.maxHp += CONFIG.UPGRADES.hpBoost.effect.hp * lv;
            this.hp += CONFIG.UPGRADES.hpBoost.effect.hp * lv;
            this.baseHp = this.maxHp;
        }
        if (upgrades.shieldBoost) {
            const lv = upgrades.shieldBoost;
            this.maxShield += CONFIG.UPGRADES.shieldBoost.effect.shield * lv;
            this.shield += CONFIG.UPGRADES.shieldBoost.effect.shield * lv;
        }
        if (upgrades.fireRateBoost) {
            const lv = upgrades.fireRateBoost;
            const mult = 1 + CONFIG.UPGRADES.fireRateBoost.effect.fireRate * lv;
            this.fireRate = this.baseFireRate / mult;
        }
        if (upgrades.energyBoost) {
            const lv = upgrades.energyBoost;
            this.energyRegenRate *= (1 + CONFIG.UPGRADES.energyBoost.effect.energyRegen * lv);
        }
        if (upgrades.bombBoost) {
            const lv = upgrades.bombBoost;
            this.bombs += CONFIG.UPGRADES.bombBoost.effect.bombs * lv;
        }
        if (upgrades.scoreBoost) {
            const lv = upgrades.scoreBoost;
            this.baseScoreMult = 1 + CONFIG.UPGRADES.scoreBoost.effect.scoreMult * lv;
            this.skillClearRadius = 120 + CONFIG.UPGRADES.scoreBoost.effect.skillClearRadius * lv;
        }
    }

    getScoreMultiplier() {
        return this.baseScoreMult;
    }

    upgradeWeapon() {
        if (this.powerLevel >= 5) {
            this.weapon = 'plasma';
        } else if (this.powerLevel >= 4) {
            this.weapon = 'spiral';
        } else if (this.powerLevel >= 2) {
            this.weapon = 'spread';
        } else {
            this.weapon = this.tankConfig.weaponAffinity;
        }
        if (this.powerLevel >= 2) {
            this.hasHoming = this.hasHoming || this.tankConfig.weaponAffinity === 'homing';
        }
    }

    takeDamage(amount, game) {
        if (this.invincible) return;

        if (this.shield > 0) {
            this.shield -= amount;
            if (this.shield < 0) {
                this.hp += this.shield;
                this.shield = 0;
            }
            game.particles.emitShieldBreak(this.x + this.width / 2, this.y + this.height / 2);
        } else {
            this.hp -= amount;
        }

        Audio.playPlayerDamage();
        game.shake(0.3);

        this.invincible = true;
        this.invincibleTimer = CONFIG.PLAYER_BASE.invincibleTime;

        if (this.hp <= 0) {
            this.hp = 0;
            this.die(game);
        }
    }

    die(game) {
        if (this.lives > 0) {
            this.lives--;
            this.hp = this.maxHp;
            this.shield = Math.floor(this.maxShield * 0.3);
            this.invincible = true;
            this.invincibleTimer = 3;
            game.particles.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, 25, this.color);
            Audio.playExplosion(false);
        } else {
            this.active = false;
            game.particles.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, 40, this.color);
            game.particles.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, 35, this.accentColor);
            Audio.playExplosion(true);
            game.shake(0.6);
        }
    }

    update(dt, game) {
        if (!this.active) return;

        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        if (this.magnet) {
            this.magnetTimer -= dt;
            if (this.magnetTimer <= 0) {
                this.magnet = false;
            }
        }

        const move = Input.getMoveDirection();
        const hasKeyboardInput = move.x !== 0 || move.y !== 0;

        if (!hasKeyboardInput) {
            if (Input.touch.active) {
                const targetX = Input.touch.x - this.width / 2;
                const targetY = Input.touch.y - this.height / 2;
                this.x = Utils.lerp(this.x, targetX, 0.25);
                this.y = Utils.lerp(this.y, targetY, 0.25);
            } else if (Input.mouse.down && Input.mouse.x > 0 && Input.mouse.y > 0) {
                const targetX = Input.mouse.x - this.width / 2;
                const targetY = Input.mouse.y - this.height / 2;
                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                    const maxMove = this.speed * dt * 2.0;
                    if (dist < maxMove) {
                        this.x = targetX;
                        this.y = targetY;
                    } else {
                        this.x += (dx / dist) * maxMove;
                        this.y += (dy / dist) * maxMove;
                    }
                }
            }
        } else {
            this.x += move.x * this.speed * dt;
            this.y += move.y * this.speed * dt;
        }

        this.x = Utils.clamp(this.x, 0, CONFIG.CANVAS.width - this.width);
        this.y = Utils.clamp(this.y, 0, CONFIG.CANVAS.height - this.height);

        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
            this.fire(game);
            this.fireTimer = this.fireRate;
        }

        this.treadFrame += dt;

        if (this.energy >= this.energyMax && Input.consumeKey('Space')) {
            this.useSkill(game);
        }

        if (Input.consumeKey('KeyB') && this.bombs > 0) {
            this.useBomb(game);
        }
    }

    fire(game) {
        const cx = this.x + this.width / 2;
        const cy = this.y;
        const weaponConfig = CONFIG.WEAPONS[this.weapon];

        Audio.playShoot();

        switch (this.weapon) {
            case 'single':
                game.bullets.push(new Bullet(cx, cy - 10, 0, -weaponConfig.speed, {
                    damage: weaponConfig.damage + this.powerLevel * 3,
                    color: this.color,
                    size: weaponConfig.size + this.powerLevel * 0.5,
                    fromPlayer: true
                }));
                if (this.powerLevel >= 2) {
                    game.bullets.push(new Bullet(cx - 14, cy - 5, 0, -weaponConfig.speed, {
                        damage: weaponConfig.damage + this.powerLevel * 2,
                        color: this.color,
                        size: weaponConfig.size,
                        fromPlayer: true
                    }));
                    game.bullets.push(new Bullet(cx + 14, cy - 5, 0, -weaponConfig.speed, {
                        damage: weaponConfig.damage + this.powerLevel * 2,
                        color: this.color,
                        size: weaponConfig.size,
                        fromPlayer: true
                    }));
                }
                break;

            case 'spread':
                for (let i = -1; i <= 1; i++) {
                    const angle = -Math.PI / 2 + i * weaponConfig.angle;
                    game.bullets.push(new Bullet(cx, cy - 10,
                        Math.cos(angle) * weaponConfig.speed,
                        Math.sin(angle) * weaponConfig.speed, {
                            damage: weaponConfig.damage + this.powerLevel * 2,
                            color: this.color,
                            size: weaponConfig.size,
                            fromPlayer: true
                        }));
                }
                if (this.powerLevel >= 3) {
                    for (const side of [-1, 1]) {
                        game.bullets.push(new Bullet(cx + side * 18, cy,
                            side * 100, -weaponConfig.speed * 0.9, {
                                damage: weaponConfig.damage + this.powerLevel,
                                color: this.color,
                                size: weaponConfig.size,
                                fromPlayer: true
                            }));
                    }
                }
                break;

            case 'spiral':
                const spiralAngle = (this.treadFrame * 8) % (Math.PI * 2);
                for (let i = 0; i < weaponConfig.count; i++) {
                    const angle = spiralAngle + (i / weaponConfig.count) * Math.PI * 2;
                    game.bullets.push(new Bullet(cx, cy,
                        Math.cos(angle) * weaponConfig.speed,
                        Math.sin(angle) * weaponConfig.speed, {
                            damage: weaponConfig.damage + this.powerLevel,
                            color: this.color,
                            size: weaponConfig.size,
                            fromPlayer: true
                        }));
                }
                break;

            case 'plasma':
                Audio.playPlasmaShoot();
                game.bullets.push(new Bullet(cx, cy - 15, 0, -weaponConfig.speed, {
                    damage: weaponConfig.damage,
                    color: this.accentColor,
                    size: weaponConfig.size,
                    fromPlayer: true,
                    pierce: true
                }));
                break;
        }

        if (this.hasHoming && Math.random() < 0.3) {
            game.bullets.push(new Bullet(cx, cy, Utils.random(-50, 50), -300, {
                damage: CONFIG.WEAPONS.homing.damage,
                color: CONFIG.WEAPONS.homing.color,
                size: CONFIG.WEAPONS.homing.size,
                fromPlayer: true,
                homing: true
            }));
        }

        if (this.hasFreeze && Math.random() < 0.25) {
            const angle = Utils.random(-0.5, 0.5) - Math.PI / 2;
            game.bullets.push(new Bullet(cx, cy,
                Math.cos(angle) * CONFIG.WEAPONS.freeze.speed,
                Math.sin(angle) * CONFIG.WEAPONS.freeze.speed, {
                    damage: CONFIG.WEAPONS.freeze.damage,
                    color: CONFIG.WEAPONS.freeze.color,
                    size: CONFIG.WEAPONS.freeze.size,
                    fromPlayer: true,
                    freeze: true
                }));
        }

        // 开火尘烟
        game.particles.emitEngine(cx - 10, cy + this.height - 5, '#aa9966');
        game.particles.emitEngine(cx + 10, cy + this.height - 5, '#aa9966');
    }

    // 空袭支援
    useBomb(game) {
        this.bombs--;
        Audio.playSkill();
        Audio.playBomb();
        game.screenFlash = 0.2;
        game.shake(0.5);

        for (const enemy of game.enemies) {
            if (enemy.active) {
                enemy.takeDamage(this.damageBomb, game);
                game.addPopupText('-' + this.damageBomb, enemy.x + enemy.width / 2, enemy.y, '#ff8800');
            }
        }
        if (game.boss && game.boss.active) {
            game.boss.takeDamage(this.damageBomb * 2, game);
            game.addPopupText('-' + (this.damageBomb * 2), game.boss.x + game.boss.width / 2, game.boss.y, '#ff4444');
        }
        game.particles.emitSkillBurst(this.x + this.width / 2, this.y + this.height / 2, 30);
    }

    useSkill(game) {
        this.energy = 0;
        Audio.playSkill();
        game.screenFlash = 0.3;
        game.shake(0.8);

        var px = this.x + this.width / 2;
        var py = this.y + this.height / 2;
        var clearR = this.skillClearRadius;
        var clearR2 = clearR * clearR;

        var clearedCount = 0;
        for (var i = 0; i < game.bullets.length; i++) {
            var b = game.bullets[i];
            if (!b.active || b.fromPlayer) continue;
            var dx = b.x - px;
            var dy = b.y - py;
            if (dx * dx + dy * dy <= clearR2) {
                b.active = false;
                clearedCount++;
            }
        }

        for (const enemy of game.enemies) {
            if (enemy.active) {
                enemy.takeDamage(this.damageSkill, game);
                game.addPopupText('-' + this.damageSkill, enemy.x + enemy.width / 2, enemy.y, '#ffff00');
            }
        }
        if (game.boss && game.boss.active) {
            game.boss.takeDamage(this.damageSkill * 1.5, game);
            game.addPopupText('-' + (this.damageSkill * 1.5), game.boss.x + game.boss.width / 2, game.boss.y, '#ff00ff');
        }

        if (clearedCount > 0) {
            game.addPopupText('清弹 x' + clearedCount, px, py - 30, '#ffcc00');
        }

        game.particles.emitSkillBurst(px, py, clearR * 0.5);

        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                game.particles.emitSkillBurst(
                    px + Utils.random(-100, 100),
                    py + Utils.random(-80, 80),
                    20
                );
            }, i * 60);
        }
    }

    addEnergy(amount) {
        this.energy = Math.min(this.energy + amount * this.energyRegenRate, this.energyMax);
    }

    draw(ctx) {
        if (!this.active) return;

        if (this.invincible && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
            return;
        }

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.save();
        ctx.translate(cx, cy);

        const w = this.width;
        const h = this.height;
        const hw = w / 2;
        const hh = h / 2;

        // === 履带（无光晕）===
        ctx.shadowBlur = 0;
        const treadW = w * 0.16;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-hw, -hh + 2, treadW, h - 4);
        ctx.fillRect(hw - treadW, -hh + 2, treadW, h - 4);

        // 履带节纹滚动
        ctx.fillStyle = '#3a3a3a';
        const seg = 4;
        const offset = (this.treadFrame * 60 % seg + seg) % seg;
        for (let y = -hh + 2 - seg + offset; y < hh - 2; y += seg) {
            ctx.fillRect(-hw + 1, y, treadW - 2, 2);
            ctx.fillRect(hw - treadW + 1, y, treadW - 2, 2);
        }

        // === 车身（带光晕）===
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;

        ctx.fillStyle = '#0e1a0e';
        ctx.fillRect(-hw + treadW - 2, -hh + 2, w - treadW * 2 + 4, h - 4);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-hw + treadW - 2, -hh + 2, w - treadW * 2 + 4, h - 4);

        // 车身装甲纹理
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.accentColor;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-hw + treadW, -hh + h * 0.3);
        ctx.lineTo(hw - treadW, -hh + h * 0.3);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // === 炮塔 ===
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.26, 0, Math.PI * 2);
        ctx.fill();

        // 炮塔内层
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.accentColor;
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.14, 0, Math.PI * 2);
        ctx.fill();

        // === 炮管朝上 ===
        ctx.fillStyle = '#222';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;
        const barrelW = this.powerLevel >= 2 ? 7 : 5;
        ctx.fillRect(-barrelW / 2, -hh - 4, barrelW, hh * 0.7);

        // 炮口
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#444';
        ctx.fillRect(-barrelW / 2 - 2, -hh - 6, barrelW + 4, 4);

        // === 型号特征装饰 ===
        if (this.tankType === 'bear') {
            // 巨熊：侧面附加装甲
            ctx.fillStyle = this.accentColor;
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 6;
            ctx.fillRect(-hw - 4, -hh + h * 0.2, 5, h * 0.5);
            ctx.fillRect(hw - 1, -hh + h * 0.2, 5, h * 0.5);
        } else if (this.tankType === 'cheetah') {
            // 猎豹：天线/雷达
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(0, -w * 0.26);
            ctx.lineTo(0, -w * 0.5);
            ctx.stroke();
            ctx.fillStyle = this.accentColor;
            ctx.beginPath();
            ctx.arc(0, -w * 0.5, 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.tankType === 'night') {
            // 暗夜：能量节点
            ctx.fillStyle = this.accentColor;
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, -hh + h * 0.25, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-w * 0.22, 0, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(w * 0.22, 0, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // === 火力等级装饰：副炮 ===
        if (this.powerLevel >= 2) {
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 6;
            ctx.fillRect(-hw + treadW, -hh + h * 0.1, 4, h * 0.3);
            ctx.fillRect(hw - treadW - 4, -hh + h * 0.1, 4, h * 0.3);
        }

        // === 护盾光环 ===
        if (this.shield > 0) {
            ctx.strokeStyle = `rgba(0, 170, 255, ${0.3 + (this.shield / this.maxShield) * 0.5})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00aaff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, w * 0.75, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
};
