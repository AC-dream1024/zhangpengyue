// ====== Scene System ======
// Base Scene + MenuScene + GameScene + GameOverScene + VictoryScene

class Scene {
    constructor(game) {
        this.game = game;
        this.isPlaying = false;
        this.ui = null;
        this.name = 'Scene';
    }

    enter() {
        this.isPlaying = true;
    }

    exit() {
        this.isPlaying = false;
        if (this.ui) {
            this.ui.remove();
            this.ui = null;
        }
    }

    update(dt) {}
    draw(ctx) {}

    createUI(html) {
        this.ui = document.createElement('div');
        this.ui.className = 'scene';
        this.ui.innerHTML = html;
        const container = document.getElementById('scene-container');
        if (container) {
            container.innerHTML = '';
            container.appendChild(this.ui);
        }
        return this.ui;
    }
}


// ====== Menu Scene ======
class MenuScene extends Scene {
    constructor(game) {
        super(game);
        this.name = 'Menu';
    }

    enter() {
        super.enter();
        this.createMenu();
    }

    createMenu() {
        const game = this.game;
        const levels = CONFIG.LEVELS;
        const unlockedLevel = game.unlockedLevel;

        let levelHTML = '';
        levels.forEach((level, i) => {
            const unlocked = i <= unlockedLevel;
            const isCurrent = i === game.selectedLevel;
            const enemyCount = Object.values(level.enemies).reduce((a, b) => a + b, 0);
            const lockIcon = unlocked ? '' : '🔒 ';
            const cardClass = unlocked ? (isCurrent ? 'level-card active' : 'level-card') : 'level-card locked';

            levelHTML += `
                <div class="${cardClass}" data-level="${i}" ${unlocked ? '' : 'style="pointer-events:none;"'}>
                    <div class="level-card-num">${lockIcon}第 ${level.id} 关</div>
                    <div class="level-card-name">${level.name}</div>
                    <div class="level-card-info">${enemyCount} 敌军 · ${level.objective === 'destroy' ? '歼灭战' : '收集任务'}</div>
                </div>
            `;
        });

        const highScore = parseInt(localStorage.getItem('tankmaze_highscore') || '0');
        const endlessHighScore = parseInt(localStorage.getItem('tankmaze_endless_highscore') || '0');

        this.ui = this.createUI(`
            <h1>钢铁迷宫</h1>
            <h2>STEEL LABYRINTH: TANK ASSAULT</h2>
            <div class="highscore">战役最高: ${Utils.formatNumber(highScore)} | 无尽最高: ${Utils.formatNumber(endlessHighScore)} | 战役总分: ${Utils.formatNumber(game.totalScore)}</div>
            <div class="story-progress">已解锁: ${unlockedLevel + 1} / ${levels.length} 关</div>

            <div class="section-label">选择关卡</div>
            <div class="level-grid">
                ${levelHTML}
            </div>

            <div class="section-label">操作说明</div>
            <div class="info-panel" style="text-align:left; font-size:14px; line-height:1.8;">
                <div><span class="label">移动:</span> <span class="value">WASD 或 方向键 (四方向)</span></div>
                <div><span class="label">炮塔瞄准:</span> <span class="value">鼠标移动 (360°自由旋转)</span></div>
                <div><span class="label">射击:</span> <span class="value">鼠标左键 或 空格键</span></div>
                <div><span class="label">暂停:</span> <span class="value">ESC 键</span></div>
                <div><span class="label">目标:</span> <span class="value">摧毁所有敌军或完成关卡目标</span></div>
            </div>

            <button class="btn" id="btn-start">▶ 开始战斗 (战役)</button>
            <button class="btn" id="btn-endless" style="background:linear-gradient(135deg,#ff6b6b,#ee5a24); margin-top:12px;">♾️ 无尽挑战模式</button>
            <div style="color:#ffcc88; font-size:12px; margin-top:6px;">无尽模式: 关卡无限生成, 难度逐波递增, 每 5 波出现 BOSS</div>
            <button class="btn btn-secondary" id="btn-sound" style="font-size:12px; padding:8px 20px;">${Audio.muted ? '🔇 音效关' : '🔊 音效开'}</button>
            <div class="controls-hint">WASD 移动 · 鼠标瞄准 · 点击射击</div>
        `);

        document.getElementById('btn-start').addEventListener('click', () => {
            Audio.resume();
            game.startGame();
        });

        document.getElementById('btn-endless').addEventListener('click', () => {
            Audio.resume();
            game.startEndlessGame();
        });

        document.getElementById('btn-sound').addEventListener('click', () => {
            const muted = Audio.toggleMute();
            document.getElementById('btn-sound').textContent = muted ? '🔇 音效关' : '🔊 音效开';
        });

        this.ui.querySelectorAll('.level-card').forEach(card => {
            if (card.classList.contains('locked')) return;
            card.addEventListener('click', () => {
                const levelIdx = parseInt(card.dataset.level);
                game.selectedLevel = levelIdx;
                this.ui.querySelectorAll('.level-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });
    }
}


// ====== Game Scene ======
class GameScene extends Scene {
    constructor(game) {
        super(game);
        this.name = 'Game';
        this.isPlaying = true;
        this.paused = false;
        this.pauseOverlay = null;
        this.levelBannerEl = null;
        this.objectiveBannerEl = null;
    }

    enter() {
        super.enter();
        this.paused = false;
        this.setupPauseOverlay();
        this.showLevelBanner();
    }

    setupPauseOverlay() {
        const container = document.getElementById('scene-container');
        this.pauseOverlay = document.createElement('div');
        this.pauseOverlay.className = 'pause-overlay';
        this.pauseOverlay.style.display = 'none';
        this.pauseOverlay.innerHTML = `
            <h2>暂 停</h2>
            <div class="pause-subtitle">SYSTEM PAUSED</div>
            <button class="btn" id="btn-resume">▶ 继续战斗</button>
            <button class="btn btn-secondary" id="btn-restart">↻ 重新开始</button>
            <button class="btn btn-danger" id="btn-quit">← 返回主菜单</button>
            <div class="pause-hint">按 ESC 键继续</div>
        `;
        container.appendChild(this.pauseOverlay);

        document.getElementById('btn-resume').addEventListener('click', () => {
            this.game.togglePause();
        });
        document.getElementById('btn-restart').addEventListener('click', () => {
            if (this.paused) this.game.togglePause();
            if (this.game.endlessMode) {
                this.game.startEndlessGame();
            } else {
                this.game.startGame();
            }
        });
        document.getElementById('btn-quit').addEventListener('click', () => {
            if (this.paused) this.game.togglePause();
            this.game.returnToMenu();
        });
    }

    showLevelBanner() {
        const game = this.game;
        let levelConfig;
        let title;
        if (game.endlessMode) {
            levelConfig = game.maze && game.maze.config;
            if (!levelConfig) return;
            title = levelConfig.isBossLevel
                ? `♾️ 无尽 BOSS 波次 ${game.endlessWave}`
                : `♾️ 无尽波次 ${game.endlessWave}`;
        } else {
            levelConfig = CONFIG.LEVELS[game.currentLevel];
            if (!levelConfig) return;
            title = `第 ${levelConfig.id} 关`;
        }

        const container = document.getElementById('scene-container');
        this.levelBannerEl = document.createElement('div');
        this.levelBannerEl.className = 'level-banner';
        if (game.endlessMode) {
            // Slightly different styling to indicate endless banner
            this.levelBannerEl.style.background = 'linear-gradient(135deg,rgba(255,107,107,0.92),rgba(238,90,36,0.92))';
        }
        this.levelBannerEl.innerHTML = `
            <div class="level-banner-title">${title}</div>
            <div class="level-banner-subtitle">${levelConfig.name}</div>
            <div class="level-banner-objective">🎯 ${levelConfig.objectiveText || ''}</div>
        `;
        container.appendChild(this.levelBannerEl);

        setTimeout(() => {
            if (this.levelBannerEl && this.levelBannerEl.parentNode) {
                this.levelBannerEl.remove();
                this.levelBannerEl = null;
            }
        }, 3000);
    }

    showObjectiveBanner(text) {
        const container = document.getElementById('scene-container');
        if (this.objectiveBannerEl) this.objectiveBannerEl.remove();
        this.objectiveBannerEl = document.createElement('div');
        this.objectiveBannerEl.className = 'objective-banner';
        this.objectiveBannerEl.innerHTML = `<div class="objective-banner-text">${text}</div>`;
        container.appendChild(this.objectiveBannerEl);

        setTimeout(() => {
            if (this.objectiveBannerEl && this.objectiveBannerEl.parentNode) {
                this.objectiveBannerEl.remove();
                this.objectiveBannerEl = null;
            }
        }, 2500);
    }

    update(dt) {
        if (Input.consumeKey('Escape')) {
            this.game.togglePause();
            return;
        }
        if (this.paused) return;
        this.game.update(dt);
    }

    draw(ctx) {
        this.game.draw(ctx);
    }

    exit() {
        super.exit();
        if (this.pauseOverlay) {
            this.pauseOverlay.remove();
            this.pauseOverlay = null;
        }
        if (this.levelBannerEl) {
            this.levelBannerEl.remove();
            this.levelBannerEl = null;
        }
        if (this.objectiveBannerEl) {
            this.objectiveBannerEl.remove();
            this.objectiveBannerEl = null;
        }
    }
}


// ====== Game Over Scene ======
class GameOverScene extends Scene {
    constructor(game) {
        super(game);
        this.name = 'GameOver';
    }

    enter() {
        super.enter();
        this.createGameOver();
    }

    createGameOver() {
        const game = this.game;

        if (game.endlessMode) {
            // ====== Endless mode defeat screen ======
            const endlessHighScore = game.endlessHighScore;
            const isNewRecord = game.score >= endlessHighScore && game.score > 0;
            // High score already saved in endGame for endless mode; safety update in case
            if (isNewRecord) {
                localStorage.setItem('tankmaze_endless_highscore', game.score.toString());
            }
            this.ui = this.createUI(`
                <h1 class="game-over-title">无尽挑战终结</h1>
                <div style="color:#ff4444; font-size:18px; letter-spacing:4px; margin-bottom:20px;">DEFEAT · ENDLESS RUN</div>
                ${isNewRecord ? '<div style="color:#ffcc00; font-size:18px; margin-bottom:15px;">🏆 无尽模式新纪录!</div>' : ''}
                <div class="info-panel" style="text-align:left;">
                    <div><span class="label">抵达波次:</span> <span class="value">第 ${game.endlessWave} 波</span></div>
                    <div><span class="label">本次得分:</span> <span class="value">${Utils.formatNumber(game.score)}</span></div>
                    <div><span class="label">击毁敌军:</span> <span class="value">${game.enemiesKilled}</span></div>
                    <div><span class="label">无尽最高:</span> <span class="value">${Utils.formatNumber(Math.max(endlessHighScore, game.score))}</span></div>
                </div>
                <button class="btn" id="btn-retry" style="background:linear-gradient(135deg,#ff6b6b,#ee5a24);">♾️ 再次挑战无尽</button>
                <button class="btn btn-secondary" id="btn-menu">← 返回主菜单</button>
            `);
            Audio.playGameOver();
            document.getElementById('btn-retry').addEventListener('click', () => {
                game.startEndlessGame();
            });
            document.getElementById('btn-menu').addEventListener('click', () => {
                game.returnToMenu();
            });
            return;
        }

        // ====== Normal campaign defeat ======
        const levelConfig = CONFIG.LEVELS[game.currentLevel];
        const highScore = parseInt(localStorage.getItem('tankmaze_highscore') || '0');
        const isNewRecord = game.score > highScore;

        if (isNewRecord) {
            localStorage.setItem('tankmaze_highscore', game.score.toString());
        }

        const earnedScore = game.score;

        this.ui = this.createUI(`
            <h1 class="game-over-title">战斗失败</h1>
            <div style="color:#ff4444; font-size:18px; letter-spacing:4px; margin-bottom:20px;">DEFEAT</div>
            ${isNewRecord ? '<div style="color:#ffcc00; font-size:18px; margin-bottom:15px;">🏆 新纪录!</div>' : ''}
            <div class="info-panel" style="text-align:left;">
                <div><span class="label">关卡:</span> <span class="value">第 ${levelConfig.id} 关 - ${levelConfig.name}</span></div>
                <div><span class="label">本关得分:</span> <span class="value">${Utils.formatNumber(earnedScore)}</span></div>
                <div><span class="label">击毁敌军:</span> <span class="value">${game.enemiesKilled}</span></div>
                <div><span class="label">战役最高:</span> <span class="value">${Utils.formatNumber(Math.max(highScore, game.score))}</span></div>
            </div>
            <button class="btn" id="btn-retry">▶ 重新挑战</button>
            <button class="btn btn-secondary" id="btn-menu">← 返回主菜单</button>
        `);

        Audio.playGameOver();

        document.getElementById('btn-retry').addEventListener('click', () => {
            game.startGame();
        });
        document.getElementById('btn-menu').addEventListener('click', () => {
            game.returnToMenu();
        });
    }
}


// ====== Victory Scene ======
class VictoryScene extends Scene {
    constructor(game) {
        super(game);
        this.name = 'Victory';
    }

    enter() {
        super.enter();
        this.createVictory();
    }

    createVictory() {
        const game = this.game;
        const levelConfig = CONFIG.LEVELS[game.currentLevel];
        const isFinalLevel = game.currentLevel >= CONFIG.LEVELS.length - 1;
        const highScore = parseInt(localStorage.getItem('tankmaze_highscore') || '0');
        const isNewRecord = game.score > highScore;

        if (isNewRecord) {
            localStorage.setItem('tankmaze_highscore', game.score.toString());
        }

        // Note: score added to totalScore in endGame() for campaign victories; no double-count here

        // Always keep a clear next-step action on the victory screen.
        // On the final campaign level, nextLevel() safely returns to the menu.
        const nextLevelBtn = '<button class="btn" id="btn-next" style="background:linear-gradient(135deg,#00ff88,#00cc66);">▶ 下一关</button>';

        this.ui = this.createUI(`
            <h1 class="victory-title">关卡完成!</h1>
            <div style="color:#00ff88; font-size:18px; letter-spacing:4px; margin-bottom:20px;">VICTORY</div>
            ${isNewRecord ? '<div style="color:#ffcc00; font-size:18px; margin-bottom:15px;">🏆 新纪录!</div>' : ''}
            <div class="info-panel" style="text-align:left;">
                <div><span class="label">关卡:</span> <span class="value">第 ${levelConfig.id} 关 - ${levelConfig.name}</span></div>
                <div><span class="label">本关得分:</span> <span class="value">${Utils.formatNumber(game.score)}</span></div>
                <div><span class="label">击毁敌军:</span> <span class="value">${game.enemiesKilled}</span></div>
                <div><span class="label">战役总分:</span> <span class="value">${Utils.formatNumber(game.totalScore)}</span></div>
                <div><span class="label">战役最高:</span> <span class="value">${Utils.formatNumber(Math.max(highScore, game.score))}</span></div>
            </div>
            ${nextLevelBtn}
            <button class="btn btn-secondary" id="btn-menu">← 返回主菜单</button>
        `);

        if (isFinalLevel) {
            Audio.playVictory();
        } else {
            Audio.playLevelComplete();
        }

        const nextBtn = document.getElementById('btn-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                game.nextLevel();
            });
        }
        document.getElementById('btn-menu').addEventListener('click', () => {
            game.returnToMenu();
        });
    }
}

window.MenuScene = MenuScene;
window.GameScene = GameScene;
window.GameOverScene = GameOverScene;
window.VictoryScene = VictoryScene;
