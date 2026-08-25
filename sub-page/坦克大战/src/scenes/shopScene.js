class ShopScene extends Scene {
    constructor(game) {
        super(game);
        this.name = 'Shop';
    }

    enter() {
        super.enter();
        this.createShop();
    }

    createShop() {
        const points = this.game.totalPoints;
        const upgrades = CONFIG.UPGRADES;
        let shopItemsHTML = '';

        for (const key in upgrades) {
            const up = upgrades[key];
            const level = this.game.getUpgradeLevel(up.id);
            const isMaxed = level >= up.maxLevel;
            const cost = isMaxed ? null : up.cost[level];
            const canAfford = !isMaxed && points >= cost;

            shopItemsHTML += `
                <div class="shop-item ${isMaxed ? 'shop-maxed' : ''}" data-id="${up.id}">
                    <div class="shop-item-header">
                        <span class="shop-item-icon">${up.icon}</span>
                        <span class="shop-item-name">${up.name}</span>
                    </div>
                    <div class="shop-item-desc">${up.description}</div>
                    <div class="shop-item-level">Lv.${level}/${up.maxLevel}</div>
                    ${isMaxed
                        ? '<div class="shop-maxed-label">MAX</div>'
                        : `<button class="shop-buy-btn ${canAfford ? '' : 'disabled'}" data-id="${up.id}" ${canAfford ? '' : 'disabled'}>💰 ${cost}</button>`
                    }
                </div>
            `;
        }

        const dmgEnabled = this.game.damageNumbersEnabled;

        this.ui = this.createUI(`
            <h1 style="font-size: 28px; margin-bottom: 4px;">升级商店</h1>
            <div class="shop-points">💰 积分: ${Utils.formatNumber(points)}</div>
            <div class="shop-grid">
                ${shopItemsHTML}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; justify-content: center;">
                <button class="btn btn-secondary" id="btn-damage-toggle" style="font-size: 12px; padding: 6px 16px;">
                    🎯 伤害数字: ${dmgEnabled ? '开' : '关'}
                </button>
                <button class="btn btn-danger" id="btn-back" style="font-size: 12px; padding: 6px 16px;">← 返回主菜单</button>
            </div>
        `);

        this.ui.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.purchaseItem(id);
            });
        });

        document.getElementById('btn-damage-toggle').addEventListener('click', () => {
            this.toggleDamageNumbers();
        });

        document.getElementById('btn-back').addEventListener('click', () => {
            this.game.returnToMenu();
        });
    }

    purchaseItem(id) {
        const success = this.game.purchaseUpgrade(id);
        if (success) {
            this.game.saveUpgrades();
            this.refreshShop();
        }
    }

    refreshShop() {
        const pointsEl = this.ui.querySelector('.shop-points');
        if (pointsEl) {
            pointsEl.textContent = `💰 积分: ${Utils.formatNumber(this.game.totalPoints)}`;
        }

        for (const key in CONFIG.UPGRADES) {
            const up = CONFIG.UPGRADES[key];
            const level = this.game.getUpgradeLevel(up.id);
            const isMaxed = level >= up.maxLevel;
            const cost = isMaxed ? null : up.cost[level];
            const canAfford = !isMaxed && this.game.totalPoints >= cost;

            const itemEl = this.ui.querySelector(`.shop-item[data-id="${up.id}"]`);
            if (!itemEl) continue;

            const levelEl = itemEl.querySelector('.shop-item-level');
            if (levelEl) {
                levelEl.textContent = `Lv.${level}/${up.maxLevel}`;
            }

            if (isMaxed) {
                if (!itemEl.classList.contains('shop-maxed')) {
                    itemEl.classList.add('shop-maxed');
                    const buyBtn = itemEl.querySelector('.shop-buy-btn');
                    if (buyBtn) buyBtn.remove();
                    const maxedLabel = document.createElement('div');
                    maxedLabel.className = 'shop-maxed-label';
                    maxedLabel.textContent = 'MAX';
                    itemEl.appendChild(maxedLabel);
                }
            } else {
                const buyBtn = itemEl.querySelector('.shop-buy-btn');
                if (buyBtn) {
                    buyBtn.textContent = `💰 ${cost}`;
                    buyBtn.classList.toggle('disabled', !canAfford);
                    buyBtn.disabled = !canAfford;
                }
            }
        }
    }

    toggleDamageNumbers() {
        this.game.damageNumbersEnabled = !this.game.damageNumbersEnabled;
        localStorage.setItem('tankbattalion_dmg_numbers', this.game.damageNumbersEnabled ? 'true' : 'false');
        const btn = document.getElementById('btn-damage-toggle');
        if (btn) {
            btn.textContent = `🎯 伤害数字: ${this.game.damageNumbersEnabled ? '开' : '关'}`;
        }
    }

    setDamageNumbersEnabled(enabled) {
        this.game.damageNumbersEnabled = !!enabled;
        localStorage.setItem('tankbattalion_dmg_numbers', this.game.damageNumbersEnabled ? 'true' : 'false');
    }

    update(dt) {
        this.game.battlefield.update(dt);
    }

    draw(ctx) {
        this.game.battlefield.draw(ctx);
    }
};
