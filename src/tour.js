import * as THREE from 'three';
import { activeCity } from './cities/index.js';

/**
 * Guided "Glided Tour" — a hands-free autopilot that flies the rocket through a
 * set of points while the player just watches. Any movement input exits it.
 * Reuses normal flight (ceiling, ground-avoid), so it's safe. Loops until stopped.
 */
// Distance-based warp: near a stop we cruise low & slow for the view; on a long
// leg we climb and warp so far-flung stops (Toyota Field is ~15km) arrive in
// seconds, not minutes.
const CRUISE = 46, WARP = 720;          // m/s
const ALT = 130, ALT_FAR = 500;         // m above ground
const NEAR = 550;                       // within this, decelerate to CRUISE for arrival
const WARP_RAMP = 3500;                 // distance at which we hit full WARP
const ARRIVE = 90, ORBIT_TIME = 7, ORBIT_R = 90, ORBIT_ALT = 95, LEG_TIMEOUT = 30;

export class Tour {
  constructor({ world, hud }) { this.world = world; this.hud = hud; this.active = false; this._tmp = new THREE.Vector3(); }

  /** points: [{ x, z, name }] in scene space. Defaults to the landmark presets. */
  start(player, points) {
    this.points = (points && points.length ? points : activeCity().presets.map((p) => { const s = this.world.geoToScene(p.lat, p.lon, 0); return { x: s.x, z: s.z, name: p.name }; }));
    if (!this.points.length) return false;
    this.i = 0; this.dwell = 0; this.legT = 0; this.orbitT = -1; this._orbitPhase = undefined; this.active = true; this.paused = false; if (this.rate === undefined) this.rate = 1;
    player.flying = true; player.gliding = false;
    this.hud.toast('GLIDED TOUR — sit back. Move to take over.', 3500);
    this.hud.setZone('TOUR · ' + this.points[0].name.toUpperCase());
    return true;
  }

  /** Take-over: pause but remember where we were so it can resume. */
  pause() { if (!this.active) return; this.active = false; this.paused = true; this._savedI = this.i; this.hud.toast('TOUR PAUSED — resume anytime', 1600); }
  stop() { this.active = false; this.paused = false; }
  resume(player) {
    if (!this.paused || !this.points) return false;
    this.active = true; this.paused = false; this.i = this._savedI || 0; this.dwell = 0; this.legT = 0; this.orbitT = -1; this._orbitPhase = undefined; this._prevYaw = undefined;
    player.flying = true; player.gliding = false;
    this.hud.toast('RESUMING TOUR', 1400); this.hud.setZone('TOUR · ' + this.points[this.i].name.toUpperCase());
    return true;
  }
  _orbit(dt, player, wp, gy) {
    // circle the stop for a cinematic flyover
    this.orbitT += dt * this.rate;
    const ang = this.orbitT * 0.6 + (this._orbitPhase || (this._orbitPhase = Math.atan2(player.position.z - wp.z, player.position.x - wp.x)));
    const tx = wp.x + Math.cos(ang) * ORBIT_R, tz = wp.z + Math.sin(ang) * ORBIT_R, ty = gy + ORBIT_ALT;
    player.flying = true;
    player.velocity.set((tx - player.position.x) * 2.2, (ty - player.position.y) * 1.5, (tz - player.position.z) * 2.2);
    player.position.addScaledVector(player.velocity, dt);
    // face the stop (look inward), banked
    const yaw = Math.atan2(-(wp.x - player.position.x), -(wp.z - player.position.z));
    player.yaw = yaw; player.pitch += (-0.25 - player.pitch) * Math.min(1, 3 * dt);
    player.speedMps = Math.hypot(player.velocity.x, player.velocity.z);
    player.mesh.position.copy(player.position);
    player.mesh.rotation.order = 'YXZ'; player.mesh.rotation.set(-0.4, yaw, 0.5);
    const parts = player.mesh.userData.parts; if (parts?.flame) parts.flame.visible = true;
  }

  get name() { return this.points ? this.points[this.i].name : ''; }
  cycleRate() { const r = [1, 1.75, 3, 0.5]; this.rate = r[(r.indexOf(this.rate) + 1) % r.length] || 1; return this.rate; }
  rateLabel() { return (this.rate === 0.5 ? '½' : this.rate === 1.75 ? '1.75' : this.rate === 3 ? '3' : '1') + '×'; }

  update(dt, player) {
    if (!this.active) return;
    this.legT += dt;
    const wp = this.points[this.i];
    const dx = wp.x - player.position.x, dz = wp.z - player.position.z;
    const d = Math.hypot(dx, dz);
    const nx = d > 0.1 ? dx / d : 0, nz = d > 0.1 ? dz / d : 0;

    // ground under the waypoint AND under the player (for clearance on the leg)
    const gyW = (this.world.groundBelow(this._tmp.set(wp.x, 400, wp.z), 2000, true) || {}).point?.y ?? (player._lastGroundY || 0);
    const gyP = (this.world.groundBelow(this._tmp.set(player.position.x, 400, player.position.z), 2000, true) || {}).point?.y ?? gyW;
    if (!Number.isFinite(player._lastGroundY)) player._lastGroundY = Number.isFinite(gyP) ? gyP : 0;

    // speed & altitude ramp with distance to the next stop
    const t = Math.max(0, Math.min(1, (d - NEAR) / (WARP_RAMP - NEAR)));
    const speed = (CRUISE + (WARP - CRUISE) * t * t) * this.rate;   // ease-in to warp, scaled by rate
    const cruiseAlt = ALT + (ALT_FAR - ALT) * t;
    const targetY = (d < NEAR ? gyW : Math.max(gyP, gyW)) + cruiseAlt;

    player.flying = true;
    const accel = d < NEAR ? 2.5 : 1.6;   // snappier when maneuvering near a stop
    player.velocity.x += (nx * speed - player.velocity.x) * Math.min(1, accel * dt);
    player.velocity.z += (nz * speed - player.velocity.z) * Math.min(1, accel * dt);
    player.velocity.y += ((targetY - player.position.y) * 0.8 - player.velocity.y) * Math.min(1, 2 * dt);
    player.position.addScaledVector(player.velocity, dt);
    this._warp = d > NEAR * 2;
    // face travel + gentle mesh lean
    const yaw = Math.atan2(-nx, -nz);
    let ddy = yaw - player.yaw; ddy = Math.atan2(Math.sin(ddy), Math.cos(ddy));
    player.yaw += ddy * Math.min(1, 2 * dt);
    player.pitch += (-0.1 - player.pitch) * Math.min(1, 2 * dt);
    player.speedMps = Math.hypot(player.velocity.x, player.velocity.z);
    player.mesh.position.copy(player.position);
    // point the rocket like it's flying: nose forward (more at warp) + bank into turns
    const warpT = Math.max(0, Math.min(1, (speed - CRUISE) / (WARP - CRUISE)));
    const leanX = -(0.5 + 0.45 * warpT);
    const dyaw = this._prevYaw === undefined ? 0 : Math.atan2(Math.sin(player.yaw - this._prevYaw), Math.cos(player.yaw - this._prevYaw));
    this._prevYaw = player.yaw;
    const bankZ = Math.max(-0.6, Math.min(0.6, -dyaw * 12));
    player.mesh.rotation.order = 'YXZ';
    player.mesh.rotation.y = player.yaw;
    player.mesh.rotation.x = THREE.MathUtils.lerp(player.mesh.rotation.x, leanX, Math.min(1, 4 * dt));
    player.mesh.rotation.z = THREE.MathUtils.lerp(player.mesh.rotation.z, bankZ, Math.min(1, 4 * dt));
    const parts = player.mesh.userData.parts; if (parts?.flame) parts.flame.visible = true;

    const arrived = d < ARRIVE && Math.abs(player.position.y - targetY) < 70;
    if (this.orbitT >= 0 || arrived) {
      if (this.orbitT < 0) { this.orbitT = 0; this._orbitPhase = undefined; }   // begin flyover circle
      this._orbit(dt, player, wp, gyW);
      if (this.orbitT > ORBIT_TIME / this.rate) this._advance();
      return;
    }
    if (this.legT > LEG_TIMEOUT) this._advance();
  }

  /** Move to the next stop, or END the tour after the last one (no infinite loop). */
  _advance() {
    this.orbitT = -1; this.legT = 0; this._orbitPhase = undefined;
    if (this.i + 1 >= this.points.length) {
      this.active = false; this.paused = false; this._savedI = 0;
      this.hud.setZone('TOUR COMPLETE');
      this.hud.toast('★ TOUR COMPLETE — you have the controls', 3500);
      return;
    }
    this.i++;
    this.hud.setZone('TOUR · ' + this.points[this.i].name.toUpperCase());
  }
}
