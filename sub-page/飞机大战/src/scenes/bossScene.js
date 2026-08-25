class BossScene extends GameScene {
    constructor(game) {
        super(game);
        this.name = 'Boss';
    }

    enter() {
        super.enter();
        // 确保 BOSS 血条在 enter 时可见
        if (this.game.boss && this.game.boss.active) {
            this.game.hud.showBossBar(this.game.boss);
        }
    }

    update(dt) {
        // 暂停时只处理按键：直接用 P/ESC 恢复
        if (this.paused) {
            if (Input.keyPressed('Escape') || Input.keyPressed('KeyP')) {
                this.game.togglePause();
            }
            return;
        }
        this.game.update(dt);
    }

    draw(ctx) {
        this.game.draw(ctx);
    }
};
