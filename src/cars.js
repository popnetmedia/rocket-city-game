import * as THREE from 'three';
import { buildCar } from './vehicle.js';

/**
 * World cars, GTA-style: parked cars you can jack, plus a few AI cars cruising loops.
 * Positions are scene metres relative to the courthouse origin; all snap to the ground mesh.
 */
const KINDS = {
  sedan:  { name: 'SEDAN',   color: 0xff3b1f, scale: [1, 1, 1],       maxSpeed: 38 },
  coupe:  { name: 'COUPE',   color: 0x1fa9ff, scale: [0.95, 0.85, 0.95], maxSpeed: 46 },
  truck:  { name: 'PICKUP',  color: 0x2e8b57, scale: [1.1, 1.15, 1.2],  maxSpeed: 32 },
  taxi:   { name: 'TAXI',    color: 0xffc400, scale: [1, 1, 1],       maxSpeed: 38 },
  police: { name: 'CRUISER', color: 0x1a1f3a, scale: [1, 1, 1.05],    maxSpeed: 50 },
  van:    { name: 'VAN',     color: 0xe8e8e8, scale: [1.05, 1.3, 1.1], maxSpeed: 30 },
};

const PARKED = [
  ['sedan', 12, 6, 0.3], ['taxi', -14, 4, -0.2], ['coupe', 24, -18, 1.4], ['truck', -30, -22, 0.9],
  ['van', 40, 26, 0], ['police', -52, 30, 2.0], ['sedan', 70, -45, -1.1], ['coupe', -85, -60, 0.4],
];
// AI loops: [kind, centerX, centerZ, radius, speed m/s, clockwise]
const TRAFFIC = [
  ['taxi', 0, 0, 55, 9, 1], ['sedan', 20, -30, 80, 11, -1], ['van', -40, 40, 100, 8, 1],
];

export class Car {
  /** `parent` is the fleet's container group, not the scene. */
  constructor(parent, kind, x, z, heading) {
    this.kind = KINDS[kind];
    this.name = this.kind.name;
    this.mesh = buildCar(this.kind.color);
    this.mesh.scale.set(...this.kind.scale);
    this.position = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.snapped = false;
    this.driver = null;   // 'player' while being driven
    this.ai = null;
    parent.add(this.mesh);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = heading;
  }
}

export class CarFleet {
  constructor(scene, world, osm = null) {
    this.scene = scene; this.world = world; this.osm = osm;
    // One container for the whole fleet. Cars are still built exactly as before —
    // Car only ever calls .add on what it is handed — but interiors need a single
    // handle to hide the traffic while the player is in a room built at a real
    // street address, or a sedan drives through the furniture.
    this.group = new THREE.Group();
    this.group.name = 'CarFleet';
    scene.add(this.group);
    this.cars = [];
    for (const [k, x, z, h] of PARKED) this.cars.push(new Car(this.group, k, x, z, h));
    for (const [k, cx, cz, r, v, dir] of TRAFFIC) {
      const c = new Car(this.group, k, cx + r, cz, 0);
      c.ai = { cx, cz, r, v, dir, a: 0 };
      this.cars.push(c);
    }
    this._tmp = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._n = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  /** Nearest enterable car within `radius` metres of `pos`, or null. */
  nearest(pos, radius = 3.5) {
    let best = null, bd = radius;
    for (const c of this.cars) {
      if (c.driver) continue;
      const d = Math.hypot(c.position.x - pos.x, c.position.z - pos.z);
      if (d < bd && Math.abs(c.position.y - pos.y) < 4) { bd = d; best = c; }
    }
    return best;
  }

  update(dt, playerPos) {
    this._frame = (this._frame || 0) + 1;
    for (const c of this.cars) {
      if (c.driver) continue;           // Vehicle controller owns it while driven
      if (c.ai) this._driveAI(c, dt, playerPos);
      // ground follow — raycasts are the expensive part, so skip far-away cars
      // (beyond ~250 m they're fog-dimmed dots; AI cars keep integrating, just don't re-snap).
      const distToPlayer = Math.hypot(c.position.x - playerPos.x, c.position.z - playerPos.z);
      // near: every frame · mid: every 3rd · far: every ~45th (BVH makes this cheap,
      // and it prevents a car from freezing at a stale coarse-tile height = 'flying car').
      const period = distToPlayer > 250 ? 45 : distToPlayer > 80 ? 3 : 1;
      if (c.snapped && (this._frame + c.mesh.id) % period !== 0) {
        c.mesh.position.copy(c.position);
        if (c.ai) c.mesh.rotation.y = c.heading;
        continue;
      }
      this._tmp.copy(c.position); this._tmp.y += 300;
      const hit = this.world.groundBelow(this._tmp, 2000, true); // terrain only — not building roofs
      if (hit) {
        c.position.y = hit.point.y; c.snapped = true;
        if (hit.face) { this._n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); if (this._n.y < 0.5) this._n.set(0, 1, 0); }
        else this._n.set(0, 1, 0);
      } else this._n.set(0, 1, 0);
      c.mesh.position.copy(c.position);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(this._up, c.heading);
      const tiltQ = new THREE.Quaternion().setFromUnitVectors(this._up, this._n);
      c.mesh.quaternion.slerp(this._q.multiplyQuaternions(tiltQ, yawQ), Math.min(1, 8 * dt));
      if (c.ai) { const spin = (c.ai.cur ?? 0) * dt / 0.36; for (const w of c.mesh.userData.wheels) { w.mesh.rotation.x += spin; w.hub.rotation.x += spin; } }
    }
  }

  /** Drive an AI car along OSM road polylines; fall back to its loop if no roads loaded. */
  _driveAI(c, dt, playerPos) {
    const lines = this.osm && this.osm.roadLines;
    // (re)assign a road when we don't have one or ours was unloaded
    if (lines && lines.length && (!c.ai.line || !lines.includes(c.ai.line))) this._assignRoad(c, lines);
    if (!c.ai.line) { // no roads yet -> gentle loop so they're not frozen
      c.ai.cur = THREE.MathUtils.lerp(c.ai.cur ?? 0, c.ai.v, Math.min(1, 1.5 * dt));
      c.ai.a = (c.ai.a || 0) + (c.ai.cur / c.ai.r) * c.ai.dir * dt;
      c.position.x = c.ai.cx + Math.cos(c.ai.a) * c.ai.r;
      c.position.z = c.ai.cz + Math.sin(c.ai.a) * c.ai.r;
      c.heading = Math.atan2(Math.sin(c.ai.a) * c.ai.dir, -Math.cos(c.ai.a) * c.ai.dir);
      return;
    }
    const line = c.ai.line, dir = c.ai.seg; // dir: +1 forward along the line, -1 back
    // slow near the player so you can jack it
    const blocked = c.position.distanceTo(playerPos) < 4;
    c.ai.cur = THREE.MathUtils.lerp(c.ai.cur ?? 0, blocked ? 0 : c.ai.v, Math.min(1, (blocked ? 6 : 2) * dt));
    let remaining = c.ai.cur * dt;
    while (remaining > 0.001) {
      const nextIdx = c.ai.i + dir;
      if (nextIdx < 0 || nextIdx >= line.length) { this._atRoadEnd(c, lines); return; }
      const cur = line[c.ai.i], nxt = line[nextIdx];
      const segLen = Math.hypot(nxt[0] - cur[0], nxt[1] - cur[1]) || 0.001;
      const step = Math.min(remaining, segLen * (1 - c.ai.t));
      c.ai.t += step / segLen; remaining -= step;
      const hx = nxt[0] - cur[0], hz = nxt[1] - cur[1];
      c.heading = Math.atan2(-hx, -hz);
      c.position.x = cur[0] + hx * c.ai.t;
      c.position.z = cur[1] + hz * c.ai.t;
      if (c.ai.t >= 1) { c.ai.t = 0; c.ai.i = nextIdx; }
    }
  }

  _assignRoad(c, lines) {
    // nearest road line + nearest vertex to the car's current position
    let best = null, bestD = Infinity, bestI = 0;
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const d = Math.hypot(line[i][0] - c.position.x, line[i][1] - c.position.z);
        if (d < bestD) { bestD = d; best = line; bestI = i; }
      }
    }
    if (!best) return;
    c.ai.line = best; c.ai.i = Math.min(bestI, best.length - 2); c.ai.t = 0;
    c.ai.seg = c.ai.i < best.length - 1 ? 1 : -1;
  }

  _atRoadEnd(c, lines) {
    // hop to a connecting road whose endpoint is near, else U-turn on this one
    const end = c.position;
    let pick = null, pickI = 0, pickDir = 1, bestD = 25;
    for (const line of lines) {
      if (line === c.ai.line) continue;
      for (const endIdx of [0, line.length - 1]) {
        const d = Math.hypot(line[endIdx][0] - end.x, line[endIdx][1] - end.z);
        if (d < bestD) { bestD = d; pick = line; pickI = endIdx; pickDir = endIdx === 0 ? 1 : -1; }
      }
    }
    if (pick) { c.ai.line = pick; c.ai.i = pickI === 0 ? 0 : pick.length - 1; c.ai.t = 0; c.ai.seg = pickDir; }
    else { c.ai.seg = -c.ai.seg; } // dead end -> reverse
  }

  /** Minimap markers */
  markers() { return this.cars.filter((c) => !c.driver).map((c) => ({ x: c.position.x, z: c.position.z, kind: 'car', ai: !!c.ai })); }
}
