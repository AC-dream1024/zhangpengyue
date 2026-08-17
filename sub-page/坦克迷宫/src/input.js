window.Input = {
    canvas: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,

    keys: {},
    keysPressed: {},

    // Track which movement key was pressed last for intuitive diagonal disambiguation
    _lastMoveKey: null,  // code of last Arrow*/KeyWASD press

    mouse: {
        x: 0,
        y: 0,
        down: false,
        clicked: false,
        rightDown: false,
    },

    touch: {
        active: false,
        x: 0,
        y: 0,
    },

    // ====== Virtual Joystick & Mobile Shooting ======
    _virtualJoy: {
        active: false,
        dx: 0,
        dy: 0,
        touchId: null,
        centerX: 0,
        centerY: 0,
        radius: 60,
    },
    _mobileShooting: false,

    isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    },

    init(canvas) {
        this.canvas = canvas;
        this.updateScale();

        // Initialize mobile controls after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._initMobile());
        } else {
            this._initMobile();
        }

        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) {
                this.keysPressed[e.code] = true;
            }
            this.keys[e.code] = true;

            // Track last movement key pressed (for diagonal disambiguation)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
                this._lastMoveKey = e.code;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Recompute scale on window resize so mouse coordinates stay accurate
        window.addEventListener('resize', () => this.updateScale());
        window.addEventListener('orientationchange', () => this.updateScale());

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            // Recalculate scale every mouse move to catch any subtle size changes
            if (rect.width > 0 && rect.height > 0) {
                this.scale = this.canvas.width / rect.width;
            }
            this.offsetX = rect.left;
            this.offsetY = rect.top;
            this.mouse.x = (e.clientX - rect.left) * this.scale;
            this.mouse.y = (e.clientY - rect.top) * this.scale;
        });

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.scale = this.canvas.width / rect.width;
            }
            this.mouse.x = (e.clientX - rect.left) * this.scale;
            this.mouse.y = (e.clientY - rect.top) * this.scale;
            if (e.button === 0) {
                this.mouse.down = true;
                this.mouse.clicked = true;
            } else if (e.button === 2) {
                this.mouse.rightDown = true;
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouse.down = false;
            } else if (e.button === 2) {
                this.mouse.rightDown = false;
            }
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    this.scale = this.canvas.width / rect.width;
                }
                this.touch.active = true;
                this.touch.x = (e.touches[0].clientX - rect.left) * this.scale;
                this.touch.y = (e.touches[0].clientY - rect.top) * this.scale;
                this.mouse.x = this.touch.x;
                this.mouse.y = this.touch.y;
                this.mouse.clicked = true;
                this.mouse.down = true;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    this.scale = this.canvas.width / rect.width;
                }
                this.touch.x = (e.touches[0].clientX - rect.left) * this.scale;
                this.touch.y = (e.touches[0].clientY - rect.top) * this.scale;
                this.mouse.x = this.touch.x;
                this.mouse.y = this.touch.y;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touch.active = false;
            this.mouse.down = false;
        }, { passive: false });
    },

    updateScale() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.scale = this.canvas.width / rect.width;
            this.offsetX = rect.left;
            this.offsetY = rect.top;
        }
    },

    // Movement direction from keyboard (4-way)
    getMoveDirection() {
        let dx = 0;
        let dy = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;

        // Normalize diagonal to prevent faster diagonal movement
        if (dx !== 0 && dy !== 0) {
            // For 4-directional tank movement, prioritize horizontal
            // (classic tank game behavior - one direction at a time)
            // Actually, allow both for smoother feel but normalize
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        return { x: dx, y: dy };
    },

    // Get 4-directional movement (snapped, for hull facing)
    // When two diagonal keys are held, the last-pressed key wins its axis
    // Also merges virtual joystick input from mobile controls.
    getMoveDirection4() {
        let dx = 0, dy = 0;
        const leftDown  = this.keys['ArrowLeft']  || this.keys['KeyA'];
        const rightDown = this.keys['ArrowRight'] || this.keys['KeyD'];
        const upDown    = this.keys['ArrowUp']    || this.keys['KeyW'];
        const downDown  = this.keys['ArrowDown']  || this.keys['KeyS'];
        if (leftDown)  dx -= 1;
        if (rightDown) dx += 1;
        if (upDown)    dy -= 1;
        if (downDown)  dy += 1;

        // ====== Virtual joystick merge ======
        if (dx === 0 && dy === 0 && this._virtualJoy.active) {
            const jdx = this._virtualJoy.dx;
            const jdy = this._virtualJoy.dy;
            const jmag = Math.sqrt(jdx * jdx + jdy * jdy);
            if (jmag > 0.25) {
                // Pick dominant axis (tank = 4-way movement)
                if (Math.abs(jdx) > Math.abs(jdy)) {
                    dx = jdx > 0 ? 1 : -1;
                } else {
                    dy = jdy > 0 ? 1 : -1;
                }
            }
        }

        // If diagonal (both axes active), use last-pressed direction to pick axis
        if (dx !== 0 && dy !== 0) {
            const last = this._lastMoveKey;
            const lastIsX = (last === 'ArrowLeft' || last === 'ArrowRight' ||
                             last === 'KeyA'    || last === 'KeyD');
            const lastIsY = (last === 'ArrowUp'   || last === 'ArrowDown' ||
                             last === 'KeyW'     || last === 'KeyS');
            if (lastIsX) {
                dy = 0;
            } else if (lastIsY) {
                dx = 0;
            } else {
                // Fallback: prefer last-key of the winning side on X axis
                dy = 0;
            }
        }
        return { x: dx, y: dy };
    },

    // Also consider virtual shoot button on mobile
    isMouseDown() {
        return this.mouse.down || this._mobileShooting;
    },

    consumeMouseClick() {
        const clicked = this.mouse.clicked;
        this.mouse.clicked = false;
        return clicked;
    },

    isKeyPressed(code) {
        return !!this.keysPressed[code];
    },

    consumeKey(code) {
        if (this.keysPressed[code]) {
            this.keysPressed[code] = false;
            return true;
        }
        return false;
    },

    getMouseX() { return this.mouse.x; },
    getMouseY() { return this.mouse.y; },

    // ====== Mobile: virtual joystick + shoot button + orientation hint ======
    _initMobile() {
        const self = this;

        // ---- Touch detection: mark body so .mobile-controls appear ----
        const markTouch = () => {
            document.body.classList.add('is-touch-device');
        };
        if (this.isTouchDevice()) {
            // Mark immediately if detected via capabilities
            markTouch();
            // Also mark on first touch (covers devices where maxTouchPoints lies)
            const onceTouch = () => { markTouch(); window.removeEventListener('touchstart', onceTouch, true); };
            window.addEventListener('touchstart', onceTouch, true);
        } else {
            // Fallback: mark on first touch event if browser reports touch event later
            const onceTouch = () => { markTouch(); window.removeEventListener('touchstart', onceTouch, true); };
            window.addEventListener('touchstart', onceTouch, true);
        }

        // ---- Orientation / portrait-hint management ----
        const checkOrientation = () => {
            const isPortrait = window.innerHeight > window.innerWidth;
            if (isPortrait && self.isTouchDevice()) {
                // Only show if user has NOT explicitly dismissed recently
                const dismissed = sessionStorage.getItem('tankmaze_portrait_dismissed');
                if (!dismissed) {
                    document.body.classList.add('show-portrait-hint');
                }
            } else {
                document.body.classList.remove('show-portrait-hint');
            }
        };
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => { setTimeout(checkOrientation, 300); });
        checkOrientation();

        const hintCloseBtn = document.getElementById('orientation-hint-close');
        if (hintCloseBtn) {
            const dismiss = (ev) => {
                if (ev) ev.preventDefault();
                document.body.classList.remove('show-portrait-hint');
                sessionStorage.setItem('tankmaze_portrait_dismissed', '1');
            };
            hintCloseBtn.addEventListener('click', dismiss);
            hintCloseBtn.addEventListener('touchend', dismiss, { passive: false });
        }

        // ---- Virtual Joystick ----
        const joyContainer = document.getElementById('joystick-container');
        const joyKnob = document.getElementById('joystick-knob');
        if (joyContainer && joyKnob) {
            const joyMoveKnob = (px, py) => {
                // Center-based offset
                const rect = joyContainer.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const maxR = rect.width / 2 * 0.7;
                let ox = px - cx;
                let oy = py - cy;
                const dist = Math.sqrt(ox * ox + oy * oy);
                if (dist > maxR) {
                    ox = (ox / dist) * maxR;
                    oy = (oy / dist) * maxR;
                }
                joyKnob.style.transform = 'translate(' + ox.toFixed(1) + 'px, ' + oy.toFixed(1) + 'px)';
                // Normalize joystick output (-1..1 for each axis)
                self._virtualJoy.dx = dist > 1 ? (ox / maxR) : 0;
                self._virtualJoy.dy = dist > 1 ? (oy / maxR) : 0;
            };
            const joyReset = () => {
                self._virtualJoy.active = false;
                self._virtualJoy.touchId = null;
                self._virtualJoy.dx = 0;
                self._virtualJoy.dy = 0;
                joyKnob.style.transform = '';
            };
            joyContainer.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const t = e.changedTouches[0];
                self._virtualJoy.active = true;
                self._virtualJoy.touchId = t.identifier;
                const r = joyContainer.getBoundingClientRect();
                self._virtualJoy.centerX = r.left + r.width / 2;
                self._virtualJoy.centerY = r.top + r.height / 2;
                self._virtualJoy.radius = r.width / 2 * 0.7;
                joyMoveKnob(t.clientX, t.clientY);
            }, { passive: false });
            joyContainer.addEventListener('touchmove', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (self._virtualJoy.active && t.identifier === self._virtualJoy.touchId) {
                        joyMoveKnob(t.clientX, t.clientY);
                        break;
                    }
                }
            }, { passive: false });
            const joyEnd = (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === self._virtualJoy.touchId) {
                        joyReset();
                        break;
                    }
                }
            };
            joyContainer.addEventListener('touchend', joyEnd, { passive: false });
            joyContainer.addEventListener('touchcancel', joyEnd, { passive: false });
        }

        // ---- Shoot Button ----
        const shootBtn = document.getElementById('shoot-btn');
        if (shootBtn) {
            const setShoot = (on) => {
                self._mobileShooting = !!on;
                if (on) {
                    self.mouse.clicked = true; // also register a click for one-frame consumers
                }
            };
            shootBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setShoot(true); }, { passive: false });
            shootBtn.addEventListener('touchend', (e) => { e.preventDefault(); setShoot(false); }, { passive: false });
            shootBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); setShoot(false); }, { passive: false });
            // Desktop fallback: mouse click on the button for debugging
            shootBtn.addEventListener('mousedown', (e) => { e.preventDefault(); setShoot(true); });
            shootBtn.addEventListener('mouseup', () => setShoot(false));
            shootBtn.addEventListener('mouseleave', () => setShoot(false));
        }
    },

    reset() {
        this.keys = {};
        this.keysPressed = {};
        this._lastMoveKey = null;
        this.mouse.down = false;
        this.mouse.clicked = false;
        this.touch.active = false;
        this._virtualJoy.active = false;
        this._virtualJoy.dx = 0;
        this._virtualJoy.dy = 0;
        this._mobileShooting = false;
    },

    endFrame() {
        this.keysPressed = {};
        this.mouse.clicked = false;
    },
};
