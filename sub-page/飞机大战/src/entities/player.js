class Player {
    constructor(shipType = 'judgment', upgrades = {}) {
        const typeConfig = CONFIG.SHIP_TYPES[shipType] || CONFIG.SHIP_TYPES.judgment;
        const stats = typeConfig.stats;

        this.shipType = shipType;
        this.shipConfig = typeConfig;

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
        this.thrusterFrame = 0;

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
            this.weapon = this.shipConfig.weaponAffinity;
        }
        if (this.powerLevel >= 2) {
            this.hasHoming = this.hasHoming || this.shipConfig.weaponAffinity === 'homing';
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

        this.thrusterFrame += dt;

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
                    game.bullets.push(new Bullet(cx - 12, cy - 5, 0, -weaponConfig.speed, {
                        damage: weaponConfig.damage + this.powerLevel * 2,
                        color: this.color,
                        size: weaponConfig.size,
                        fromPlayer: true
                    }));
                    game.bullets.push(new Bullet(cx + 12, cy - 5, 0, -weaponConfig.speed, {
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
                        game.bullets.push(new Bullet(cx + side * 16, cy,
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
                const spiralAngle = (this.thrusterFrame * 8) % (Math.PI * 2);
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

        game.particles.emitEngine(cx - 8, cy + 5, this.accentColor);
        game.particles.emitEngine(cx + 8, cy + 5, this.accentColor);
    }

    useBomb(game) {
        this.bombs--;
        Audio.playSkill();
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

        // 清除范围内的敌方弹幕
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

        // 对全场敌人造成伤害
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

        // 清弹提示
        if (clearedCount > 0) {
            game.addPopupText('清弹 x' + clearedCount, px, py - 30, '#00ffff');
        }

        // 特效：清除范围圆环
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

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;

        ctx.fillStyle = '#0a1628';
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(-this.width / 2, this.height / 2);
        ctx.lineTo(-this.width / 4, this.height / 3);
        ctx.lineTo(0, this.height / 2.5);
        ctx.lineTo(this.width / 4, this.height / 3);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2 + 8);
        ctx.lineTo(-6, -4);
        ctx.lineTo(6, -4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.accentColor;
        ctx.shadowColor = this.accentColor;
        ctx.shadowBlur = 10;
        const flameSize = 6 + Math.sin(this.thrusterFrame * 20) * 3;
        ctx.beginPath();
        ctx.moveTo(-6, this.height / 2 - 5);
        ctx.lineTo(0, this.height / 2 + flameSize);
        ctx.lineTo(6, this.height / 2 - 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(-3, this.height / 2 - 3);
        ctx.lineTo(0, this.height / 2 + flameSize * 0.6);
        ctx.lineTo(3, this.height / 2 - 3);
        ctx.closePath();
        ctx.fill();

        if (this.shipType === 'fortress') {
            ctx.fillStyle = this.accentColor;
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 8;
            ctx.fillRect(-this.width / 2 - 6, -this.height / 4, 8, this.height / 2);
            ctx.fillRect(this.width / 2 - 2, -this.height / 4, 8, this.height / 2);
        } else if (this.shipType === 'phantom') {
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(-this.width / 2 - 5, 0);
            ctx.lineTo(-this.width / 2, -5);
            ctx.moveTo(this.width / 2 + 5, 0);
            ctx.lineTo(this.width / 2, -5);
            ctx.stroke();
        } else if (this.shipType === 'shadow') {
            ctx.fillStyle = this.accentColor;
            ctx.shadowColor = this.accentColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, -this.height / 4, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-this.width / 3, 0, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.width / 3, 0, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.powerLevel >= 2) {
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
            ctx.fillRect(-this.width / 2 - 4, 0, 6, this.height / 3);
            ctx.fillRect(this.width / 2 - 2, 0, 6, this.height / 3);
        }

        if (this.shield > 0) {
            ctx.strokeStyle = `rgba(0, 170, 255, ${0.3 + (this.shield / this.maxShield) * 0.5})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00aaff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
};