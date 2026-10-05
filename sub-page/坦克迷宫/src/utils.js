window.Utils = {
    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    distanceSq(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    angleBetween(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    },

    angleDifference(a, b) {
        return Utils.normalizeAngle(b - a);
    },

    moveAngleToward(current, target, maxStep) {
        const diff = Utils.angleDifference(current, target);
        if (Math.abs(diff) <= maxStep) return target;
        return Utils.normalizeAngle(current + Math.sign(diff) * maxStep);
    },

    aabb(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    },

    pointInRect(px, py, rect) {
        return px >= rect.x && px <= rect.x + rect.width &&
               py >= rect.y && py <= rect.y + rect.height;
    },

    random(min, max) {
        return min + Math.random() * (max - min);
    },

    randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    },

    choice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    chance(probability) {
        return Math.random() < probability;
    },

    // Seeded random number generator (LCG) for reproducible maze generation
    seededRandom(seed) {
        let state = seed | 0;
        if (state === 0) state = 1;
        return function() {
            state = (state * 1664525 + 1013904223) | 0;
            return ((state >>> 0) / 4294967296);
        };
    },

    formatNumber(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    // Convert pixel coordinates to tile coordinates
    pixelToTile(x, y) {
        return {
            col: Math.floor(x / CONFIG.TILE_SIZE),
            row: Math.floor(y / CONFIG.TILE_SIZE),
        };
    },

    tileToPixel(col, row) {
        return {
            x: col * CONFIG.TILE_SIZE,
            y: row * CONFIG.TILE_SIZE,
        };
    },

    tileCenter(col, row) {
        return {
            x: col * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
            y: row * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
        };
    },
};
