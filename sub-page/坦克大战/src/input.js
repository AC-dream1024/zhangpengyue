window.Input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false, worldX: 0, worldY: 0 },
    touch: { active: false, x: 0, y: 0 },
    canvas: null,
    scaleX: 1,
    scaleY: 1,
    paused: false,

    init(canvas) {
        this.canvas = canvas;
        this.updateScale();

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'KeyP'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        canvas.addEventListener('mousemove', (e) => {
            this.updateMouse(e);
        });

        canvas.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.updateMouse(e);
        });

        canvas.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        canvas.addEventListener('mouseleave', () => {
            this.mouse.down = false;
        });

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touch.active = true;
            this.updateTouch(e);
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.updateTouch(e);
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touch.active = false;
        }, { passive: false });

        window.addEventListener('resize', () => {
            this.updateScale();
        });
    },

    updateScale() {
        const rect = this.canvas.getBoundingClientRect();
        this.scaleX = CONFIG.CANVAS.width / rect.width;
        this.scaleY = CONFIG.CANVAS.height / rect.height;
    },

    updateMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) * this.scaleX;
        this.mouse.y = (e.clientY - rect.top) * this.scaleY;
    },

    updateTouch(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        this.touch.x = (touch.clientX - rect.left) * this.scaleX;
        this.touch.y = (touch.clientY - rect.top) * this.scaleY;
    },

    isKey(code) {
        return !!this.keys[code];
    },

    isMouseDown() {
        return this.mouse.down;
    },

    getMoveDirection() {
        let dx = 0, dy = 0;
        if (this.isKey('ArrowLeft') || this.isKey('KeyA')) dx -= 1;
        if (this.isKey('ArrowRight') || this.isKey('KeyD')) dx += 1;
        if (this.isKey('ArrowUp') || this.isKey('KeyW')) dy -= 1;
        if (this.isKey('ArrowDown') || this.isKey('KeyS')) dy += 1;
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(2);
            dx /= len;
            dy /= len;
        }
        return { x: dx, y: dy };
    },

    getAimPoint() {
        if (this.touch.active) {
            return { x: this.touch.x, y: this.touch.y };
        }
        if (this.mouse.x !== 0 || this.mouse.y !== 0) {
            return { x: this.mouse.x, y: this.mouse.y };
        }
        return null;
    },

    consumeKey(code) {
        if (this.keys[code]) {
            this.keys[code] = false;
            return true;
        }
        return false;
    },

    reset() {
        this.keys = {};
        this.mouse.down = false;
        this.touch.active = false;
    }
};
