// ====== Core Game Engine ======
// Manages game loop, scene transitions, level loading, collision, and objectives

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastTime = 0;
        this.hitStopTimer = 0;
        this.shakeIntensity = 0;

        // Game state
        this.maze = null;
        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.particles = new ParticleSystem();
        this.items = [];
        this.exitPos = null;
        this.exitActive = false;

        this.currentLevel = 0;
        this.selectedLevel = 0;
        this.unlockedLevel = parseInt(localStorage.getItem('tankmaze_unlocked') || '0');
        this.totalScore = parseInt(localStorage.getItem('tankmaze_totalscore') || '0');

        this.score = 0;
        this.enemiesKilled = 0;
        this.gameTime = 0;
        this.objectiveType = 'destroy';
        this.itemsCollected = 0;
        this.itemCount = 0;

        this._gameOverTriggered = false;
        this._victoryTriggered = false;

        // ====== Endless Mode ======
        this.endlessMode = false;
        this.endlessWave = 0;        // current wave number (1, 2, 3, ...) in endless mode
        this.endlessHighScore = parseInt(localStorage.getItem('tankmaze_endless_highscore') || '0');

        // HUD
        this.hud = new HUD(document.getElementById('hud-overlay'));
        this.hud.bindPauseCallback(() => this.togglePause());
        this.hud.hide();

        // Scenes
        this.scenes = {
            menu: new MenuScene(this),
            game: new GameScene(this),
            gameover: new GameOverScene(this),
            victory: new VictoryScene(this),
        };

        this.scene = this.scenes.menu;
        this.scene.enter();
    }

    // ====== Level Management ======
    startGame() {
        // Reset to normal campaign mode
        this.endlessMode = false;
        this.endlessWave = 0;
        this.currentLevel = this.selectedLevel;
        const cfg = CONFIG.LEVELS[this.currentLevel];
        this._loadLevelFromConfig(cfg);
        this.scene.exit();
        this.scene = this.scenes.game;
        this.scene.enter();
        this.hud.show();
    }

    startEndlessGame() {
        this.endlessMode = true;
        this.endlessWave = 1;
        this.score = 0; // fresh score accumulator for endless run
        // Reset HP carry-over: a brand-new run starts at full HP (no carry yet)
        this._endlessPrevHp = undefined;
        const cfg = CONFIG.generateEndlessLevel(this.endlessWave);
        this._loadLevelFromConfig(cfg);
        // After first level loads, capture initial HP as the "previous HP" baseline
        // (Actually for wave 1, player is created at maxHp; we'll snapshot after this load
        //  so wave 2 can carry it over.)
        this.scene.exit();
        this.scene = this.scenes.game;
        this.scene.enter();
        this.hud.show();
    }

    nextLevel() {
        if (this.endlessMode) {
            // ====== HP SNAPSHOT before unloading the current wave ======
            // When a wave ends in victory → nextLevel is called (via endGame victory path).
            // Snapshot the player's current HP so _loadLevelFromConfig can carry it over
            // (with a healing bonus) to the new wave's fresh PlayerTank instance.
            if (this.player && this.player.active) {
                this._endlessPrevHp = Math.floor(this.player.hp);
            } else {
                this._endlessPrevHp = undefined;
            }
            // Carry score forward in endless mode, load next generated wave
            this.endlessWave++;
            const cfg = CONFIG.generateEndlessLevel(this.endlessWave);
            this._loadLevelFromConfig(cfg);
            this.scene.exit();
            this.scene = this.scenes.game;
            this.scene.enter();
            this.hud.show();
            return;
        }
        this.currentLevel++;
        if (this.currentLevel >= CONFIG.LEVELS.length) {
            this.returnToMenu();
            return;
        }
        this.selectedLevel = this.currentLevel;
        this.loadLevel(this.currentLevel);
        this.scene.exit();
        this.scene = this.scenes.game;
        this.scene.enter();
        this.hud.show();
    }

    loadLevel(levelIndex) {
        const levelConfig = CONFIG.LEVELS[levelIndex];
        if (!levelConfig) return;
        this._loadLevelFromConfig(levelConfig);
    }

    // ====== Resource Cleanup: explicitly release data from the PREVIOUS level ======
    // Breaks circular references, nulls large arrays, releases offscreen canvases.
    // Critical to prevent memory leaks during endless mode's continuous level transitions.
    _disposePreviousLevel() {
        // 1) Dispose maze: release offscreen canvas + large arrays explicitly
        if (this.maze) {
            // Release offscreen static render canvas (critical - canvas elements hold pixel buffers)
            if (this.maze.staticCanvas) {
                // Setting width/height to 0 releases the underlying pixel buffer in most browsers
                try { this.maze.staticCanvas.width = 1; this.maze.staticCanvas.height = 1; } catch (_) {}
                // Null the context reference as well
                this.maze.staticCanvas = null;
            }
            // Drop wall/floor variation caches (2D arrays of size rows×cols)
            if (this.maze.wallVariations) this.maze.wallVariations.length = 0;
            if (this.maze.floorVariations) this.maze.floorVariations.length = 0;
            if (this.maze.floorTiles) this.maze.floorTiles.length = 0;
            if (this.maze.grid) this.maze.grid.length = 0;
            this.maze.wallVariations = null;
            this.maze.floorVariations = null;
            this.maze.floorTiles = null;
            this.maze.grid = null;
            this.maze.config = null;
            this.maze = null;
        }

        // 2) Dispose enemies: null references to internal caches (path, history)
        if (this.enemies) {
            for (const e of this.enemies) {
                if (!e) continue;
                if (e._posHistory) e._posHistory.length = 0;
                e._posHistory = null;
                if (e.path) e.path.length = 0;
                e.path = null;
                e.typeConfig = null;
                e.active = false;
            }
            this.enemies.length = 0;
            this.enemies = null;
        }

        // 3) Dispose bullets (should already be compacted; ensure length=0 release)
        if (this.bullets) {
            this.bullets.length = 0;
            this.bullets = null;
        }

        // 4) Dispose items (small but break reference)
        if (this.items) {
            this.items.length = 0;
            this.items = null;
        }

        // 5) Dispose player: release pos history
        if (this.player) {
            if (this.player._posHistory) this.player._posHistory.length = 0;
            this.player._posHistory = null;
            this.player.typeConfig = null;
            this.player.active = false;
            this.player = null;
        }

        // 6) Clear particles (system instance is reused; just empty its array)
        if (this.particles) this.particles.clear();

        // 7) Misc references
        this.exitPos = null;
    }

    // Internal: load any level config object (from CONFIG.LEVELS or runtime-generated for endless)
    _loadLevelFromConfig(levelConfig) {
        if (!levelConfig) return;

        // ====== CRITICAL: dispose previous level BEFORE allocating new ones ======
        // In endless mode levels are generated continuously; skipping disposal caused
        // maze pixel buffers and enemy path cache arrays to leak across waves.
        this._disposePreviousLevel();

        // Reset state (re-initialize containers after dispose nulled them out)
        this.bullets = [];
        this.enemies = [];
        this.items = [];
        if (!this.particles) this.particles = new ParticleSystem();
        this.particles.clear();

        // Score: for endless, keep cumulative; for campaign reset per-level
        if (!this.endlessMode) {
            this.score = 0;
        }
        this.enemiesKilled = 0;
        this.gameTime = 0;
        this._gameOverTriggered = false;
        this._victoryTriggered = false;
        this.objectiveType = levelConfig.objective || 'destroy';
        this.itemsCollected = 0;
        this.exitActive = false;

        // Create maze
        this.maze = new Maze(levelConfig);

        // Place player
        const playerStart = levelConfig.playerStart || { col: 1, row: 1 };
        const startPx = Utils.tileCenter(playerStart.col, playerStart.row);
        this.player = new PlayerTank(
            startPx.x - CONFIG.PLAYER.width / 2,
            startPx.y - CONFIG.PLAYER.height / 2
        );

        // ====== Place enemies with anti-overlap to prevent spawn-time twitching ======
        const enemyTypes = levelConfig.enemies || {};
        const playerTile = playerStart;

        // Track tiles where we've already placed an enemy to guarantee unique spawn positions
        const usedSpawnKeys = new Set();
        // Add a small "no-spawn halo" radius around used spawns (in tile units)
        const MIN_ENEMY_SPAWN_TILE_DIST = 2;

        // Per-wave enemy stat multiplier for endless mode (applied per-tank, no global mutation)
        const mul = levelConfig.endlessMul;

        for (const typeKey in enemyTypes) {
            const count = enemyTypes[typeKey];
            if (!count || count <= 0) continue;
            let applyCfg = CONFIG.ENEMY_TYPES[typeKey];
            if (!applyCfg) continue;

            // Shallow clone + endless stat scaling (only if endless mul present)
            if (mul) {
                applyCfg = {
                    ...applyCfg,
                    hp: Math.round(applyCfg.hp * mul.hp),
                    speed: applyCfg.speed * mul.speed,
                    bulletDamage: Math.round(applyCfg.bulletDamage * mul.damage),
                    fireRate: applyCfg.fireRate * mul.fireRate,
                    _scaled: true,
                };
            }

            for (let i = 0; i < count; i++) {
                const minDistFromPlayer = applyCfg.isBoss ? 12 : 8;
                let tile = null;
                // Try up to 40 times to find a unique unused spawn tile
                for (let attempt = 0; attempt < 40; attempt++) {
                    const candidate = this.maze.findFloorTileAwayFrom(playerTile.col, playerTile.row, minDistFromPlayer);
                    if (!candidate) break;
                    const candKey = candidate.col + ',' + candidate.row;
                    if (usedSpawnKeys.has(candKey)) continue;
                    // Also reject tiles too close to any used spawn (halo)
                    let tooClose = false;
                    for (const k of usedSpawnKeys) {
                        const [cc, cr] = k.split(',').map(Number);
                        if (Math.abs(cc - candidate.col) + Math.abs(cr - candidate.row) < MIN_ENEMY_SPAWN_TILE_DIST) {
                            tooClose = true;
                            break;
                        }
                    }
                    if (tooClose) continue;
                    tile = candidate;
                    usedSpawnKeys.add(candKey);
                    break;
                }
                // Fallback: even if it's close, accept so the enemy count is not shortchanged
                if (!tile) {
                    tile = this.maze.findFloorTileAwayFrom(playerTile.col, playerTile.row, Math.max(4, minDistFromPlayer - 4));
                }
                if (tile) {
                    const px = Utils.tileCenter(tile.col, tile.row);
                    // Pass `this.maze` as 5th arg so EnemyTank constructor can:
                    //   - snap to tile center BEFORE any movement,
                    //   - pick a valid (non-wall) initial patrol direction,
                    //   - seed position history (eliminates spawn-time false-positives).
                    this.enemies.push(new EnemyTank(
                        px.x - applyCfg.width / 2,
                        px.y - applyCfg.height / 2,
                        typeKey,
                        applyCfg,
                        this.maze
                    ));
                }
            }
        }

        // Set up items and exit for collect objective
        this.items = [];
        this.exitPos = null;
        if (levelConfig.objective === 'collect') {
            this.itemCount = levelConfig.itemCount || 3;
            for (let i = 0; i < this.itemCount; i++) {
                const tile = this.maze.findFloorTileAwayFrom(playerTile.col, playerTile.row, 6);
                if (tile) {
                    this.items.push({ col: tile.col, row: tile.row, collected: false });
                }
            }
            // Exit placement:
            //  - If level config explicitly sets exitPos (campaign levels), honor it.
            //  - Otherwise (endless collect waves), pick the floor tile FARTHEST from player
            //    so reaching the exit feels like a journey instead of a trivial step.
            if (levelConfig.exitPos) {
                this.exitPos = { col: levelConfig.exitPos.col, row: levelConfig.exitPos.row };
            } else if (this.maze && this.maze.floorTiles && this.maze.floorTiles.length > 0) {
                let best = this.maze.floorTiles[0];
                let bestDist = -1;
                const pc = playerTile.col, pr = playerTile.row;
                const fts = this.maze.floorTiles;
                for (let i = 0; i < fts.length; i++) {
                    const t = fts[i];
                    const d = Math.abs(t.col - pc) + Math.abs(t.row - pr);
                    if (d > bestDist) {
                        bestDist = d;
                        best = t;
                    }
                }
                this.exitPos = { col: best.col, row: best.row };
            }
        }

        // ====== Endless mode: CARRY-OVER REWARDS between waves ======
        // - Keep a fraction of the player's HP instead of fully resetting (reward survival)
        // - Small HP bonus per wave cleared (capped at maxHp) so the player can recover
        //   from a near-death scrape on the previous wave.
        if (this.endlessMode && this._endlessPrevHp !== undefined && this.player) {
            // Carry over: previous HP (clamped) + 20 flat bonus + small maxHp percentage
            const maxHp = this.player.maxHp;
            const carry = Math.max(10, Math.min(maxHp, this._endlessPrevHp));
            const bonus = 20 + Math.floor(maxHp * 0.1);
            let newHp = carry + bonus;
            // Boss-wave-clear bonus: extra heal
            if (levelConfig.isBossLevel === false && this.endlessWave > 1 && (this.endlessWave - 1) % 5 === 0) {
                newHp += Math.floor(maxHp * 0.15);
            }
            this.player.hp = Math.min(maxHp, Math.floor(newHp));
        }
        // Remember HP for next wave's carry-over (updated after load, not before)
        // (We'll capture HP snapshot in endGame → nextLevel flow; here we just ensure property exists)

        Input.reset();
    }

    // ====== Pause ======
    togglePause() {
        const scene = this.scene;
        if (!scene.isPlaying) return;
        scene.paused = !scene.paused;
        if (scene.pauseOverlay) {
            scene.pauseOverlay.style.display = scene.paused ? 'flex' : 'none';
        }
        Audio.playClick();
    }

    // ====== Scene Transitions ======
    returnToMenu() {
        // Release any lingering level data before returning to menu
        // (prevents memory leak if user quits mid-game / mid-endless-run)
        this._disposePreviousLevel();
        // Ensure arrays are non-null so menu HUD callbacks don't NPE
        this.bullets = [];
        this.enemies = [];
        this.items = [];
        this.scene.exit();
        this.scene = this.scenes.menu;
        this.scene.enter();
        this.hud.hide();
    }

    endGame(victory) {
        if (this.endlessMode) {
            // Endless mode: save high score on both victory (cleared wave → continue next)
            // and game over. On victory the high score may already be recorded before nextLevel.
            if (this.score > this.endlessHighScore) {
                this.endlessHighScore = this.score;
                localStorage.setItem('tankmaze_endless_highscore', this.endlessHighScore.toString());
            }
            if (victory) {
                // Endless: never exit to victory scene; just load next wave seamlessly via nextLevel
                // (caller will have invoked endGame(true) via victory check; we return before scene switch).
                this.nextLevel();
                return;
            } else {
                this.scene.exit();
                this.scene = this.scenes.gameover;
                this.scene.enter();
            }
        } else {
            if (victory) {
                if (this.currentLevel + 1 > this.unlockedLevel && this.currentLevel + 1 < CONFIG.LEVELS.length) {
                    this.unlockedLevel = this.currentLevel + 1;
                    localStorage.setItem('tankmaze_unlocked', this.unlockedLevel.toString());
                }
                // Also accumulate score into total score (campaign-only)
                this.totalScore += this.score;
                localStorage.setItem('tankmaze_totalscore', this.totalScore.toString());
                this.scene.exit();
                this.scene = this.scenes.victory;
                this.scene.enter();
            } else {
                this.scene.exit();
                this.scene = this.scenes.gameover;
                this.scene.enter();
            }
        }
        this.hud.hide();
    }

    // ====== Effects ======
    shake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    // ====== Main Update ======
    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            return;
        }

        this.gameTime += dt;

        // Update shake
        if (this.shakeIntensity > 0) {
            this.shakeIntensity -= dt * 3;
            if (this.shakeIntensity < 0) this.shakeIntensity = 0;
        }

        if (!this.maze) return;
        // Guard: level-load / dispose transition frames may temporarily null these
        if (!this.enemies || !this.bullets || !this.items) return;

        // Update player
        if (this.player && this.player.active) {
            this.player.update(dt, this.maze, this);
        }

        // Update enemies
        const enemies = this.enemies;
        const enemyCount = enemies.length;
        for (let i = 0; i < enemyCount; i++) {
            const enemy = enemies[i];
            if (enemy && enemy.active) {
                enemy.update(dt, this.maze, this);
            }
        }

        // Tank separation (prevent overlapping)
        for (let i = 0; i < enemyCount; i++) {
            const e1 = enemies[i];
            if (!e1 || !e1.active) continue;
            // Separate from player
            if (this.player && this.player.active && e1.collidesWithTank(this.player)) {
                e1.separateFrom(this.player);
            }
            // Separate from other enemies
            for (let j = i + 1; j < enemyCount; j++) {
                const e2 = enemies[j];
                if (!e2 || !e2.active) continue;
                if (e1.collidesWithTank(e2)) {
                    e1.separateFrom(e2);
                }
            }
        }

        // Update bullets
        const bullets = this.bullets;
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            if (b && b.active) b.update(dt, this.maze, this);
        }
        this._compactArray(bullets);

        // Bullet cap
        const bulletCap = CONFIG.GAME.enemyBulletCap;
        let enemyBulletCount = 0;
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            if (b && !b.fromPlayer) enemyBulletCount++;
        }
        if (enemyBulletCount > bulletCap) {
            let toRemove = enemyBulletCount - bulletCap;
            for (let i = 0; i < bullets.length && toRemove > 0; i++) {
                const b = bullets[i];
                if (b && !b.fromPlayer) {
                    b.active = false;
                    toRemove--;
                }
            }
            this._compactArray(bullets);
        }

        // Update particles
        if (this.particles) this.particles.update(dt);

        // ====== Collision Detection ======
        this.checkCollisions();

        // ====== Item Collection ======
        this.checkItemCollection();

        // ====== Objective Checking ======
        this.checkObjectives();

        // ====== Game Over Check ======
        if (this.player && !this.player.active && !this._gameOverTriggered) {
            this._gameOverTriggered = true;
            setTimeout(() => {
                if (this._gameOverTriggered) {
                    this.endGame(false);
                }
            }, 1200);
        }

        // ====== HUD Update ======
        if (this.player && this.player.active) {
            this.hud.update(this);
        }
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

    // ====== Collision Detection ======
    checkCollisions() {
        if (!this.player || !this.enemies || !this.bullets) return;

        const bullets = this.bullets;
        const enemies = this.enemies;
        for (let bi = 0; bi < bullets.length; bi++) {
            const bullet = bullets[bi];
            if (!bullet || !bullet.active) continue;

            if (bullet.fromPlayer) {
                // Player bullets vs enemies
                for (let ei = 0; ei < enemies.length; ei++) {
                    const enemy = enemies[ei];
                    if (!enemy || !enemy.active) continue;
                    if (Utils.aabb(bullet.getBounds(), enemy.getBounds())) {
                        enemy.takeDamage(bullet.damage, this);
                        this.particles.emitHit(bullet.x, bullet.y, bullet.color);
                        bullet.active = false;

                        if (!enemy.active) {
                            // Enemy destroyed
                            this.onEnemyKilled(enemy);
                        }
                        break;
                    }
                }
            } else {
                // Enemy bullets vs player
                if (this.player.active && Utils.aabb(bullet.getBounds(), this.player.getBounds())) {
                    this.player.takeDamage(bullet.damage, this);
                    this.particles.emitHit(bullet.x, bullet.y, bullet.color);
                    bullet.active = false;
                }
            }
        }
    }

    onEnemyKilled(enemy) {
        this.enemiesKilled++;
        this.score += enemy.score;
        this.particles.emitExplosion(enemy.cx, enemy.cy, enemy.isBoss ? 2.5 : 1);
    }

    // ====== Item Collection ======
    checkItemCollection() {
        if (!this.player || !this.player.active) return;
        if (this.objectiveType !== 'collect') return;
        if (!this.items || this.items.length === 0) return;

        const playerTile = Utils.pixelToTile(this.player.cx, this.player.cy);

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (!item || item.collected) continue;
            if (item.col === playerTile.col && item.row === playerTile.row) {
                item.collected = true;
                this.itemsCollected++;
                this.score += 200;
                Audio.playPickup();
                this.particles.emit(item.col * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                                    item.row * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                                    12, {
                    color: '#ffcc00',
                    speedMin: 60, speedMax: 180,
                    lifeMin: 0.3, lifeMax: 0.6,
                    sizeMin: 2, sizeMax: 4,
                    type: 'spark'
                });

                if (this.itemsCollected >= this.itemCount) {
                    this.exitActive = true;
                    if (this.scene.showObjectiveBanner) {
                        this.scene.showObjectiveBanner('补给已收集! 前往出口');
                    }
                }
            }
        }
    }

    // ====== Objective Checking ======
    checkObjectives() {
        if (this._victoryTriggered) return;
        if (!this.enemies) return;

        if (this.objectiveType === 'destroy') {
            // Check if all enemies are destroyed
            let remaining = 0;
            for (let i = 0; i < this.enemies.length; i++) {
                const e = this.enemies[i];
                if (e && e.active) remaining++;
            }
            if (remaining === 0) {
                this._victoryTriggered = true;
                setTimeout(() => {
                    if (this._victoryTriggered) {
                        this.endGame(true);
                    }
                }, 800);
            }
        } else if (this.objectiveType === 'collect') {
            // Check if player reached exit after collecting all items
            if (this.exitActive && this.exitPos && this.player && this.player.active) {
                const playerTile = Utils.pixelToTile(this.player.cx, this.player.cy);
                if (playerTile.col === this.exitPos.col && playerTile.row === this.exitPos.row) {
                    this._victoryTriggered = true;
                    this.score += 500; // Exit bonus
                    setTimeout(() => {
                        if (this._victoryTriggered) {
                            this.endGame(true);
                        }
                    }, 500);
                }
            }
        }
    }

    // ====== Rendering ======
    draw(ctx) {
        ctx.save();

        // Screen shake
        if (this.shakeIntensity > 0) {
            const sx = Utils.random(-1, 1) * this.shakeIntensity * 12;
            const sy = Utils.random(-1, 1) * this.shakeIntensity * 12;
            ctx.translate(sx, sy);
        }

        // Background
        ctx.fillStyle = '#0a0a08';
        ctx.fillRect(0, 0, CONFIG.CANVAS.width, CONFIG.CANVAS.height);

        if (!this.maze) {
            ctx.restore();
            return;
        }

        // Draw maze
        this.maze.draw(ctx);

        // Draw exit
        if (this.exitPos) {
            if (this.objectiveType === 'collect' && !this.exitActive) {
                // Draw locked exit (dim)
                const ts = CONFIG.TILE_SIZE;
                const cx = this.exitPos.col * ts + ts / 2;
                const cy = this.exitPos.row * ts + ts / 2;
                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = '#555';
                ctx.fillRect(cx - 12, cy - 12, 24, 24);
                ctx.restore();
            } else {
                this.maze.drawExit(ctx, this.exitPos.col, this.exitPos.row, this.gameTime);
            }
        }

        // Draw items
        if (this.items) {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (item && !item.collected) {
                    this.maze.drawItem(ctx, item.col, item.row, this.gameTime);
                }
            }
        }

        // Draw bullets
        if (this.bullets) {
            for (let i = 0; i < this.bullets.length; i++) {
                const b = this.bullets[i];
                if (b) b.draw(ctx);
            }
        }

        // Draw enemies
        if (this.enemies) {
            for (let i = 0; i < this.enemies.length; i++) {
                const e = this.enemies[i];
                if (e && e.active) {
                    e.draw(ctx);
                }
            }
        }

        // Draw player
        if (this.player) {
            this.player.draw(ctx);
        }

        // Draw particles
        if (this.particles) this.particles.draw(ctx);

        // Low HP vignette
        if (this.player && this.player.active && this.player.hp / this.player.maxHp < 0.3) {
            this.drawDamageVignette(ctx);
        }

        ctx.restore();
    }

    drawDamageVignette(ctx) {
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
        ctx.restore();
    }

    // ====== Game Loop ======
    start() {
        this.lastTime = performance.now();
        let errorStreak = 0;

        const loop = (timestamp) => {
            try {
                let dt = (timestamp - this.lastTime) / 1000;
                this.lastTime = timestamp;
                dt = Math.min(dt, 0.05);

                // Always call scene.update() so pause toggle (ESC) works even when paused
                if (this.scene.isPlaying) {
                    this.scene.update(dt);
                }

                if (!(this.scene.paused)) {
                    this.scene.draw(this.ctx);
                }

                // Clear per-frame input state every frame regardless of scene
                Input.endFrame();

                errorStreak = 0;
            } catch (err) {
                console.warn('[Game loop] error:', err);
                errorStreak++;
                if (errorStreak > 30) {
                    try {
                        this.scene.exit && this.scene.exit();
                        this.hud.hide();
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
}

// ====== Bootstrap ======
window.addEventListener('load', () => {
    const canvas = document.getElementById('game-canvas');
    Input.init(canvas);
    Audio.init();
    const game = new Game(canvas);
    game.start();
    window.game = game;
});
