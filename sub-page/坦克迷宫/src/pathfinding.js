// ====== A* Pathfinding + Line of Sight ======

const Pathfinding = {
    // A* pathfinding on grid. Returns array of {col, row} tiles from start to end (exclusive of start).
    findPath(maze, startCol, startRow, endCol, endRow) {
        if (maze.isWall(endCol, endRow)) return null;

        const cols = maze.cols;
        const rows = maze.rows;
        const key = (c, r) => r * cols + c;

        const openMap = new Map();
        const closedSet = new Set();
        const cameFrom = new Map();

        const startKey = key(startCol, startRow);
        const startNode = {
            col: startCol,
            row: startRow,
            g: 0,
            h: this.heuristic(startCol, startRow, endCol, endRow),
            f: 0,
        };
        startNode.f = startNode.g + startNode.h;
        openMap.set(startKey, startNode);

        const openList = [startNode];

        let iterations = 0;
        const maxIterations = cols * rows * 2;

        while (openList.length > 0 && iterations < maxIterations) {
            iterations++;

            // Get node with lowest f
            let bestIdx = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[bestIdx].f) {
                    bestIdx = i;
                }
            }
            const current = openList.splice(bestIdx, 1)[0];
            const currentKey = key(current.col, current.row);
            openMap.delete(currentKey);
            closedSet.add(currentKey);

            // Reached end?
            if (current.col === endCol && current.row === endRow) {
                return this.reconstructPath(cameFrom, current, cols);
            }

            // Check 4 neighbors
            const neighbors = [
                [0, -1], [1, 0], [0, 1], [-1, 0],
            ];

            for (const [dc, dr] of neighbors) {
                const nc = current.col + dc;
                const nr = current.row + dr;

                if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                if (maze.isWall(nc, nr)) continue;

                const nKey = key(nc, nr);
                if (closedSet.has(nKey)) continue;

                const tentativeG = current.g + 1;

                let neighbor = openMap.get(nKey);
                if (!neighbor) {
                    neighbor = {
                        col: nc,
                        row: nr,
                        g: tentativeG,
                        h: this.heuristic(nc, nr, endCol, endRow),
                        f: 0,
                    };
                    neighbor.f = neighbor.g + neighbor.h;
                    cameFrom.set(nKey, current);
                    openMap.set(nKey, neighbor);
                    openList.push(neighbor);
                } else if (tentativeG < neighbor.g) {
                    neighbor.g = tentativeG;
                    neighbor.f = tentativeG + neighbor.h;
                    cameFrom.set(nKey, current);
                }
            }
        }

        return null; // No path found
    },

    heuristic(c1, r1, c2, r2) {
        return Math.abs(c1 - c2) + Math.abs(r1 - r2);
    },

    reconstructPath(cameFrom, endNode, cols) {
        const path = [];
        let current = endNode;
        while (current) {
            path.unshift({ col: current.col, row: current.row });
            const currentKey = current.row * cols + current.col;
            current = cameFrom.get(currentKey);
        }
        // Remove the start tile (first element)
        if (path.length > 0) path.shift();
        return path;
    },

    // Simplify path to just direction changes (for smooth tank movement)
    simplifyPath(path) {
        if (path.length <= 1) return path;
        const simplified = [path[0]];
        for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            const prevDir = simplified.length > 0
                ? { dc: prev.col - (simplified[simplified.length - 2] || prev).col, dr: prev.row - (simplified[simplified.length - 2] || prev).row }
                : { dc: 0, dr: 0 };
            simplified.push(curr);
        }
        return simplified;
    },

    // Line of sight check using Bresenham's line algorithm
    // Returns true if there's a clear line from (x1,y1) to (x2,y2) without walls
    hasLineOfSight(maze, x1, y1, x2, y2) {
        const ts = CONFIG.TILE_SIZE;
        // Convert to tile coordinates
        let c1 = Math.floor(x1 / ts);
        let r1 = Math.floor(y1 / ts);
        const c2 = Math.floor(x2 / ts);
        const r2 = Math.floor(y2 / ts);

        const dx = Math.abs(c2 - c1);
        const dy = Math.abs(r2 - r1);
        const sx = c1 < c2 ? 1 : -1;
        const sy = r1 < r2 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (maze.isWall(c1, r1)) return false;
            if (c1 === c2 && r1 === r2) return true;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                c1 += sx;
            }
            if (e2 < dx) {
                err += dx;
                r1 += sy;
            }
        }
    },

    // Check if there's line of sight between two tiles
    hasTileLineOfSight(maze, col1, row1, col2, row2) {
        const ts = CONFIG.TILE_SIZE;
        return this.hasLineOfSight(
            maze,
            col1 * ts + ts / 2,
            row1 * ts + ts / 2,
            col2 * ts + ts / 2,
            row2 * ts + ts / 2
        );
    },
};

window.Pathfinding = Pathfinding;
