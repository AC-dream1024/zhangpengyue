class MenuScene extends Scene {
    constructor(game) {
        super(game);
        this.name = 'Menu';
        this.selectedDifficulty = 'easy';
    }

    enter() {
        super.enter();
        this.createMenu();
    }

    createMenu() {
        const game = this.game;
        const highScore = parseInt(localStorage.getItem('tankbattalion_highscore') || '0');
        const tankTypes = CONFIG.TANK_TYPES;
        const modes = CONFIG.GAME_MODES;
        const skills = CONFIG.SKILLS;

        let tankHTML = '';
        for (const key in tankTypes) {
            const tank = tankTypes[key];
            const stats = tank.stats;
            const active = game.selectedShip === tank.id ? 'active' : '';
            tankHTML += `
                <div class="ship-card ${active}" data-ship="${tank.id}" style="--ship-color:${tank.color};">
                    <div class="ship-card-icon">${tank.icon}</div>
                    <div class="ship-card-name">${tank.name}</div>
                    <div class="ship-card-codename">${tank.codename}</div>
                    <div class="ship-card-advantage">${tank.advantage}</div>
                    <div class="ship-card-desc">${tank.description}</div>
                    <div class="ship-stats">
                        <span class="ship-stats-item">❤ ${stats.maxHp}</span>
                        <span class="ship-stats-item">⚡ ${stats.speed}</span>
                        <span class="ship-stats-item">🔥 ${(1 / stats.fireRate).toFixed(1)}/s</span>
                    </div>
                </div>
            `;
        }

        let modeHTML = '';
        for (const key in modes) {
            const mode = modes[key];
            const active = game.selectedMode === mode.id ? 'active' : '';
            modeHTML += `
                <div class="mode-card ${active}" data-mode="${mode.id}">
                    <div class="mode-card-name">${mode.name}</div>
                    <div class="mode-card-desc">${mode.description}</div>
                </div>
            `;
        }

        let skillHTML = '';
        for (const key in skills) {
            const skill = skills[key];
            skillHTML += `
                <div class="skill-card">
                    <div class="skill-card-header">
                        <span class="skill-card-icon">${skill.icon}</span>
                        <span class="skill-card-name">${skill.name}</span>
                        <span class="skill-card-key">[${skill.key}]</span>
                    </div>
                    <div class="skill-card-desc">${skill.description}</div>
                </div>
            `;
        }

        let progressHTML = '';
        const stages = CONFIG.GAME_MODES.story ? CONFIG.GAME_MODES.story.stages : [];
        if (game.storyProgress > 0 && stages.length > 0) {
            progressHTML = `<div class="story-progress">战役进度: 已解锁 ${game.storyProgress + 1} / ${stages.length} 关</div>`;
        }

        // 关卡选择 HTML（仅 story 模式）
        let stageSelectHTML = '';
        if (stages.length > 0) {
            let stageCards = '';
            stages.forEach((stage, i) => {
                const unlocked = i <= game.storyProgress;
                const isCurrent = i === game.selectedStage;
                const lockIcon = unlocked ? '' : '🔒 ';
                const cardClass = unlocked ? (isCurrent ? 'stage-card active' : 'stage-card') : 'stage-card locked';
                stageCards += `
                    <div class="${cardClass}" data-stage="${i}" ${unlocked ? '' : 'style="opacity:0.4; pointer-events:none;"'}>
                        <div class="stage-card-num">${lockIcon}第 ${stage.id} 关</div>
                        <div class="stage-card-name">${stage.name}</div>
                    </div>
                `;
            });
            stageSelectHTML = `
                <div class="section-label stage-select-section" style="${game.selectedMode === 'story' ? '' : 'display:none;'}">选择关卡</div>
                <div class="stage-grid" id="stage-grid" style="${game.selectedMode === 'story' ? '' : 'display:none;'}">
                    ${stageCards}
                </div>
            `;
        }

        this.ui = this.createUI(`
            <h1>钢铁洪流</h1>
            <h2>STEEL TORRENT: TANK BATTLEFIELD</h2>
            <div class="highscore">最高纪录: ${Utils.formatNumber(highScore)} | 积分: ${Utils.formatNumber(game.totalPoints)}</div>
            ${progressHTML}

            <div class="section-label">选择坦克</div>
            <div class="ship-grid">
                ${tankHTML}
            </div>

            <div class="section-label">选择模式</div>
            <div class="mode-grid">
                ${modeHTML}
            </div>

            ${stageSelectHTML}

            <div class="section-label">难度选择</div>
            <div class="difficulty-selector">
                <button class="diff-btn ${this.selectedDifficulty === 'easy' ? 'active' : ''}" data-diff="easy">简单</button>
                <button class="diff-btn ${this.selectedDifficulty === 'normal' ? 'active' : ''}" data-diff="normal">普通</button>
                <button class="diff-btn ${this.selectedDifficulty === 'hard' ? 'active' : ''}" data-diff="hard">困难</button>
            </div>

            <div class="section-label">技能说明</div>
            <div class="skill-grid">
                ${skillHTML}
            </div>

            <button class="btn" id="btn-start">▶ 开始战斗</button>
            <button class="btn btn-secondary" id="btn-shop">🛒 升级商店</button>

            <div style="display: flex; gap: 10px; margin: 8px 0;">
                <button class="btn btn-secondary" id="btn-sound" style="font-size: 12px; padding: 6px 16px; min-width: 140px;">${Audio.muted ? '🔇 音效: 关' : '🔊 音效: 开'}</button>
                <button class="btn btn-danger" id="btn-reset" style="font-size: 12px; padding: 6px 16px; min-width: 140px;">重置纪录</button>
            </div>

            <div class="controls-hint">v1.0 | Canvas 2D | 零依赖</div>
        `);

        document.getElementById('btn-start').addEventListener('click', () => {
            Audio.resume();
            game.setDifficulty(this.selectedDifficulty);
            game.startGame();
        });

        document.getElementById('btn-shop').addEventListener('click', () => {
            game.returnToShop();
        });

        this.ui.querySelectorAll('.ship-card').forEach(card => {
            card.addEventListener('click', () => {
                const tankId = card.dataset.ship;
                game.setShip(tankId);
                this.ui.querySelectorAll('.ship-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });

        this.ui.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                const mode = card.dataset.mode;
                game.setMode(mode);
                this.ui.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                const stageSection = this.ui.querySelector('.stage-select-section');
                const stageGrid = this.ui.querySelector('#stage-grid');
                if (mode === 'story') {
                    if (stageSection) stageSection.style.display = '';
                    if (stageGrid) stageGrid.style.display = '';
                } else {
                    if (stageSection) stageSection.style.display = 'none';
                    if (stageGrid) stageGrid.style.display = 'none';
                }
            });
        });

        this.ui.querySelectorAll('.stage-card').forEach(card => {
            if (card.classList.contains('locked')) return;
            card.addEventListener('click', () => {
                const stageIdx = parseInt(card.dataset.stage);
                game.selectedStage = stageIdx;
                this.ui.querySelectorAll('.stage-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });

        this.ui.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedDifficulty = btn.dataset.diff;
                this.ui.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        const soundBtn = document.getElementById('btn-sound');
        soundBtn.addEventListener('click', () => {
            const muted = Audio.toggleMute();
            soundBtn.textContent = muted ? '🔇 音效: 关' : '🔊 音效: 开';
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            if (confirm('确定要重置最高纪录吗？')) {
                localStorage.setItem('tankbattalion_highscore', '0');
                this.enter();
            }
        });
    }

    update(dt) {
        this.game.battlefield.update(dt);
    }

    draw(ctx) {
        this.game.battlefield.draw(ctx);
    }
};
