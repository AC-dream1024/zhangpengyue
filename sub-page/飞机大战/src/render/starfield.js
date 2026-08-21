class Starfield {
    constructor() {
        this.layers = [
            {
                stars: [],
                count: 100,
                speed: 15,
                size: [0.5, 1.2],
                alpha: [0.2, 0.5],
                color: ['#444466', '#666688']
            },
            {
                stars: [],
                count: 60,
                speed: 40,
                size: [1, 2],
                alpha: [0.4, 0.8],
                color: ['#8888aa', '#aaaacc']
            },
            {
                stars: [],
                count: 25,
                speed: 80,
                size: [1.5, 3],
                alpha: [0.7, 1],
                color: ['#ccccdd', '#ffffff']
            }
        ];
        this.bgGradient = null;
        this.initialize();
    }

    initialize() {
        for (const layer of this.layers) {
            for (let i = 0; i < layer.count; i++) {
                layer.stars.push({
                    x: Math.random() * CONFIG.CANVAS.width,
                    y: Math.random() * CONFIG.CANVAS.height,
                    size: Utils.random(layer.size[0], layer.size[1]),
                    alpha: Utils.random(layer.alpha[0], layer.alpha[1]),
                    color: Utils.choice(layer.color),
                    twinkle: Math.random() * Math.PI * 2
                });
            }
        }
    }

    resize(oldW, oldH, newW, newH) {
        if (!oldW || !oldH || oldW <= 0 || oldH <= 0) {
            this.initialize();
            this.bgGradient = null;
            return;
        }
        const scaleX = newW / oldW;
        const scaleY = newH / oldH;
        for (const layer of this.layers) {
            for (const star of layer.stars) {
                star.x *= scaleX;
                star.y *= scaleY;
            }
        }
        this.bgGradient = null;
    }

    update(dt) {
        for (const layer of this.layers) {
            const stars = layer.stars;
            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                star.y += layer.speed * dt;
                star.twinkle += dt * 2;

                if (star.y > CONFIG.CANVAS.height + 5) {
                    star.y = -5;
                    star.x = Math.random() * CONFIG.CANVAS.width;
                }
            }
        }
    }

    draw(ctx) {
        // 缓存背景渐变
        if (!this.bgGradient) {
            this.bgGradient = ctx.createRadialGradient(
                CONFIG.CANVAS.width / 2, CONFIG.CANVAS.height / 2, 0,
                CONFIG.CANVAS.width / 2, CONFIG.CANVAS.height / 2, CONFIG.CANVAS.width * 0.7
            );
            this.bgGradient.addColorStop(0, '#0d0d2a');
            this.bgGradient.addColorStop(0.5, '#080820');
            this.bgGradient.addColorStop(1, '#030310');
        }

        ctx.fillStyle = this.bgGradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS.width, CONFIG.CANVAS.height);

        // 星星：无shadowBlur，用fillRect代替arc
        for (const layer of this.layers) {
            const stars = layer.stars;
            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                const twinkleAlpha = star.alpha * (0.7 + Math.sin(star.twinkle) * 0.3);
                ctx.globalAlpha = twinkleAlpha;
                ctx.fillStyle = star.color;
                ctx.fillRect(star.x - star.size, star.y - star.size, star.size * 2, star.size * 2);
            }
        }
        ctx.globalAlpha = 1;

        this.drawNebula(ctx);
    }

    drawNebula(ctx) {
        const time = Date.now() / 1000;
        const w = CONFIG.CANVAS.width;
        const h = CONFIG.CANVAS.height;
        const minDim = Math.min(w, h);
        const nebulae = [
            { x: w * 0.25, y: h * 0.21, r: minDim * 0.22, color: 'rgba(80, 20, 120, 0.08)' },
            { x: w * 0.75, y: h * 0.57, r: minDim * 0.25, color: 'rgba(20, 60, 120, 0.06)' },
            { x: w * 0.50, y: h * 0.36, r: minDim * 0.18, color: 'rgba(100, 20, 80, 0.05)' }
        ];

        for (const n of nebulae) {
            const driftX = Math.sin(time * 0.1 + n.x) * 10;
            const driftY = Math.cos(time * 0.08 + n.y) * 10;
            const gradient = ctx.createRadialGradient(
                n.x + driftX, n.y + driftY, 0,
                n.x + driftX, n.y + driftY, n.r
            );
            gradient.addColorStop(0, n.color);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, CONFIG.CANVAS.width, CONFIG.CANVAS.height);
        }
    }
};
