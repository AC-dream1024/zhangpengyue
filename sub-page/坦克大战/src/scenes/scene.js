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
};
