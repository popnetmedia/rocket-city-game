import * as THREE from 'three';
import { WALK_SPEED, SPRINT_SPEED, JUMP_VELOCITY, GRAVITY, PLAYER_HEIGHT, DEFAULT_FLY_CEILING } from './constants.js';
import { CHARACTERS, CHARACTER_KEYS } from './characters.js';
import { activeCity, cityKey } from './cities/index.js';
export { CHARACTERS, CHARACTER_KEYS };

// Glider arcade model (m/s, m/s^2, rad/s)
const GLIDE_MIN = 6, GLIDE_CRUISE = 12, GLIDE_MAX = 32;
const GLIDE_DIVE_ACCEL = 10, GLIDE_PULL_DECEL = 9;
const GLIDE_SINK = 1.6, GLIDE_TURN_RATE = 1.4;

// Flight (F): rocket-powered free flight, fly where you look
const FLY_SPEED = 30, FLY_BOOST = 150, FLY_CLIMB = 14, FLY_ACCEL = 4;
const FLY_LUDICROUS = 420;      // double-tap SHIFT while boosting: plaid
const LUDICROUS_TAP_MS = 350;   // window for the second SHIFT tap
/**
 * Metres above ground this city allows. Read per call rather than captured at module
 * load, exactly as sky.js reads its origin and station, so switching city switches the
 * ceiling instead of keeping whichever one booted first.
 */
const flyCeiling = () => activeCity().flyCeiling ?? DEFAULT_FLY_CEILING;

export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    // Each city has its own signature avatar, and the player's own pick is remembered
    // per city — otherwise choosing one in Huntsville would silently override the other
    // city's default the next time they flew there.
    const cityDefault = activeCity().meta.character;
    this.characterKey = CHARACTERS[cityDefault] ? cityDefault : 'saturn';
    try { const c = localStorage.getItem(cityKey('rocketcity.character')); if (CHARACTERS[c]) this.characterKey = c; } catch { /* default */ }
    this.mesh = CHARACTERS[this.characterKey].build();
    scene.add(this.mesh);

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;      // facing direction (radians, around Y)
    this.pitch = 0;    // camera pitch
    this.grounded = false;
    this.frozen = true; // until first ground hit after (re)spawn
    this.gliding = false;
    this.glideSpeed = 0;
    this.flying = false;
    this.flightUnlocked = false;
    this.canFly = () => this.flightUnlocked;
    this.speedMps = 0;
    this._walkCycle = 0;
    this._tmp = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
  }

  /**
   * Place the player above a point; it settles when ground loads.
   * hoverAGL > 0 (and flight unlocked) starts the rocket airborne, engines lit.
   */
  spawnAt(scenePos, { hoverAGL = 0, yaw } = {}) {
    this.position.copy(scenePos);
    this.position.y += 300; // will snap down on first ground hit
    this.velocity.set(0, 0, 0);
    this.frozen = true;
    this.grounded = false;
    this.flying = false;
    this._spawnHover = hoverAGL;
    // window during which the buried check runs even with ground below (see _updateFlight)
    this._spawnGuardUntil = performance.now() + 20000;
    if (yaw !== undefined) { this.yaw = yaw; this.pitch = 0; }
    this.mesh.position.copy(this.position);
  }

  /**
   * Put the player exactly here, with no lift and no long ground probe.
   * spawnAt() lifts 300 m and then probes 3000 m down, which is right for a
   * teleport onto streamed terrain and wrong inside a four-metre room: it
   * punches through the ceiling and lands on the tiles outside.
   *
   * Caller precondition: the ground raycast must already resolve to a surface
   * beneath this point (e.g. World.pushCollision to the room's floor) before
   * calling this. placeAt asserts grounded = true rather than verifying it, so
   * if nothing is actually below, the lost-ground fallback in update() will
   * fire spawnAt() a few seconds later and reintroduce the 300 m lift this
   * method exists to avoid.
   */
  placeAt(scenePos, { yaw } = {}) {
    this.position.copy(scenePos);
    this.velocity.set(0, 0, 0);
    this.frozen = false;
    this.grounded = true;
    this.flying = false;
    this.stowGlider?.();
    this._spawnHover = 0;
    this._spawnGuardUntil = 0;
    if (yaw !== undefined) { this.yaw = yaw; this.pitch = 0; }
    this.mesh.position.copy(this.position);
  }

  setVisible(v) { this.mesh.visible = v; }

  /** Swap the playable character mesh in place. Returns its display name. */
  setCharacter(key) {
    if (!CHARACTERS[key]) return null;
    const old = this.mesh;
    this.characterKey = key;
    this.mesh = CHARACTERS[key].build();
    this.mesh.position.copy(old.position);
    this.mesh.rotation.copy(old.rotation);
    this.mesh.visible = old.visible;
    this.mesh.userData.parts.wing.visible = this.gliding;
    this.scene.add(this.mesh);
    this.scene.remove(old);
    old.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    try { localStorage.setItem(cityKey('rocketcity.character'), key); } catch { /* ignore */ }
    return CHARACTERS[key].name;
  }

  nextCharacter() {
    const i = CHARACTER_KEYS.indexOf(this.characterKey);
    return this.setCharacter(CHARACTER_KEYS[(i + 1) % CHARACTER_KEYS.length]);
  }

  /** Deploy the glider. Only valid while airborne. Returns true if deployed. */
  deployGlider() {
    if (this.grounded || this.frozen || this.gliding) return false;
    this.gliding = true;
    this._glideT = 0;
    // carry current horizontal momentum, minimum airspeed so it flies immediately
    this.glideSpeed = Math.max(GLIDE_MIN, Math.hypot(this.velocity.x, this.velocity.z));
    this.mesh.userData.parts.wing.visible = true;
    return true;
  }

  /** Toggle powered flight. Works from the ground or mid-air; stows the glider. */
  toggleFlight() {
    if (this.frozen) return false;
    if (this.flying) { this.flying = false; return false; }
    if (!this.canFly()) return null; // locked
    this.stowGlider();
    this.flying = true;
    this.grounded = false;
    if (this.velocity.y < 3) this.velocity.y = 6; // little lift-off kick
    this.position.y += 0.05;
    return true;
  }

  _updateFlight(dt, input, hit) {
    // Buried recovery: terrain LOD can refine to ABOVE a hovering rocket (the spawn
    // height was measured against a coarse blob). If there's no surface below us, look
    // for one above and pop on top of it — otherwise the camera ends up inside the mesh
    // and the tile traversal starves.
    //
    // Being buried usually does NOT mean nothing is below you, though — there is still
    // coarser ground further down — so the !hit test alone missed the common case, which
    // is how Orlando came up underground. For a short window after spawning, while LOD is
    // actively refining, check regardless of what is below. Only for that window: run
    // always and flying low past a tall building would probe its roof and yank the player
    // on top of it.
    this._buriedT = (this._buriedT || 0) + dt;
    if (this._spawnGuardUntil && performance.now() < this._spawnGuardUntil && this._buriedT > 0.35) {
      this._buriedT = 0;
      this._tmp2 = this._tmp2 || this._tmp.clone();
      this._tmp2.copy(this.position); this._tmp2.y += 240;
      const rec = this.world.groundBelow(this._tmp2, 260);
      if (rec && rec.point.y > this.position.y - 2) {
        this.position.y = rec.point.y + Math.max(10, this._spawnHoverKeep || 0);
        this.velocity.y = 0;
        hit = rec;
      }
    }
    if (!hit) {
      this._tmp2 = this._tmp2 || this._tmp.clone();
      this._tmp2.copy(this.position); this._tmp2.y += 200;
      const rec = this.world.groundBelow(this._tmp2, 220);
      if (rec && rec.point.y > this.position.y - 2) {
        this.position.y = rec.point.y + Math.max(10, this._spawnHoverKeep || 0);
        this.velocity.y = 0;
        hit = rec;
      }
    }
    if (hit) this._lastGroundY = hit.point.y;
    const stick = input.moveAxis();
    const boost = input.down('ShiftLeft') || input.down('ShiftRight');
    const up = input.down('Space');
    // LUDICROUS SPEED: double-tap SHIFT. Stays engaged while SHIFT is held.
    if (input.justPressed('ShiftLeft') || input.justPressed('ShiftRight')) {
      const now = performance.now();
      if (now - (this._lastShiftTap || 0) < LUDICROUS_TAP_MS) { this.ludicrous = true; this.onLudicrous?.(); }
      this._lastShiftTap = now;
    }
    if (!boost) this.ludicrous = false;      // releasing SHIFT drops out of plaid
    const speed = boost ? (this.ludicrous ? FLY_LUDICROUS : FLY_BOOST) : FLY_SPEED;
    // fly where the camera looks: forward includes pitch
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = -Math.sin(this.yaw) * cp, fy = sp, fz = -Math.cos(this.yaw) * cp;
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const tx = (fx * stick.y + rx * stick.x) * speed;
    const ty = fy * stick.y * speed + (up ? FLY_CLIMB : 0);
    const tz = (fz * stick.y + rz * stick.x) * speed;
    const k = Math.min(1, FLY_ACCEL * dt);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.y += (ty - this.velocity.y) * k;
    this.velocity.z += (tz - this.velocity.z) * k;
    this.position.addScaledVector(this.velocity, dt);

    // ceiling: keep flight below FLY_CEILING above the last known ground
    if (hit) this._lastGroundY = hit.point.y;
    const ceil = (this._lastGroundY ?? 0) + flyCeiling();
    if (this.position.y > ceil) { this.position.y = ceil; if (this.velocity.y > 0) this.velocity.y = 0; }

    // don't fly through the ground; touching down while descending lands you
    if (hit && this.position.y <= hit.point.y + 0.02) {
      this.position.y = hit.point.y;
      if (this.velocity.y <= 0 && !up && stick.y <= 0.01) {
        this.flying = false; this.grounded = true; this.velocity.set(0, 0, 0);
      } else { this.velocity.y = Math.max(this.velocity.y, 0); }
    }

    // visuals: lean into travel, flame on
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    this.speedMps = Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.yaw;
    const fwdDot = (this.velocity.x * -Math.sin(this.yaw) + this.velocity.z * -Math.cos(this.yaw));
    const sideDot = (this.velocity.x * Math.cos(this.yaw) + this.velocity.z * -Math.sin(this.yaw));
    // lean NOSE-first into travel (negative x-rotation pitches the nose toward -Z / forward)
    // Lean nose-first into travel — scaled to cruise speed so even slow flight tilts
    // clearly forward (not a straight-up rocket). Bank on strafing.
    // A model built nose-forward is already pointing where it is going; leaning it the
    // full amount buries the nose, and worse under boost. Keep a hint of pitch for feel.
    const noseFwd = this.mesh.userData.noseForward === true;
    const leanX = -THREE.MathUtils.clamp(fwdDot / FLY_SPEED, -1.4, 1.4) * (noseFwd ? 0.08 : 0.75);
    const leanZ = THREE.MathUtils.clamp(-sideDot / FLY_SPEED, -1, 1) * 0.6;
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, leanX, Math.min(1, 5 * dt));
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, leanZ, Math.min(1, 5 * dt));
    const p = this.mesh.userData.parts;
    p.flame.visible = true;
    this._walkCycle += dt * 8;
    const power = 0.6 + Math.min(1, this.speedMps / FLY_BOOST) * 0.9 + (up ? 0.3 : 0);
    p.f1.scale.set(power, power * (0.9 + Math.random() * 0.3), power);
    p.f2.scale.set(1, power * (0.8 + Math.random() * 0.4), 1);
    void hs;
  }

  stowGlider() {
    if (!this.gliding) return;
    this.gliding = false;
    this.mesh.userData.parts.wing.visible = false;
    this.mesh.rotation.x = 0;
  }

  _updateGlider(dt, input, hit) {
    this._glideT += dt;
    const stick = input.moveAxis();
    const pitchIn = stick.y;   // +1 nose down (speed), -1 pull back (height)
    const bank = stick.x;      // gentle turning

    // Airspeed: nose-down accelerates, pull-back bleeds it, otherwise decays to cruise.
    let v = this.glideSpeed;
    if (pitchIn > 0) v += GLIDE_DIVE_ACCEL * pitchIn * dt;
    else if (pitchIn < 0) v -= GLIDE_PULL_DECEL * -pitchIn * dt; // pulling back bleeds airspeed
    v += (GLIDE_CRUISE - v) * Math.min(1, 0.6 * dt);
    v = THREE.MathUtils.clamp(v, GLIDE_MIN, GLIDE_MAX);
    this.glideSpeed = v;

    // Vertical: constant gentle sink; diving sinks faster; pulling back converts speed into climb
    // (only while there is speed to spare, so it stalls out rather than climbing forever).
    let vy = -GLIDE_SINK;
    if (pitchIn > 0) vy -= pitchIn * 6 * (v / GLIDE_MAX);
    if (pitchIn < 0) vy += -pitchIn * Math.max(0, v - GLIDE_MIN) * 0.45;

    this.yaw -= bank * GLIDE_TURN_RATE * dt;
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.velocity.x = this._fwd.x * v;
    this.velocity.z = this._fwd.z * v;
    this.velocity.y = vy;
    this.position.addScaledVector(this.velocity, dt);

    // visual pitch/bank
    this.mesh.rotation.order = 'YXZ';
    // Same as fly: no upright-to-forward bias for a model already built nose-forward,
    // and no constant droop — it would sit nose-down even in level glide.
    const glideTarget = this.mesh.userData.noseForward === true ? pitchIn * 0.16 : pitchIn * 0.45 - 0.15;
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, glideTarget, Math.min(1, 6 * dt));
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, -bank * 0.5, Math.min(1, 6 * dt));

    // Landing: ground within capsule height -> stow and hand back to walking.
    // (short grace after deploy so a jump-then-H at ground level actually lifts off)
    if (hit && this._glideT > 0.5 && this.position.y - hit.point.y <= 0.6) {
      this.position.y = hit.point.y;
      this.grounded = true;
      this.velocity.y = 0;
      this.velocity.multiplyScalar(0.4);
      this.stowGlider();
    }
    this.speedMps = Math.hypot(this.velocity.x, this.velocity.z);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
    const parts = this.mesh.userData.parts;
    parts.flame.visible = this.gliding && pitchIn > 0; // boost flame when diving
  }

  /**
   * Ground height beneath the player, for anything that needs to sit on the
   * surface rather than on the player (contact shadows).
   *
   * Standing, position.y IS the ground -- the walk path assigns it straight from
   * the probe. Airborne it is not, so fall back to the last probe that hit.
   * Null until the very first probe lands, which callers must treat as "unknown"
   * rather than as zero: scene origin is hundreds of metres off in most cities.
   */
  get groundY() {
    if (this.grounded) return this.position.y;
    return this._lastGroundY ?? null;
  }

  update(dt, input, opts = {}) {
    const { allowMove = true } = opts;

    // ---- ground probe ----
    // Ray from a bit above the head, far enough to catch long falls. If frozen (freshly spawned) probe a long way.
    const probeFrom = this._tmp.copy(this.position);
    probeFrom.y += this.frozen ? 1000 : 3;
    let hit = this.world.groundBelow(probeFrom, this.frozen ? 3000 : 400);

    if (this.frozen) {
      // Reject an absurd first hit. The spawn ray starts 1000m above a position already
      // lifted 300m, and runs 3000m down, so before the local tiles arrive it can catch a
      // distant low-LOD blob far beneath the real ground: spawning at Magic Kingdom put the
      // player at ALT -853m, under the terrain looking at its underside.
      //
      // Tested against an ABSOLUTE height, not a distance from the probe: a legitimate hit
      // is already ~1270m below the probe origin, so a relative threshold near that rejects
      // every valid spawn and leaves the player frozen for good. No city's ground sits 400m
      // below its own ENU origin plane — Orlando's is about +25m, Huntsville's about +190m.
      if (hit && hit.point.y < -400) hit = null;
      if (hit) {
        this.frozen = false;
        this.velocity.set(0, 0, 0);
        this._lostGround = 0;
        this._lastGroundY = hit.point.y;
        if (this._spawnHover > 0 && this.canFly()) {
          // scenic arrival: hover above the ground, engines lit
          this._spawnHoverKeep = this._spawnHover;
          this.position.y = hit.point.y + this._spawnHover;
          this.flying = true;
          this.grounded = false;
        } else {
          this.position.y = hit.point.y;
          this.grounded = true;
        }
        this._spawnHover = 0;
      }
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.yaw;
      return;
    }

    // Surface recovery: tile LOD swaps can move the ground above the player's feet (we end up underneath the
    // mesh and the short ray sees nothing). Look much higher and, if there is a surface above us, pop back onto it.
    if (!hit && !this.flying && !this.gliding) {
      probeFrom.copy(this.position); probeFrom.y += 80;
      const rec = this.world.groundBelow(probeFrom, 85);
      if (rec && rec.point.y >= this.position.y - 0.05) {
        this.position.y = rec.point.y;
        this.velocity.y = 0; this.grounded = true;
        hit = rec;
      }
    }
    // Still nothing under us for a while (void / unloaded tiles): respawn on the surface at this lat/lon.
    if (!hit && !this.flying) {
      this._lostGround = (this._lostGround || 0) + dt;
      if (this._lostGround > 3) { this.spawnAt(this.position.clone().setY(0)); this._lostGround = 0; return; }
    } else this._lostGround = 0;

    if (this.flying) { this._updateFlight(dt, input, hit); return; }
    if (this.gliding) { this._updateGlider(dt, input, hit); return; }
    this.mesh.rotation.x = 0; this.mesh.rotation.z = 0;

    // ---- input ----
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let mx = 0, mz = 0;
    if (allowMove) { const a = input.moveAxis(); mx = a.x; mz = a.y; }
    const len = Math.max(1, Math.hypot(mx, mz));
    const vx = (this._fwd.x * mz + this._right.x * mx) / len * speed;
    const vz = (this._fwd.z * mz + this._right.z * mx) / len * speed;

    // smooth horizontal accel
    const accel = this.grounded ? 14 : 4;
    this.velocity.x += (vx - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (vz - this.velocity.z) * Math.min(1, accel * dt);

    if (allowMove && this.grounded && input.justPressed('Space')) {
      this.velocity.y = JUMP_VELOCITY;
      this.grounded = false;
    }

    // ---- gravity + integrate ----
    this.velocity.y -= GRAVITY * dt;
    this.velocity.y = Math.max(this.velocity.y, -40);
    this.position.addScaledVector(this.velocity, dt);

    // ---- collision with ground ----
    if (hit) {
      const groundY = hit.point.y;
      const stepUp = 0.6; // max step height we snap up
      if (this.position.y <= groundY + 0.02 || (this.grounded && this.position.y < groundY + stepUp && this.velocity.y <= 0)) {
        this.position.y = groundY;
        if (this.velocity.y < 0) this.velocity.y = 0;
        this.grounded = true;
      } else if (this.position.y > groundY + 0.05) {
        this.grounded = false;
      }
      // Ground above us: small rise (tile LOD pop) -> snap up; big rise (a wall) -> block the move.
      if (groundY - this.position.y > stepUp) {
        if (groundY - this.position.y <= 3 && this.grounded) {
          this.position.y = groundY; this.velocity.y = 0;
        } else {
          this.position.x -= this.velocity.x * dt;
          this.position.z -= this.velocity.z * dt;
          this.velocity.x = 0; this.velocity.z = 0;
        }
      }
    } else {
      // No mesh below (unloaded tile or void). Don't fall forever: hover in place.
      if (this.position.y < -500) this.frozen = true;
      this.velocity.y = Math.max(this.velocity.y, -2);
      this.grounded = false;
    }

    // ---- visuals ----
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speedMps = hSpeed;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
    const p = this.mesh.userData.parts;
    this._walkCycle += dt * (this.grounded ? hSpeed * 2.4 : 6);
    this.mesh.rotation.order = 'YXZ';
    if (hSpeed > 0.2 && this.grounded) {
      // hop-bob and a little forward lean
      this.mesh.position.y += Math.abs(Math.sin(this._walkCycle)) * 0.12;
      const walkLean = (this.mesh.userData.noseForward === true ? 0.05 : 0.18) * Math.min(1, hSpeed / SPRINT_SPEED);
      this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, walkLean, Math.min(1, 8 * dt));
      this.mesh.rotation.z = Math.sin(this._walkCycle) * 0.06;
    } else {
      this.mesh.rotation.x *= 0.85; this.mesh.rotation.z *= 0.85;
    }
    const airborne = !this.grounded;
    p.flame.visible = airborne;
    if (airborne) {
      const flick = 0.8 + Math.sin(this._walkCycle * 7) * 0.2;
      p.f1.scale.set(flick, 0.9 + Math.random() * 0.3, flick);
      p.f2.scale.set(1, 0.8 + Math.random() * 0.4, 1);
    }
  }
}
