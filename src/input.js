// Keyboard + pointer-lock mouse input. Emits "activity" for the cost guard.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pressed = new Set(); // keys pressed this frame (edge-triggered)
    this.locked = false;
    this.lastActivity = performance.now();
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || /[?&]touch\b/.test(location.search);
    this.joy = { x: 0, y: 0 }; // virtual joystick, -1..1 (x = strafe right, y = forward)
    this.onActivity = null;
    this.chatOpen = false; // while true, game keys are ignored entirely
    this.golfCapture = false;     // GOLF mode owns this — via setGolfCapture()
    this.golfPointer = null;      // { down, x, y, t } while capturing

    const active = () => { this.lastActivity = performance.now(); this.onActivity && this.onActivity(); };

    window.addEventListener('keydown', (e) => {
      if (this.chatOpen) { active(); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
      active();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); active(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape') this.keys.clear(); });
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
      active();
    });
    ['mousedown', 'wheel', 'touchstart', 'touchmove', 'pointerdown'].forEach((t) =>
      document.addEventListener(t, active, { passive: true }));

    canvas.addEventListener('click', () => {
      // Pointer lock freezes clientX/clientY by spec — only movementX/Y keep
      // updating — and the golf swing is read entirely from clientX/clientY.
      // Grabbing the lock mid-round would silently kill every later stroke, so
      // golf runs unlocked. Outside golf this is unchanged.
      if (this.golfCapture) return;
      if (!this.locked && !this.isTouch) canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });

    const golfTrack = (e, down) => {
      if (!this.golfCapture) return;
      this.golfPointer = { down, x: e.clientX, y: e.clientY, t: performance.now() };
    };
    canvas.addEventListener('pointerdown', (e) => golfTrack(e, true));
    canvas.addEventListener('pointermove', (e) => { if (this.golfPointer?.down) golfTrack(e, true); });
    window.addEventListener('pointerup', (e) => golfTrack(e, false));
  }

  /** Combined movement axis from keys + joystick: x = strafe (+right), y = forward (+forward). */
  moveAxis() {
    let x = (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0);
    let y = (this.down('KeyW') ? 1 : 0) - (this.down('KeyS') ? 1 : 0);
    x += this.joy.x; y += this.joy.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  /** Virtual button press/release (touch UI). */
  pressVirtual(code) { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); this.lastActivity = performance.now(); this.onActivity && this.onActivity(); }
  releaseVirtual(code) { this.keys.delete(code); }

  /** Wire up the on-screen touch controls. */
  attachTouchUI(root) {
    root.classList.remove('hidden');
    document.body.classList.add('touch');
    const joyZone = root.querySelector('#joy-zone');
    const base = root.querySelector('#joy-base');
    const knob = root.querySelector('#joy-knob');
    const RADIUS = 44;
    let joyId = null, cx = 0, cy = 0;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    joyZone.addEventListener('pointerdown', (e) => {
      if (joyId !== null) return;
      joyId = e.pointerId; cx = e.clientX; cy = e.clientY;
      try { joyZone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      const zr = joyZone.getBoundingClientRect();
      base.style.left = `${cx - zr.left - 60}px`; base.style.bottom = `${zr.bottom - cy - 60}px`; base.style.opacity = '1';
      this.lastActivity = performance.now(); this.onActivity && this.onActivity();
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      this.joy.x = dx / RADIUS; this.joy.y = -dy / RADIUS;
      setKnob(dx, dy);
      this.lastActivity = performance.now();
    });
    const joyEnd = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.joy.x = 0; this.joy.y = 0; setKnob(0, 0);
      base.style.left = '40px'; base.style.bottom = '60px'; base.style.opacity = '0.7';
    };
    joyZone.addEventListener('pointerup', joyEnd);
    joyZone.addEventListener('pointercancel', joyEnd);

    // camera drag
    const look = root.querySelector('#look-zone');
    let lookId = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', (e) => {
      if (lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      try { look.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      this.lastActivity = performance.now(); this.onActivity && this.onActivity();
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.mouseDX += (e.clientX - lx) * 2.2; this.mouseDY += (e.clientY - ly) * 2.2;
      lx = e.clientX; ly = e.clientY; this.lastActivity = performance.now();
    });
    const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; };
    look.addEventListener('pointerup', lookEnd);
    look.addEventListener('pointercancel', lookEnd);

    // Right-hand BOOST joystick: hold to boost forward, drag to steer.
    // Double-tap engages ludicrous speed (pressVirtual feeds justPressed()).
    const bstick = root.querySelector('#boost-stick');
    if (bstick) {
      const bknob = root.querySelector('#boost-knob');
      const BR = 46;
      let bId = null, bx = 0, by = 0;
      const bstart = (e) => {
        if (bId !== null) return;
        e.preventDefault();
        bId = e.pointerId; bx = e.clientX; by = e.clientY;
        try { bstick.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        bstick.classList.add('active');
        this.pressVirtual('ShiftLeft');   // boost
        this.pressVirtual('KeyW');        // throttle forward
      };
      const bmove = (e) => {
        if (e.pointerId !== bId) return;
        const rdx = e.clientX - bx, rdy = e.clientY - by;
        let kx = rdx, ky = rdy;
        const len = Math.hypot(kx, ky);
        if (len > BR) { kx *= BR / len; ky *= BR / len; }
        if (bknob) bknob.style.transform = `translate(${kx}px, ${ky}px)`;
        this.mouseDX += rdx * 2.0; this.mouseDY += rdy * 2.0;   // steer
        bx = e.clientX; by = e.clientY;
        this.lastActivity = performance.now();
      };
      const bend = (e) => {
        if (e.pointerId !== bId) return;
        bId = null;
        bstick.classList.remove('active');
        if (bknob) bknob.style.transform = '';
        this.releaseVirtual('ShiftLeft');
        this.releaseVirtual('KeyW');
      };
      bstick.addEventListener('pointerdown', bstart);
      bstick.addEventListener('pointermove', bmove);
      bstick.addEventListener('pointerup', bend);
      bstick.addEventListener('pointercancel', bend);
      bstick.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // buttons
    const extraBtns = [...root.querySelectorAll('#touch-buttons button')];
    extraBtns.forEach((b) => {
      const code = b.dataset.code;
      const dn = (e) => { e.preventDefault(); b.classList.add('active'); this.pressVirtual(code); };
      const up = () => { b.classList.remove('active'); this.releaseVirtual(code); };
      b.addEventListener('pointerdown', dn);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  /**
   * Turn GOLF pointer capture on/off. The only supported way to set golfCapture.
   * - entering: drop any pointer lock, because a locked pointer reports frozen
   *   clientX/clientY and the swing gesture would never register a drag;
   * - either way: forget any half-finished drag, so quitting mid-swing can't
   *   leave `{ down: true }` behind and arm a phantom stroke at stale
   *   coordinates the next time a round starts.
   */
  setGolfCapture(on) {
    this.golfCapture = on;
    this.golfPointer = null;
    if (on) this.releaseLock();
  }

  down(code) { return this.keys.has(code); }
  justPressed(code) { return this.pressed.has(code); }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  endFrame() { this.pressed.clear(); }

  /** Chat took focus: forget every held key so WASD doesn't stick. */
  setChatOpen(open) { this.chatOpen = open; this.keys.clear(); this.pressed.clear(); this.joy.x = 0; this.joy.y = 0; }

  releaseLock() { if (this.locked) document.exitPointerLock?.(); }
}
