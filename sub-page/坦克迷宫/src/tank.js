// ====== Base Tank Class ======
// Handles movement, wall collision, HP management, and rendering (hull + turret)

class Tank {
    constructor(x, y, typeConfig) {
        this.x = x;
        this.y = y;
        this.width = typeConfig.width || 26;
        this.height = typeConfig.height || 26;
        this.speed = typeConfig.speed || 100;
        this.hp = typeConfig.hp;
        this.maxHp = typeConfig.hp;
        this.fireRate = typeConfig.fireRate;
        this.fireTimer = 0;
        this.bulletSpeed = typeConfig.bulletSpeed;
        this.bulletDamage = typeConfig.bulletDamage;
        this.bulletRange = typeConfig.bulletRange || 400;
        this.range = typeConfig.range || 300;
        this.sightRange = typeConfig.sightRange || 300;
        this.score = typeConfig.score || 100;
        this.color = typeConfig.color || '#888';
        this.accentColor = typeConfig.accentColor || '#aaa';
        this.isBoss = typeConfig.isBoss || false;
        this.typeConfig = typeConfig;

        // Hull facing (radians): 0=right, PI/2=down, PI=left, -PI/2=up
        this.hullAngle = -Math.PI / 2; // Default: facing up
        // Turret facing (radians): can be any angle
        this.turretAngle = -Math.PI / 2;

        this.active = true;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.flashTimer = 0;

        // Animation
        this.treadOffset = 0;
        this.moving = false;

        // Collision helper: half-sizes
        this.halfW = this.width / 2;
        this.halfH = this.height / 2;

        // Stuck detection: track recent positions
        this._posHistory = [];
        this._lastMoveDx = 0;
        this._lastMoveDy = 0;
    }

    get cx() { return this.x + this.halfW; }
    get cy() { return this.y + this.halfH; }

    getBounds() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    // Move with wall collision using axis-separated sliding.
    // Implements robust wall-sliding so that hitting a wall along one axis
    // still allows the other axis to move smoothly (e.g. sliding along corridors).
    // Returns {movedX, movedY} with actual pixels moved.
    move(dx, dy, maze) {
        const startX = this.x;
        const startY = this.y;

        // ---- X axis movement with sliding ----
        if (dx !== 0) {
            const newX = this.x + dx;
            if (!maze.rectCollidesWall(newX, this.y, this.width, this.height)) {
                this.x = newX;
            } else {
                // Find the maximum safe X position (1px precision)
                const step = dx > 0 ? 1 : -1;
                let safeX = this.x;
                const targetX = newX;
                // Walk pixel by pixel toward target, stop at the last safe pixel before wall
                while (Math.abs(safeX - targetX) > 0.01) {
                    const candidate = safeX + step;
                    if (maze.rectCollidesWall(candidate, this.y, this.width, this.height)) {
                        break;
                    }
                    safeX = candidate;
                }
                this.x = safeX;
            }
        }

        // ---- Y axis movement with sliding ----
        if (dy !== 0) {
            const newY = this.y + dy;
            if (!maze.rectCollidesWall(this.x, newY, this.width, this.height)) {
                this.y = newY;
            } else {
                const step = dy > 0 ? 1 : -1;
                let safeY = this.y;
                const targetY = newY;
                while (Math.abs(safeY - targetY) > 0.01) {
                    const candidate = safeY + step;
                    if (maze.rectCollidesWall(this.x, candidate, this.width, this.height)) {
                        break;
                    }
                    safeY = candidate;
                }
                this.y = safeY;
            }
        }

        // Track actual movement amount
        this._lastMoveDx = this.x - startX;
        this._lastMoveDy = this.y - startY;

        // Record position for stuck detection
        this._posHistory.push({ x: this.x, y: this.y, t: performance.now() });
        if (this._posHistory.length > 20) this._posHistory.shift();

        // Safety: if we're actually inside a wall, do a full unstick.
        // This is a last-resort and should only trigger on rare edge cases (spawn in wall, teleport bugs).
        if (maze.rectCollidesWall(this.x, this.y, this.width, this.height)) {
            this.unstickFromWall(maze);
        }

        return { movedX: this._lastMoveDx, movedY: this._lastMoveDy };
    }

    // Push tank out of wall tiles if it's currently embedded
    unstickFromWall(maze) {
        if (!maze.rectCollidesWall(this.x, this.y, this.width, this.height)) {
            return;
        }

        // Try 8-directional push-out by increasing pixel steps
        const pushDirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [1, -1], [-1, 1], [1, 1],
        ];
        const maxStep = 8;
        for (let step = 1; step <= maxStep; step++) {
            for (const [dx, dy] of pushDirs) {
                const testX = this.x + dx * step;
                const testY = this.y + dy * step;
                if (!maze.rectCollidesWall(testX, testY, this.width, this.height)) {
                    this.x = testX;
                    this.y = testY;
                    return;
                }
            }
        }

        // Last resort: snap center to nearest tile center
        const tile = Utils.pixelToTile(this.cx, this.cy);
        const center = Utils.tileCenter(tile.col, tile.row);
        // Try the tile first; if still wall, expand search to 5x5 neighborhood
        const offsets = [
            [0, 0],
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [1, -1], [-1, 1], [1, 1],
            [-2, 0], [2, 0], [0, -2], [0, 2],
            [-2, -2], [2, -2], [-2, 2], [2, 2],
        ];
        for (const [oc, or] of offsets) {
            const tc = tile.col + oc;
            const tr = tile.row + or;
            if (maze.isWall(tc, tr)) continue;
            const c = Utils.tileCenter(tc, tr);
            const testX = c.x - this.width / 2;
            const testY = c.y - this.height / 2;
            if (!maze.rectCollidesWall(testX, testY, this.width, this.height)) {
                this.x = testX;
                this.y = testY;
                return;
            }
        }
    }

    // Detect if tank hasn't moved for a while despite trying
    isStuck(thresholdPx) {
        if (this._posHistory.length < 10) return false;
        const oldest = this._posHistory[0];
        const newest = this._posHistory[this._posHistory.length - 1];
        const dx = newest.x - oldest.x;
        const dy = newest.y - oldest.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (thresholdPx || 4);
    }

    // Snap tank to the center of nearest floor tile
    snapToTileCenter(maze) {
        let bestCol = -1, bestRow = -1;
        let bestDist = Infinity;
        const myCol = Math.floor(this.cx / CONFIG.TILE_SIZE);
        const myRow = Math.floor(this.cy / CONFIG.TILE_SIZE);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const tc = myCol + dc;
                const tr = myRow + dr;
                if (maze.isWall(tc, tr)) continue;
                const c = Utils.tileCenter(tc, tr);
                const d = Utils.distance(this.cx, this.cy, c.x, c.y);
                if (d < bestDist) {
                    bestDist = d;
                    bestCol = tc;
                    bestRow = tr;
                }
            }
        }
        if (bestCol >= 0 && bestRow >= 0) {
            const c = Utils.tileCenter(bestCol, bestRow);
            this.x = c.x - this.width / 2;
            this.y = c.y - this.height / 2;
        }
        this._posHistory = [];
    }

    // Check if this tank collides with another tank (AABB)
    collidesWithTank(other) {
        return Utils.aabb(this.getBounds(), other.getBounds());
    }

    // Push away from another tank to prevent overlap.
    // Added grace-factor: if either tank is in spawn grace, apply heavy damping
    // (10% strength) so spawn-cluster tanks don't jitter violently before their AI starts.
    separateFrom(other) {
        const dx = this.cx - other.cx;
        const dy = this.cy - other.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (this.width + other.width) / 2;

        if (dist < minDist && dist > 0) {
            let push = (minDist - dist) / 2;
            // Damping during either side's spawn grace: prevent violent initial push-out
            const thisGrace = (this.spawnGraceTimer !== undefined && this.spawnGraceTimer > 0) ? 0.12 : 1.0;
            const otherGrace = (other.spawnGraceTimer !== undefined && other.spawnGraceTimer > 0) ? 0.12 : 1.0;
            const damp = Math.min(thisGrace, otherGrace);
            // Also: if overlap is tiny (<2px) and not both tanks are active players, skip to avoid micro-jitter
            if (push < 1.2 && damp < 1) return;
            push *= damp;
            this.x += (dx / dist) * push;
            this.y += (dy / dist) * push;
        }
    }

    takeDamage(amount, game) {
        if (this.invincible || !this.active) return;
        this.hp -= amount;
        this.flashTimer = 0.1;

        if (this.hp <= 0) {
            this.hp = 0;
            this.die(game);
        }
    }

    die(game) {
        this.active = false;
        const scale = this.isBoss ? 2.5 : 1;
        game.particles.emitExplosion(this.cx, this.cy, scale);
        if (this.isBoss) {
            Audio.playBigExplosion();
        } else {
            Audio.playExplosion();
        }
        game.shake(this.isBoss ? 0.6 : 0.3);
    }

    update(dt, maze, game) {
        if (!this.active) return;

        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) this.invincible = false;
        }

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }

        this.fireTimer -= dt;

        if (this.moving) {
            this.treadOffset += dt * 30;
        }
    }

    // Fire a bullet
    fire(game) {
        const barrelLen = this.halfW + 6;
        const bx = this.cx + Math.cos(this.turretAngle) * barrelLen;
        const by = this.cy + Math.sin(this.turretAngle) * barrelLen;

        const config = {
            speed: this.bulletSpeed,
            damage: this.bulletDamage,
            fromPlayer: this.isPlayer || false,
            color: this.isPlayer ? CONFIG.COLORS.bullet : CONFIG.COLORS.enemyBullet,
            size: this.isBoss ? 6 : (this.isPlayer ? 4 : 4),
            range: this.bulletRange,
        };

        game.bullets.push(new Bullet(bx, by, this.turretAngle, config));

        // Muzzle flash
        game.particles.emitMuzzleFlash(bx, by, this.turretAngle, config.color);

        if (this.isPlayer) {
            Audio.playShoot();
        } else {
            Audio.playEnemyShoot();
        }
    }

    // ====== Rendering ======
    draw(ctx) {
        if (!this.active) return;

        // Flash white when hit
        const flashing = this.flashTimer > 0;

        ctx.save();
        ctx.translate(this.cx, this.cy);

        // Draw hull (rotated to hullAngle)
        ctx.save();
        ctx.rotate(this.hullAngle);
        this.drawHull(ctx, flashing);
        ctx.restore();

        // Draw turret (rotated to turretAngle)
        ctx.save();
        ctx.rotate(this.turretAngle);
        this.drawTurret(ctx, flashing);
        ctx.restore();

        ctx.restore();

        // Draw HP bar above tank (if damaged)
        if (this.hp < this.maxHp) {
            this.drawHpBar(ctx);
        }
    }

    drawHull(ctx, flashing) {
        const w = this.width;
        const h = this.height;
        const hw = w / 2;
        const hh = h / 2;

        // Treads (left and right)
        const treadW = w * 0.18;
        ctx.fillStyle = '#1a1a14';
        ctx.fillRect(-hw, -hh, treadW, h);
        ctx.fillRect(hw - treadW, -hh, treadW, h);

        // Tread segments (animated)
        ctx.fillStyle = '#3a3a2a';
        const seg = 4;
        const offset = (this.treadOffset % seg + seg) % seg;
        for (let y = -hh - seg + offset; y < hh; y += seg) {
            ctx.fillRect(-hw + 1, y, treadW - 2, 2);
            ctx.fillRect(hw - treadW + 1, y, treadW - 2, 2);
        }

        // Hull body
        const bodyColor = flashing ? '#ffffff' : this.color;
        ctx.fillStyle = flashing ? '#ffffff' : '#1a1a12';
        ctx.fillRect(-hw + treadW - 1, -hh + 1, w - treadW * 2 + 2, h - 2);

        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = flashing ? 16 : 8;
        ctx.strokeRect(-hw + treadW - 1, -hh + 1, w - treadW * 2 + 2, h - 2);

        // Hull armor line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.accentColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-hw + treadW, -hh + h * 0.3);
        ctx.lineTo(hw - treadW, -hh + h * 0.3);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    drawTurret(ctx, flashing) {
        const w = this.width;
        const turretRadius = w * 0.28;

        // Turret base circle
        ctx.fillStyle = flashing ? '#ffffff' : this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = flashing ? 14 : 8;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.shadowBlur = 0;
        ctx.fillStyle = flashing ? '#ffffff' : this.accentColor;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Barrel
        const barrelW = this.isBoss ? 8 : (this.width > 26 ? 6 : 5);
        const barrelL = w * 0.55;
        ctx.fillStyle = '#222';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 4;
        ctx.fillRect(0, -barrelW / 2, barrelL, barrelW);

        // Barrel tip
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#444';
        ctx.fillRect(barrelL - 3, -barrelW / 2 - 1, 3, barrelW + 2);
    }

    drawHpBar(ctx) {
        const barW = this.width + 6;
        const barH = 4;
        const barX = this.cx - barW / 2;
        const barY = this.y - 10;
        const hpRatio = this.hp / this.maxHp;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barW, barH);

        let color = '#00ff88';
        if (hpRatio < 0.6) color = '#ffcc00';
        if (hpRatio < 0.3) color = '#ff3322';
        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.restore();
    }
}

window.Tank = Tank;
