class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 28;
        this.height = 28;
        this.speed = 60;
        this.vx = Utils.random(-30, 30);
        this.vy = this.speed;
        this.age = 0;
        this.life = CONFIG.POWERUP.lifetime;
        this.active = true;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.collected = false;

        // 道具图标：补给箱风格
        this.configs = {
            P: { color: '#ff4444', glow: '#ff8888', label: 'P' },
            S: { color: '#00aaff', glow: '#88ddff', label: 'S' },
            B: { color: '#ffff00', glow: '#ffff88', label: 'B' },
            H: { color: '#ff00ff', glow: '#ff88ff', label: 'H' },
            F: { color: '#88ccff', glow: '#cceeff', label: 'F' },
            M: { color: '#ffaa00', glow: '#ffdd88', label: 'M' },
            L: { color: '#ff0088', glow: '#ff88cc', label: 'L' },
            G: { color: '#ffdd00', glow: '#ffff88', label: 'G' }
        };
    }

    update(dt, game) {
        this.age += dt;
        if (this.age > this.life) {
            this.active = false;
            return;
        }

        const magnetActive = game.player && game.player.magnet;
        if (magnetActive) {
            const dx = game.player.x + game.player.width / 2 - this.x;
            const dy = game.player.y + game.player.height / 2 - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONFIG.POWERUP.magnetRange) {
                const force = 400 * dt;
                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.vy = Math.min(this.vy, this.speed);

        if (this.y > CONFIG.CANVAS.height + 50 || this.x < -50 || this.x > CONFIG.CANVAS.width + 50) {
            this.active = false;
        }
    }

    draw(ctx) {
        const config = this.configs[this.type] || this.configs.G;
        const bob = Math.sin(this.age * 4 + this.bobOffset) * 3;
        const pulse = 0.8 + Math.sin(this.age * 6) * 0.2;
        const alpha = this.age > this.life - 2 ? Math.min(1, (this.life - this.age) / 1) : 1;

        ctx.save();
        ctx.globalAlpha = alpha;

        const cx = this.x;
        const cy = this.y + bob;

        // 外层光晕：补给箱外框
        ctx.globalAlpha = alpha * 0.3 * pulse;
        ctx.fillStyle = config.glow;
        const rOuter = 18;
        ctx.fillRect(cx - rOuter, cy - rOuter, rOuter * 2, rOuter * 2);

        // 主体补给箱
        ctx.globalAlpha = alpha;
        ctx.fillStyle = config.color;
        ctx.fillRect(cx - 13, cy - 13, 26, 26);

        // 内描边
        ctx.strokeStyle = config.glow;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 13, cy - 13, 26, 26);

        // 补给箱十字封条
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 13);
        ctx.lineTo(cx, cy + 13);
        ctx.moveTo(cx - 13, cy);
        ctx.lineTo(cx + 13, cy);
        ctx.stroke();

        // 标签
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.label, cx, cy + 1);

        ctx.restore();
    }

    apply(game) {
        const player = game.player;
        Audio.playPickup();

        const popupConfig = {
            P: { text: '火力↑', color: '#ff4444' },
            S: { text: '装甲+25', color: '#00aaff' },
            B: { text: '空袭+1', color: '#ffff00' },
            H: { text: '追踪弹!', color: '#ff00ff' },
            F: { text: '冰冻弹!', color: '#88ccff' },
            M: { text: '磁铁!', color: '#ffaa00' },
            L: { text: '重生+1', color: '#ff0088' },
            G: { text: '+500分', color: '#ffdd00' }
        };

        let popup = popupConfig[this.type] || popupConfig.G;

        switch (this.type) {
            case 'P':
                player.powerLevel = Math.min(player.powerLevel + 1, CONFIG.PLAYER_BASE.maxPowerLevel);
                player.upgradeWeapon();
                break;
            case 'S':
                player.shield = Math.min(player.shield + 25, player.maxShield);
                break;
            case 'B':
                player.bombs = (player.bombs || 0) + 1;
                break;
            case 'H':
                player.hasHoming = true;
                break;
            case 'F':
                player.hasFreeze = true;
                break;
            case 'M':
                player.magnet = true;
                player.magnetTimer = 10;
                break;
            case 'L':
                player.lives = (player.lives || 0) + 1;
                break;
            case 'G':
                game.addScore(500);
                break;
        }

        game.particles.emitPickup(this.x, this.y, this.configs[this.type]?.glow || '#ffff00');
        game.addPopupText(popup.text, this.x, this.y - 20, popup.color);
    }
};
