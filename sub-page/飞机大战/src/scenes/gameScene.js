class GameScene extends Scene {
    constructor(game) {
        super(game);
        this.name = 'Game';
        this.isPlaying = true;
        this.paused = false;

        this.tutorialSteps = [
            {
                title: '欢迎来到星际战场！',
                content: '作为一名飞行员，你将在浩瀚宇宙中驾驶战机对抗敌军。\n你的任务是击败所有敌人，保卫星际和平。',
                icon: '🚀'
            },
            {
                title: '移动战机',
                content: '使用 WASD 或 方向键 移动战机\n也可以使用 鼠标 或 触屏拖拽\n灵活移动躲避敌人攻击！',
                icon: '🎮'
            },
            {
                title: '射击与道具',
                content: '战机会自动射击，无需手动操作\n击败敌人后会掉落道具\n收集道具可以增强你的战力！',
                icon: '💎'
            },
            {
                title: '大招与炸弹',
                content: '空格键 释放大招（能量满时可用）\n对全场敌人造成巨额伤害\nB键 投掷炸弹，清屏并对BOSS造成大量伤害',
                icon: '⚡'
            },
            {
                title: '通关条件',
                content: '击败BOSS可进入下一关！\n每一关都更具挑战性\n坚持到底，成为最强飞行员！',
                icon: '🏆'
            }
        ];

        this.currentTutorialStep = 0;
        this.tutorialOverlay = null;
        this.tutorialAutoDismissTimer = null;

        this.stageBannerTimer = 0;
        this.stageBannerDuration = 3;
        this.lastStageIndex = -1;

        this.endlessBanner = null;
        this.endlessBannerTimer = 0;

        this.stageTransitionPending = false;
        this.stageTransitionTimer = 0;
    }

    enter() {
        this.paused = false;
        super.enter();
        this.setupPauseOverlay();
        this.setupGameUI();

        if (typeof this.game.initPlayer === 'function') {
            this.game.initPlayer();
        }

        this.lastStageIndex = this.game.currentStage;

        if (this.game.selectedMode === 'story') {
            this.showStageBanner();
            const stages = CONFIG.GAME_MODES.story.stages;
            const currentStage = stages[this.game.currentStage];
            if (currentStage && currentStage.tutorial && this.game.storyProgress === 0) {
                this.showTutorial();
            }
        } else if (this.game.selectedMode === 'endless') {
            this.showEndlessBanner();
        }
    }

    setupGameUI() {
        const container = document.getElementById('scene-container');

        this.stageBanner = document.createElement('div');
        this.stageBanner.className = 'stage-banner';
        this.stageBanner.innerHTML = `
            <div class="stage-banner-title"></div>
            <div class="stage-banner-subtitle"></div>
            <div class="stage-banner-bar"></div>
        `;
        container.appendChild(this.stageBanner);

        this.endlessBanner = document.createElement('div');
        this.endlessBanner.className = 'endless-banner';
        this.endlessBanner.innerHTML = `
            <div class="endless-banner-title">无尽挑战</div>
            <div class="endless-banner-subtitle">ENDLESS SURVIVAL</div>
            <div class="endless-banner-bar"></div>
        `;
        container.appendChild(this.endlessBanner);
    }

    setupPauseOverlay() {
        const container = document.getElementById('scene-container');
        this.pauseOverlay = document.createElement('div');
        this.pauseOverlay.className = 'pause-overlay';
        this.pauseOverlay.style.display = 'none';
        this.pauseOverlay.innerHTML = `
            <div class="pause-icon"></div>
            <h2>暂 停</h2>
            <div class="pause-subtitle">SYSTEM PAUSED</div>
            <button class="btn" id="btn-resume">▶ 继续游戏</button>
            <button class="btn btn-secondary" id="btn-restart">↻ 重新开始</button>
            <button class="btn btn-danger" id="btn-quit">← 返回主菜单</button>
            <div class="pause-hint">按 ESC 或 P 键继续</div>
        `;
        container.appendChild(this.pauseOverlay);

        document.getElementById('btn-resume').addEventListener('click', () => {
            this.game.togglePause();
        });
        document.getElementById('btn-restart').addEventListener('click', () => {
            if (this.paused) { this.game.togglePause(); }
            this.game.startGame();
        });
        document.getElementById('btn-quit').addEventListener('click', () => {
            if (this.paused) { this.game.togglePause(); }
            this.game.returnToMenu();
        });
    }

    togglePause() {
        this.game.togglePause();
    }

    showTutorial() {
        if (this.game.storyProgress > 0) return;

        this.tutorialOverlay = document.createElement('div');
        this.tutorialOverlay.className = 'tutorial-overlay';
        this.tutorialOverlay.innerHTML = this.buildTutorialStep(0);
        document.getElementById('scene-container').appendChild(this.tutorialOverlay);

        this.bindTutorialEvents();
        this.scheduleTutorialAutoDismiss();
        this.tutorialActive = true;
        this.game.isTutorial = true;
    }

    buildTutorialStep(stepIndex) {
        const step = this.tutorialSteps[stepIndex];
        const isLastStep = stepIndex === this.tutorialSteps.length - 1;
        const progressDots = this.tutorialSteps.map((_, i) => {
            return `<div class="tutorial-dot ${i === stepIndex ? 'active' : ''}"></div>`;
        }).join('');

        return `
            <div class="tutorial-panel">
                <div class="tutorial-header">
                    <div class="tutorial-icon">${step.icon}</div>
                    <div class="tutorial-progress">${progressDots}</div>
                </div>
                <h2 class="tutorial-title">${step.title}</h2>
                <div class="tutorial-content">${step.content.replace(/\n/g, '<br>')}</div>
                <div class="tutorial-footer">
                    <div class="tutorial-hint">提示：可自动跳过，或点击下方按钮</div>
                    <button class="btn tutorial-btn" id="btn-tutorial-next">
                        ${isLastStep ? '开始游戏 ▶' : '下一步 ▶'}
                    </button>
                </div>
                <button class="tutorial-skip" id="btn-tutorial-skip">跳过教程</button>
            </div>
        `;
    }

    bindTutorialEvents() {
        const nextBtn = document.getElementById('btn-tutorial-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.advanceTutorial());
        }
        const skipBtn = document.getElementById('btn-tutorial-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.completeTutorial());
        }
    }

    advanceTutorial() {
        if (!this.tutorialActive) return;
        this.cancelTutorialAutoDismiss();

        this.currentTutorialStep++;
        if (this.currentTutorialStep >= this.tutorialSteps.length) {
            this.completeTutorial();
            return;
        }

        if (this.tutorialOverlay) {
            this.tutorialOverlay.innerHTML = this.buildTutorialStep(this.currentTutorialStep);
            this.bindTutorialEvents();
            this.scheduleTutorialAutoDismiss();
        }
    }

    scheduleTutorialAutoDismiss() {
        this.cancelTutorialAutoDismiss();
        this.tutorialAutoDismissTimer = setTimeout(() => {
            if (this.tutorialActive) {
                this.advanceTutorial();
            }
        }, 5000);
    }

    cancelTutorialAutoDismiss() {
        if (this.tutorialAutoDismissTimer) {
            clearTimeout(this.tutorialAutoDismissTimer);
            this.tutorialAutoDismissTimer = null;
        }
    }

    completeTutorial() {
        this.tutorialActive = false;
        this.cancelTutorialAutoDismiss();
        this.game.isTutorial = false;
        if (this.tutorialOverlay) {
            this.tutorialOverlay.classList.add('tutorial-fade-out');
            setTimeout(() => {
                if (this.tutorialOverlay && this.tutorialOverlay.parentNode) {
                    this.tutorialOverlay.parentNode.removeChild(this.tutorialOverlay);
                }
                this.tutorialOverlay = null;
            }, 400);
        }
    }

    showStageBanner() {
        if (this.game.selectedMode !== 'story') return;

        const stages = CONFIG.GAME_MODES.story.stages;
        const stageIndex = this.game.currentStage;
        const stage = stages[stageIndex];
        if (!stage) return;

        const titleEl = this.stageBanner.querySelector('.stage-banner-title');
        const subtitleEl = this.stageBanner.querySelector('.stage-banner-subtitle');
        const barEl = this.stageBanner.querySelector('.stage-banner-bar');

        titleEl.textContent = `第 ${stage.id} 关`;
        subtitleEl.textContent = stage.name;

        this.stageBanner.classList.remove('stage-banner-hidden');
        this.stageBanner.classList.add('stage-banner-visible');

        this.stageBannerTimer = this.stageBannerDuration;
    }

    showEndlessBanner() {
        this.endlessBanner.classList.remove('endless-banner-hidden');
        this.endlessBanner.classList.add('endless-banner-visible');
        this.endlessBannerTimer = 3;
    }

    updateStageBanner(dt) {
        if (this.stageBannerTimer > 0) {
            this.stageBannerTimer -= dt;
            if (this.stageBannerTimer <= 1.5 && this.stageBannerTimer > 0) {
                this.stageBanner.classList.add('stage-banner-fade-out');
            }
            if (this.stageBannerTimer <= 0) {
                this.stageBanner.classList.remove('stage-banner-visible');
                this.stageBanner.classList.add('stage-banner-hidden');
                this.stageBanner.classList.remove('stage-banner-fade-out');
            }
        }

        if (this.endlessBannerTimer > 0) {
            this.endlessBannerTimer -= dt;
            if (this.endlessBannerTimer <= 1 && this.endlessBannerTimer > 0) {
                this.endlessBanner.classList.add('endless-banner-fade-out');
            }
            if (this.endlessBannerTimer <= 0) {
                this.endlessBanner.classList.remove('endless-banner-visible');
                this.endlessBanner.classList.add('endless-banner-hidden');
                this.endlessBanner.classList.remove('endless-banner-fade-out');
            }
        }
    }

    updateStageProgression(dt) {
        if (this.game.selectedMode !== 'story') return;

        if (this.game.currentStage !== this.lastStageIndex) {
            this.lastStageIndex = this.game.currentStage;
            this.showStageBanner();

            const stages = CONFIG.GAME_MODES.story.stages;
            const stage = stages[this.game.currentStage];
            if (stage) {
                this.game.spawnMult = stage.spawnMult;
                this.game.isTutorial = stage.tutorial || false;
            }
        }
    }

    updateEndlessMode(dt) {
        if (this.game.selectedMode !== 'endless') return;

        if (!this.game.isBossFight && this.game.gameTime > 0) {
            const targetSpawnMult = 1 + Math.floor(this.game.gameTime / 45) * 0.15;
            this.game.spawnMult = Math.min(targetSpawnMult, 3.0);
        }
    }

    update(dt) {
        // P/ESC 键检测放在最前：即使 paused 也能检测到恢复
        if (Input.consumeKey('Escape') || Input.consumeKey('KeyP')) {
            this.game.togglePause();
            return;
        }
        if (this.paused) return;

        // 关卡完成界面显示时暂停游戏更新
        if (this.game.stageComplete) {
            this.updateStageBanner(dt);
            return;
        }

        if (this.tutorialActive) {
            this.game.update(0);
            this.updateStageBanner(dt);
            return;
        }

        this.updateStageBanner(dt);
        this.updateStageProgression(dt);
        this.updateEndlessMode(dt);

        this.game.update(dt);
    }

    draw(ctx) {
        this.game.draw(ctx);
    }

    showStageComplete(nextStageIndex) {
        // 避免重复创建
        if (this.stageCompleteOverlay) return;

        const stages = CONFIG.GAME_MODES.story.stages;
        const nextStage = stages[nextStageIndex];
        const container = document.getElementById('scene-container');

        this.stageCompleteOverlay = document.createElement('div');
        this.stageCompleteOverlay.className = 'pause-overlay';
        this.stageCompleteOverlay.style.display = 'flex';

        const earnedPoints = Math.floor(this.game.score / 10);

        this.stageCompleteOverlay.innerHTML = `
            <div class="pause-panel">
                <h2 class="pause-title" style="color:#00ff88;">关卡完成！</h2>
                <div class="pause-subtitle" style="color:#ffcc00;">本关得分: ${Utils.formatNumber(this.game.score)}</div>
                <div class="pause-subtitle" style="color:#00ffff;">获得积分: +${Utils.formatNumber(earnedPoints)}</div>
                ${nextStage ? `<div class="pause-subtitle" style="color:#aaa; margin-top:8px;">下一关: 第 ${nextStage.id} 关 - ${nextStage.name}</div>` : ''}
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px; min-width:260px;">
                    ${nextStage ? '<button class="btn" id="btn-continue-next" style="background:linear-gradient(135deg,#00ff88,#00cc66);">▶ 继续下一关</button>' : ''}
                    <button class="btn btn-secondary" id="btn-stage-quit">← 返回主菜单</button>
                </div>
            </div>
        `;
        container.appendChild(this.stageCompleteOverlay);

        const continueBtn = document.getElementById('btn-continue-next');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.hideStageComplete();
                this.game.continueNextStage();
                this.lastStageIndex = this.game.currentStage;
                this.showStageBanner();
            });
        }

        document.getElementById('btn-stage-quit').addEventListener('click', () => {
            this.hideStageComplete();
            this.game.returnToMenu();
        });
    }

    hideStageComplete() {
        if (this.stageCompleteOverlay) {
            this.stageCompleteOverlay.remove();
            this.stageCompleteOverlay = null;
        }
    }

    exit() {
        super.exit();

        this.cancelTutorialAutoDismiss();

        if (this.pauseOverlay) {
            this.pauseOverlay.remove();
            this.pauseOverlay = null;
        }

        if (this.stageBanner && this.stageBanner.parentNode) {
            this.stageBanner.parentNode.removeChild(this.stageBanner);
            this.stageBanner = null;
        }

        if (this.endlessBanner && this.endlessBanner.parentNode) {
            this.endlessBanner.parentNode.removeChild(this.endlessBanner);
            this.endlessBanner = null;
        }

        if (this.tutorialOverlay && this.tutorialOverlay.parentNode) {
            this.tutorialOverlay.parentNode.removeChild(this.tutorialOverlay);
            this.tutorialOverlay = null;
        }

        this.hideStageComplete();
    }
}