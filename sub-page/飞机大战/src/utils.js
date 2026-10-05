window.Utils = {
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    dist(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    distSq(x1, y1, x2, y2) {
        return (x2 - x1) ** 2 + (y2 - y1) ** 2;
    },

    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    random(min, max) {
        return Math.random() * (max - min) + min;
    },

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    choice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    chance(rate) {
        return Math.random() < rate;
    },

    aabb(a, b) {
        return !(a.x + a.width < b.x ||
                 a.x > b.x + b.width ||
                 a.y + a.height < b.y ||
                 a.y > b.y + b.height);
    },

    circleRect(cx, cy, cr, rx, ry, rw, rh) {
        const closestX = Utils.clamp(cx, rx, rx + rw);
        const closestY = Utils.clamp(cy, ry, ry + rh);
        return Utils.distSq(cx, cy, closestX, closestY) <= cr * cr;
    },

    circleCircle(x1, y1, r1, x2, y2, r2) {
        return Utils.distSq(x1, y1, x2, y2) <= (r1 + r2) * (r1 + r2);
    },

    formatNumber(n) {
        return n.toLocaleString('en-US');
    },

    uid() {
        return Math.random().toString(36).substring(2, 9);
    },

    drawGlowCircle(ctx, x, y, radius, color, glowSize) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = glowSize || radius * 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawGlowRect(ctx, x, y, w, h, color, glowSize) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = glowSize || 10;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    },

    drawGlowText(ctx, text, x, y, color, font, align) {
        ctx.save();
        ctx.font = font || '14px Orbitron';
        ctx.textAlign = align || 'left';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    drawLine(ctx, x1, y1, x2, y2, color, width, glow) {
        ctx.save();
        if (glow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = glow;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }
};