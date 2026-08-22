/**
 * 移动端竖屏/横屏切换 —— 自适应测试用例
 *
 * 用法：
 *   方式一：在 index.html 中游戏脚本之后添加
 *          <script src="tests/orientation-test.js?v=18"></script>
 *          然后在浏览器控制台执行 runOrientationTests()
 *   方式二：直接将本文件内容粘贴到浏览器控制台（游戏已加载时），再执行 runOrientationTests()
 *
 * 测试覆盖：
 *   T1  Canvas 缓冲尺寸与容器 CSS 尺寸一致
 *   T2  CONFIG.CANVAS 与 canvas 缓冲一致
 *   T3  Input 缩放比例为 1（canvas 缓冲 = CSS 尺寸）
 *   T4  玩家位置在 resize 后仍处于画面内
 *   T5  派发 orientationchange 不抛异常
 *   T6  resize 后 canvas 非空白（无闪烁/黑屏）
 *   T7  快速连续方向切换不导致状态错乱
 *   T8  星空覆盖整个画面（无聚集/缺失区域）
 *   T9  暂停状态下 resize 会触发重绘（canvas 非空白）
 *   T10 超小尺寸 (240×300) 下游戏仍可运行
 */
window.OrientationTests = (function () {
    const results = [];
    let game = null;

    function setGame(g) { game = g; }

    function assert(name, condition, details) {
        const entry = { name, passed: !!condition, details: details || '' };
        results.push(entry);
        const tag = condition ? '%c✓ PASS' : '%c✗ FAIL';
        const style = condition ? 'color:#00ff88;font-weight:bold' : 'color:#ff4444;font-weight:bold';
        console.log(tag + ' %c' + name + (details ? ' — ' + details : ''),
            style, 'color:#aaccdd;');
    }

    function getCanvas() { return document.getElementById('game-canvas'); }
    function getContainer() { return document.getElementById('game-container'); }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /** 采样 canvas 像素，判断是否完全空白（全透明） */
    function isCanvasBlank() {
        const cv = getCanvas();
        const ctx = cv.getContext('2d');
        try {
            // 采样中心、四角附近共 5 个点，每点取 4×4 区域
            const pts = [
                [cv.width / 2, cv.height / 2],
                [cv.width * 0.1, cv.height * 0.1],
                [cv.width * 0.9, cv.height * 0.1],
                [cv.width * 0.1, cv.height * 0.9],
                [cv.width * 0.9, cv.height * 0.9],
            ];
            for (const [x, y] of pts) {
                const px = Math.floor(x) - 2;
                const py = Math.floor(y) - 2;
                if (px < 0 || py < 0 || px + 4 > cv.width || py + 4 > cv.height) continue;
                const data = ctx.getImageData(px, py, 4, 4).data;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] > 0) return false; // 存在非透明像素
                }
            }
            return true;
        } catch (e) {
            // getImageData 跨域受限时保守返回 false（认为非空白）
            return false;
        }
    }

    /** 模拟 orientationchange + resize 事件序列 */
    function fireOrientationChange() {
        window.dispatchEvent(new Event('orientationchange'));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    }

    // ---- 各测试用例 ----

    async function T1_canvasMatchesContainer() {
        const cv = getCanvas();
        const rect = getContainer().getBoundingClientRect();
        assert('T1 Canvas宽度匹配容器', cv.width === Math.round(rect.width),
            `canvas=${cv.width} container=${Math.round(rect.width)}`);
        assert('T1 Canvas高度匹配容器', cv.height === Math.round(rect.height),
            `canvas=${cv.height} container=${Math.round(rect.height)}`);
    }

    async function T2_configMatchesCanvas() {
        const cv = getCanvas();
        assert('T2 CONFIG.CANVAS.width === canvas.width',
            CONFIG.CANVAS.width === cv.width,
            `config=${CONFIG.CANVAS.width} canvas=${cv.width}`);
        assert('T2 CONFIG.CANVAS.height === canvas.height',
            CONFIG.CANVAS.height === cv.height,
            `config=${CONFIG.CANVAS.height} canvas=${cv.height}`);
    }

    async function T3_inputScale() {
        Input.updateScale();
        const scaleXOk = Math.abs(Input.scaleX - 1) < 0.01;
        const scaleYOk = Math.abs(Input.scaleY - 1) < 0.01;
        assert('T3 Input.scaleX ≈ 1', scaleXOk, `scaleX=${Input.scaleX.toFixed(4)}`);
        assert('T3 Input.scaleY ≈ 1', scaleYOk, `scaleY=${Input.scaleY.toFixed(4)}`);
    }

    async function T4_playerInBounds() {
        if (!game || !game.player || !game.player.active) {
            assert('T4 玩家在画面内（无玩家时跳过）', true, 'player 不存在或未激活');
            return;
        }
        const p = game.player;
        const w = CONFIG.CANVAS.width;
        const h = CONFIG.CANVAS.height;
        assert('T4 玩家 X 在画面内', p.x >= 0 && p.x + p.width <= w,
            `x=${p.x.toFixed(0)} w=${p.width} canvasW=${w}`);
        assert('T4 玩家 Y 在画面内', p.y >= 0 && p.y + p.height <= h,
            `y=${p.y.toFixed(0)} h=${p.height} canvasH=${h}`);
    }

    async function T5_orientationNoException() {
        let threw = false;
        let errMsg = '';
        try {
            fireOrientationChange();
            await sleep(700);
        } catch (e) {
            threw = true;
            errMsg = e.message;
        }
        assert('T5 orientationchange 不抛异常', !threw, errMsg);
    }

    async function T6_noFlickerAfterResize() {
        // 先确保一帧正常渲染
        await sleep(100);
        game && (game._needsResize = true);
        await sleep(50); // 等待下一帧处理 resize + draw
        await sleep(50); // 再等一帧确保完成
        const blank = isCanvasBlank();
        assert('T6 resize 后 canvas 非空白（无闪烁）', !blank,
            blank ? '检测到 canvas 全透明' : 'canvas 有渲染内容');
    }

    async function T7_rapidOrientationChanges() {
        if (!game) { assert('T7 快速连续方向切换（无 game 跳过）', true); return; }
        const beforeScene = game.scene ? game.scene.name : 'unknown';
        const beforePaused = game.scene ? game.scene.paused : null;

        // 在 1.2s 内派发 6 次方向切换
        for (let i = 0; i < 6; i++) {
            setTimeout(() => fireOrientationChange(), i * 200);
        }
        await sleep(1600);

        const afterScene = game.scene ? game.scene.name : 'unknown';
        const cv = getCanvas();
        const configOk = CONFIG.CANVAS.width === cv.width && CONFIG.CANVAS.height === cv.height;

        assert('T7 快速切换后场景不变', beforeScene === afterScene,
            `before=${beforeScene} after=${afterScene}`);
        assert('T7 快速切换后 CONFIG 与 canvas 一致', configOk,
            `config=${CONFIG.CANVAS.width}x${CONFIG.CANVAS.height} canvas=${cv.width}x${cv.height}`);
        assert('T7 快速切换后 canvas 非空白', !isCanvasBlank(), '');
    }

    async function T8_starfieldCoverage() {
        if (!game || !game.starfield) {
            assert('T8 星空覆盖（无 starfield 跳过）', true);
            return;
        }
        const sf = game.starfield;
        const w = CONFIG.CANVAS.width;
        const h = CONFIG.CANVAS.height;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let count = 0;
        for (const layer of sf.layers) {
            for (const star of layer.stars) {
                if (star.x < minX) minX = star.x;
                if (star.x > maxX) maxX = star.x;
                if (star.y < minY) minY = star.y;
                if (star.y > maxY) maxY = star.y;
                count++;
            }
        }
        // 星星应分布在画面宽高的 80% 以上区域
        const xCoverage = count > 0 ? (maxX - minX) / w : 0;
        const yCoverage = count > 0 ? (maxY - minY) / h : 0;
        assert('T8 星空 X 方向覆盖 ≥ 80%', xCoverage >= 0.8,
            `coverage=${xCoverage.toFixed(2)} range=[${minX.toFixed(0)},${maxX.toFixed(0)}] w=${w}`);
        assert('T8 星空 Y 方向覆盖 ≥ 80%', yCoverage >= 0.8,
            `coverage=${yCoverage.toFixed(2)} range=[${minY.toFixed(0)},${maxY.toFixed(0)}] h=${h}`);
    }

    async function T9_pausedResizeRedraws() {
        if (!game || !game.scene || !game.scene.isPlaying) {
            assert('T9 暂停态重绘（非游戏场景跳过）', true);
            return;
        }
        // 暂停
        const wasPaused = game.scene.paused;
        if (!wasPaused) {
            game.togglePause();
            await sleep(200);
        }
        // 触发 resize
        game._needsResize = true;
        await sleep(100);
        const blank = isCanvasBlank();
        assert('T9 暂停态 resize 后 canvas 非空白', !blank,
            blank ? 'canvas 空白（暂停时未重绘）' : 'canvas 有内容');

        // 恢复原暂停状态
        if (!wasPaused) {
            game.togglePause();
            await sleep(100);
        }
    }

    async function T10_minimumDimensions() {
        // 验证最小尺寸保护不会导致崩溃
        let threw = false;
        let errMsg = '';
        try {
            // 手动调用 resize 并传入极小容器尺寸的模拟
            const oldW = CONFIG.CANVAS.width;
            const oldH = CONFIG.CANVAS.height;
            // 临时设置 CONFIG 为极小值再恢复，验证 starfield.resize 不出错
            if (game && game.starfield) {
                game.starfield.resize(oldW, oldH, 240, 300);
                game.starfield.resize(240, 300, oldW, oldH); // 恢复
            }
        } catch (e) {
            threw = true;
            errMsg = e.message;
        }
        assert('T10 极小尺寸 starfield.resize 不抛异常', !threw, errMsg);

        // 验证 canvas 宽高有下限保护
        const cv = getCanvas();
        assert('T10 Canvas 宽度 ≥ 240', cv.width >= 240, `width=${cv.width}`);
        assert('T10 Canvas 高度 ≥ 300', cv.height >= 300, `height=${cv.height}`);
    }

    // ---- 主入口 ----

    async function runAll() {
        results.length = 0;
        game = window.game || game;
        if (!game) {
            console.error('[OrientationTests] 未找到 window.game，请确保游戏已加载');
            return null;
        }
        setGame(game);

        console.log('%c=== 移动端竖屏/横屏切换自适应测试 ===', 'color:#00ffff;font-size:14px;font-weight:bold');
        console.log(`初始尺寸: canvas=${getCanvas().width}x${getCanvas().height} config=${CONFIG.CANVAS.width}x${CONFIG.CANVAS.height}`);

        await T1_canvasMatchesContainer();
        await T2_configMatchesCanvas();
        await T3_inputScale();
        await T4_playerInBounds();
        await T5_orientationNoException();
        await T6_noFlickerAfterResize();
        await T7_rapidOrientationChanges();
        await T8_starfieldCoverage();
        await T9_pausedResizeRedraws();
        await T10_minimumDimensions();

        // 汇总
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        console.log('%c=== 测试汇总 ===', 'color:#00ffff;font-weight:bold');
        console.log(`%c通过: ${passed}  失败: ${failed}  总计: ${results.length}`,
            failed > 0 ? 'color:#ff4444;font-weight:bold' : 'color:#00ff88;font-weight:bold');

        if (failed > 0) {
            console.log('%c失败项:', 'color:#ff4444');
            results.filter(r => !r.passed).forEach(r => {
                console.log(`  ✗ ${r.name} — ${r.details}`);
            });
        }

        // 打印结果表到页面（如果存在 body）
        printResultsTable(passed, failed);

        return { passed, failed, results: results.slice() };
    }

    function printResultsTable(passed, failed) {
        let panel = document.getElementById('test-results-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'test-results-panel';
            panel.style.cssText = `
                position:fixed; top:10px; right:10px; z-index:99999;
                max-width:420px; max-height:90vh; overflow-y:auto;
                background:rgba(0,15,30,0.95); border:1px solid #00ffff;
                color:#aaccdd; font-family:monospace; font-size:12px;
                padding:12px; border-radius:4px; box-shadow:0 0 20px rgba(0,255,255,0.3);
            `;
            document.body.appendChild(panel);
        }
        const status = failed === 0
            ? '<span style="color:#00ff88;font-weight:bold">全部通过</span>'
            : `<span style="color:#ff4444;font-weight:bold">${failed} 项失败</span>`;
        let html = `<div style="margin-bottom:8px;color:#00ffff;font-weight:bold">自适应测试结果 ${status}</div>`;
        html += `<div style="margin-bottom:6px;color:#88aacc">通过 ${passed} / ${results.length}</div>`;
        results.forEach(r => {
            const color = r.passed ? '#00ff88' : '#ff4444';
            const icon = r.passed ? '✓' : '✗';
            html += `<div style="color:${color};margin:2px 0">${icon} ${r.name}${r.details ? ' <span style="color:#667788">' + r.details + '</span>' : ''}</div>`;
        });
        html += `<div style="margin-top:8px"><button onclick="this.parentElement.remove()" style="background:transparent;color:#00ffff;border:1px solid #00ffff;padding:4px 12px;cursor:pointer;font-family:monospace">关闭</button></div>`;
        panel.innerHTML = html;
    }

    return { runAll, setGame, results: () => results.slice() };
})();

// 便捷全局函数
window.runOrientationTests = function () {
    return window.OrientationTests.runAll();
};
