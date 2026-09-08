// ====== Player Tank ======
// WASD/Arrows for 4-directional movement, mouse for turret aiming, click/space to fire

class PlayerTank extends Tank {
    constructor(x, y) {
        super(x, y, {
            width: CONFIG.PLAYER.width,
            height: CONFIG.PLAYER.height,
            speed: CONFIG.PLAYER.speed,
            hp: CONFIG.PLAYER.hp,
            fireRate: CONFIG.PLAYER.fireRate,
            bulletSpeed: CONFIG.PLAYER.bulletSpeed,
            bulletDamage: CONFIG.PLAYER.bulletDamage,
            bulletRange: CONFIG.PLAYER.bulletRange,
            range: CONFIG.PLAYER.bulletRange,
            sightRange: 400,
            score: 0,
            color: CONFIG.COLORS.player,
            accentColor: CONFIG.COLORS.playerAccent,
        });
        this.isPlayer = true;
        this.turretRotSpeed = CONFIG.PLAYER.turretRotSpeed;
        this.hullAngle = -Math.PI / 2; // Start facing up
        this.turretAngle = -Math.PI / 2;
        this.invincibleTimer = 1.0;
        this.invincible = true;
    }

    update(dt, maze, game) {
        if (!this.active) return;

        // Handle invincibility
        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) this.invincible = false;
        }

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }

        this.fireTimer -= dt;

        // ====== Movement (4-directional) ======
        const move = Input.getMoveDirection4();
        this.moving = (move.x !== 0 || move.y !== 0);

        if (this.moving) {
            const dx = move.x * this.speed * dt;
            const dy = move.y * this.speed * dt;
            this.move(dx, dy, maze);

            // Update hull facing to movement direction
            if (move.x > 0) this.hullAngle = 0;
            else if (move.x < 0) this.hullAngle = Math.PI;
            else if (move.y > 0) this.hullAngle = Math.PI / 2;
            else if (move.y < 0) this.hullAngle = -Math.PI / 2;

            this.treadOffset += dt * 30;

            // Engine sound + dust
            if (Math.random() < 0.08) {
                Audio.playEngine();
            }
            if (Math.random() < 0.15) {
                game.particles.emitDust(this.cx - Math.cos(this.hullAngle) * this.halfW,
                                       this.cy - Math.sin(this.hullAngle) * this.halfH);
            }
        }

        // ====== Turret Aiming ======
        // Priority: mouse/touch aim on canvas > hull align when moving > auto-aim nearest enemy > keep
        const mouseX = Input.getMouseX();
        const mouseY = Input.getMouseY();
        let aimFrom = null; // {x,y} target for aim; null = no explicit aim from user
        if (mouseX !== 0 || mouseY !== 0) {
            aimFrom = { x: mouseX, y: mouseY };
        } else if (this.moving) {
            // Hull alignment fallback when user moves but no canvas aim
            aimFrom = {
                x: this.cx + Math.cos(this.hullAngle) * 500,
                y: this.cy + Math.sin(this.hullAngle) * 500
            };
        } else if (game && game.enemies) {
            // Auto-aim nearest active enemy for mobile-friendly assisted aiming
            let bestEnemy = null;
            let bestDistSq = Infinity;
            const aimRange = 480; // within this distance; turrets can see further but 480 is reasonable assist
            const aimRangeSq = aimRange * aimRange;
            for (let i = 0; i < game.enemies.length; i++) {
                const en = game.enemies[i];
                if (!en || !en.active) continue;
                const ddx = en.cx - this.cx;
                const ddy = en.cy - this.cy;
                const dsq = ddx * ddx + ddy * ddy;
                if (dsq < bestDistSq && dsq < aimRangeSq) {
                    bestDistSq = dsq;
                    bestEnemy = en;
                }
            }
            if (bestEnemy) {
                aimFrom = { x: bestEnemy.cx, y: bestEnemy.cy };
            }
        }
        if (aimFrom) {
            const targetAngle = Utils.angleBetween(this.cx, this.cy, aimFrom.x, aimFrom.y);
            // Smoothly chase the target angle; keep responsiveness vs jarring snaps
            const diffAbs = Math.abs(Utils.angleDifference(this.turretAngle, targetAngle));
            const rotAmount = Math.max(this.turretRotSpeed * dt, diffAbs * 0.35);
            this.turretAngle = Utils.moveAngleToward(this.turretAngle, targetAngle, rotAmount);
        }

        // ====== Firing ======
        if ((Input.isMouseDown() || Input.consumeKey('Space')) && this.fireTimer <= 0) {
            this.fire(game);
            this.fireTimer = this.fireRate;
        }
    }

    takeDamage(amount, game) {
        if (this.invincible) return;
        super.takeDamage(amount, game);
        if (this.active) {
            Audio.playPlayerDamage();
            game.shake(0.25);
            this.invincible = true;
            this.invincibleTimer = 0.6;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        // Flicker when invincible
        if (this.invincible && Math.floor(this.invincibleTimer * 12) % 2 === 0) {
            return;
        }

        // Draw shield ring when invincible
        if (this.invincible) {
            ctx.save();
            ctx.translate(this.cx, this.cy);
            ctx.strokeStyle = `rgba(0, 221, 102, ${0.3 + Math.sin(Date.now() / 100) * 0.2})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = CONFIG.COLORS.player;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        super.draw(ctx);
    }
}

window.PlayerTank = PlayerTank;
