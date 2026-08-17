// ====== HUD (Heads-Up Display) ======

class HUD {
    constructor(overlayElement) {
        this.overlay = overlayElement;
        this._pauseCallback = null;
        this.createElements();
    }

    createElements() {
        this.overlay.innerHTML = `
            <div class="hud-element hud-hp-bar">
                <div class="hud-hp-fill" id="hud-hp-fill" style="width:100%"></div>
                <div class="hud-bar-text" id="hud-hp-text">HP 100/100</div>
            </div>
            <div class="hud-element hud-score" id="hud-score">得分: 0</div>
            <div class="hud-element hud-wave" id="hud-wave" style="display:none;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:12px;box-shadow:0 2px 8px rgba(238,90,36,0.4);">♾️ 无尽波次 1</div>
            <div class="hud-element hud-level" id="hud-level">第 1 关</div>
            <div class="hud-element hud-objective" id="hud-objective">目标: 摧毁所有敌方坦克</div>
            <div class="hud-element hud-enemies" id="hud-enemies">敌军: 0</div>
            <div class="hud-element hud-highscore" id="hud-highscore" style="display:none;color:#ffcc00;">最高分: 0</div>
            <div class="hud-pause-btn" id="hud-pause">
                <svg width="16" height="16" viewBox="0 0 20 20">
                    <rect x="4" y="3" width="4" height="14" fill="#ffcc00"/>
                    <rect x="12" y="3" width="4" height="14" fill="#ffcc00"/>
                </svg>
            </div>
            <div class="hud-element hud-ammo" id="hud-ammo">点击/空格 射击</div>
            <div class="hud-element hud-controls-hint">
                WASD/方向键 移动<br>
                鼠标 瞄准 · 点击/空格 射击<br>
                ESC 暂停
            </div>
        `;

        this.hpFillEl = document.getElementById('hud-hp-fill');
        this.hpTextEl = document.getElementById('hud-hp-text');
        this.scoreEl = document.getElementById('hud-score');
        this.waveEl = document.getElementById('hud-wave');
        this.levelEl = document.getElementById('hud-level');
        this.objectiveEl = document.getElementById('hud-objective');
        this.enemiesEl = document.getElementById('hud-enemies');
        this.highScoreEl = document.getElementById('hud-highscore');
        this.pauseBtn = document.getElementById('hud-pause');

        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => {
                if (this._pauseCallback) this._pauseCallback();
            });
        }

        this.hide();
    }

    bindPauseCallback(callback) {
        this._pauseCallback = callback;
    }

    show() {
        this.overlay.style.display = '';
    }

    hide() {
        this.overlay.style.display = 'none';
    }

    update(game) {
        if (game.player) {
            const hpRatio = game.player.hp / game.player.maxHp;
            this.hpFillEl.style.width = (hpRatio * 100) + '%';
            this.hpTextEl.textContent = `HP ${Math.ceil(game.player.hp)}/${game.player.maxHp}`;
        }

        this.scoreEl.textContent = '得分: ' + Utils.formatNumber(game.score);

        // ====== Endless mode: display wave instead of fixed level ======
        if (game.endlessMode) {
            this.waveEl.style.display = '';
            const mazeCfg = game.maze && game.maze.config;
            this.waveEl.textContent = `♾️ 无尽波次 ${game.endlessWave}${(mazeCfg && mazeCfg.isBossLevel) ? ' · BOSS' : ''}`;
            this.levelEl.textContent = (mazeCfg && mazeCfg.name) ? mazeCfg.name : `第 ${game.endlessWave} 波`;
            if (this.highScoreEl) {
                this.highScoreEl.style.display = '';
                this.highScoreEl.textContent = '🏆 最高分: ' + Utils.formatNumber(Math.max(game.endlessHighScore, game.score));
            }
        } else {
            if (this.waveEl) this.waveEl.style.display = 'none';
            if (this.highScoreEl) this.highScoreEl.style.display = 'none';
            const levelConfig = CONFIG.LEVELS[game.currentLevel];
            if (levelConfig) {
                this.levelEl.textContent = `第 ${levelConfig.id} 关: ${levelConfig.name}`;
            }
        }

        // Objective: prefer levelConfig from game.maze (covers both endless + campaign)
        const levelConfig = game.endlessMode
            ? (game.maze && game.maze.config)
            : CONFIG.LEVELS[game.currentLevel];
        let objText = levelConfig ? (levelConfig.objectiveText || '') : '';
        if (game.objectiveType === 'collect') {
            const remaining = game.itemsCollected < game.itemCount
                ? ` (${game.itemsCollected}/${game.itemCount})`
                : ' → 前往出口!';
            objText += remaining;
        } else if (game.objectiveType === 'destroy') {
            const remaining = game.enemies.filter(e => e.active).length;
            objText += ` (${remaining} 剩余)`;
        }
        this.objectiveEl.textContent = '🎯 ' + objText;

        // Enemies remaining
        const enemyCount = game.enemies.filter(e => e.active).length;
        this.enemiesEl.textContent = '敌军剩余: ' + enemyCount;
    }

    clear() {
        this.overlay.innerHTML = '';
    }
}

window.HUD = HUD;
