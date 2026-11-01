import * as THREE from 'three';
import { activeCity } from './cities/index.js';

/**
 * Playable-area border: a circle (or union of circles) around the active city's
 * playable area, plus any restricted-airspace no-fly zones. Player and cars are
 * pushed back at the wall; a translucent wall fades in as you approach.
 *
 * Lobe/no-fly data lives on the city module (city.border), not here — a player
 * spawning in a different city needs a border around THAT city, not Huntsville's.
 */
export class Border {
  constructor(scene, world, hud) {
    this.hud = hud;
    const { lobes: LOBES, nofly: NOFLY } = activeCity().border;
    this.lobes = LOBES.map((l) => { const c = world.geoToScene(l.lat, l.lon, 0); return { cx: c.x, cz: c.z, r: l.r }; });
    this.wallMat = new THREE.MeshBasicMaterial({
      color: 0x39ff88, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false,
    });
    for (const l of this.lobes) {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(l.r, l.r, 4000, 96, 1, true), this.wallMat);
      wall.position.set(l.cx, 0, l.cz);
      wall.raycast = () => {};
      scene.add(wall);
    }
    // Restricted zones get their own visible perimeter: a faint standing wall at
    // all times so you can see the edge coming, brightening as you close on it.
    // Amber = the game's caution colour, distinct from the green city-limits wall.
    this.nofly = NOFLY.map((z) => {
      const c = world.geoToScene(z.lat, z.lon, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffb347, transparent: true, opacity: 0.05,
        side: THREE.DoubleSide, depthWrite: false, fog: false,
      });
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, 4000, 128, 1, true), mat);
      wall.position.set(c.x, 0, c.z);
      wall.renderOrder = 2;
      wall.raycast = () => {};
      scene.add(wall);
      return { cx: c.x, cz: c.z, r: z.r, name: z.name, mat };
    });
    this._lastToast = -1e9;
  }

  /** Clamp a position (Vector3, mutated) inside the union of lobes. Returns true if clamped. */
  clamp(pos, velocity = null) {
    // NaN guard: a bad position would otherwise cascade through the whole frame
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
      const c = this.lobes[0]; pos.x = c ? c.cx : 0; pos.z = c ? c.cz : 0; if (!Number.isFinite(pos.y)) pos.y = 200;
      if (velocity) velocity.set(0, 0, 0);
      return true;
    }
    let best = null, bestOver = Infinity, minEdge = Infinity;
    for (const l of this.lobes) {
      const d = Math.hypot(pos.x - l.cx, pos.z - l.cz);
      const over = d - l.r;
      minEdge = Math.min(minEdge, over);        // negative when inside this lobe
      if (over < bestOver) { bestOver = over; best = l; }
    }
    // wall fades in only near the ACTUAL boundary of the union
    const t = Math.max(0, 1 + minEdge / 800);
    this.wallMat.opacity = Math.min(0.18, t * 0.18);
    // no-fly exclusions: if inside one, push to its edge (whichever is nearest)
    for (const z of this.nofly) {
      let dx = pos.x - z.cx, dz = pos.z - z.cz, d = Math.hypot(dx, dz);
      // brighten from either side of the boundary, so it reads on approach and
      // while you're being turned back
      const near = Math.max(0, 1 - Math.abs(d - z.r) / 1500);
      z.mat.opacity = 0.05 + near * 0.24;
      if (d < 1) { dx = 1; dz = 0; d = 1; } // exactly-centered: pick a direction
      if (d < z.r) {
        const k = z.r / d; pos.x = z.cx + dx * k; pos.z = z.cz + dz * k;
        if (velocity) { const nx = dx / d, nz = dz / d; const into = -(velocity.x * nx + velocity.z * nz); if (into > 0) { velocity.x += into * nx; velocity.z += into * nz; } }
        const now = performance.now();
        if (now - this._lastToast > 4000) { this._lastToast = now; this.hud.toast(`RESTRICTED AIRSPACE — ${z.name}`, 2400); }
        return true;
      }
    }
    if (minEdge <= 0) return false;             // inside at least one lobe
    const dx = pos.x - best.cx, dz = pos.z - best.cz;
    const d = Math.hypot(dx, dz) || 1;
    const k = best.r / d;
    pos.x = best.cx + dx * k;
    pos.z = best.cz + dz * k;
    if (velocity) {
      const nx = dx / d, nz = dz / d;
      const out = velocity.x * nx + velocity.z * nz;
      if (out > 0) { velocity.x -= out * nx; velocity.z -= out * nz; }
    }
    const now = performance.now();
    if (now - this._lastToast > 4000) { this._lastToast = now; this.hud.toast('CITY LIMITS — THE ROCKET CITY ENDS HERE', 2200); }
    return true;
  }
}
