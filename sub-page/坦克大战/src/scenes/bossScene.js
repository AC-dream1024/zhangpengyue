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
        if (this.paused) {
            if (Input.consumeKey('Escape') || Input.consumeKey('KeyP')) {
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
