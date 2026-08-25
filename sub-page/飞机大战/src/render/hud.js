class HUD {
    constructor(overlayElement) {
        this.overlay = overlayElement;
        this.element = null;
        this.gameTime = 0;
        this._pauseCallback = null;
        this._game = null;
        this.createElements();
    }

    createElements() {
        this.overlay.innerHTML = `
            <div class="hud-element hud-score" id="hud-score">得分: 0</div>
            <div class="hud-element hud-combo" id="hud-combo"></div>
            <div class="hud-pause-btn" id="hud-pause">
                <svg width="18" height="18" viewBox="0 0 20 20">
                    <rect x="4" y="3" width="4" height="14" fill="#00ffff"/>
                    <rect x="12" y="3" width="4" height="14" fill="#00ffff"/>
                </svg>
            </div>
            <div class="hud-element hud-mode-indicator" id="hud-mode-indicator"></div>
            <div class="hud-element hud-hp-bar" id="hud-hp-bar">
                <div class="hud-hp-fill" id="hud-hp-fill" style="width:100%"></div>
                <div class="hud-bar-text" id="hud-hp-text">HP: 0/0</div>
            </div>
            <div class="hud-element hud-shield-bar" id="hud-shield-bar">
                <div class="hud-shield-fill" id="hud-shield-fill" style="width:0%"></div>
                <div class="hud-bar-text" id="hud-shield-text">SHIELD: 0/0</div>
            </div>
            <div class="hud-element hud-energy-bar" id="hud-energy-bar">
                <div class="hud-energy-fill" id="hud-energy-fill" style="width:0%"></div>
                <div class="hud-bar-text" id="hud-energy-text">EN: 0/0</div>
            </div>
            <div class="hud-element hud-bombs" id="hud-bombs">💣 x 0</div>
            <div class="hud-element hud-weapon" id="hud-weapon">武器: 脉冲激光 Lv.1</div>
            <div class="hud-element hud-magnet" id="hud-magnet" style="display:none">🧲 磁铁激活</div>
            <div class="hud-element hud-dmg-numbers" id="hud-dmg-numbers">
                <span class="hud-dmg-label">🎯 伤害数字</span>
                <span class="hud-dmg-toggle" id="hud-dmg-toggle">ON</span>
            </div>
            <div class="hud-skill-ready" id="hud-skill-ready" style="display:none">
                <div class="skill-ready-text">⚡ 大招就绪 ⚡</div>
                <div class="skill-ready-sub">[ 空格键 释放 ]</div>
            </div>
        `;

        this.scoreEl = document.getElementById('hud-score');
        this.comboEl = document.getElementById('hud-combo');
        this.modeIndicatorEl = document.getElementById('hud-mode-indicator');
        this.hpFillEl = document.getElementById('hud-hp-fill');
        this.hpTextEl = document.getElementById('hud-hp-text');
        this.shieldFillEl = document.getElementById('hud-shield-fill');
        this.shieldTextEl = document.getElementById('hud-shield-text');
        this.energyFillEl = document.getElementById('hud-energy-fill');
        this.energyTextEl = document.getElementById('hud-energy-text');
        this.bombsEl = document.getElementById('hud-bombs');
        this.weaponEl = document.getElementById('hud-weapon');
        this.magnetEl = document.getElementById('hud-magnet');
        this.pauseBtn = document.getElementById('hud-pause');
        this.dmgNumbersEl = document.getElementById('hud-dmg-numbers');
        this.dmgToggleEl = document.getElementById('hud-dmg-toggle');
        this.skillReadyEl = document.getElementById('hud-skill-ready');
        this.skillReadyTimer = null;

        this.dmgNumbersEl.addEventListener('click', () => {
            if (!this._game) return;
            this._game.damageNumbersEnabled = !this._game.damageNumbersEnabled;
            localStorage.setItem('starfighter_dmg_numbers', this._game.damageNumbersEnabled ? 'true' : 'false');
            this.setDamageNumbersEnabled(this._game.damageNumbersEnabled);
        });

        this._rebindPauseCallback();
    }

    bindPauseCallback(callback) {
        this._pauseCallback = callback;
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', callback);
        }
    }

    _rebindPauseCallback() {
        if (this._pauseCallback && this.pauseBtn) {
            this.pauseBtn.addEventListener('click', this._pauseCallback);
        }
    }

    setDamageNumbersEnabled(enabled) {
        if (!this.dmgToggleEl) return;
        this.dmgToggleEl.textContent = enabled ? 'ON' : 'OFF';
        this.dmgToggleEl.style.color = enabled ? '#00ff88' : '#ff4444';
        this.dmgToggleEl.style.textShadow = enabled ? '0 0 6px #00ff88' : '0 0 6px #ff4444';
    }

    update(game) {
        this._game = game;
        const player = game.player;
        if (!player) return;

        this.scoreEl.textContent = '得分: ' + Utils.formatNumber(game.score);

        if (game.combo > 1) {
            this.comboEl.textContent = `${game.combo}x COMBO`;
            this.comboEl.style.display = 'block';
        } else {
            this.comboEl.style.display = 'none';
        }

        this._updateModeIndicator(game);

        this.hpFillEl.style.width = (player.hp / player.maxHp * 100) + '%';
        this.hpTextEl.textContent = `HP: ${Math.ceil(player.hp)}/${player.maxHp}`;

        if (player.shield > 0) {
            this.shieldFillEl.style.width = (player.shield / player.maxShield * 100) + '%';
            this.shieldTextEl.textContent = `SHIELD: ${Math.ceil(player.shield)}/${player.maxShield}`;
            this.shieldFillEl.parentElement.style.display = 'block';
        } else {
            this.shieldFillEl.parentElement.style.display = 'none';
        }

        if (player.energy > 0) {
            this.energyFillEl.style.width = (player.energy / player.energyMax * 100) + '%';
            this.energyTextEl.textContent = `EN: ${Math.ceil(player.energy)}/${player.energyMax}`;
            this.energyFillEl.parentElement.style.display = 'block';
        } else {
            this.energyFillEl.parentElement.style.display = 'none';
        }

        if (player.bombs > 0) {
            this.bombsEl.textContent = '💣 x ' + player.bombs;
            this.bombsEl.style.display = 'block';
        } else {
            this.bombsEl.style.display = 'none';
        }

        let weaponName = CONFIG.WEAPONS[player.weapon]?.name || '脉冲激光';
        this.weaponEl.textContent = `武器: ${weaponName} Lv.${player.powerLevel}`;

        if (player.magnet) {
            this.magnetEl.style.display = 'block';
            this.magnetEl.textContent = `🧲 磁铁 ${player.magnetTimer.toFixed(1)}s`;
        } else {
            this.magnetEl.style.display = 'none';
        }

        this.setDamageNumbersEnabled(game.damageNumbersEnabled);

        this.gameTime = game.gameTime;
    }

    _updateModeIndicator(game) {
        if (!this.modeIndicatorEl) return;
        const mode = game.selectedMode;
        if (mode === 'story') {
            const stageIndex = game.currentStage || 0;
            const modeConfig = CONFIG.GAME_MODES.story;
            const stage = modeConfig.stages[stageIndex];
            if (stage) {
                this.modeIndicatorEl.textContent = `📡 ${modeConfig.name} · ${stage.name}`;
            } else {
                this.modeIndicatorEl.textContent = `📡 ${modeConfig.name}`;
            }
            this.modeIndicatorEl.style.display = 'block';
        } else if (mode === 'endless') {
            const modeConfig = CONFIG.GAME_MODES.endless;
            this.modeIndicatorEl.textContent = `📡 ${modeConfig.name}`;
            this.modeIndicatorEl.style.display = 'block';
        } else {
            this.modeIndicatorEl.style.display = 'none';
        }
    }

    showBossBar(boss) {
        if (!document.getElementById('boss-hp-container')) {
            const container = document.createElement('div');
            container.id = 'boss-hp-container';
            container.innerHTML = `
                <div class="boss-hp-label">⚠ BOSS: 深渊之喉 ⚠</div>
                <div class="boss-hp-bar"><div class="boss-hp-fill" id="boss-hp-fill" style="width:100%"></div></div>
            `;
            this.overlay.appendChild(container);
        }
        document.getElementById('boss-hp-container').style.display = 'block';
        document.getElementById('boss-hp-fill').style.width = (boss.hpRatio * 100) + '%';
    }

    hideBossBar() {
        const container = document.getElementById('boss-hp-container');
        if (container) {
            container.style.display = 'none';
        }
    }

    showSkillReadyPrompt() {
        if (!this.skillReadyEl) return;
        if (this.skillReadyTimer) {
            clearTimeout(this.skillReadyTimer);
        }
        this.skillReadyEl.style.display = 'flex';
        this.skillReadyEl.classList.remove('skill-ready-hide');
        this.skillReadyEl.classList.add('skill-ready-show');
        this.skillReadyTimer = setTimeout(() => {
            if (this.skillReadyEl) {
                this.skillReadyEl.classList.remove('skill-ready-show');
                this.skillReadyEl.classList.add('skill-ready-hide');
                setTimeout(() => {
                    if (this.skillReadyEl) {
                        this.skillReadyEl.style.display = 'none';
                    }
                }, 600);
            }
        }, 3000);
    }

    hideSkillReadyPrompt() {
        if (this.skillReadyEl) {
            this.skillReadyEl.style.display = 'none';
        }
        if (this.skillReadyTimer) {
            clearTimeout(this.skillReadyTimer);
            this.skillReadyTimer = null;
        }
    }

    showBossAlert() {
        const alert = document.createElement('div');
        alert.id = 'boss-alert';
        alert.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: 'Orbitron', sans-serif;
            font-size: 36px;
            font-weight: 900;
            color: #ff0000;
            text-shadow: 0 0 20px #ff0000, 0 0 40px #ff0000;
            letter-spacing: 8px;
            z-index: 40;
            animation: glow-pulse 0.3s ease-in-out infinite;
        `;
        alert.textContent = '⚠ WARNING ⚠';
        this.overlay.appendChild(alert);

        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 3000);
    }

    clear() {
        this.overlay.innerHTML = '';
        this.createElements();
    }

    show() {
        this.overlay.style.display = 'block';
    }

    hide() {
        this.overlay.style.display = 'none';
    }
};