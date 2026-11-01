import * as THREE from 'three';
import { CLUBS, clubAt } from './golf/clubs.js';
import { createSwing } from './golf/swing.js';
import { launchFrom, simulate } from './golf/flight.js';
import { submitScore, playerTag } from './leaderboard.js';
import { makeFlightGround, makeSmoothGround } from './minigame/terrain.js';

/**
 * GOLF mode. Owns the ball, the club rig and the hole state; the only golf file
 * that touches THREE or the HUD. All the maths lives in ./golf/*.js so it can be
 * tested in node.
 *
 * No putting: a hole ends when the ball rests inside the green radius.
 */
const BALL_R = 0.35;                 // visually oversized so it reads at distance
const GROUND_PROBE_INTERVAL = 0.6;   // s — re-probe cadence while addressing the ball
const STAND_SIDE = 0.8;              // m the player stands right of the target line
const STAND_BACK = 0.25;             // m behind the ball, so the club head reads at the ball

export class Golf {
  constructor(scene, world, hud, player, border) {
    this.scene = scene; this.world = world; this.hud = hud; this.player = player;
    this.border = border;
    this.courses = null;
    this.active = false;
    this.course = null; this.holeIdx = 0; this.strokes = 0;
    this.clubIdx = 0;
    this.state = 'idle';             // idle | address | flying | resting
    this.swing = null;
    this._tmp = new THREE.Vector3();
    this._groundT = 0;               // accumulator driving the address-state re-probe

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    );
    this.ball.visible = false;
    this.ball.raycast = () => {};
    scene.add(this.ball);

    this.trail = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.5, fog: false }),
    );
    this.trail.visible = false;
    this.trail.raycast = () => {};
    scene.add(this.trail);

    // Club hangs on a pivot parented to the character, so one rig animates every
    // character — including the Saturn V and UFO, which have no arms at all. Built
    // once here and reused across enter/exit cycles (same pattern as the ball above:
    // geometry/material live for the life of the Golf instance, not per-round).
    this.pivot = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.4 }),
    );
    shaft.position.y = -0.55;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.07, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.3, metalness: 0.6 }),
    );
    head.position.set(0.05, -1.08, 0);
    this.pivot.add(shaft, head);
    this.pivot.visible = false;
    this.pivot.traverse((o) => { o.raycast = () => {}; });
    this.clubAngle = 0;
    this.swing0Y = 0;                 // pointer-down y that starts the current swing
    this._armed = false;              // false = aiming (free look); true = address, gesture live

    // The pin. Until now the green had NO marker at all — the player was aiming at
    // empty grass. Three parts, because a hole is played from 400 m and finished
    // from 3 m and one object cannot read at both distances:
    //   beam  — tall translucent column, the only thing visible from the tee
    //           (same idiom as the coin-run pillars in collect.js)
    //   ring  — the actual target, sized to this hole's green radius
    //   stick — flagstick + flag, what you see once you are close
    this.pin = new THREE.Group();
    this.pinBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 300, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff4d5a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    this.pinBeam.position.y = 150;
    this.pinRing = new THREE.Mesh(
      new THREE.RingGeometry(9, 10, 56),
      new THREE.MeshBasicMaterial({ color: 0xff4d5a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    this.pinRing.rotation.x = -Math.PI / 2;
    this.pinRing.position.y = 0.4;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.5 }),
    );
    pole.position.y = 1.3;
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff4d5a, side: THREE.DoubleSide, fog: false }),
    );
    flag.position.set(0.44, 2.3, 0);
    const cup = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({ color: 0x0a0f0c, side: THREE.DoubleSide, depthWrite: false }),
    );
    cup.rotation.x = -Math.PI / 2; cup.position.y = 0.06;
    this.pin.add(this.pinBeam, this.pinRing, pole, flag, cup);
    this.pin.visible = false;
    this.pin.traverse((o) => { o.raycast = () => {}; });
    scene.add(this.pin);
    this._pinT = 0;

    this.flight = null; this.flightT = 0;
    // _flightGround: one raycast, cached — for simulate()'s substeps, thousands
    // of times on the strike frame, where five rays would be a visible freeze.
    // _smoothGround: five rays averaged — for address height and launch origin,
    // called a few times a second, where the smoothing damps photogrammetry
    // noise under a resting ball. See ./minigame/terrain.js for why there are two.
    this._flightGround = makeFlightGround(world);
    this._smoothGround = makeSmoothGround(world);
  }

  async load() {
    try {
      const r = await fetch('/golf/holes.json');
      this.courses = r.ok ? await r.json() : {};
    } catch { this.courses = {}; }
  }

  /** True when holes.json actually has playable holes for this course id. */
  /** True while the player is free-looking to aim (pointer locked, no swing armed). */
  get aiming() { return this.active && this.state === 'address' && !this._armed; }

  /** Address the ball: stop aiming, hand the pointer to the swing gesture. */
  arm() {
    if (!this.active || this.state !== 'address' || this._armed) return false;
    this._armed = true;
    this.hud.toast('DRAG BACK, THEN FLICK FORWARD TO SWING', 2600);
    return true;
  }

  /** Back to free-look aiming (after a shot, or on cancel). */
  disarm() { this._armed = false; this.swing = null; this._poseSwing(0); }

  hasCourse(id) { return !!this.courses?.[id]?.holes?.length; }

  hole() { return this.course?.holes?.[this.holeIdx] ?? null; }

  enter(courseId, holeIndex = 0) {
    const c = this.courses?.[courseId];
    if (!c) { this.hud.toast('NO HOLE DATA FOR THIS COURSE', 2600); return false; }
    if (!c.holes?.[holeIndex]) { this.hud.toast('NO HOLE AT THAT INDEX', 2600); return false; }
    this.course = c; this.holeIdx = holeIndex; this.strokes = 0; this.total = 0;
    this.active = true;
    // player.mesh.add() reparents automatically if this.pivot is already attached
    // somewhere (three.js Object3D.add detaches from any current parent first), so
    // repeated enter() calls without an intervening exit() never accumulate pivots.
    this.player.mesh.add(this.pivot);
    this.pivot.position.set(0, 1.25, 0.25);
    this.pivot.visible = true;
    this._placeAtTee();
    this.hud.toast(`${c.name}\nHOLE ${this.hole().n} · PAR ${this.hole().par}\nCLICK TO LOOK · AIM · CLICK THE BALL`, 4200);
    return true;
  }

  exit() {
    this.active = false; this.state = 'idle';
    this.ball.visible = false; this.trail.visible = false;
    this.swing = null; this.flight = null;
    // Reset club + arm pose before detaching, so a session ended mid-swing (or
    // mid-follow-through) doesn't leave arms rotated on the character, and a later
    // enter() doesn't inherit a stale rotation. Safe to call with pivot already
    // detached — pivot.parent?.remove() is a no-op then (exit() runs twice back to
    // back on the round-complete path: once from _settle(), once from main.js's
    // `if (!golf.active) leaveGolf()` right after).
    this._poseSwing(0);
    this.clubAngle = 0;
    this.pin.visible = false;
    this.pivot.visible = false;
    this.pivot.parent?.remove(this.pivot);
    this.hud.setGolf(null);
  }

  /**
   * Put the pin on the current green, sized to this hole's radius. Height is NOT
   * cached — like the ball, it re-probes on a cadence, because tile LOD moves the
   * surface underneath (the same failure that buried the stadium decals 23 m down).
   */
  _placePin() {
    const h = this.hole();
    if (!h) { this.pin.visible = false; return; }
    const g = this.world.geoToScene(h.green[0], h.green[1], 0);
    this.pin.position.set(g.x, this._smoothGround(g.x, g.z), g.z);
    const r = h.r || 12;
    this.pinRing.geometry.dispose();
    this.pinRing.geometry = new THREE.RingGeometry(Math.max(1, r - 1), r, 56);
    this.pin.visible = true;
    this._pinT = 0;
  }

  _placeAtTee() {
    const h = this.hole();
    const p = this.world.geoToScene(h.tee[0], h.tee[1], 0);
    this.ball.position.set(p.x, this._smoothGround(p.x, p.z) + BALL_R, p.z);
    this.ball.visible = true;
    this.trail.visible = false;
    this._placePin();
    this._groundT = 0;
    this.state = 'address';
    this._standAtBall();
  }

  /**
   * Put the character (and the club rig parented to it) beside the ball, facing
   * the green. Without this the player stays wherever they were standing when
   * they pressed L — up to 900 m from the tee — so the camera frames a ball with
   * no golfer, no club and no swing animation next to it.
   *
   * Reuses player.spawnAt(), the same machinery teleport() uses: it resets
   * velocity/flight state, freezes the player, and settles them onto the terrain
   * on the next player.update() — which main.js now runs in GOLF mode (with
   * movement input off) for exactly this reason. Called at every tee and after
   * every settle, so the player follows the ball up the fairway.
   */
  _standAtBall() {
    const h = this.hole();
    if (!h) return;
    const a = this._headingToGreen();
    const yaw = this._aimYaw();
    const b = this.ball.position;
    // forward (toward the green) = (sin a, -cos a); right = (cos a, sin a)
    const x = b.x + Math.cos(a) * STAND_SIDE - Math.sin(a) * STAND_BACK;
    const z = b.z + Math.sin(a) * STAND_SIDE + Math.cos(a) * STAND_BACK;
    this.player.stowGlider?.();
    this.player.spawnAt(this._tmp.set(x, b.y, z), { yaw });
  }

  nextClub(dir) {
    this.clubIdx = Math.max(0, Math.min(CLUBS.length - 1, this.clubIdx + dir));
  }

  get ballPos() { return this.ball.position; }

  /** Heading from the ball toward the current green, in radians (0 = -z). */
  /**
   * Shot heading = wherever the player has aimed. `_aimYaw()` is the inverse
   * mapping used when we point the camera down the line at a new tee, so the
   * player's yaw converts back to a shot heading the same way.
   */
  _shotHeading() { return -this.player.yaw; }

  _headingToGreen() {
    const h = this.hole();
    const g = this.world.geoToScene(h.green[0], h.green[1], 0);
    return Math.atan2(g.x - this.ball.position.x, -(g.z - this.ball.position.z));
  }

  /**
   * The same aim as _headingToGreen(), expressed in player.js's yaw convention
   * (forward = (-sin yaw, -cos yaw)), which is the mirror of the shot heading
   * convention (forward = (sin a, -cos a)) used by flight.js. main.js derives
   * the golf camera from player.yaw, so this is what points the camera — and the
   * character — down the target line.
   */
  _aimYaw() { return -this._headingToGreen(); }

  /** phase: -1 fully back .. 0 address .. +1 follow-through */
  _poseSwing(phase) {
    this.pivot.rotation.x = phase * 2.4;
    this.pivot.rotation.z = phase * 0.5;
    const parts = this.player.mesh?.userData?.parts;
    if (parts?.armL && parts?.armR) {          // optional: two characters have no arms
      parts.armL.rotation.x = phase * 1.6;
      parts.armR.rotation.x = phase * 1.6;
    }
  }

  update(dt, input) {
    if (!this.active) return null;

    // Follow-through: ease the club back to address over ~2/3s after a strike.
    // Runs every frame golf is active, unconditional on `state` — a strike flips
    // state to 'flying' immediately (see _strike), so this can't live inside the
    // 'address' branch below or it would never run while the ball is in the air.
    if (this.clubAngle > 0) {
      this.clubAngle = Math.max(0, this.clubAngle - dt * 1.5);
      this._poseSwing(this.clubAngle);
    }

    const h = this.hole();
    if (h) {
      const g = this.world.geoToScene(h.green[0], h.green[1], 0);
      this.hud.setGolf({
        club: clubAt(this.clubIdx).name,
        hole: h.n, par: h.par, strokes: this.strokes,
        toPin: Math.hypot(this.ball.position.x - g.x, this.ball.position.z - g.z),
      });
    }

    if (this.state === 'address') {
      // Ground height is never cached — tile LOD keeps moving the surface, and the
      // player can sit here indefinitely, so re-probe on a slow cadence rather than
      // trusting the height resolved when the ball was placed (see fielddecal.js).
      this._groundT += dt;
      if (this._groundT >= GROUND_PROBE_INTERVAL) {
        this._groundT = 0;
        this.ball.position.y = this._smoothGround(this.ball.position.x, this.ball.position.z) + BALL_R;
      }

      // Same treatment for the pin — it stands on streamed terrain too.
      this._pinT += dt;
      if (this._pinT >= GROUND_PROBE_INTERVAL && this.pin.visible) {
        this._pinT = 0;
        this.pin.position.y = this._smoothGround(this.pin.position.x, this.pin.position.z);
      }

      const m = this._armed ? input.golfPointer : null;   // aiming? the pointer belongs to look, not the swing
      if (m) {
        if (m.down && !this.swing) {
          this.swing = createSwing(window.innerHeight);
          this.swing.down(m.x, m.y, m.t);
          this.swing0Y = m.y;                      // pointer-down y: baseline for the live pose below
        } else if (this.swing && m.down) {
          this.swing.move(m.x, m.y, m.t);
          if (this.swing.result) {
            this._strike(this.swing.result);
          } else {
            // live backswing pose while dragging
            const back = -Math.min(1, Math.max(0, (m.y - this.swing0Y) / this.swing.backFull));
            this._poseSwing(back);
          }
        } else if (this.swing && !m.down) {
          // Aborted drag — released before the forward crossing that fires a
          // strike. Snap straight back to address rather than easing through
          // clubAngle: clubAngle's easing is signed for the *positive*
          // follow-through phase (0..1) driven off a completed strike, while an
          // aborted backswing pose is negative. Reusing it would mean teaching
          // that block to handle both signs and both triggers, for a case that
          // is, by definition, not a swing. A snap reads correctly here — same
          // as letting go of a loaded gesture with nothing behind it.
          this.swing.up(); this.swing = null;
          this._poseSwing(0);
        }
      }
      return null;
    }

    if (this.state === 'flying') {
      this.flightT += dt;
      const pts = this.flight.points;
      const i = Math.min(pts.length - 1, Math.floor(this.flightT * 120));
      const p = pts[i];
      this.ball.position.set(p.x, p.y + BALL_R, p.z);
      if (i >= pts.length - 1) this._settle();
      return 'flying';
    }
    return null;
  }

  _strike(sw) {
    this.lastLie = this.ball.position.clone();
    this.swing = null;
    this._armed = false;              // shot away — back to free-look aiming
    this.strokes++;
    const club = clubAt(this.clubIdx);
    const { vel, spin } = launchFrom(club, sw, this._shotHeading());
    // Fresh ground probe rather than the (possibly stale) mesh y — the ball may
    // have sat in `address` for a while and the surface can have moved under it.
    const o = { x: this.ball.position.x, y: this._smoothGround(this.ball.position.x, this.ball.position.z), z: this.ball.position.z };
    // seed the probe cache at the launch lie, so a probe that misses (unloaded
    // tile) falls back to the ground we just measured rather than 0 or last shot
    this._flightGround.seed(o.x, o.z, o.y);
    this.flight = simulate(o, vel, spin, (x, z, y) => this._flightGround(x, z, y));
    this.flightT = 0;
    this.state = 'flying';
    this.clubAngle = 1;   // kick off follow-through; eased back to 0 in update()

    const pos = new Float32Array(this.flight.points.length * 3);
    this.flight.points.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y + BALL_R; pos[i * 3 + 2] = p.z; });
    this.trail.geometry.dispose();
    this.trail.geometry = new THREE.BufferGeometry();
    this.trail.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.trail.visible = true;
  }

  _settle() {
    const h = this.hole();
    const g = this.world.geoToScene(h.green[0], h.green[1], 0);
    const rest = this.flight.rest;
    const toPin = Math.hypot(rest.x - g.x, rest.z - g.z);
    this.state = 'address';

    // border.clamp returns true when it had to pull the position back — that is
    // our out-of-bounds signal, including anything hit toward Redstone Arsenal.
    const probe = new THREE.Vector3(rest.x, 200, rest.z);
    if (this.border?.clamp(probe)) {
      this.strokes++;                       // one-stroke penalty
      this.hud.toast('OUT OF BOUNDS — +1 STROKE', 3000);
      this.ball.position.copy(this.lastLie);
      this.trail.visible = false;           // the OB arc must not hang in the air
      this._standAtBall();
      return;
    }

    if (toPin <= h.r) {
      const delta = this.strokes - h.par;
      const word = delta <= -2 ? 'EAGLE' : delta === -1 ? 'BIRDIE' : delta === 0 ? 'PAR'
                 : delta === 1 ? 'BOGEY' : `+${delta}`;
      this.hud.toast(`HOLE ${h.n} — ${word}\n${this.strokes} STROKES · PAR ${h.par}`, 4200);
      this.holeIdx++;
      this.total += this.strokes;
      this.strokes = 0;
      if (this.holeIdx >= this.course.holes.length) {
        const total = this.total ?? this.strokes;
        this.hud.toast(`ROUND COMPLETE — ${total} STROKES`, 4200);
        submitScore('golf-round', playerTag(), total, false).catch(() => {});
        this.exit();
        return;
      }
      this._placeAtTee();
      return;
    }
    this._standAtBall();                    // walk up to the new lie, re-aim at the green
    const yd = (m) => Math.round(m / 0.9144);   // scene units are metres; golf is played in yards
    this.hud.toast(`${yd(this.flight.carry)} YD CARRY\n${yd(toPin)} YD TO PIN`, 3000);
  }
}
