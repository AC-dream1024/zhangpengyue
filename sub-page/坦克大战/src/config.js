window.CONFIG = {
    CANVAS: {
        width: 800,
        height: 700
    },

    // 坦克型号（对应原战机类型）
    TANK_TYPES: {
        cheetah: {
            id: 'cheetah',
            name: '猎豹',
            codename: '猎豹·轻骑',
            description: '高机动轻型坦克，速度极快但装甲薄弱。',
            advantage: '机动性',
            color: '#ffcc00',
            accentColor: '#ff6600',
            glowColor: 'rgba(255, 204, 0, 0.6)',
            stats: {
                width: 46,
                height: 54,
                speed: 420,
                hp: 110,
                maxHp: 110,
                shield: 15,
                maxShield: 60,
                fireRate: 0.10,
                energyMax: 80,
                energyRegen: 1.3,
                bombDamage: 35,
                skillDamage: 90
            },
            weaponAffinity: 'spread',
            icon: '⚡'
        },
        bear: {
            id: 'bear',
            name: '巨熊',
            codename: '巨熊·重甲',
            description: '重型装甲坦克，血量丰厚但行动迟缓。',
            advantage: '生存力',
            color: '#ff8800',
            accentColor: '#ff4444',
            glowColor: 'rgba(255, 136, 0, 0.6)',
            stats: {
                width: 58,
                height: 66,
                speed: 260,
                hp: 220,
                maxHp: 220,
                shield: 40,
                maxShield: 120,
                fireRate: 0.16,
                energyMax: 120,
                energyRegen: 0.9,
                bombDamage: 45,
                skillDamage: 120
            },
            weaponAffinity: 'plasma',
            icon: '🛡'
        },
        judgment: {
            id: 'judgment',
            name: '裁决者',
            codename: '裁决者·平衡',
            description: '全能型主战坦克，各项属性均衡发展。',
            advantage: '综合能力',
            color: '#00ff88',
            accentColor: '#ffff00',
            glowColor: 'rgba(0, 255, 136, 0.6)',
            stats: {
                width: 50,
                height: 58,
                speed: 340,
                hp: 150,
                maxHp: 150,
                shield: 25,
                maxShield: 80,
                fireRate: 0.12,
                energyMax: 100,
                energyRegen: 1.0,
                bombDamage: 40,
                skillDamage: 100
            },
            weaponAffinity: 'single',
            icon: '⚔'
        },
        night: {
            id: 'night',
            name: '暗夜',
            codename: '暗夜·能量',
            description: '能量特化型，技能回复极快但火力稍弱。',
            advantage: '能量回复',
            color: '#aa44ff',
            accentColor: '#ff00ff',
            glowColor: 'rgba(170, 68, 255, 0.6)',
            stats: {
                width: 48,
                height: 56,
                speed: 360,
                hp: 120,
                maxHp: 120,
                shield: 20,
                maxShield: 70,
                fireRate: 0.14,
                energyMax: 70,
                energyRegen: 1.8,
                bombDamage: 30,
                skillDamage: 110
            },
            weaponAffinity: 'homing',
            icon: '🌑'
        }
    },

    UPGRADES: {
        hpBoost: {
            id: 'hpBoost',
            name: '装甲强化',
            description: '最大生命值 +30',
            icon: '❤',
            maxLevel: 5,
            cost: [500, 1200, 2500, 5000, 10000],
            effect: { hp: 30 }
        },
        shieldBoost: {
            id: 'shieldBoost',
            name: '反应装甲',
            description: '最大护盾 +20',
            icon: '🛡',
            maxLevel: 5,
            cost: [600, 1400, 2800, 5500, 11000],
            effect: { shield: 20 }
        },
        fireRateBoost: {
            id: 'fireRateBoost',
            name: '装填强化',
            description: '射速提升 10%',
            icon: '🔥',
            maxLevel: 5,
            cost: [800, 1800, 3500, 7000, 14000],
            effect: { fireRate: 0.1 }
        },
        energyBoost: {
            id: 'energyBoost',
            name: '能量回复',
            description: '能量回复速度 +20%',
            icon: '⚡',
            maxLevel: 5,
            cost: [700, 1600, 3200, 6500, 13000],
            effect: { energyRegen: 0.2 }
        },
        bombBoost: {
            id: 'bombBoost',
            name: '空袭支援',
            description: '初始空袭 +1',
            icon: '💣',
            maxLevel: 3,
            cost: [1000, 3000, 7000],
            effect: { bombs: 1 }
        },
        magnetBoost: {
            id: 'magnetBoost',
            name: '磁吸范围',
            description: '道具磁吸范围 +30%',
            icon: '🧲',
            maxLevel: 3,
            cost: [600, 1800, 4500],
            effect: { magnetRange: 0.3 }
        },
        luckBoost: {
            id: 'luckBoost',
            name: '幸运加成',
            description: '道具掉落率 +15%',
            icon: '🍀',
            maxLevel: 3,
            cost: [1500, 4000, 9000],
            effect: { dropRate: 0.15 }
        },
        scoreBoost: {
            id: 'scoreBoost',
            name: '积分加成',
            description: '击杀积分 +10%，大招清弹范围 +60',
            icon: '💰',
            maxLevel: 5,
            cost: [900, 2000, 4000, 8000, 16000],
            effect: { scoreMult: 0.1, skillClearRadius: 60 }
        }
    },

    GAME: {
        spawnInterval: 1.6,
        difficultyScaleTime: 45,
        difficultyScaleHp: 0.12,
        difficultyScaleSpeed: 0.04,
        bossTime: 120,
        maxComboTime: 3,
        hitStopDuration: 0.03,
        enemyCap: 30,
        powerupCap: 20
    },

    // BOSS：钢铁巨兽
    BOSS: {
        name: '钢铁巨兽',
        hp: 5000,
        maxHp: 5000,
        width: 300,
        height: 180,
        moveSpeed: 70,
        score: 50000,
        phases: [
            { ratio: 1.0, duration: 25 },
            { ratio: 0.66, duration: 25 },
            { ratio: 0.33, duration: 20 }
        ]
    },

    POWERUP: {
        dropRate: 0.25,
        magnetRange: 200,
        lifetime: 12
    },

    // 敌方载具类型
    ENEMY_TYPES: {
        scout: { hp: 15, speed: 140, score: 100, width: 34, height: 34, fireRate: 2.5, color: '#ff5544' },
        fighter: { hp: 35, speed: 95, score: 200, width: 40, height: 44, fireRate: 2, color: '#ff3322' },
        elite: { hp: 70, speed: 75, score: 400, width: 46, height: 50, fireRate: 1.5, color: '#cc1133' },
        heavy: { hp: 140, speed: 48, score: 800, width: 58, height: 62, fireRate: 1.2, color: '#882222' },
        kamikaze: { hp: 25, speed: 240, score: 300, width: 32, height: 32, fireRate: 0, color: '#ff8800' }
    },

    // 武器系统：坦克炮弹类型
    WEAPONS: {
        single: { name: '穿甲炮', damage: 15, speed: 700, fireRate: 0.12, color: '#ffcc00', size: 4 },
        spread: { name: '三连散射', damage: 10, speed: 650, fireRate: 0.15, color: '#ffcc00', size: 4, count: 3, angle: 0.25 },
        spiral: { name: '螺旋炮', damage: 8, speed: 500, fireRate: 0.08, color: '#ffe680', size: 3, count: 6 },
        plasma: { name: '高爆炮', damage: 40, speed: 550, fireRate: 0.3, color: '#ff6600', size: 9, pierce: true },
        homing: { name: '追踪导弹', damage: 25, speed: 400, fireRate: 0.4, color: '#ff44ff', size: 5, homing: true },
        freeze: { name: '冰冻弹', damage: 8, speed: 500, fireRate: 0.25, color: '#88ccff', size: 6, freeze: true }
    },

    BULLET_TYPES: {
        player: { damage: 15, speed: 700, color: '#ffcc00', size: 4 },
        enemy: { damage: 6, speed: 250, color: '#ff3322', size: 5 },
        boss: { damage: 8, speed: 180, color: '#ff00ff', size: 6 }
    },

    COLORS: {
        primary: '#ffcc00',
        secondary: '#ff6600',
        accent: '#00ff88',
        background: '#1a1a0e',
        hud: '#ffcc00',
        danger: '#ff3322',
        warning: '#ff8800',
        shield: '#00aaff'
    },

    DIFFICULTY: {
        easy: { hpMult: 0.6, speedMult: 0.8, spawnMult: 1.4, label: '简单' },
        normal: { hpMult: 0.85, speedMult: 1.0, spawnMult: 1.1, label: '普通' },
        hard: { hpMult: 1.3, speedMult: 1.2, spawnMult: 0.8, label: '困难' }
    },

    SKILLS: {
        bomb: {
            name: '空袭',
            key: 'B',
            description: '呼叫空袭支援，对所有敌军和BOSS造成大量伤害。',
            damage: 35,
            cooldown: 0,
            icon: '💣'
        },
        ultimate: {
            name: '大招',
            key: '空格',
            description: '必杀技，能量充满后可释放，对全场敌人造成巨额伤害。',
            damage: 100,
            energyRequired: 100,
            icon: '⚡'
        }
    },

    GAME_MODES: {
        story: {
            id: 'story',
            name: '战役模式',
            description: '逐步推进，挑战各关卡BOSS',
            stages: [
                { id: 1, name: '新兵训练营', duration: 40, bossTime: 30, spawnMult: 0.7, hasBoss: false, tutorial: true },
                { id: 2, name: '边境突围', duration: 60, bossTime: 45, spawnMult: 0.9, hasBoss: true, tutorial: false },
                { id: 3, name: '装甲洪流', duration: 70, bossTime: 50, spawnMult: 1.1, hasBoss: true, tutorial: false },
                { id: 4, name: 'BOSS决战', duration: 90, bossTime: 60, spawnMult: 1.2, hasBoss: true, tutorial: false },
                { id: 5, name: '钢铁要塞', duration: 120, bossTime: 80, spawnMult: 1.4, hasBoss: true, tutorial: false }
            ]
        },
        endless: {
            id: 'endless',
            name: '无尽模式',
            description: '无限挑战，难度持续攀升',
            stages: []
        }
    },

    PLAYER_BASE: {
        invincibleTime: 2,
        maxPowerLevel: 5
    }
};
