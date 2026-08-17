class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastTime = 0;
        this.hitStopTimer = 0;
        this.shakeIntensity = 0;
        this.screenFlash = 0;
        this.difficulty = 1;
        this.spawnMult = 1;

        this.battlefield = new Battlefield();
        this.particles = new ParticleSystem();
        this.spawner = new Spawner();
        this.collisionSystem = new CollisionSystem();

        this.player = null;
        this.bullets = [];
        this.enemies = [];
        this.powerups = [];
        this.boss = null;

        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;
        this.enemiesKilled = 0;
        this.bossDefeated = false;
        this.isVictory = false;
        this.isBossFight = false;
        this.bossAlertTimer = 0;
        this.gameTime = 0;
        this.popupTexts = [];

        this.selectedShip = 'judgment';
        this.selectedMode = 'story';
        this.currentStage = 0;
        this.selectedStage = 0;
        this.stageTimer = 0;
        this.tutorialShown = false;
        this.isTutorial = false;
        this._gameOverTriggered = false;
        this.damageNumbersEnabled = true;
        this.storyProgress = parseInt(localStorage.getItem('tankbattalion_story_progress') || '0');
        this.isVictory = false;

        this.upgrades = this.loadUpgrades();
        this.totalPoints = parseInt(localStorage.getItem('tankbattalion_points') || '0');
        this.damageNumbersEnabled = localStorage.getItem('tankbattalion_dmg_numbers') !== 'false';

        this.hud = new HUD(document.getElementById('hud-overlay'));
        this.hud.hide();
        this.hud.bindPauseCallback(() => {
            this.togglePause();
        });

        this.scenes = {
            menu: new MenuScene(this),
            game: new GameScene(this),
            boss: new BossScene(this),
            gameover: new GameOverScene(this),
            shop: new ShopScene(this)
        };

        this.setupResize();

        this.scene = this.scenes.menu;
        this.scene.enter();
    }

    setupResize() {
        this._needsResize = false;
        this.resize();
        window.addEventListener('resize', () => { this._needsResize = true; });
        window.addEventListener('orientationchange', () => {
            this._needsResize = true;
            setTimeout(() => { this._needsResize = true; }, 200);
            setTimeout(() => { this._needsResize = true; }, 500);
        });
    }

    resize() {
        const container = document.getElementById('game-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const w = Math.max(240, Math.round(rect.width));
        const h = Math.max(300, Math.round(rect.height));
        const oldW = CONFIG.CANVAS.width;
        const oldH = CONFIG.CANVAS.height;
        if (w === oldW && h === oldH) return;

        CONFIG.CANVAS.width = w;
        CONFIG.CANVAS.height = h;
        this.canvas.width = w;
        this.canvas.height = h;

        if (this.battlefield) {
            this.battlefield.resize(oldW, oldH, w, h);
        }

        if (window.Input && Input.canvas) {
            Input.updateScale();
        }

        if (this.player && this.player.active) {
            this.player.x = Utils.clamp(this.player.x, 0, w - this.player.width);
            this.player.y = Utils.clamp(this.player.y, 0, h - this.player.height);
        }
    }

    togglePause() {
        const scene = this.scene;
        if (!scene.isPlaying) return;

        scene.paused = !scene.paused;
        const paused = scene.paused;

        if (scene.pauseOverlay) {
            scene.pauseOverlay.style.display = paused ? 'flex' : 'none';
        }

        const pauseBtn = this.hud.pauseBtn;
        if (pauseBtn) {
            if (paused) {
                pauseBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20"><polygon points="5,3 17,10 5,17" fill="#ffcc00"/></svg>';
            } else {
                pauseBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20"><rect x="4" y="3" width="4" height="14" fill="#ffcc00"/><rect x="12" y="3" width="4" height="14" fill="#ffcc00"/></svg>';
            }
        }

        Audio.playClick();
    }

    loadUpgrades() {
        try {
            return JSON.parse(localStorage.getItem('tankbattalion_upgrades') || '{}');
        } catch {
            return {};
        }
    }

    saveUpgrades() {
        localStorage.setItem('tankbattalion_upgrades', JSON.stringify(this.upgrades));
        localStorage.setItem('tankbattalion_points', this.totalPoints.toString());
    }

    purchaseUpgrade(upgradeId) {
        const config = CONFIG.UPGRADES[upgradeId];
        if (!config) return false;
        const currentLevel = this.upgrades[upgradeId] || 0;
        if (currentLevel >= config.maxLevel) return false;
        const cost = config.cost[currentLevel];
        if (this.totalPoints < cost) return false;
        this.totalPoints -= cost;
        this.upgrades[upgradeId] = currentLevel + 1;
        this.saveUpgrades();
        return true;
    }

    getUpgradeLevel(upgradeId) {
        return this.upgrades[upgradeId] || 0;
    }

    setDifficulty(level) {
        const config = CONFIG.DIFFICULTY[level] || CONFIG.DIFFICULTY.normal;
        this.difficulty = config.hpMult;
        this.spawnMult = config.spawnMult;
    }

    setShip(shipType) {
        this.selectedShip = shipType;
    }

    setMode(mode) {
        this.selectedMode = mode;
        this.currentStage = 0;
        this.stageTimer = 0;
        if (mode === 'story') {
            this.selectedStage = this.storyProgress;
        } else {
            this.selectedStage = 0;
        }
    }

    startGame(stageIndex) {
        if (stageIndex === undefined) {
            stageIndex = (this.selectedMode === 'story') ? this.storyProgress : 0;
        }
        this.selectedStage = stageIndex;
        this.reset();
        this.scene.exit();
        this.scene = this.scenes.game;
        this.scene.enter();
        this.hud.clear();
        this.hud.show();
        this.hud.setDamageNumbersEnabled(this.damageNumbersEnabled);
    }

    initPlayer() {
        if (!this.player || !this.player.active) {
            this.player = new Player(this.selectedShip, this.upgrades);
        }
    }

    startStage(stageIndex) {
        this.currentStage = stageIndex;
        this.stageTimer = 0;
        const modeConfig = CONFIG.GAME_MODES[this.selectedMode];
        if (modeConfig && modeConfig.stages[stageIndex]) {
            const stage = modeConfig.stages[stageIndex];
            this.spawnMult = stage.spawnMult;
            this.isTutorial = stage.tutorial || false;
        }
    }

    advanceStage() {
        const modeConfig = CONFIG.GAME_MODES[this.selectedMode];
        if (!modeConfig) return;

        if (this.selectedMode === 'story') {
            const stages = modeConfig.stages;
            const nextIndex = this.currentStage + 1;
            if (nextIndex >= stages.length) {
                this.endGame(true);
                return;
            }
            if (this.currentStage >= this.storyProgress) {
                this.storyProgress = Math.min(this.currentStage + 1, stages.length - 1);
                localStorage.setItem('tankbattalion_story_progress', this.storyProgress.toString());
            }
            this.stageComplete = true;
            this.scene.showStageComplete(nextIndex);
        }
    }

    continueNextStage() {
        this.stageComplete = false;
        this.savePoints();
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.gameTime = 0;

        const stages = CONFIG.GAME_MODES.story.stages;
        this.currentStage = Math.min(this.currentStage + 1, stages.length - 1);
        this.stageTimer = 0;
        const stage = stages[this.currentStage];
        this.spawnMult = stage.spawnMult;
        this.isTutorial = stage.tutorial || false;
        this.bossDefeated = false;
        this.isBossFight = false;
        this.boss = null;

        this.bullets = [];
        this.enemies = [];
        this.powerups = [];
        this.popupTexts = [];
        this.particles.clear();

        if (this.player) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
            this.player.shield = this.player.maxShield;
        }

        Input.reset();
    }

    restartGame() {
        this.startGame();
    }

    savePoints() {
        const earnedPoints = Math.floor(this.score / 10);
        if (earnedPoints > 0) {
            this.totalPoints += earnedPoints;
            this.saveUpgrades();
        }
        const highScore = parseInt(localStorage.getItem('tankbattalion_highscore') || '0');
        if (this.score > highScore) {
            localStorage.setItem('tankbattalion_highscore', this.score.toString());
        }
    }

    returnToMenu() {
        this.savePoints();
        this.scene.exit();
        this.scene = this.scenes.menu;
        this.scene.enter();
        this.hud.clear();
        this.hud.hide();
    }

    returnToShop() {
        this.scene.exit();
        this.scene = this.scenes.shop;
        this.scene.enter();
        this.hud.clear();
        this.hud.hide();
    }

    endGame(victory) {
        this.isVictory = victory;

        if (victory && this.selectedMode === 'story') {
            if (this.currentStage >= this.storyProgress) {
                this.storyProgress = Math.min(this.currentStage + 1, CONFIG.GAME_MODES.story.stages.length - 1);
                localStorage.setItem('tankbattalion_story_progress', this.storyProgress.toString());
            }
        }

        this.savePoints();

        this.scene.exit();
        this.scene = this.scenes.gameover;
        this.scene.enter();
        this.hud.clear();
        this.hud.hide();
    }

    reset() {
        this.player = new Player(this.selectedShip, this.upgrades);
        this.bullets = [];
        this.enemies = [];
        this.powerups = [];
        this.boss = null;
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;
        this.enemiesKilled = 0;
        this.bossDefeated = false;
        this.isVictory = false;
        this.isBossFight = false;
        this.bossAlertTimer = 0;
        this.gameTime = 0;
        this.particles.clear();
        this.spawner.reset();
        this.stageComplete = false;

        if (this.selectedMode === 'story') {
            const startStage = this.selectedStage !== undefined ? this.selectedStage : this.storyProgress;
            this.currentStage = startStage;
            const stages = CONFIG.GAME_MODES.story.stages;
            if (stages[startStage]) {
                this.spawnMult = stages[startStage].spawnMult;
                this.isTutorial = stages[startStage].tutorial;
            }
        } else {
            this.spawnMult = 1;
            this.isTutorial = false;
            this.currentStage = 0;
        }

        this.stageTimer = 0;
        this.popupTexts = [];
        this._gameOverTriggered = false;

        Input.reset();
    }

    update(dt) {
        this.gameTime += dt;

        if (this.bossAlertTimer > 0) {
            this.bossAlertTimer -= dt;
            if (this.bossAlertTimer <= 0 && this.boss && this.boss.active) {
                this.hud.showBossBar(this.boss);
            }
        }

        if (this.isBossFight && this.boss && this.boss.active) {
            this.hud.showBossBar(this.boss);
        } else if (this.isBossFight && this.boss && !this.boss.active) {
            this.bossDefeated = true;
            this.isBossFight = false;
            this.hud.hideBossBar();
            this.boss = null;

            if (this.selectedMode === 'story') {
                this.advanceStage();
            }
        }

        this.updateCombo(dt);
        this.updateShake(dt);
        this.updateScreenFlash(dt);

        this.battlefield.update(dt);

        if (!this.isBossFight) {
            this.spawner.update(dt, this);
        }

        this.player && this.player.update(dt, this);

        for (let i = 0; i < this.bullets.length; i++) {
            this.bullets[i].update(dt, this);
        }
        this._compactArray(this.bullets);

        if (this.bullets.length > 400) {
            let removed = 0;
            const excess = this.bullets.length - 400;
            for (let i = 0; i < this.bullets.length && removed < excess; i++) {
                if (!this.bullets[i].fromPlayer) {
                    this.bullets[i].active = false;
                    removed++;
                }
            }
            this._compactArray(this.bullets);
        }

        for (let i = 0; i < this.enemies.length; i++) {
            this.enemies[i].update(dt, this);
        }
        this._compactArray(this.enemies);

        if (this.boss && this.boss.active) {
            this.boss.update(dt, this);
        }

        for (let i = 0; i < this.powerups.length; i++) {
            this.powerups[i].update(dt, this);
        }
        this._compactArray(this.powerups);

        const powerupCap = CONFIG.GAME.powerupCap || 20;
        if (this.powerups.length > powerupCap) {
            this.powerups.splice(0, this.powerups.length - powerupCap);
        }

        this.particles.update(dt);

        this.updatePopupTexts(dt);

        this.collisionSystem.checkAll(this);

        if (this.player && !this.player.active && !this._gameOverTriggered) {
            this._gameOverTriggered = true;
            setTimeout(() => {
                if (this._gameOverTriggered) {
                    this.endGame(false);
                }
            }, 1500);
        }

        if (this.player && this.player.active) {
            this.hud.update(this);

            if (this.player.energy >= this.player.energyMax && !this.player.skillReadyTriggered) {
                this.player.skillReadyTriggered = true;
                this.hud.showSkillReadyPrompt();
            }

            if (this.player.energy < this.player.energyMax && this.player.skillReadyTriggered) {
                this.player.skillReadyTriggered = false;
                this.hud.hideSkillReadyPrompt();
            }
        }

        if (this.selectedMode === 'story' && !this.stageComplete) {
            const stages = CONFIG.GAME_MODES.story.stages;
            const currentStageConfig = stages[this.currentStage];
            if (currentStageConfig) {
                this.stageTimer += dt;
                if (currentStageConfig.hasBoss && this.stageTimer >= currentStageConfig.bossTime && !this.isBossFight) {
                    this.triggerBossFight();
                }
                if (!currentStageConfig.hasBoss && this.stageTimer >= currentStageConfig.duration) {
                    this.advanceStage();
                }
            }
        } else if (this.selectedMode === 'endless' && !this.stageComplete) {
            this.stageTimer += dt;
            if (this.stageTimer > 30 && !this.isBossFight) {
                if (Math.random() < 0.3) {
                    this.triggerBossFight();
                }
                this.stageTimer = 0;
            }
            if (this.gameTime > 0 && this.gameTime % 45 < dt && !this.isBossFight) {
                this.spawnMult = Math.min(this.spawnMult + 0.1, 3.0);
            }
        }
    }

    triggerBossFight() {
        if (this.isBossFight) return;
        this.bossAlertTimer = 2;
    }

    _compactArray(arr) {
        let writeIdx = 0;
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].active) {
                arr[writeIdx++] = arr[i];
            }
        }
        arr.length = writeIdx;
    }

    updateCombo(dt) {
        if (this.combo > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }
    }

    updateShake(dt) {
        if (this.shakeIntensity > 0) {
            this.shakeIntensity -= dt * 3;
            if (this.shakeIntensity < 0) this.shakeIntensity = 0;
        }
    }

    updateScreenFlash(dt) {
        if (this.screenFlash > 0) {
            this.screenFlash -= dt * 4;
            if (this.screenFlash < 0) this.screenFlash = 0;
        }
    }

    shake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    addHitStop() {
        this.hitStopTimer = CONFIG.GAME.hitStopDuration;
    }

    onEnemyKilled(enemy) {
        this.enemiesKilled++;

        this.combo++;
        this.comboTimer = CONFIG.GAME.maxComboTime;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        const multiplier = (1 + Math.min(this.combo / 20, 4)) * (this.player ? this.player.getScoreMultiplier() : 1);
        const points = Math.floor(enemy.score * multiplier);
        this.score += points;

        if (this.combo > 5 && this.combo % 5 === 0) {
            Audio.playCombo(Math.floor(this.combo / 5));
        }

        if (this.player && this.player.active) {
            this.player.addEnergy(3 + (enemy.width > 40 ? 5 : 0));
        }
    }

    addScore(amount) {
        this.score += amount;
    }

    addPopupText(text, x, y, color) {
        if (this.popupTexts.length > 40) {
            this.popupTexts.shift();
        }
        const vy = -60;
        this.popupTexts.push({
            text: text,
            x: x,
            y: y,
            vy: vy,
            life: 1.0,
            maxLife: 1.0,
            color: color || '#ffcc00',
            age: 0,
            isDamage: text.startsWith('-') && this.damageNumbersEnabled
        });
    }

    updatePopupTexts(dt) {
        let writeIdx = 0;
        for (let i = 0; i < this.popupTexts.length; i++) {
            const p = this.popupTexts[i];
            p.age += dt;
            p.y += p.vy * dt;
            p.vy -= 30 * dt;
            if (p.age < p.life) {
                this.popupTexts[writeIdx++] = p;
            }
        }
        this.popupTexts.length = writeIdx;
    }

    drawPopupTexts(ctx) {
        ctx.save();
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < this.popupTexts.length; i++) {
            const p = this.popupTexts[i];
            if (p.isDamage && !this.damageNumbersEnabled) continue;
            const t = p.age / p.life;
            const alpha = 1 - t;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    draw(ctx) {
        ctx.save();

        if (this.shakeIntensity > 0) {
            const sx = Utils.random(-1, 1) * this.shakeIntensity * 15;
            const sy = Utils.random(-1, 1) * this.shakeIntensity * 15;
            ctx.translate(sx, sy);
        }

        this.battlefield.draw(ctx);

        for (const powerup of this.powerups) {
            powerup.draw(ctx);
        }

        for (const enemy of this.enemies) {
            enemy.draw(ctx);
        }

        if (this.boss && this.boss.active) {
            this.boss.draw(ctx);
        }

        for (const bullet of this.bullets) {
            bullet.draw(ctx);
        }

        if (this.player) {
            this.player.draw(ctx);
        }

        this.particles.draw(ctx);

        this.drawPopupTexts(ctx);

        if (this.screenFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 200, ${this.screenFlash * 0.5})`;
            ctx.fillRect(0, 0, CONFIG.CANVAS.width, CONFIG.CANVAS.height);
        }

        if (this.boss && this.boss.active && this.boss.state === 'entering') {
            this.drawBossWarning(ctx);
        }

        if (this.player && this.player.hp / this.player.maxHp < 0.3) {
            this.drawDamageVignette(ctx);
        }

        ctx.restore();
    }

    drawBossWarning(ctx) {
        const t = Date.now() / 200;
        const alpha = 0.3 + Math.sin(t) * 0.2;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 50, 0, ${alpha})`;
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, CONFIG.CANVAS.width - 20, CONFIG.CANVAS.height - 20);
        ctx.restore();
    }

    drawDamageVignette(ctx) {
        if (!this.player) return;
        const hpRatio = this.player.hp / this.player.maxHp;
        const intensity = 1 - hpRatio;
        const t = Date.now() / (150 - intensity * 80);
        const pulse = 0.15 + Math.sin(t) * 0.1 + intensity * 0.15;

        ctx.save();

        const gradient = ctx.createRadialGradient(
            CONFIG.CANVAS.width / 2, CONFIG.CANVAS.height / 2, CONFIG.CANVAS.width * 0.2,
            CONFIG.CANVAS.width / 2, CONFIG.CANVAS.height / 2, CONFIG.CANVAS.width * 0.7
        );
        gradient.addColorStop(0, 'rgba(255, 50, 0, 0)');
        gradient.addColorStop(0.7, `rgba(255, 50, 0, ${pulse * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 50, 0, ${pulse})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS.width, CONFIG.CANVAS.height);

        ctx.strokeStyle = `rgba(255, 80, 30, ${0.4 + intensity * 0.3})`;
        ctx.lineWidth = 4 + intensity * 8;
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 20 + intensity * 30;
        ctx.strokeRect(8, 8, CONFIG.CANVAS.width - 16, CONFIG.CANVAS.height - 16);

        ctx.restore();
    }

    start() {
        this.lastTime = performance.now();
        let errorStreak = 0;
        let lastErrorMsg = '';
        const loop = (timestamp) => {
            try {
                let resized = false;
                if (this._needsResize) {
                    this._needsResize = false;
                    this.resize();
                    resized = true;
                }

                let dt = (timestamp - this.lastTime) / 1000;
                this.lastTime = timestamp;
                dt = Math.min(dt, 0.05);

                if (this.hitStopTimer > 0) {
                    this.hitStopTimer -= dt;
                    if (!(this.scene.paused) || resized) {
                        this.scene.draw(this.ctx);
                    }
                    errorStreak = 0;
                    requestAnimationFrame(loop);
                    return;
                }

                if (this.scene.isPlaying) {
                    this.scene.update(dt);
                }

                if (!(this.scene.paused) || resized) {
                    this.scene.draw(this.ctx);
                }

                errorStreak = 0;
            } catch (err) {
                const msg = String(err && err.message ? err.message : err);
                if (msg !== lastErrorMsg || errorStreak === 0) {
                    console.warn('[Game loop] caught error:', err);
                    lastErrorMsg = msg;
                }
                errorStreak++;
                if (errorStreak > 60) {
                    try {
                        this.scene.exit && this.scene.exit();
                    } catch (_) {}
                    try {
                        this.hud.hide();
                        this.reset();
                        this.scene = this.scenes.menu;
                        this.scene.enter();
                    } catch (_) {}
                    errorStreak = 0;
                }
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
};

window.addEventListener('load', () => {
    const canvas = document.getElementById('game-canvas');
    Input.init(canvas);
    Audio.init();
    const game = new Game(canvas);
    game.start();
    window.game = game;
});
