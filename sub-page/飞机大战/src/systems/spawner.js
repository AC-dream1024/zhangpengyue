class Spawner {
    constructor() {
        this.spawnTimer = 0;
        this.spawnInterval = CONFIG.GAME.spawnInterval;
        this.gameTime = 0;
        this.waveCount = 0;
        this.difficulty = 1;
        this.bossSpawned = false;
        this.spawnPatterns = [];
    }

    reset() {
        this.spawnTimer = 0;
        this.gameTime = 0;
        this.waveCount = 0;
        this.difficulty = 1;
        this.bossSpawned = false;
    }

    update(dt, game) {
        if (game.boss && game.boss.active && game.boss.state !== 'dying') {
            return;
        }

        this.gameTime += dt;

        this.difficulty = 1 + Math.floor(this.gameTime / CONFIG.GAME.difficultyScaleTime) * CONFIG.GAME.difficultyScaleHp;
        game.difficulty = this.difficulty;

        this.spawnTimer -= dt;
        const currentSpawnInterval = this.spawnInterval / this.difficulty * (game.spawnMult || 1);

        // 敌机数量上限：超过则暂停生成，避免后期卡顿
        const enemyCap = CONFIG.GAME.enemyCap || 30;
        if (this.spawnTimer <= 0) {
            if (game.enemies.length < enemyCap) {
                this.spawnWave(game);
            }
            this.spawnTimer = currentSpawnInterval;
        }

        if (!this.bossSpawned && this.gameTime >= CONFIG.GAME.bossTime) {
            this.spawnBoss(game);
        }
    }

    spawnWave(game) {
        this.waveCount++;
        const wave = this.waveCount;
        const availableTypes = this.getAvailableTypes();

        let spawnCount = Utils.randomInt(2, 4);
        if (wave > 10) spawnCount = Utils.randomInt(3, 5);
        if (wave > 20) spawnCount = Utils.randomInt(4, 6);

        const formationType = Utils.choice(['line', 'v', 'grid', 'random']);

        switch (formationType) {
            case 'line':
                this.spawnLine(availableTypes, spawnCount, game);
                break;
            case 'v':
                this.spawnVFormation(availableTypes, spawnCount, game);
                break;
            case 'grid':
                this.spawnGrid(availableTypes, spawnCount, game);
                break;
            default:
                this.spawnRandom(availableTypes, spawnCount, game);
        }

        if (wave > 5 && Utils.chance(0.2)) {
            const kamikaze = new Enemy('kamikaze', 0, 0, this.difficulty);
            kamikaze.initPosition(Utils.random(50, CONFIG.CANVAS.width - 50), -30);
            game.enemies.push(kamikaze);
        }
    }

    getAvailableTypes() {
        const wave = this.waveCount;
        if (wave <= 3) return ['scout'];
        if (wave <= 6) return ['scout', 'scout', 'fighter'];
        if (wave <= 10) return ['scout', 'fighter', 'fighter', 'elite'];
        if (wave <= 15) return ['fighter', 'elite', 'elite', 'heavy'];
        return ['fighter', 'elite', 'heavy', 'heavy', 'kamikaze'];
    }

    spawnLine(types, count, game) {
        const type = Utils.choice(types);
        const enemyWidth = CONFIG.ENEMY_TYPES[type].width;
        const spacing = enemyWidth + 20;
        const totalWidth = count * spacing;
        const startX = (CONFIG.CANVAS.width - totalWidth) / 2;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const enemy = new Enemy(type, 0, 0, this.difficulty);
                enemy.initPosition(startX + i * spacing, -enemy.height - 20);
                game.enemies.push(enemy);
            }, i * 150);
        }
    }

    spawnVFormation(types, count, game) {
        const type = Utils.choice(types);
        const centerX = CONFIG.CANVAS.width / 2;
        const spacing = 45;

        for (let i = 0; i < count; i++) {
            const side = i < count / 2 ? -1 : 1;
            const offset = i < count / 2 ? i : i - Math.ceil(count / 2);
            const enemy = new Enemy(type, 0, 0, this.difficulty);
            enemy.initPosition(
                centerX + side * (offset + 1) * spacing,
                -enemy.height - 20 - offset * 10
            );
            game.enemies.push(enemy);
        }
    }

    spawnGrid(types, count, game) {
        const rows = Math.min(2, Math.ceil(count / 3));
        const cols = Math.ceil(count / rows);
        const cellWidth = CONFIG.CANVAS.width / (cols + 1);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (r * cols + c >= count) break;
                const type = Utils.choice(types);
                const enemy = new Enemy(type, 0, 0, this.difficulty);
                enemy.initPosition(
                    cellWidth * (c + 1) - enemy.width / 2,
                    -enemy.height - 20 - r * 50
                );
                game.enemies.push(enemy);
            }
        }
    }

    spawnRandom(types, count, game) {
        for (let i = 0; i < count; i++) {
            const type = Utils.choice(types);
            const enemy = new Enemy(type, 0, 0, this.difficulty);
            enemy.initPosition(
                Utils.random(30, CONFIG.CANVAS.width - 30 - enemy.width),
                -enemy.height - Utils.random(0, 100)
            );
            game.enemies.push(enemy);
        }
    }

    spawnBoss(game) {
        this.bossSpawned = true;
        Audio.playBossAlert();
        game.bossAlertTimer = 3;

        setTimeout(() => {
            game.boss = new Boss();
            game.isBossFight = true;
        }, 3000);
    }
};