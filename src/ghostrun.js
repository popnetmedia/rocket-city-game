import * as THREE from 'three';
import { activeCity } from './cities/index.js';
import { analytics } from './analytics.js';

/**
 * GHOST RUN — a stealth challenge over the real Flock camera map.
 * Start downtown, reach the target on the GROUND (walk or drive — flying disqualifies)
 * without entering any camera's view cone. Detections are counted; a clean run = GHOST badge.
 */
const DETECT_RADIUS = 45;      // m a camera can "see"
const CONE_HALF = Math.PI * 0.28; // ±~50° field of view
/**
 * The stealth route belongs to the active city (city.ghost = { start, target }). A city
 * without one has no Ghost Run — hasGhostRun() gates the mode in the menu.
 */
export function hasGhostRun() { const g = activeCity().ghost; return !!(g && g.start && g.target); }
const ghostRoute = () => activeCity().ghost || { start: [0, 0], target: [0, 0] };
const TARGET_R = 25;

export class GhostRun {
  constructor({ scene, world, hud, audio, alpr }) {
    this.scene = scene; this.world = world; this.hud = hud; this.audio = audio; this.alpr = alpr;
    this.active = false;
    this.detections = 0;
    this._spotted = false;
    this._tmp = new THREE.Vector3();
    const t = ghostRoute().target;
    const p = world.geoToScene(t[0], t[1], 0);
    this.target = new THREE.Vector3(p.x, 0, p.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(TARGET_R, 1, 8, 40), new THREE.MeshBasicMaterial({ color: 0x39ff88 }));
    ring.rotation.x = Math.PI / 2; ring.position.copy(this.target).setY(15); ring.visible = false; ring.raycast = () => {};
    this.ring = ring; scene.add(ring);
    this.startLL = ghostRoute().start;
  }

  start(teleport) {
    this.active = true; this.detections = 0; this._spotted = false;
    this.ring.visible = true;
    const st = ghostRoute().start;
    teleport(st[0], st[1], 'ghost-run:start', { alt: 0 }); // ground start
    this.hud.toast('GHOST RUN — reach the green ring unseen. STAY OFF FLIGHT.', 4500);
    this.audio?.blip(700);
    analytics.track('ghostrun_start');
  }

  stop(reason) {
    this.active = false; this.ring.visible = false;
    if (reason) this.hud.toast(reason, 3000);
  }

  update(dt, player, mode, now = performance.now()) {
    if (!this.active) return;
    this.ring.rotation.z += dt * 0.6;
    this.ring.position.y = (this.world.groundBelow(this._tmp.set(this.target.x, 400, this.target.z), 900, true)?.point.y ?? 0) + 15;

    // flying disqualifies (the whole point is ground stealth)
    if (player.flying) { this.stop('GHOST RUN VOIDED — no flying'); return; }

    // detection: any nearby camera whose view cone contains the player
    let seen = false;
    for (const c of this.alpr.cams) {
      const dx = player.position.x - c.x, dz = player.position.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d > DETECT_RADIUS || d < 1) continue;
      // camera looks along its mapped direction (-sin,-cos); check angle to player
      const fx = -Math.sin(c.dir), fz = -Math.cos(c.dir);
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx / d) * fx + (dz / d) * fz)));
      if (ang < CONE_HALF) { seen = true; break; }
    }
    if (seen && !this._spotted) {
      this._spotted = true; this.detections++;
      this.hud.toast(`SPOTTED! (${this.detections})`, 1400);
      this.audio?.blip(200);
      analytics.track('ghostrun_spotted');
    } else if (!seen) this._spotted = false;

    // reached target?
    if (Math.hypot(player.position.x - this.target.x, player.position.z - this.target.z) < TARGET_R) {
      const clean = this.detections === 0;
      this.hud.toast(clean ? 'GHOST RUN COMPLETE — UNDETECTED! 👻 GHOST BADGE' : `MADE IT — but spotted ${this.detections}×. Try for a clean run!`, 6000);
      this.audio?.fanfare();
      analytics.track('ghostrun_finish', { value: this.detections });
      this.stop();
    }
  }
}
