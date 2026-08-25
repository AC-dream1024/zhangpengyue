class CollisionSystem {
    constructor() {}

    checkAll(game) {
        if (!game.player || !game.player.active) return;

        this.checkPlayerBulletsVsEnemies(game);
        this.checkPlayerBulletsVsBoss(game);
        this.checkEnemyBulletsVsPlayer(game);
        this.checkPlayerVsEnemies(game);
        this.checkPlayerVsBoss(game);
        this.checkPlayerVsPowerups(game);
    }

    checkPlayerBulletsVsEnemies(game) {
        for (const bullet of game.bullets) {
            if (!bullet.active || !bullet.fromPlayer) continue;

            for (const enemy of game.enemies) {
                if (!enemy.active) continue;
                if (Utils.aabb(
                    { x: bullet.x - bullet.size, y: bullet.y - bullet.size, width: bullet.size * 2, height: bullet.size * 2 },
                    enemy
                )) {
                    enemy.takeDamage(bullet.damage, game);
                    game.particles.emitHit(bullet.x, bullet.y, bullet.color);

                    if (bullet.freeze) {
                        enemy.applyFreeze(1.5);
                    }

                    if (!bullet.pierce) {
                        bullet.active = false;
                    }
                    break;
                }
            }
        }
    }

    checkPlayerBulletsVsBoss(game) {
        if (!game.boss || !game.boss.active || game.boss.state === 'entering' || game.boss.state === 'dying') return;

        for (const bullet of game.bullets) {
            if (!bullet.active || !bullet.fromPlayer) continue;

            if (Utils.aabb(
                { x: bullet.x - bullet.size, y: bullet.y - bullet.size, width: bullet.size * 2, height: bullet.size * 2 },
                game.boss
            )) {
                game.boss.takeDamage(bullet.damage, game);
                game.addHitStop();
                game.particles.emitHit(bullet.x, bullet.y, bullet.color);

                if (!bullet.pierce) {
                    bullet.active = false;
                }
            }
        }
    }

    checkEnemyBulletsVsPlayer(game) {
        if (!game.player || !game.player.active || game.player.invincible) return;

        for (const bullet of game.bullets) {
            if (!bullet.active || bullet.fromPlayer) continue;

            if (Utils.circleRect(
                bullet.x, bullet.y, bullet.size,
                game.player.x, game.player.y, game.player.width, game.player.height
            )) {
                game.player.takeDamage(bullet.damage, game);
                bullet.active = false;
                game.particles.emitHit(bullet.x, bullet.y, '#ff4444');
            }
        }
    }

    checkPlayerVsEnemies(game) {
        if (!game.player || !game.player.active || game.player.invincible) return;

        for (const enemy of game.enemies) {
            if (!enemy.active) continue;
            if (Utils.aabb(game.player, enemy)) {
                game.player.takeDamage(25, game);
                if (!enemy.isKamikaze) {
                    enemy.takeDamage(50, game);
                }
            }
        }
    }

    checkPlayerVsBoss(game) {
        if (!game.player || !game.player.active || game.player.invincible) return;
        if (!game.boss || !game.boss.active || game.boss.state === 'entering' || game.boss.state === 'dying') return;

        if (Utils.aabb(game.player, game.boss)) {
            game.player.takeDamage(30, game);
        }
    }

    checkPlayerVsPowerups(game) {
        if (!game.player || !game.player.active) return;

        for (const powerup of game.powerups) {
            if (!powerup.active) continue;
            if (Utils.aabb(game.player, powerup)) {
                powerup.apply(game);
                powerup.active = false;
            }
        }
    }
};