class Battlefield {
    constructor() {
        // 滚动地面层：沙土/泥地纹理点
        this.layers = [
            {
                // 远景：稀疏地表颗粒
                dots: [],
                count: 90,
                speed: 18,
                size: [0.5, 1.2],
                alpha: [0.15, 0.35],
                color: ['#4a4022', '#5a4a2a']
            },
            {
                // 中景：砂石
                dots: [],
                count: 70,
                speed: 45,
                size: [1, 2],
                alpha: [0.3, 0.6],
                color: ['#6b5a30', '#7a6840']
            },
            {
                // 近景：弹坑/碎石
                dots: [],
                count: 30,
                speed: 85,
                size: [1.5, 3],
                alpha: [0.5, 0.85],
                color: ['#8a7040', '#aa8855']
            }
        ];
        this.bgGradient = null;
        this.craters = [];
        this.smokeClouds = [];
        this.scrollY = 0;
        this.initialize();
    }

    initialize() {
        for (const layer of this.layers) {
            layer.dots = [];
            for (let i = 0; i < layer.count; i++) {
                layer.dots.push({
                    x: Math.random() * CONFIG.CANVAS.width,
                    y: Math.random() * CONFIG.CANVAS.height,
                    size: Utils.random(layer.size[0], layer.size[1]),
                    alpha: Utils.random(layer.alpha[0], layer.alpha[1]),
                    color: Utils.choice(layer.color)
                });
            }
        }

        // 静态弹坑
        this.craters = [];
        for (let i = 0; i < 8; i++) {
            this.craters.push({
                x: Math.random() * CONFIG.CANVAS.width,
                y: Math.random() * CONFIG.CANVAS.height,
                r: Utils.random(8, 22),
                baseY: Math.random() * CONFIG.CANVAS.height
            });
        }

        // 飘动烟雾
        this.smokeClouds = [];
        for (let i = 0; i < 5; i++) {
            this.smokeClouds.push({
                x: Math.random() * CONFIG.CANVAS.width,
                y: Math.random() * CONFIG.CANVAS.height,
                r: Utils.random(40, 90),
                speed: Utils.random(8, 18),
                alpha: Utils.random(0.03, 0.08),
                drift: Math.random() * Math.PI * 2
            });
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
            for (const dot of layer.dots) {
                dot.x *= scaleX;
                dot.y *= scaleY;
            }
        }
        for (const crater of this.craters) {
            crater.x *= scaleX;
            crater.y *= scaleY;
            crater.baseY *= scaleY;
        }
        for (const cloud of this.smokeClouds) {
            cloud.x *= scaleX;
            cloud.y *= scaleY;
        }
        this.bgGradient = null;
    }

    update(dt) {
        this.scrollY += dt * 20;

        for (const layer of this.layers) {
            const dots = layer.dots;
            for (let i = 0; i < dots.length; i++) {
                const dot = dots[i];
                dot.y += layer.speed * dt;
                if (dot.y > CONFIG.CANVAS.height + 5) {
                    dot.y = -5;
                    dot.x = Math.random() * CONFIG.CANVAS.width;
                }
            }
        }

        // 弹坑随地面滚动
        for (const crater of this.craters) {
            crater.y += 25 * dt;
            if (crater.y > CONFIG.CANVAS.height + crater.r) {
                crater.y = -crater.r;
                crater.x = Math.random() * CONFIG.CANVAS.width;
                crater.r = Utils.random(8, 22);
            }
        }

        // 烟雾飘动
        for (const cloud of this.smokeClouds) {
            cloud.y += cloud.speed * dt;
            cloud.drift += dt * 0.5;
            cloud.x += Math.sin(cloud.drift) * 8 * dt;
            if (cloud.y > CONFIG.CANVAS.height + cloud.r) {
                cloud.y = -cloud.r;
                cloud.x = Math.random() * CONFIG.CANVAS.width;
            }
        }
    }

    draw(ctx) {
        // 缓存背景渐变：沙漠战场暮色
        if (!this.bgGradient) {
            this.bgGradient = ctx.createLinearGradient(
                0, 0, 0, CONFIG.CANVAS.height
            );
            this.bgGradient.addColorStop(0, '#1a1608');
            this.bgGradient.addColorStop(0.5, '#2a2210');
            this.bgGradient.addColorStop(1, '#1a1408');
        }

        ctx.fillStyle = this.bgGradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS.width, CONFIG.CANVAS.height);

        this.drawTacticalGrid(ctx);
        this.drawCraters(ctx);
        this.drawGroundDots(ctx);
        this.drawSmoke(ctx);
    }

    // 战术网格：滚动效果
    drawTacticalGrid(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 204, 0, 0.05)';
        ctx.lineWidth = 1;

        const gridSize = 80;
        const offset = this.scrollY % gridSize;

        // 横线
        for (let y = -gridSize + offset; y < CONFIG.CANVAS.height + gridSize; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CONFIG.CANVAS.width, y);
            ctx.stroke();
        }

        // 竖线
        for (let x = 0; x < CONFIG.CANVAS.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONFIG.CANVAS.height);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawCraters(ctx) {
        ctx.save();
        for (const crater of this.craters) {
            // 弹坑暗影
            const grad = ctx.createRadialGradient(
                crater.x, crater.y, 0,
                crater.x, crater.y, crater.r
            );
            grad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
            grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(crater.x, crater.y, crater.r, 0, Math.PI * 2);
            ctx.fill();

            // 弹坑边缘
            ctx.strokeStyle = 'rgba(120, 90, 50, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(crater.x, crater.y, crater.r * 0.6, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawGroundDots(ctx) {
        for (const layer of this.layers) {
            const dots = layer.dots;
            for (let i = 0; i < dots.length; i++) {
                const dot = dots[i];
                ctx.globalAlpha = dot.alpha;
                ctx.fillStyle = dot.color;
                ctx.fillRect(dot.x - dot.size, dot.y - dot.size, dot.size * 2, dot.size * 2);
            }
        }
        ctx.globalAlpha = 1;
    }

    drawSmoke(ctx) {
        ctx.save();
        for (const cloud of this.smokeClouds) {
            const grad = ctx.createRadialGradient(
                cloud.x, cloud.y, 0,
                cloud.x, cloud.y, cloud.r
            );
            grad.addColorStop(0, `rgba(120, 100, 70, ${cloud.alpha})`);
            grad.addColorStop(1, 'rgba(120, 100, 70, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
};
