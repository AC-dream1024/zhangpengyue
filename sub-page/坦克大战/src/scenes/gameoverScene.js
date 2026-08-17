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
        const highScore = parseInt(localStorage.getItem('tankbattalion_highscore') || '0');
        const isNewRecord = game.score > highScore;

        if (isNewRecord) {
            localStorage.setItem('tankbattalion_highscore', game.score.toString());
        }

        const earnedPoints = Math.floor(game.score / 10);
        const tankConfig = CONFIG.TANK_TYPES[game.selectedShip] || CONFIG.TANK_TYPES.judgment;
        const modeConfig = CONFIG.GAME_MODES[game.selectedMode] || CONFIG.GAME_MODES.story;
        const totalStages = CONFIG.GAME_MODES.story ? CONFIG.GAME_MODES.story.stages.length : 0;

        let isVictory = game.isVictory;
        if (game.selectedMode === 'story' && totalStages > 0) {
            if (game.storyProgress >= totalStages - 1 && game.isVictory) {
                isVictory = true;
            }
        }

        let stageInfo = '';
        if (game.selectedMode === 'story') {
            const stageIndex = game.currentStage || 0;
            const stageConfig = CONFIG.GAME_MODES.story.stages[stageIndex];
            const stageName = stageConfig ? stageConfig.name : `第 ${stageIndex + 1} 关`;
            stageInfo = `<div><span class="label">到达关卡:</span> <span class="value">${stageName} (${stageIndex + 1}/${totalStages})</span></div>`;
        } else {
            const survivalTime = Math.floor(game.gameTime) || 0;
            const minutes = Math.floor(survivalTime / 60);
            const seconds = survivalTime % 60;
            stageInfo = `<div><span class="label">生存时间:</span> <span class="value">${minutes}分${seconds}秒</span></div>`;
        }

        this.ui = this.createUI(`
            <h1 class="${isVictory ? 'victory-title' : 'game-over-title'}">
                ${isVictory ? '战斗胜利' : '战斗结束'}
            </h1>
            <div style="color: ${isVictory ? '#00ff88' : '#ff4444'}; font-size: 18px; letter-spacing: 4px; margin-bottom: 20px;">
                ${isVictory ? 'VICTORY' : 'GAME OVER'}
            </div>
            ${isNewRecord ? '<div style="color: #ffaa00; font-size: 18px; margin-bottom: 15px; text-shadow: 0 0 10px #ffaa00;">🏆 新纪录！</div>' : ''}
            <div class="info-panel" style="text-align: left;">
                <div><span class="label">最终得分:</span> <span class="value">${Utils.formatNumber(game.score)}</span></div>
                <div><span class="label">获得积分:</span> <span class="value" style="color:#ffaa00;">+${Utils.formatNumber(earnedPoints)}</span></div>
                <div><span class="label">积分余额:</span> <span class="value">${Utils.formatNumber(game.totalPoints)}</span></div>
                <div><span class="label">最高连击:</span> <span class="value">${game.maxCombo}x</span></div>
                <div><span class="label">击毁敌军:</span> <span class="value">${game.enemiesKilled}</span></div>
                <div><span class="label">使用坦克:</span> <span class="value">${tankConfig.icon || ''} ${tankConfig.name}</span></div>
                <div><span class="label">游戏模式:</span> <span class="value">${modeConfig.name}</span></div>
                ${stageInfo}
                ${game.bossDefeated ? `<div><span class="label">BOSS 奖励:</span> <span class="value">+${CONFIG.BOSS.score}</span></div>` : ''}
                <div><span class="label">最高纪录:</span> <span class="value">${Utils.formatNumber(Math.max(highScore, game.score))}</span></div>
            </div>
            <button class="btn" id="btn-shop">🛒 前往升级商店</button>
            <button class="btn btn-secondary" id="btn-retry">▶ 重新开始</button>
            <button class="btn btn-secondary" id="btn-menu">← 返回主菜单</button>
        `);

        if (isVictory) {
            Audio.playVictory();
        } else {
            Audio.playGameOver();
        }

        document.getElementById('btn-shop').addEventListener('click', () => {
            game.returnToShop();
        });

        document.getElementById('btn-retry').addEventListener('click', () => {
            game.startGame();
        });

        document.getElementById('btn-menu').addEventListener('click', () => {
            game.returnToMenu();
        });
    }

    update(dt) {
        this.game.battlefield.update(dt);
    }

    draw(ctx) {
        this.game.battlefield.draw(ctx);
    }
};
