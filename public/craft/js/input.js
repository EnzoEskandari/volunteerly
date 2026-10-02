// Unified input: keyboard + mouse (pointer lock) on desktop, and a
// Minecraft Bedrock–style touch scheme on tablets/phones:
//   left side  : floating joystick (push to the edge to sprint)
//   right side : drag to look, tap to use/place/attack, hold to break
//   buttons    : jump, sneak, fly (creative), inventory, pause

export class Input {
  constructor(canvas, touchLayer) {
    this.canvas = canvas;
    this.touchLayer = touchLayer;
    this.keys = new Set();
    this.down = new Set(); // keys pressed this frame
    this.lookDX = 0; this.lookDY = 0;
    this.wheel = 0;
    this.attack = false; this.attackPressed = false;
    this.use = false; this.usePressed = false;
    this.pickPressed = false;
    this.tap = false; // touch tap (use or attack, decided by the game)
    this.mode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop';
    this.locked = false;
    this.active = false; // true while playing (no menu open)
    this.sensitivity = 1;
    this.invertY = false;
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.look = new Map(); // touch id -> state
    this.touchJump = false; this.touchSneak = false; this.touchSprint = false;
    this.sneakToggle = false;
    this.lastW = 0; this.lastSpace = 0;
    this.doubleTapSprint = false;
    this.flyToggle = false;
    this.onPause = null;
    this.onModeChange = null;
    this.bind();
  }

  setMode(m) {
    if (this.mode === m) return;
    this.mode = m;
    if (this.onModeChange) this.onModeChange(m);
  }

  bind() {
    const c = this.canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.setMode('desktop');
      if (!this.keys.has(e.code)) {
        this.down.add(e.code);
        const now = performance.now();
        if (e.code === 'KeyW') { if (now - this.lastW < 280) this.doubleTapSprint = true; this.lastW = now; }
        if (e.code === 'Space') { if (now - this.lastSpace < 280) this.flyToggle = true; this.lastSpace = now; }
      }
      this.keys.add(e.code);
      if (this.active && ['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
      if (e.code === 'F3' || (e.ctrlKey && e.code === 'KeyS')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') this.doubleTapSprint = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.attack = this.use = false; });

    c.addEventListener('mousedown', (e) => {
      if (e.pointerType === 'touch') return;
      this.setMode('desktop');
      if (!this.active) return;
      if (!this.locked && document.pointerLockElement !== c) { this.requestLock(); return; }
      if (e.button === 0) { this.attack = true; this.attackPressed = true; }
      if (e.button === 2) { this.use = true; this.usePressed = true; }
      if (e.button === 1) { this.pickPressed = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.attack = false;
      if (e.button === 2) this.use = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.locked && this.active) {
        this.lookDX += e.movementX || 0;
        this.lookDY += e.movementY || 0;
      }
    });
    window.addEventListener('wheel', (e) => {
      if (!this.active) return;
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === c;
      if (was && !this.locked && this.active && this.mode === 'desktop' && this.onPause) this.onPause();
    });

    // Touch.
    const L = this.touchLayer;
    const opts = { passive: false };
    L.addEventListener('touchstart', (e) => this.touchStart(e), opts);
    L.addEventListener('touchmove', (e) => this.touchMove(e), opts);
    L.addEventListener('touchend', (e) => this.touchEnd(e), opts);
    L.addEventListener('touchcancel', (e) => this.touchEnd(e), opts);
    // Stop iOS page gestures (pinch zoom, rubber banding).
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || this.active) e.preventDefault(); }, opts);
    document.addEventListener('dblclick', (e) => e.preventDefault());

    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.setMode('touch'); on(); el.classList.add('pressed'); }, opts);
      const end = (e) => { e.preventDefault(); e.stopPropagation(); if (off) off(); el.classList.remove('pressed'); };
      el.addEventListener('touchend', end, opts);
      el.addEventListener('touchcancel', end, opts);
      // Allow mouse clicks on the buttons too (desktop testing / hybrid devices).
      el.addEventListener('mousedown', (e) => { e.stopPropagation(); on(); el.classList.add('pressed'); });
      el.addEventListener('mouseup', (e) => { e.stopPropagation(); if (off) off(); el.classList.remove('pressed'); });
    };
    let lastJumpTap = 0;
    hold('btn-jump', () => {
      this.touchJump = true;
      const now = performance.now();
      if (now - lastJumpTap < 300) this.flyToggle = true;
      lastJumpTap = now;
    }, () => { this.touchJump = false; });
    hold('btn-sneak', () => { this.sneakToggle = !this.sneakToggle; document.getElementById('btn-sneak').classList.toggle('on', this.sneakToggle); });
    hold('btn-down', () => { this.touchSneak = true; }, () => { this.touchSneak = false; });
  }

  requestLock() {
    const c = this.canvas;
    if (!c.requestPointerLock) return;
    try {
      const p = c.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { c.requestPointerLock(); } catch (e) { /* ignore */ } });
    } catch (e) {
      try { c.requestPointerLock(); } catch (e2) { /* ignore */ }
    }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  touchStart(e) {
    e.preventDefault();
    this.setMode('touch');
    if (!this.active) return;
    const w = window.innerWidth;
    for (const t of e.changedTouches) {
      if (t.clientX < w * 0.42 && this.joy.id === null) {
        this.joy.id = t.identifier;
        this.joy.ox = t.clientX; this.joy.oy = t.clientY;
        this.joy.x = 0; this.joy.y = 0;
        this.showJoy(true);
      } else {
        this.look.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now(), moved: false, breaking: false });
      }
    }
  }
  touchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) {
        const R = 56;
        let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          // Drag the joystick origin along so it never gets "stuck".
          this.joy.ox += (dx / d) * (d - R); this.joy.oy += (dy / d) * (d - R);
          dx = (dx / d) * R; dy = (dy / d) * R;
        }
        this.joy.x = dx / R; this.joy.y = dy / R;
        this.touchSprint = d > R * 1.05 && dy < -R * 0.7;
        this.showJoy(true);
        continue;
      }
      const s = this.look.get(t.identifier);
      if (!s) continue;
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      s.x = t.clientX; s.y = t.clientY;
      if (Math.hypot(t.clientX - s.sx, t.clientY - s.sy) > 12) s.moved = true;
      this.lookDX += dx * 2.2;
      this.lookDY += dy * 2.2;
    }
  }
  touchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) {
        this.joy.id = null; this.joy.x = 0; this.joy.y = 0; this.touchSprint = false;
        this.showJoy(false);
        continue;
      }
      const s = this.look.get(t.identifier);
      if (!s) continue;
      this.look.delete(t.identifier);
      if (!s.breaking && !s.moved && performance.now() - s.t < 300) this.tap = true;
    }
  }

  showJoy(on) {
    const base = document.getElementById('joy');
    const knob = document.getElementById('joy-knob');
    if (!base) return;
    base.style.display = on ? 'block' : 'none';
    if (on) {
      base.style.left = this.joy.ox + 'px';
      base.style.top = this.joy.oy + 'px';
      knob.style.transform = `translate(${this.joy.x * 56}px, ${this.joy.y * 56}px)`;
    }
  }

  // Called once per frame before reading state.
  poll() {
    // Touch hold-to-break.
    let breaking = false;
    const now = performance.now();
    for (const s of this.look.values()) {
      if (!s.moved && now - s.t > 280) s.breaking = true;
      if (s.breaking) breaking = true;
    }
    this.touchBreaking = breaking;
  }

  get moveForward() {
    if (this.mode === 'touch' && this.joy.id !== null) return -this.joy.y;
    return (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
  }
  get moveStrafe() {
    if (this.mode === 'touch' && this.joy.id !== null) return this.joy.x;
    return (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
  }
  get jump() { return this.keys.has('Space') || this.touchJump; }
  get sneak() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.sneakToggle || this.touchSneak; }
  get sprint() { return this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.doubleTapSprint || this.touchSprint; }
  get attackHeld() { return this.attack || this.touchBreaking; }

  pressed(code) { return this.down.has(code); }

  endFrame() {
    this.down.clear();
    this.lookDX = 0; this.lookDY = 0; this.wheel = 0;
    this.attackPressed = false; this.usePressed = false; this.pickPressed = false; this.tap = false;
    this.flyToggle = false;
  }

  releaseAll() {
    this.keys.clear();
    this.attack = this.use = false;
    this.look.clear();
    this.joy.id = null; this.joy.x = this.joy.y = 0;
    this.touchJump = this.touchSneak = this.touchSprint = false;
    this.showJoy(false);
  }
}
