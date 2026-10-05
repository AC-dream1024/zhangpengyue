// ====== Enemy Tank with AI ======
// States: PATROL (random corridor movement) -> CHASE (pathfind to player) -> ATTACK (stop and fire)
// Uses A* pathfinding for chase, line-of-sight for detection

class EnemyTank extends Tank {
    constructor(x, y, typeKey, typeConfig, maze) {
        super(x, y, typeConfig);
        this.typeKey = typeKey;
        this.isPlayer = false;

        // ====== Spawn-time initialization: snap to tile & pick valid initial direction ======
        // Pre-emptively snap to tile center BEFORE anything else to eliminate pixel-level
        // misalignment that caused spawn-time wall-detect false-positives and unstickFromWall jitter.
        if (maze) {
            const tile = Utils.pixelToTile(this.cx, this.cy);
            const center = Utils.tileCenter(tile.col, tile.row);
            this.x = center.x - this.width / 2;
            this.y = center.y - this.height / 2;
            // Initialize lastPatrolTileKey to our exact spawn tile so first-frame
            // tile-crossing logic doesn't falsely fire "arrived at new tile"
            this.lastPatrolTileKey = tile.col + ',' + tile.row;
            // Pick a valid initial patrol direction (one that has an adjacent floor tile)
            // instead of hardcoding "up" which was frequently blocked by walls at spawn.
            const dirs = [
                { x: 0, y: -1, angle: -Math.PI / 2, name: 'up' },
                { x: 1, y: 0, angle: 0, name: 'right' },
                { x: 0, y: 1, angle: Math.PI / 2, name: 'down' },
                { x: -1, y: 0, angle: Math.PI, name: 'left' },
            ];
            const validDirs = dirs.filter(d => !maze.isWall(tile.col + d.x, tile.row + d.y));
            const chosenDir = (validDirs.length > 0 ? Utils.choice(validDirs) : dirs[0]);
            this.patrolDir = { x: chosenDir.x, y: chosenDir.y };
            this.hullAngle = chosenDir.angle;
            this.turretAngle = chosenDir.angle;
            // Seed the position history with our snapped center so isStuck()
            // doesn't see an empty history and produce confusing results.
            for (let i = 0; i < 12; i++) {
                this._posHistory.push({ x: this.x, y: this.y, t: performance.now() - i * 16 });
            }
        } else {
            this.patrolDir = { x: 0, y: -1 };
            this.hullAngle = -Math.PI / 2;
            this.turretAngle = -Math.PI / 2;
            this.lastPatrolTileKey = '';
        }

        // AI state
        this.state = 'patrol';
        this.stateTimer = 0;
        this.alertTimer = 0; // Shows "!" when first spotting player

        // Spawn grace period: skip isStuck / hard recovery / separation push-out during
        // the first seconds to avoid false positives from spawn position settling.
        this.spawnGraceTimer = 2.0; // seconds
        this.dirChangeCooldown = 0.4; // initial cooldown so we don't re-pick direction right away

        // Patrol
        this.patrolTimer = 0;
        this._crossedTileThisFrame = false;
        this._stuckNoMoveAccum = 0;  // Frames-of-stuck-no-move accumulator
        this._dirBlockedAccum = 0;   // Sustained dirBlocked accumulator to filter transient wall-detect false-positives
        this._initialSpawnSettled = !maze; // If maze was given we're pre-snapped; otherwise skip settle logic

        // Chase / pathfinding
        this.path = null;
        this.pathIndex = 0;
        this.pathTimer = 0;
        this.pathRecalcInterval = 0.6;
        this.lastKnownPlayerCol = -1;
        this.lastKnownPlayerRow = -1;

        // Attack
        this.aimTolerance = 0.15; // Radians - how close turret must be to fire

        // Turret smoothing
        this.turretRotSpeed = typeConfig.isBoss ? 4.0 : 2.5;

        // For boss: multi-shot
        this.bossShotCount = 0;
        this.bossShotTimer = 0;

        // Visual: alert indicator
        this.showAlert = false;
    }

    update(dt, maze, game) {
        if (!this.active) return;

        const inGrace = this.spawnGraceTimer > 0;

        // Spawn grace + direction cooldown timers
        if (this.spawnGraceTimer > 0) this.spawnGraceTimer -= dt;
        if (this.dirChangeCooldown > 0) this.dirChangeCooldown -= dt;

        // ====== SPAWN GRACE: freeze movement/state logic to eliminate initial twitching ======
        // During spawn grace, tanks hold their snapped position, maintain initial facing,
        // and do not attempt patrol/chase/attack. Only visual timers (flash, alert) advance.
        if (inGrace) {
            if (this.flashTimer > 0) this.flashTimer -= dt;
            if (this.alertTimer > 0) {
                this.alertTimer -= dt;
            }
            // Keep fireTimer counting down so enemies cannot fire instantly on spawn
            if (this.fireTimer > 0) this.fireTimer -= dt;
            // Ensure treads do not animate during the grace freeze (not moving)
            this.moving = false;
            // Gradually fade in: allow turret to very slowly align toward hull (no movement)
            return;
        }

        // Timers (post-grace)
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.fireTimer > 0) this.fireTimer -= dt;
        if (this.alertTimer > 0) {
            this.alertTimer -= dt;
            this.showAlert = this.alertTimer > 0.5;
        } else {
            this.showAlert = false;
        }
        this.stateTimer += dt;
        this.pathTimer -= dt;

        const player = game.player;

        // ====== Player Detection ======
        let playerVisible = false;
        let playerDist = Infinity;
        if (player && player.active) {
            playerDist = Utils.distance(this.cx, this.cy, player.cx, player.cy);
            if (playerDist <= this.sightRange) {
                playerVisible = Pathfinding.hasLineOfSight(maze, this.cx, this.cy, player.cx, player.cy);
            }
        }

        // Update last known position
        if (playerVisible) {
            const tile = Utils.pixelToTile(player.cx, player.cy);
            this.lastKnownPlayerCol = tile.col;
            this.lastKnownPlayerRow = tile.row;
        }

        // ====== State Machine ======
        this.updateStateMachine(dt, maze, game, player, playerVisible, playerDist);

        // ====== Turret Aiming ======
        this.updateTurret(dt, maze, game, player, playerVisible, playerDist);

        // ====== Firing ======
        this.updateFiring(dt, maze, game, player, playerVisible, playerDist);
    }

    updateStateMachine(dt, maze, game, player, playerVisible, playerDist) {
        const oldState = this.state;

        if (playerVisible && playerDist <= this.range) {
            // In attack range and can see player
            if (this.state !== 'attack') {
                this.state = 'attack';
                this.stateTimer = 0;
                if (oldState === 'patrol') {
                    this.alertTimer = 1.0;
                }
            }
        } else if (playerVisible || (this.lastKnownPlayerCol >= 0 && this.state === 'chase')) {
            // Can see player but too far, or was chasing
            if (this.state !== 'chase') {
                this.state = 'chase';
                this.stateTimer = 0;
                this.pathTimer = 0; // Force path recalc
                if (oldState === 'patrol') {
                    this.alertTimer = 1.0;
                }
            }
            // Give up chase after long time without seeing player
            if (!playerVisible && this.stateTimer > 5.0) {
                this.state = 'patrol';
                this.stateTimer = 0;
                this.lastKnownPlayerCol = -1;
                this.lastKnownPlayerRow = -1;
            }
        } else {
            // No player visible
            if (this.state !== 'patrol') {
                this.state = 'patrol';
                this.stateTimer = 0;
            }
        }

        // Execute state behavior
        switch (this.state) {
            case 'patrol':
                this.updatePatrol(dt, maze);
                break;
            case 'chase':
                this.updateChase(dt, maze, game, player);
                break;
            case 'attack':
                this.updateAttack(dt, maze);
                break;
        }
    }

    // ====== PATROL: wander corridors ======
    // Simplified and robust patrol logic:
    // 1. Move continuously in current patrol direction.
    // 2. When arriving at a NEW tile center, pick a new direction (creates natural turns at intersections).
    // 3. If blocked or stuck for too long, pick a new direction immediately.
    updatePatrol(dt, maze) {
        this.moving = true;

        const myTile = Utils.pixelToTile(this.cx, this.cy);
        const tileCenter = Utils.tileCenter(myTile.col, myTile.row);
        const distToCenter = Math.abs(this.cx - tileCenter.x) + Math.abs(this.cy - tileCenter.y);
        const tileKey = myTile.col + ',' + myTile.row;

        // First-frame init
        if (this.lastPatrolTileKey === '') {
            this.lastPatrolTileKey = tileKey;
        }

        // Move in patrol direction
        const oldX = this.x;
        const oldY = this.y;
        const speed = this.speed * 0.6;
        const dx = this.patrolDir.x * speed * dt;
        const dy = this.patrolDir.y * speed * dt;
        this.move(dx, dy, maze);
        const actuallyMoved = (Math.abs(this.x - oldX) + Math.abs(this.y - oldY)) > 0.3;

        // ====== Direction Change Conditions ======
        // We pick a new direction when ONE of these is true:
        // A) We've just entered a new tile and are close to its center (natural intersection turn)
        // B) We've been stuck (can't move) for too long (blocked recovery)
        // C) The current direction is definitely blocked ahead (wall detected)

        let shouldPickDir = false;
        const inGrace = this.spawnGraceTimer > 0;

        // Condition A: Arrived at new tile center
        const arrivedNewTile = (tileKey !== this.lastPatrolTileKey) && (distToCenter < 6);
        if (arrivedNewTile && this.dirChangeCooldown <= 0) {
            shouldPickDir = true;
        }

        // Condition B: Stuck for too long
        const stuckNoMove = !actuallyMoved && (Math.abs(dx) + Math.abs(dy) > 0.001);
        if (stuckNoMove) {
            this._stuckNoMoveAccum += dt;
        } else {
            this._stuckNoMoveAccum = 0;
        }
        if (!inGrace && this._stuckNoMoveAccum > 0.4 && this.dirChangeCooldown <= 0) {
            shouldPickDir = true;
        }

        // Condition C: Look ahead to see if we're about to hit a wall (preventative turn)
        const lookAhead = this.width / 2 + 10;
        const checkX = this.cx + this.patrolDir.x * lookAhead;
        const checkY = this.cy + this.patrolDir.y * lookAhead;
        const dirBlocked = maze.isWallPixel(checkX, checkY);
        if (dirBlocked && this.dirChangeCooldown <= 0 && !inGrace) {
            // Only pick if we're also not moving (otherwise we're sliding along the wall)
            if (!actuallyMoved) {
                shouldPickDir = true;
            }
        }

        // Handle direction pick
        if (shouldPickDir) {
            // Hard stuck: snap to tile center first to cleanly align, then pick
            const superStuck = !inGrace && this.isStuck(6);
            if (superStuck) {
                this.snapToTileCenter(maze);
                this.pickPatrolDirection(maze, myTile.col, myTile.row, true);
                this.dirChangeCooldown = 0.5;
            } else {
                this.pickPatrolDirection(maze, myTile.col, myTile.row, false);
                this.dirChangeCooldown = 0.3;
            }
            this.lastPatrolTileKey = tileKey;
            this._stuckNoMoveAccum = 0;
        }

        // Update hull facing
        if (this.patrolDir.x > 0) this.hullAngle = 0;
        else if (this.patrolDir.x < 0) this.hullAngle = Math.PI;
        else if (this.patrolDir.y > 0) this.hullAngle = Math.PI / 2;
        else if (this.patrolDir.y < 0) this.hullAngle = -Math.PI / 2;

        this.treadOffset += dt * 20;
    }

    pickPatrolDirection(maze, col, row, forceRandom) {
        const dirs = [
            { x: 0, y: -1, name: 'up' },
            { x: 1, y: 0, name: 'right' },
            { x: 0, y: 1, name: 'down' },
            { x: -1, y: 0, name: 'left' },
        ];

        const available = [];
        for (const d of dirs) {
            if (!maze.isWall(col + d.x, row + d.y)) {
                available.push(d);
            }
        }

        if (available.length === 0) {
            // No floor tile adjacent - fall back to any dir, caller will snap us out later
            this.patrolDir = Utils.choice(dirs);
            return;
        }

        // Don't reverse direction unless it's the only option OR forcing random recovery
        if (forceRandom) {
            this.patrolDir = Utils.choice(available);
            return;
        }
        const reverse = { x: -this.patrolDir.x, y: -this.patrolDir.y };
        const nonReverse = available.filter(d => !(d.x === reverse.x && d.y === reverse.y));

        const choices = nonReverse.length > 0 ? nonReverse : available;
        this.patrolDir = Utils.choice(choices);
    }

    // ====== CHASE: pathfind to player ======
    updateChase(dt, maze, game, player) {
        const inGrace = this.spawnGraceTimer > 0;

        // Detect if stuck and force recovery — but NOT during spawn grace
        if (!inGrace && this.isStuck(6)) {
            this.snapToTileCenter(maze);
            this.path = null;
            this.pathTimer = 0; // Force immediate path recalc after snap
            this.stateTimer = 0; // Reset to prevent immediate re-trigger
            return; // Skip movement this frame after snap to let it settle
        }

        // Recalculate path periodically
        if (this.pathTimer <= 0 || !this.path) {
            this.pathTimer = this.pathRecalcInterval;

            const myTile = Utils.pixelToTile(this.cx, this.cy);
            let targetCol, targetRow;

            if (player && player.active) {
                const playerTile = Utils.pixelToTile(player.cx, player.cy);
                targetCol = playerTile.col;
                targetRow = playerTile.row;
            } else if (this.lastKnownPlayerCol >= 0) {
                targetCol = this.lastKnownPlayerCol;
                targetRow = this.lastKnownPlayerRow;
            } else {
                this.state = 'patrol';
                return;
            }

            this.path = Pathfinding.findPath(maze, myTile.col, myTile.row, targetCol, targetRow);
            this.pathIndex = 0;
        }

        if (!this.path || this.path.length === 0) {
            // No path - fallback to patrol
            this.updatePatrol(dt, maze);
            return;
        }

        // Follow path
        this.moving = true;
        const targetTile = this.path[this.pathIndex];
        if (!targetTile) {
            this.path = null;
            return;
        }

        const target = Utils.tileCenter(targetTile.col, targetTile.row);
        const dx = target.x - this.cx;
        const dy = target.y - this.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 8) {
            // Reached this tile, advance to next
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.path = null;
            }
            return;
        }

        // Move toward target tile center
        const oldX = this.x;
        const oldY = this.y;
        const moveX = (dx / dist) * this.speed * dt;
        const moveY = (dy / dist) * this.speed * dt;
        this.move(moveX, moveY, maze);
        const actuallyMoved = (Math.abs(this.x - oldX) + Math.abs(this.y - oldY)) > 0.3;

        // If we couldn't move toward the target tile center for a while,
        // snap to nearest tile and force path recalc next frame
        if (!actuallyMoved && this.stateTimer > 0.5 && !inGrace) {
            this.snapToTileCenter(maze);
            this.path = null;
            this.pathTimer = 0;
            this.stateTimer = 0;
            return;
        }

        // ====== Smooth Hull Facing ======
        // Use angle-based smoothness instead of hysteresis to make turning fluid.
        const targetAngle = Math.atan2(dy, dx);
        // Convert to hull angle convention: 0=right, PI/2=down, PI=left, -PI/2=up
        // atan2 gives: 0=right, PI/2=down, PI=left, -PI/2=up -> exactly the same!
        // Smoothly interpolate current hullAngle toward targetAngle
        this.hullAngle = Utils.moveAngleToward(this.hullAngle, targetAngle, 8.0 * dt);

        this.treadOffset += dt * 25;
    }

    // ====== ATTACK: stop and fire at player ======
    updateAttack(dt, maze) {
        this.moving = false;

        // If boss, occasionally reposition
        if (this.isBoss && this.stateTimer > 2.0) {
            this.stateTimer = 0;
            // Brief chase to reposition
            this.state = 'chase';
            this.pathTimer = 0;
        }
    }

    // ====== Turret Aiming ======
    updateTurret(dt, maze, game, player, playerVisible, playerDist) {
        let targetAngle;

        if (playerVisible && player && player.active) {
            // Aim at player
            targetAngle = Utils.angleBetween(this.cx, this.cy, player.cx, player.cy);
        } else if (this.moving) {
            // Aim in movement direction
            targetAngle = this.hullAngle;
        } else {
            // Keep current aim
            return;
        }

        // Smooth turret rotation
        this.turretAngle = Utils.moveAngleToward(this.turretAngle, targetAngle, this.turretRotSpeed * dt);
    }

    // ====== Firing ======
    updateFiring(dt, maze, game, player, playerVisible, playerDist) {
        if (!player || !player.active) return;
        if (this.fireTimer > 0) return;

        // Only fire if player is visible and in range
        if (!playerVisible || playerDist > this.range) return;

        // Check if turret is roughly aimed at player
        const angleToPlayer = Utils.angleBetween(this.cx, this.cy, player.cx, player.cy);
        const aimDiff = Math.abs(Utils.angleDifference(this.turretAngle, angleToPlayer));

        if (aimDiff <= this.aimTolerance) {
            if (this.isBoss) {
                this.bossFire(game);
            } else {
                this.fire(game);
            }
            this.fireTimer = this.fireRate;
        }
    }

    // Boss fires a spread of 3 bullets
    bossFire(game) {
        const barrelLen = this.halfW + 8;
        const bx = this.cx + Math.cos(this.turretAngle) * barrelLen;
        const by = this.cy + Math.sin(this.turretAngle) * barrelLen;

        const spread = 0.2;
        for (let i = -1; i <= 1; i++) {
            const angle = this.turretAngle + i * spread;
            game.bullets.push(new Bullet(bx, by, angle, {
                speed: this.bulletSpeed,
                damage: this.bulletDamage,
                fromPlayer: false,
                color: CONFIG.COLORS.enemyBullet,
                size: 5,
                range: this.bulletRange,
            }));
        }

        game.particles.emitMuzzleFlash(bx, by, this.turretAngle, CONFIG.COLORS.enemyBullet);
        Audio.playEnemyShoot();
    }

    // ====== Rendering ======
    draw(ctx) {
        super.draw(ctx);

        // Alert indicator when first spotting player
        if (this.showAlert) {
            ctx.save();
            ctx.translate(this.cx, this.y - 16);
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 18px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 8;
            ctx.fillText('!', 0, 0);
            ctx.restore();
        }

        // Boss gets a special aura
        if (this.isBoss && this.active) {
            ctx.save();
            ctx.translate(this.cx, this.cy);
            const pulse = 0.3 + Math.sin(Date.now() / 200) * 0.15;
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.85, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

window.EnemyTank = EnemyTank;
