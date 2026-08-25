// ====== Maze Generation + Rendering ======
// Optimized for endless mode: iterative (non-recursive) generation,
// lazy variation sampling, and compact floor-tile bookkeeping.

class Maze {
    constructor(levelConfig) {
        this.config = levelConfig;
        this.cols = levelConfig.cols;
        this.rows = levelConfig.rows;
        this.tileSize = CONFIG.TILE_SIZE;
        this.widthPx = this.cols * this.tileSize;
        this.heightPx = this.rows * this.tileSize;

        // ====== Size safety net ======
        // Prevent pathological size inputs that would blow up memory/CPU.
        if (this.cols > 61) this.cols = 61;
        if (this.rows > 41) this.rows = 41;

        // Generate maze grid + floor tiles efficiently
        this.grid = this.generateMaze(levelConfig.seed, levelConfig.extraOpenings || 0);
        this.floorTiles = this.collectFloorTilesCompact();

        // ====== Lazy variation cache ======
        // Instead of preallocating rows×cols Float64-ish arrays for visual variations,
        // we derive per-tile variations on demand from a single 32-bit hash of
        // (seed, col, row). Saves ~2N 2D arrays per maze, which matters at 41×29+ sizes.
        this._variationSeedWall = (levelConfig.seed + 7777) | 0;
        this._variationSeedFloor = (levelConfig.seed + 9999) | 0;
        // Retain the old property names (empty arrays) so any external code that
        // references them doesn't throw; they'll be GC-friendly (length 0).
        this.wallVariations = [];
        this.floorVariations = [];

        // Offscreen canvas for static maze rendering (performance)
        this.staticCanvas = null;
        this.renderStatic();
    }

    // On-demand deterministic variation sampler [0,1) — replaces the
    // rows×cols 2D arrays we used to preallocate. Constant memory per call.
    _sampleVariation(seed, col, row) {
        // FNV-1a inspired hash of (seed, col, row) -> 32-bit -> [0,1)
        let h = 2166136261 ^ seed;
        h = Math.imul(h ^ col, 16777619);
        h = Math.imul(h ^ row, 16777619);
        h = Math.imul(h ^ (col >> 16), 2246822507);
        h = Math.imul(h ^ (row >> 16), 3266489909);
        h = (h ^ (h >>> 16)) >>> 0;
        return h / 4294967296;
    }

    getWallVariation(r, c) {
        // Back-compat + lazy: if old-style precomputed array exists and has data, use it
        if (this.wallVariations && this.wallVariations[r] && this.wallVariations[r][c] !== undefined) {
            return this.wallVariations[r][c];
        }
        return this._sampleVariation(this._variationSeedWall, c, r);
    }

    getFloorVariation(r, c) {
        if (this.floorVariations && this.floorVariations[r] && this.floorVariations[r][c] !== undefined) {
            return this.floorVariations[r][c];
        }
        return this._sampleVariation(this._variationSeedFloor, c, r);
    }

    // ====== Maze Generation (Iterative Recursive Backtracking) ======
    // Pure iterative (no function-call recursion) so even large mazes
    // (e.g. 61×41) cannot blow the JS call stack on shallow-hostile engines.
    generateMaze(seed, extraOpenings) {
        const rng = Utils.seededRandom(seed);
        const cols = this.cols;
        const rows = this.rows;

        // ---- Compact 1-bit-per-cell wall init using typed-style Arrays ----
        // (We still use Array<Array<number>> because surrounding code indexes
        // as grid[r][c]; but we construct rows densely with fill + slice for speed.)
        const grid = new Array(rows);
        for (let r = 0; r < rows; r++) {
            const row = new Array(cols);
            // Initialize all to wall
            for (let c = 0; c < cols; c++) row[c] = 1;
            grid[r] = row;
        }

        // Iterative stack-based carving.
        // Start at (1,1) - must be odd coordinates for proper maze topology.
        // Boundary clamp: if size is even, start at (1,1) anyway; the later
        // border-fixup pass will harden row 0 / col 0 anyway.
        let startC = 1;
        let startR = 1;
        if (!((startC & 1) === 1 && (startR & 1) === 1)) {
            startC = (startC | 1);
            startR = (startR | 1);
        }
        if (startC >= cols - 1) startC = cols - 2;
        if (startR >= rows - 1) startR = rows - 2;

        grid[startR][startC] = 0;
        const stack = new Array(cols * rows >> 1);
        let stackTop = 0;
        stack[stackTop++] = (startC << 16) | (startR & 0xffff); // pack two ints

        const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]];
        // Reusable neighbor list (4 slots max) to avoid GC churn
        const neighborSlots = new Array(4);

        while (stackTop > 0) {
            const packed = stack[stackTop - 1];
            const c = (packed >> 16) & 0xffff;
            const r = packed & 0xffff;

            let neighborCount = 0;
            for (let d = 0; d < 4; d++) {
                const [dc, dr] = dirs[d];
                const nc = c + dc;
                const nr = r + dr;
                if (nc > 0 && nc < cols - 1 && nr > 0 && nr < rows - 1 && grid[nr][nc] === 1) {
                    neighborSlots[neighborCount++] = d;
                }
            }

            if (neighborCount > 0) {
                const pick = neighborSlots[Math.floor(rng() * neighborCount)];
                const [dc, dr] = dirs[pick];
                const nc = c + dc;
                const nr = r + dr;
                grid[r + (dr >> 1)][c + (dc >> 1)] = 0;
                grid[nr][nc] = 0;
                stack[stackTop++] = (nc << 16) | (nr & 0xffff);
            } else {
                stackTop--;
            }
        }

        // Add extra openings to create loops (better gameplay than perfect maze)
        this.addLoops(grid, extraOpenings, rng);

        // Ensure borders are walls
        const lastCol = cols - 1;
        const lastRow = rows - 1;
        for (let c = 0; c < cols; c++) {
            grid[0][c] = 1;
            grid[lastRow][c] = 1;
        }
        for (let r = 0; r < rows; r++) {
            grid[r][0] = 1;
            grid[r][lastCol] = 1;
        }

        return grid;
    }

    addLoops(grid, count, rng) {
        if (count <= 0) return;
        const cols = this.cols;
        const rows = this.rows;
        let added = 0;
        let attempts = 0;
        const maxAttempts = Math.min(count * 25, cols * rows); // bounded

        while (added < count && attempts < maxAttempts) {
            attempts++;
            const c = 1 + Math.floor(rng() * (cols - 2));
            const r = 1 + Math.floor(rng() * (rows - 2));
            if (grid[r][c] !== 1) continue;

            // Only remove walls that connect two floor tiles
            let floorNeighbors = 0;
            if (r > 0 && grid[r - 1][c] === 0) floorNeighbors++;
            if (r < rows - 1 && grid[r + 1][c] === 0) floorNeighbors++;
            if (c > 0 && grid[r][c - 1] === 0) floorNeighbors++;
            if (c < cols - 1 && grid[r][c + 1] === 0) floorNeighbors++;

            if (floorNeighbors >= 2) {
                grid[r][c] = 0;
                added++;
            }
        }
    }

    // Compact floor-tile collection: returns same {col,row} array but avoids
    // sparse rows / hasOwnProperty checks we might get from for-in loops.
    collectFloorTilesCompact() {
        const tiles = [];
        const cols = this.cols;
        const rows = this.rows;
        // Pre-reserve approximate capacity (typical maze ~45% floor)
        const approxFloor = Math.ceil((cols * rows) * 0.5);
        if (approxFloor > 0) tiles.length = 0; // no-op but hints
        for (let r = 0; r < rows; r++) {
            const row = this.grid[r];
            for (let c = 0; c < cols; c++) {
                if (row[c] === 0) {
                    tiles.push({ col: c, row: r });
                }
            }
        }
        return tiles;
    }

    // ====== Collision Queries ======
    isWall(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true;
        return this.grid[row][col] === 1;
    }

    isWallPixel(x, y) {
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);
        return this.isWall(col, row);
    }

    // Check if a rect (in pixel coords) collides with any wall tile
    rectCollidesWall(x, y, w, h) {
        // Use slightly inset rect for better gameplay feel
        const inset = 2;
        const rx = x + inset;
        const ry = y + inset;
        const rw = w - inset * 2;
        const rh = h - inset * 2;

        const minCol = Math.floor(rx / this.tileSize);
        const maxCol = Math.floor((rx + rw) / this.tileSize);
        const minRow = Math.floor(ry / this.tileSize);
        const maxRow = Math.floor((ry + rh) / this.tileSize);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (this.isWall(c, r)) return true;
            }
        }
        return false;
    }

    // Find a floor tile far from a given position (for enemy/item placement)
    findFloorTileAwayFrom(centerCol, centerRow, minDistance) {
        const candidates = [];
        for (const tile of this.floorTiles) {
            const dist = Math.abs(tile.col - centerCol) + Math.abs(tile.row - centerRow);
            if (dist >= minDistance) {
                candidates.push(tile);
            }
        }
        if (candidates.length === 0) return this.floorTiles[0];
        return Utils.choice(candidates);
    }

    getRandomFloorTile() {
        return Utils.choice(this.floorTiles);
    }

    // ====== Rendering ======
    renderStatic() {
        this.staticCanvas = document.createElement('canvas');
        // Guard against giant sizes (safety)
        const safeW = Math.min(this.widthPx, 2048);
        const safeH = Math.min(this.heightPx, 2048);
        this.staticCanvas.width = safeW;
        this.staticCanvas.height = safeH;
        const ctx = this.staticCanvas.getContext('2d');
        if (!ctx) return;

        const ts = this.tileSize;

        // Draw floor first
        for (let r = 0; r < this.rows; r++) {
            const gridRow = this.grid[r];
            for (let c = 0; c < this.cols; c++) {
                if (gridRow[c] !== 0) continue;
                const px = c * ts;
                const py = r * ts;
                const variation = this.getFloorVariation(r, c);

                // Floor tile
                const shade = Math.floor(variation * 10);
                // Match the dark tactical field palette used by 坦克大战.
                const cold = this.config && this.config.id === 3;
                ctx.fillStyle = cold
                    ? `rgb(${44 + shade}, ${60 + shade}, ${58 + shade})`
                    : `rgb(${16 + shade}, ${26 + shade}, ${21 + shade})`;
                ctx.fillRect(px, py, ts, ts);

                // Tactical 32px grid lines, kept subtle beneath the maze.
                ctx.strokeStyle = cold ? 'rgba(255,255,255,0.12)' : 'rgba(91,116,88,0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

                // Random floor detail (cracks, stains)
                if (variation > 0.7) {
                    ctx.fillStyle = `rgba(60, 50, 30, ${0.3 + variation * 0.2})`;
                    ctx.fillRect(px + 4 + variation * 10, py + 6 + variation * 8, 3, 3);
                }
                if (variation > 0.85) {
                    ctx.strokeStyle = `rgba(80, 65, 35, 0.15)`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(px + variation * 20, py + 8);
                    ctx.lineTo(px + variation * 20 + 6, py + 18);
                    ctx.stroke();
                }
            }
        }

        // Draw walls with 3D effect
        const cols = this.cols;
        const rows = this.rows;
        for (let r = 0; r < rows; r++) {
            const gridRow = this.grid[r];
            const gridRowAbove = r > 0 ? this.grid[r - 1] : null;
            const gridRowBelow = r < rows - 1 ? this.grid[r + 1] : null;
            for (let c = 0; c < cols; c++) {
                if (gridRow[c] !== 1) continue;

                const px = c * ts;
                const py = r * ts;
                const variation = this.getWallVariation(r, c);
                const shade = Math.floor(variation * 15);

                // Wall base
                ctx.fillStyle = `rgb(${74 + shade}, ${64 + shade}, ${40 + Math.floor(shade * 0.7)})`;
                ctx.fillRect(px, py, ts, ts);

                // Top face (lighter - simulates height)
                const hasFloorAbove = gridRowAbove && gridRowAbove[c] === 0;
                if (hasFloorAbove) {
                    ctx.fillStyle = `rgb(${106 + shade}, ${90 + shade}, ${56 + Math.floor(shade * 0.7)})`;
                    ctx.fillRect(px, py, ts, 5);
                }

                // Left edge highlight
                const hasFloorLeft = c > 0 && gridRow[c - 1] === 0;
                if (hasFloorLeft) {
                    ctx.fillStyle = `rgba(${138 + shade}, ${122 + shade}, ${72 + Math.floor(shade * 0.7)}, 0.6)`;
                    ctx.fillRect(px, py, 2, ts);
                }

                // Bottom shadow
                const hasFloorBelow = gridRowBelow && gridRowBelow[c] === 0;
                if (hasFloorBelow) {
                    ctx.fillStyle = `rgba(0, 0, 0, 0.4)`;
                    ctx.fillRect(px, py + ts - 4, ts, 4);
                }

                // Right shadow
                const hasFloorRight = c < cols - 1 && gridRow[c + 1] === 0;
                if (hasFloorRight) {
                    ctx.fillStyle = `rgba(0, 0, 0, 0.25)`;
                    ctx.fillRect(px + ts - 2, py, 2, ts);
                }

                // Wall texture details
                if (variation > 0.6) {
                    ctx.fillStyle = `rgba(${42 + shade}, ${36 + shade}, ${16 + Math.floor(shade * 0.5)}, 0.5)`;
                    const dx = Math.floor(variation * 16);
                    const dy = Math.floor(variation * 20);
                    ctx.fillRect(px + 6 + dx, py + 8 + dy, 4, 4);
                }
                if (variation > 0.8) {
                    ctx.strokeStyle = `rgba(30, 25, 12, 0.4)`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(px + 4, py + 10 + variation * 12);
                    ctx.lineTo(px + ts - 6, py + 14 + variation * 8);
                    ctx.stroke();
                }

                // Rivet detail on exposed edges
                if (hasFloorAbove || hasFloorLeft) {
                    ctx.fillStyle = `rgba(160, 140, 80, 0.4)`;
                    if (hasFloorAbove) {
                        ctx.beginPath();
                        ctx.arc(px + 4, py + 3, 1.5, 0, Math.PI * 2);
                        ctx.arc(px + ts - 4, py + 3, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
    }

    draw(ctx) {
        if (this.staticCanvas) {
            ctx.drawImage(this.staticCanvas, 0, 0);
        }
    }

    drawExit(ctx, exitCol, exitRow, time) {
        if (exitCol === undefined || exitRow === undefined) return;
        const ts = this.tileSize;
        const cx = exitCol * ts + ts / 2;
        const cy = exitRow * ts + ts / 2;
        const pulse = 0.5 + Math.sin(time * 3) * 0.3;

        ctx.save();
        ctx.translate(cx, cy);

        // Glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, ts * 0.6);
        gradient.addColorStop(0, `rgba(0, 255, 136, ${pulse * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(-ts * 0.6, -ts * 0.6, ts * 1.2, ts * 1.2);

        // Exit marker - rotating diamond
        ctx.rotate(time * 1.5);
        ctx.strokeStyle = `rgba(0, 255, 136, ${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 10);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = `rgba(0, 255, 136, ${pulse * 0.2})`;
        ctx.fill();

        ctx.restore();
    }

    drawItem(ctx, col, row, time) {
        const ts = this.tileSize;
        const cx = col * ts + ts / 2;
        const cy = row * ts + ts / 2;
        const bob = Math.sin(time * 2 + col * 0.5 + row * 0.3) * 3;
        const pulse = 0.5 + Math.sin(time * 4) * 0.3;

        ctx.save();
        ctx.translate(cx, cy + bob);

        // Glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, ts * 0.5);
        gradient.addColorStop(0, `rgba(255, 204, 0, ${pulse * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 204, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(-ts * 0.5, -ts * 0.5, ts, ts);

        // Supply crate
        ctx.fillStyle = '#ffcc00';
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeRect(-8, -8, 16, 16);

        // Cross detail
        ctx.strokeStyle = '#1a1a0e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();

        ctx.restore();
    }
}

window.Maze = Maze;
