window.CONFIG = {
    CANVAS: {
        width: 960,
        height: 640
    },

    TILE_SIZE: 32,

    COLORS: {
        wallBase: '#4a4028',
        wallTop: '#6a5a38',
        wallShadow: '#2a2410',
        wallEdge: '#8a7a48',
        floor: '#1a1810',
        floorAccent: '#2a2618',
        floorLine: 'rgba(120, 100, 60, 0.08)',
        player: '#00dd66',
        playerAccent: '#88ff44',
        playerGlow: 'rgba(0, 221, 102, 0.5)',
        bullet: '#ffdd44',
        enemyBullet: '#ff4422',
        exit: '#00ff88',
        item: '#ffcc00',
        boss: '#ff0000',
    },

    PLAYER: {
        width: 26,
        height: 26,
        speed: 140,
        hp: 100,
        maxHp: 100,
        fireRate: 0.32,
        bulletSpeed: 420,
        bulletDamage: 28,
        bulletRange: 520,
        turretRotSpeed: 8.0,
    },

    ENEMY_TYPES: {
        scout: {
            name: '侦察兵',
            hp: 30,
            speed: 110,
            fireRate: 1.6,
            bulletSpeed: 260,
            bulletDamage: 8,
            range: 280,
            sightRange: 260,
            score: 100,
            color: '#ff6644',
            accentColor: '#ffaa66',
            width: 24,
            height: 24,
            bulletRange: 320,
        },
        gunner: {
            name: '机枪手',
            hp: 55,
            speed: 75,
            fireRate: 0.65,
            bulletSpeed: 320,
            bulletDamage: 12,
            range: 340,
            sightRange: 320,
            score: 200,
            color: '#ff9933',
            accentColor: '#ffcc66',
            width: 26,
            height: 26,
            bulletRange: 380,
        },
        heavy: {
            name: '重装甲',
            hp: 130,
            speed: 48,
            fireRate: 1.8,
            bulletSpeed: 240,
            bulletDamage: 26,
            range: 300,
            sightRange: 280,
            score: 400,
            color: '#cc3322',
            accentColor: '#ff6644',
            width: 30,
            height: 30,
            bulletRange: 360,
        },
        sniper: {
            name: '狙击手',
            hp: 40,
            speed: 62,
            fireRate: 2.6,
            bulletSpeed: 520,
            bulletDamage: 35,
            range: 560,
            sightRange: 520,
            score: 350,
            color: '#cc44cc',
            accentColor: '#ff88ff',
            width: 24,
            height: 24,
            bulletRange: 640,
        },
        boss: {
            name: '钢铁堡垒',
            hp: 600,
            speed: 50,
            fireRate: 0.7,
            bulletSpeed: 320,
            bulletDamage: 22,
            range: 500,
            sightRange: 600,
            score: 3000,
            color: '#ff2222',
            accentColor: '#ffaa00',
            width: 44,
            height: 44,
            bulletRange: 600,
            isBoss: true,
        },
    },

    LEVELS: [
        {
            id: 1,
            name: '新兵训练场',
            cols: 21,
            rows: 15,
            seed: 11111,
            extraOpenings: 4,
            objective: 'destroy',
            objectiveText: '摧毁所有敌方坦克',
            enemies: { scout: 3, gunner: 0, heavy: 0, sniper: 0 },
            playerStart: { col: 1, row: 1 },
        },
        {
            id: 2,
            name: '边境哨所',
            cols: 25,
            rows: 17,
            seed: 22222,
            extraOpenings: 6,
            objective: 'destroy',
            objectiveText: '摧毁所有敌方坦克',
            enemies: { scout: 3, gunner: 2, heavy: 0, sniper: 0 },
            playerStart: { col: 1, row: 1 },
        },
        {
            id: 3,
            name: '废弃工厂',
            cols: 27,
            rows: 19,
            seed: 33333,
            extraOpenings: 8,
            objective: 'collect',
            objectiveText: '收集所有补给箱后到达出口',
            itemCount: 3,
            enemies: { scout: 2, gunner: 2, heavy: 1, sniper: 1 },
            playerStart: { col: 1, row: 1 },
            exitPos: { col: 25, row: 17 },
        },
        {
            id: 4,
            name: '装甲走廊',
            cols: 29,
            rows: 19,
            seed: 44444,
            extraOpenings: 7,
            objective: 'destroy',
            objectiveText: '摧毁所有敌方坦克',
            enemies: { scout: 3, gunner: 2, heavy: 2, sniper: 1 },
            playerStart: { col: 1, row: 1 },
        },
        {
            id: 5,
            name: '钢铁要塞',
            cols: 29,
            rows: 19,
            seed: 55555,
            extraOpenings: 10,
            objective: 'destroy',
            objectiveText: '击败BOSS与所有敌军',
            enemies: { scout: 2, gunner: 2, heavy: 1, sniper: 1, boss: 1 },
            playerStart: { col: 1, row: 1 },
            isBossLevel: true,
        },
    ],

    GAME: {
        hitStopDuration: 0.04,
        bulletLifeMax: 3.0,
        enemyBulletCap: 200,
    },

    PARTICLE: {
        maxParticles: 300,
    },

    // ====== Endless Mode: procedural level generation ======
    generateEndlessLevel(waveN) {
        const n = Math.max(1, Math.floor(waveN));

        // ---------- Maze size growth: 21x15 → smoothly up to 41x29 ----------
        // Every 2 waves grow cols by 2; every 3 waves grow rows by 2.
        const baseCols = 21;
        const baseRows = 15;
        const cols = Math.min(41, baseCols + Math.floor((n - 1) / 2) * 2); // odd numbers only
        const rows = Math.min(29, baseRows + Math.floor((n - 1) / 3) * 2);

        // ---------- Difficulty scaling curves for enemy counts ----------
        // Capped so each wave stays manageable and the game remains playable.
        const scoutCount = Math.min(8, 2 + Math.floor(n * 0.45));
        const gunnerCount = n >= 2 ? Math.min(6, Math.floor((n - 1) * 0.75)) : 0;
        const heavyCount = n >= 4 ? Math.min(5, Math.floor((n - 3) * 0.6)) : 0;
        const sniperCount = n >= 6 ? Math.min(4, Math.floor((n - 5) * 0.5)) : 0;
        // Boss every 5 waves. Every 15 waves double bosses for extra challenge (cap at 2).
        const bossCount = (n % 5 === 0) ? (n % 15 === 0 ? 2 : 1) : 0;

        const enemies = {
            scout: scoutCount,
            gunner: gunnerCount,
            heavy: heavyCount,
            sniper: sniperCount,
            boss: bossCount,
        };

        // ---------- Endless stat multipliers (applied at spawn time, never global mutation) ----------
        // Sub-linear growth so the game stays playable dozens of waves in.
        const hpMul = 1 + Math.max(0, n - 1) * 0.065;       // ~+6.5% HP per wave
        const spdMul = 1 + Math.max(0, n - 1) * 0.018;      // ~+1.8% speed per wave
        const dmgMul = 1 + Math.max(0, n - 1) * 0.065;      // ~+6.5% damage per wave
        const rateMul = Math.max(0.72, 1 - Math.max(0, n - 1) * 0.018); // fireRate floor 0.72 (≤ ~40% faster)

        // ---------- Procedural wave name ----------
        const zones = ['边境区', '缓冲区', '交战区', '核心防线', '地下设施', '空中走廊', '废弃基地', '熔岩隧道', '极地要塞', '生化实验室', '钢铁深渊', '量子终端'];
        const suffixes = ['阿尔法', '贝塔', '伽马', '德尔塔', '艾普西隆', '泽塔', '埃塔', '西塔', '欧米伽'];
        const zoneName = zones[(n - 1) % zones.length];
        const suffix = n > zones.length ? ' ' + suffixes[Math.floor((n - 1) / zones.length) % suffixes.length] : '';
        const name = `${zoneName} 第 ${n} 战区${suffix}`;

        // ---------- Objective variety: every 4th wave is a COLLECT objective ----------
        // Gives the player pacing variety instead of the same "destroy all" every wave.
        const isCollectWave = (n % 4 === 0) && (bossCount === 0);
        const objective = isCollectWave ? 'collect' : 'destroy';

        let objectiveText;
        if (bossCount > 0) {
            objectiveText = bossCount >= 2
                ? `击败双BOSS与清剿 第 ${n} 波 全部敌军`
                : `击败BOSS与清剿 第 ${n} 波 全部敌军`;
        } else if (isCollectWave) {
            const collectN = 3 + Math.min(3, Math.floor(n / 4));
            objectiveText = `收集 ${collectN} 个补给箱 并抵达出口`;
        } else {
            objectiveText = `清剿 第 ${n} 波 所有敌方坦克`;
        }

        // Seed combines deterministic wave number + entropy for high variety across runs.
        // Adding time-salted entropy guarantees even the same wave number differs on re-run.
        const entropy = Math.floor(Math.random() * 0x7fffffff);
        const seed = ((n * 1315423911) | 0) ^ entropy;
        const extraOpenings = Math.min(16, 4 + Math.floor(n / 2) + (isCollectWave ? 3 : 0));

        const result = {
            id: n,
            name,
            cols,
            rows,
            seed,
            extraOpenings,
            objective,
            objectiveText,
            enemies,
            playerStart: { col: 1, row: 1 },
            isBossLevel: bossCount > 0,
            isEndlessWave: true,
            // Enemy stat multipliers applied at spawn time (game.js will apply per-tank shallow clone)
            endlessMul: {
                hp: hpMul,
                speed: Math.min(1.75, spdMul), // hard cap 1.75× speed
                damage: dmgMul,
                fireRate: rateMul, // smaller = faster
            },
            // Pass-through hints used during _loadLevelFromConfig for collect objectives
        };

        if (isCollectWave) {
            result.itemCount = 3 + Math.min(3, Math.floor(n / 4));
            // Place exit in the farthest floor tile from player (col=1, row=1)
            // _loadLevelFromConfig will use exitPos if set; we leave it null here and
            // let game.js place it at a far floor tile (done in _loadLevelFromConfig).
        }
        return result;
    },

    // Store pristine base stats so endless stat scaling doesn't stack across runs (unused now, kept for future)
    _BASE_ENEMY_TYPES: {},
};

// Snapshot base enemy stats into _BASE_ENEMY_TYPES
for (const _k of Object.keys(window.CONFIG.ENEMY_TYPES)) {
    window.CONFIG._BASE_ENEMY_TYPES[_k] = { ...window.CONFIG.ENEMY_TYPES[_k] };
}
