# 《星际战机：深空突袭》技术设计文档

> 文档目标：面向 Solo Builder，**一份文档即可产出完整可玩的网页飞机大战游戏**。
> 技术栈：纯 HTML5 + CSS3 + JavaScript (Canvas 2D)，零依赖，开箱即用。

---

## 1. 项目概述

### 1.1 游戏定位
一款**赛博朋克 / 科幻风格**的 2D 纵版卷轴射击网页游戏，玩家操控战机击败敌军敌机、收集道具、挑战巨型 BOSS，获得沉浸式的弹幕射击体验。

### 1.2 核心卖点（对标市面上爆火飞机大战）
| 卖点 | 实现方式 |
|------|---------|
| 🎨 科技风视觉 | 霓虹发光、粒子特效、星空视差、HUD 仪表 |
| 🔥 多样化战斗 | 多种武器切换、双武器系统、蓄力大招 |
| 💥 道具掉落 | 火力升级、护盾、炸弹、磁铁、减速、复活币 |
| 👹 阶段 BOSS 战 | 多形态 BOSS（第一阶段激光 / 第二阶段弹幕 / 第三阶段狂暴） |
| 📈 成长系统 | 分数排行榜、连击数、关卡递进难度、难度选择 |
| 🎮 操作友好 | 鼠标/触屏拖动 + 键盘双控制，自动开火 |
| ✨ 炫酷特效 | 粒子爆炸、屏幕震动、命中闪白、CRT 扫描线 |

### 1.3 目标平台
- PC 浏览器（Chrome / Edge / Safari 最新版）
- 移动端浏览器（响应式自适应）

---

## 2. 技术架构

### 2.1 技术选型
```
前端：原生 HTML5 + CSS3 + Vanilla JavaScript
渲染：Canvas 2D API
音频：Web Audio API（程序化合成音效，无需资源文件）
存储：LocalStorage（分数/设置持久化）
```

**选择理由**：零构建、零依赖，Solo Builder 可直接在浏览器打开 `index.html` 运行。

### 2.2 文件结构
```
飞机大战/
├── index.html          # 入口 HTML（UI 结构 + Canvas）
├── styles.css          # 全局样式（霓虹科技风）
├── game.js             # 主入口 + 游戏循环
├── src/
│   ├── config.js       # 所有游戏常量配置
│   ├── utils.js        # 工具函数（碰撞检测、向量、随机）
│   ├── input.js        # 输入管理（鼠标/键盘/触屏）
│   ├── assets.js       # 资源加载（图片、音效）
│   ├── entities/
│   │   ├── player.js       # 玩家战机
│   │   ├── enemy.js        # 敌机基类 + 多种敌机
│   │   ├── bullet.js       # 子弹（玩家 + 敌方）
│   │   ├── boss.js         # BOSS 及其多阶段行为
│   │   ├── powerup.js      # 道具
│   │   └── particle.js     # 粒子效果
│   ├── systems/
│   │   ├── spawner.js      # 敌机波次生成
│   │   ├── collision.js    # 碰撞系统
│   │   ├── audio.js        # 音效系统
│   │   ├── score.js        # 分数与连击
│   │   └── screen.js       # 屏幕震动/闪屏/扫描线
│   ├── scenes/
│   │   ├── scene.js        # 场景基类
│   │   ├── menuScene.js    # 主菜单
│   │   ├── gameScene.js    # 游戏主场景
│   │   ├── bossScene.js    # BOSS 战场景
│   │   └── gameoverScene.js# 结算
│   └── render/
│       ├── starfield.js    # 星空背景（多层视差）
│       ├── hud.js          # HUD 绘制
│       └── effects.js      # 屏幕特效渲染
└── assets/
    ├── sprites/            # 精灵图（可选，可纯代码绘制）
    └── sfx/               # 音效文件（可选，Web Audio 合成亦可）
```

> 注：若采用纯代码绘制（推荐），`assets/` 目录可省略，所有战机/子弹/爆炸均用 Canvas 矢量绘制。

### 2.3 核心游戏循环
```js
// game.js
function gameLoop(timestamp) {
    const delta = (timestamp - lastTime) / 1000;  // 秒
    lastTime = timestamp;
    
    // 固定逻辑更新（60 FPS）
    update(delta);
    
    // 渲染
    render();
    
    requestAnimationFrame(gameLoop);
}
```

---

## 3. 游戏玩法设计

### 3.1 操作方式
| 操作 | 按键（PC） | 触屏 |
|------|-----------|------|
| 移动战机 | 方向键 / WASD / 鼠标拖动 | 手指拖动 |
| 手动开火 | 空格键（默认自动开火） | 自动 |
| 放炸弹/大招 | B 键 或 双击 | 双击屏幕 |
| 暂停 | ESC / P | 暂停按钮 |

### 3.2 玩家战机系统

#### 3.2.1 战机属性
```js
player = {
    x, y, width: 48, height: 56,
    speed: 320,            // 移动速度 px/s
    hp: 100, maxHp: 100,
    shield: 0, maxShield: 50,
    fireRate: 0.12,        // 射击间隔（秒）
    invincible: false,
    weapons: {
        primary: 'single', // 主武器
        secondary: 'none' // 副武器
    },
    powerLevel: 1..5       // 火力等级
}
```

#### 3.2.2 武器系统（6 种）
| 武器名 | 类型 | 描述 | 获取方式 |
|--------|------|------|---------|
| ⚡ 脉冲激光 | 主武器 | 单发高速直线弹，穿透 | 初始 |
| 🔱 三连散射 | 主武器 | 3 发扇形散射 | PowerUp P 道具 |
| 🌀 螺旋炮 | 主武器 | 旋转弹幕，圆形扩散 | PowerUp S 道具 |
| 💥 等离子炮 | 主武器 | 重型单发，高伤害，大弹体 | BOSS 掉落 |
| 🔫 追踪导弹 | 副武器 | 自动锁定最近敌机 | PowerUp H 道具 |
| ❄️ 冰冻弹 | 副武器 | 命中减速敌机 | PowerUp F 道具 |

#### 3.2.3 大招系统
- 能量条（击杀敌机积累）
- 满格后释放：全屏清屏 + 所有敌机受伤 + 屏幕震动
- 视觉效果：蓝色冲击波扩散 + 扫描线 + 闪白

### 3.3 敌机波次系统

#### 3.3.1 敌机类型
| 类型 | HP | 速度 | 行为 | 得分 |
|------|-----|------|------|------|
| 🟢 侦察兵 Scout | 20 | 150 | 直线飞行，偶尔射击 | 100 |
| 🔵 战斗机 Fighter | 40 | 100 | S 形机动，定期射击 | 200 |
| 🟣 精英 Elite | 80 | 80 | 发射三连弹幕 | 400 |
| 🔴 重型 Heavy | 150 | 50 | 缓慢但子弹密集 | 800 |
| ⚫ 自杀式 Kamikaze | 30 | 250 | 追踪玩家冲撞 | 300 |

#### 3.3.2 波次生成（Spawner）
```js
spawnPatterns = [
    // 第 1 关：入门
    { time: 1, type: 'scout', count: 5, interval: 0.5 },
    { time: 8, type: 'fighter', count: 3, interval: 1 },
    // 第 2 关：混合
    { time: 20, type: 'scout', count: 10, interval: 0.3 },
    { time: 30, type: 'elite', count: 2, interval: 2 },
    // ... BOSS 触发条件：时间或击杀数
    { time: 60, trigger: 'BOSS' }
]
```

#### 3.3.3 难度递增
- 每 30 秒，敌机 HP +15%，速度 +5%
- 每 5 波出现精英敌机
- 连击加成：连续击杀 combo 越高得分倍率越高（最高 5x）

### 3.4 道具系统（PowerUp）

#### 3.4.1 道具类型（敌机掉落 + 场景道具）
| 图标 | 名称 | 效果 |
|------|------|------|
| 🔴 | P - Power | 火力升级（最高 5 级） |
| 🟢 | S - Shield | 护盾 +25 |
| 🔵 | B - Bomb | 炸弹 +1 |
| 🟡 | H - Homing | 安装追踪导弹副武器 |
| 🟣 | F - Freeze | 安装冰冻副武器 |
| ⚪ | M - Magnet | 磁铁：自动吸收附近道具 |
| 🔶 | L - Life | 复活币 +1 |
| 🟠 | G - Gold | 金币 +500 分 |

#### 3.4.2 道具行为
- 被敌机击毁后随机掉落（15% 概率）
- 磁铁激活时自动吸附 200px 内道具
- 接触战机自动拾取 + 拾取特效

### 3.5 BOSS 系统 ⚠️ 核心玩法

#### 3.5.1 BOSS 设计：巨型母舰「深渊之喉」
```
┌──────────────────────────────┐
│     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      │
│    ▓   主炮激光阵列      ▓    │
│   ▓                        ▓   │
│   ▓   核心能量球          ▓   │
│    ▓                        ▓  │
│     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      │
└──────────────────────────────┘
```

#### 3.5.2 三阶段行为模式

**阶段一：试探（HP 100% → 66%）**
- 行为：缓慢左右移动
- 攻击：周期性发射 3 道激光柱
- 召唤：每隔 5 秒召唤 2 架侦察兵
- 弹幕：8 方向圆形弹幕（慢速）

**阶段二：猛攻（HP 66% → 33%）**
- 行为：快速冲刺攻击（冲向玩家位置）
- 攻击：
  - 双旋转炮塔（Twin Gatling）：高速追踪弹
  - 底部导弹阵列：3 发追踪导弹
  - 随机 5 方向弹幕
- 屏幕震动：每次冲刺时触发

**阶段三：狂暴（HP 33% → 0%）**
- 行为：全屏横扫（从左到右 / 右到左）
- 攻击：
  - 核心爆裂：360° 圆形弹幕 3 连发
  - 激光风暴：随机位置 5 道激光柱
  - 召唤：4 架重型敌机 + 2 架精英
- 背景变红、屏幕持续微震

#### 3.5.3 BOSS 参数
```js
boss = {
    name: '深渊之喉',
    hp: 5000, maxHp: 5000,
    width: 320, height: 180,
    phases: 3,
    currentPhase: 1,
    score: 50000
}
```

#### 3.5.4 BOSS 进入动画
1. 屏幕上方黑暗 + 警报闪烁
2. BOSS 从屏幕顶部缓慢下降（4 秒）
3. 锁定位置 + HP 条出现
4. 背景音：低频警报声

#### 3.5.5 BOSS 击杀奖励
- 1 枚 L（复活币）+ 3 枚 P + 20000 分
- 全屏爆炸动画（分多次爆炸）
- 掉落大量金色金币
- 解锁下一难度

### 3.6 碰撞检测
```js
// AABB + 圆形混合检测
function checkCollision(a, b) {
    return !(a.x + a.width < b.x ||
             a.x > b.x + b.width ||
             a.y + a.height < b.y ||
             a.y > b.y + b.height);
}
```
- 玩家子弹 vs 敌机（矩形）
- 敌机子弹 vs 玩家（圆形，精准）
- 玩家 vs 敌机（矩形）
- 玩家 vs 道具（圆形吸附）

### 3.7 分数与连击
```js
score = 0;
combo = 0;
comboTimer = 0;  // 3 秒内连续击杀累加

comboMultiplier = 1 + Math.min(combo / 20, 4);  // 最高 5x
```
- 新纪录保存到 `localStorage`
- 结算画面显示：得分、最高连击、击杀数、BOSS 奖励

---

## 4. 视觉设计

### 4.1 视觉风格
- **色调**：深蓝/紫色宇宙背景 + 青蓝/霓虹粉/电光绿发光色
- **字体**：`Orbitron` 或 `Rajdhani`（Google Fonts）
- **发光效果**：`shadow: 0 0 10px #0ff, 0 0 20px #0ff`
- **星空**：3 层视差（近/中/远），不同速度
- **CRT 扫描线**：半透明横条纹覆盖全屏（经典街机感）
- **HUD**：四角信息面板，雷达图 + HP 仪表 + 能量条

### 4.2 战机外观（Canvas 矢量绘制）
```
玩家战机：
   ╱╲
  ╱  ╲      ← 青蓝渐变 + 白色发光
 ╱ ●● ╲    ← 引擎喷射（橙红火焰粒子）
╱__||__╲   ← 机身
  │  │
  ╰──╯
```
- 敌机：六边形 / 菱形 / 三角形不同形状对应类型
- BOSS：大型矩形 + 复杂几何纹理 + 多个发光核心

### 4.3 粒子特效
| 特效 | 实现 |
|------|------|
| 引擎尾焰 | 每帧生成 2-3 粒子，橙→黄→透明 |
| 爆炸 | 多层圆环扩散 + 粒子爆裂 + 屏幕震动 |
| 命中闪光 | 白色粒子球快速扩散消失 |
| 护盾破裂 | 蓝色六边形碎片四散 |
| 道具拾取 | 金色星星粒子螺旋上升 |
| BOSS 进入 | 警报红光扫描 + 粒子聚集 |

### 4.4 屏幕特效
- **Hit Stop**：命中瞬间 0.03 秒时间冻结（手感关键）
- **屏幕震动**：受击 / BOSS 攻击时触发
- **闪白**：释放大招时全屏闪白 0.2 秒
- **红屏**：玩家血量 < 20% 时屏幕边缘红色脉动

---

## 5. 音频系统

### 5.1 音效（Web Audio 程序化合成）
| 音效 | 触发 |
|------|------|
| shoot_激光 | 每次开火（短高频） |
| hit_命中 | 命中敌机 |
| explosion_小 | 小型敌机爆炸 |
| explosion_大 | BOSS/重型敌机爆炸 |
| pickup_道具 | 拾取道具（金币音） |
| boss_警报 | BOSS 出场（低频警报） |
| boss_激光 | BOSS 激光攻击 |
| player_damage | 玩家受伤 |
| powerup_升级 | 火力升级 |
| skill_大招 | 释放大招 |

### 5.2 背景音乐
- 采用程序化生成的电子/合成器氛围音乐
- 或使用 `<audio>` 标签加载 mp3（可选）
- 游戏静音按钮 + 音量调节

---

## 6. UI / 场景流转

### 6.1 场景流程
```
┌─────────────┐
│   主菜单     │  →  游戏中  │  →  暂停  │
│ (MenuScene)  │             │ (Pause) │
└─────────────┘              └─────────┘
       │                          │
       ▼                          │
┌─────────────┐                  │
│  游戏中      │  →  BOSS 战  │ ←┘
│ (GameScene)  │  (BossScene) │
└─────────────┘              │
       │                      │
       ▼                      ▼
┌─────────────┐          ┌─────────────┐
│  结算       │          │  胜利画面   │
│ (GameOver)  │          │  (Victory)  │
└─────────────┘          └─────────────┘
```

### 6.2 主菜单 UI
```
┌──────────────────────────────────────┐
│                                      │
│     ✦ 星际战机 ✦                     │
│     STAR FIGHTER: DEEP SPACE ASSAULT │
│                                      │
│     ┌────────────────────────┐       │
│     │   ▶ 开始游戏           │       │
│     └────────────────────────┘       │
│     ┌────────────────────────┐       │
│     │     难度选择 [普通▲]   │       │
│     └────────────────────────┘       │
│     ┌────────────────────────┐       │
│     │     排行榜             │       │
│     └────────────────────────┘       │
│     ┌────────────────────────┐       │
│     │     操作说明           │       │
│     └────────────────────────┘       │
│     ┌────────────────────────┐       │
│     │     静音  重置纪录     │       │
│     └────────────────────────┘       │
│                                      │
└──────────────────────────────────────┘
```

### 6.3 游戏内 HUD
```
┌────────────────────────────────────┐
│ 得分: 128,500  连击: 25x   炸弹: 3 │
│ ━━━━━━━━━━━━━━━━━━ HP 80%  ⚡ 60%  ┃ │
│ 雷达 ◉                              │
│                                     │
│              (游戏画面)             │
│                                     │
│ 火力: Lv.3   武器: 三连+追踪        │
│ 磁铁: ●  护盾: 40/50               │
│ 暂停按钮                           │
└────────────────────────────────────┘
```

### 6.4 BOSS 战 HUD
```
┌────────────────────────────────────┐
│ ⚠ BOSS: 深渊之喉  ║ HP: ██████░░ 62% ║│
│ 得分: 258,500  连击: 35x   炸弹: 2 │
│                                     │
│              (BOSS 画面)            │
│                                     │
│ 火力: Lv.5  阶段: 2/3              │
└────────────────────────────────────┘
```

### 6.5 结算画面
```
┌────────────────────────────────────┐
│        战斗结束                      │
│  ─────────────────────────────       │
│  最终得分: 128,500                   │
│  最高连击: 42x                      │
│  击杀敌机: 87 架                    │
│  BOSS 奖励: ✓ 50,000                │
│  最高纪录: 256,800                   │
│  ─────────────────────────────       │
│  [再来一局]  [主菜单]  [分享]        │
└────────────────────────────────────┘
```

---

## 7. 配置参数总表（config.js）

```js
const CONFIG = {
    // 画布
    CANVAS: { width: 800, height: 600 },
    
    // 玩家
    PLAYER: {
        speed: 320,
        hp: 100,
        shield: 50,
        fireRate: 0.12,
        invincibleTime: 1.5,
        maxPowerLevel: 5
    },
    
    // 游戏平衡
    GAME: {
        spawnInterval: 1.0,
        difficultyScale: 0.15,  // 每 30s +15% 难度
        bossTime: 90,          // 90 秒后 BOSS 出现
        maxComboTime: 3
    },
    
    // BOSS
    BOSS: {
        hp: 5000,
        phaseRatio: [1.0, 0.66, 0.33],
        moveSpeed: 80
    },
    
    // 道具
    POWERUP: {
        dropRate: 0.15,
        magnetRange: 200
    },
    
    // 颜色
    COLORS: {
        primary: '#00ffff',
        secondary: '#ff00ff',
        accent: '#ffff00',
        background: '#0a0a2e',
        hud: '#00ff88'
    }
};
```

---

## 8. 关键技术实现要点

### 8.1 星空视差背景
```js
class Starfield {
    constructor() {
        this.layers = [
            { stars: 80, speed: 20, size: 1, alpha: 0.3 },  // 远
            { stars: 50, speed: 50, size: 2, alpha: 0.6 },  // 中
            { stars: 20, speed: 100, size: 3, alpha: 1.0 }  // 近
        ];
    }
    update(dt) { /* 每颗星按速度向下移动 */ }
    render(ctx) { /* 画星星 + 拖尾 */ }
}
```

### 8.2 Hit Stop 手感
```js
let hitStopTimer = 0;
function update(dt) {
    if (hitStopTimer > 0) {
        hitStopTimer -= dt;
        return;  // 冻结游戏逻辑，但不冻结渲染
    }
    // ... 正常更新
}
function onHit() {
    hitStopTimer = 0.03;  // 30ms 冻结
}
```

### 8.3 BOSS 行为状态机
```js
// boss.js
const STATES = {
    ENTERING: 'entering',
    PHASE1: 'phase1',
    PHASE2: 'phase2', 
    PHASE3: 'phase3',
    DYING: 'dying'
};

class Boss extends Entity {
    update(dt) {
        switch(this.state) {
            case 'entering': this.enter(dt); break;
            case 'phase1': this.phase1(dt); break;
            case 'phase2': this.phase2(dt); break;
            case 'phase3': this.phase3(dt); break;
            case 'dying': this.die(dt); break;
        }
    }
}
```

### 8.4 子弹池（性能优化）
```js
const bulletPool = [];
function createBullet() {
    return bulletPool.pop() || new Bullet();
}
function recycleBullet(b) {
    bulletPool.push(b);
}
```

### 8.5 响应式适配
```js
function resizeCanvas() {
    const ratio = CONFIG.CANVAS.width / CONFIG.CANVAS.height;
    const windowRatio = window.innerWidth / window.innerHeight;
    
    if (windowRatio > ratio) {
        height = window.innerHeight;
        width = height * ratio;
    } else {
        width = window.innerWidth;
        height = width / ratio;
    }
    
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}
```

---

## 9. 开发优先级（MVP → 完整版）

### Phase 1 - MVP（核心可玩）
1. ✅ 项目骨架 + 场景切换
2. ✅ 玩家战机 + 移动 + 自动射击
3. ✅ 基础敌机 + 直线子弹
4. ✅ 碰撞检测 + 血量系统
5. ✅ 分数 + 游戏结束
6. ✅ 星空背景

### Phase 2 - 核心玩法
7. ✅ 多种敌机 + 波次生成
8. ✅ 道具系统（P/S/B）
9. ✅ 武器升级（3 种主武器）
10. ✅ 连击系统
11. ✅ Hit Stop + 屏幕震动
12. ✅ 粒子特效（爆炸/尾焰）

### Phase 3 - BOSS 与深度玩法
13. ✅ BOSS 三阶段行为
14. ✅ BOSS 弹幕模式
15. ✅ BOSS 进入/死亡动画
16. ✅ 炸弹/大招系统
17. ✅ 更多武器（追踪/冰冻）
18. ✅ 磁铁/复活币

### Phase 4 - 打磨
19. ✅ 音效系统（Web Audio）
20. ✅ 主菜单 + 设置
21. ✅ 结算画面 + 本地排行榜
22. ✅ 难度选择
23. ✅ CRT 扫描线效果
24. ✅ 移动端触屏优化
25. ✅ 代码整理 + 注释

---

## 10. 扩展想法（后续可做）
- 🎯 每日挑战 / 限时关卡
- 🏆 全球排行榜（需要后端）
- 🛸 多种战机选择（不同属性）
- 🌌 多主题：太空 → 火山 → 冰雪 → 机械城
- 💎 成就系统
- 🎨 战机皮肤

---

## 附录：代码框架伪代码

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>星际战机：深空突袭</title>
    <link rel="stylesheet" href="styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body>
    <div id="game-container">
        <canvas id="game-canvas" width="800" height="600"></canvas>
        <div id="hud-overlay"></div>
        <div id="scene-container"></div>
    </div>
    <script src="src/config.js"></script>
    <script src="src/utils.js"></script>
    <script src="src/input.js"></script>
    <script src="src/audio.js"></script>
    <script src="src/entities/bullet.js"></script>
    <script src="src/entities/particle.js"></script>
    <script src="src/entities/powerup.js"></script>
    <script src="src/entities/enemy.js"></script>
    <script src="src/entities/player.js"></script>
    <script src="src/entities/boss.js"></script>
    <script src="src/systems/spawner.js"></script>
    <script src="src/systems/collision.js"></script>
    <script src="src/render/starfield.js"></script>
    <script src="src/render/hud.js"></script>
    <script src="src/scenes/scene.js"></script>
    <script src="src/scenes/menuScene.js"></script>
    <script src="src/scenes/gameScene.js"></script>
    <script src="src/scenes/bossScene.js"></script>
    <script src="src/scenes/gameoverScene.js"></script>
    <script src="game.js"></script>
</body>
</html>
```

---

> **文档版本**：v1.0  
> **目标 Builder**：Solo Builder（AI / 人类均可）  
> **开发时长估算**：完整约 15-20 小时（分 4 个 Phase 渐进交付）  
> **下一步**：用户审阅本文档 → 提出修改意见 → 最终版确认 → 交给 Builder 生成代码