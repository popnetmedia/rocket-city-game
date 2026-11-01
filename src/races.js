import * as THREE from 'three';
import { activeCity, cityKey } from './cities/index.js';
import { makeSign } from './osm.js';
import { analytics } from './analytics.js';
import { submitScore } from './leaderboard.js';


// Per-city; see cityKey(). Must be called lazily, not read at module scope.
const saveKey = () => cityKey('rocketcity.races.v1');
const RING_R = 16;         // visual ring radius
const HIT_R = 42;          // pass tolerance (horizontal) — forgiving for flight
const BEAM_H = 600;        // beacon column height; you can capture anywhere in it
const BEAM_BELOW = 70;     // capture a touch below the ring too (driving/running)
const START_R = 60;
const TIMEOUT_MS = 8 * 60 * 1000;

function fmt(ms) {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

/** Perpendicular unit vector to the travel direction at point i along a route. */
function perpAt(pts, i) {
  const a = pts[i - 1] || pts[i], b = pts[i + 1] || pts[i];
  let dx = b.x - a.x, dz = b.z - a.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  return { px: -dz, pz: dx, yaw: Math.atan2(dx, dz) };
}

/** Two wall slabs flanking a checkpoint — the gate you weave the trench through. */
function buildGate(scene, pts, i, color) {
  const p = pts[i]; const { px, pz, yaw } = perpAt(pts, i);
  const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z);
  const H = 48, gap = RING_R + 10;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  for (const s of [1, -1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.5, H, 12), mat);
    wall.position.set(px * gap * s, H / 2, pz * gap * s); wall.rotation.y = yaw; wall.raycast = () => {};
    grp.add(wall);
  }
  grp.visible = false; scene.add(grp); return grp;
}

/** A starting grid: side rails + an overhead START bar at the first point. */
function buildStartGrid(scene, pts, color) {
  const p = pts[0]; const { px, pz, yaw } = perpAt(pts, 0);
  const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const gap = RING_R + 6;
  for (const s of [1, -1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 90), mat);
    rail.position.set(px * gap * s, 6, pz * gap * s); rail.rotation.y = yaw; rail.raycast = () => {};
    grp.add(rail);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(gap * 2, 2.5, 3), new THREE.MeshBasicMaterial({ color }));
  bar.position.set(0, 34, 0); bar.rotation.y = yaw; bar.raycast = () => {}; grp.add(bar);
  grp.visible = false; scene.add(grp); return grp;
}

export class Races {
  constructor({ scene, world, hud, audio, onFinish }) {
    this.scene = scene; this.world = world; this.hud = hud; this.audio = audio; this.onFinish = onFinish;
    this.best = {};
    try { this.best = JSON.parse(localStorage.getItem(saveKey()) || '{}'); } catch { /* fresh */ }
    this.active = null;      // { race, idx, t0 }
    this.nearStart = null;
    this._tmp = new THREE.Vector3();
    this.tracks = cityRaces().map((race, ti) => {
      const pts = race.points.map(([lat, lon]) => world.geoToScene(lat, lon, 0));
      const color = new THREE.Color(race.color);
      const rings = [], beams = [], gates = [];
      pts.forEach((p, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 1.1, 10, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(p.x, 15, p.z);
        ring.visible = false; ring.raycast = () => {};
        scene.add(ring); rings.push(ring);
        // tall beacon column so the checkpoint is visible (and capturable) from the air
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(RING_R, RING_R, BEAM_H, 20, 1, true),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
        );
        beam.position.set(p.x, 15 + BEAM_H / 2, p.z);
        beam.visible = false; beam.raycast = () => {};
        scene.add(beam); beams.push(beam);
        // trench races: two wall slabs flank each gate — the "walls to stay inside"
        gates.push(race.trench ? buildGate(scene, pts, i, color) : null);
      });
      const grid = race.trench ? buildStartGrid(scene, pts, color) : null;   // launch box at the start
      const sign = makeSign(`${race.name}${race.sponsor ? ' · ' + race.sponsor : ''}`, { color: race.color, big: true });
      sign.position.copy(rings[0].position).setY(38 + ti * 62); // stack signs that share a start point
      scene.add(sign);
      return { race, pts, rings, beams, gates, grid, sign };
    });
  }

  bestFor(id) { return this.best[id]?.bestMs ?? null; }

  start(track) {
    this.active = { track, idx: 1, t0: performance.now() };
    track.rings.forEach((r, i) => { r.visible = i > 0; });
    track.beams.forEach((b, i) => { b.visible = i > 0; b.material.opacity = 0.2; });
    if (track.gates) track.gates.forEach((g, i) => { if (g) g.visible = i > 0; });
    if (track.grid) track.grid.visible = true;
    this.hud.toast(track.race.trench ? `${track.race.name} — GO! WEAVE THE GATES` : `${track.race.name} — GO! FLY INTO THE LIGHT COLUMNS`, 2600);
    this.audio?.fanfare();
    analytics.track('race_start', { name: track.race.id });
  }

  cancel(reason = 'CANCELLED') {
    if (!this.active) return;
    this.active.track.rings.forEach((r) => { r.visible = false; });
    this.active.track.beams.forEach((b) => { b.visible = false; });
    if (this.active.track.gates) this.active.track.gates.forEach((g) => { if (g) g.visible = false; });
    if (this.active.track.grid) this.active.track.grid.visible = false;
    this.hud.setRaceTimer(null);
    this.hud.toast(`RACE ${reason}`, 1800);
    this.active = null;
  }

  /** Minimap waypoints: the next checkpoint (bright) + the one after (dim); idle shows start beacons. */
  markers() {
    if (this.active) {
      const t = this.active.track, i = this.active.idx;
      const out = [{ x: t.rings[i].position.x, z: t.rings[i].position.z, kind: 'race' }];
      const nxt = t.rings[i + 1];
      if (nxt) out.push({ x: nxt.position.x, z: nxt.position.z, kind: 'race', dim: true });
      return out;
    }
    return this.tracks.map((t) => ({ x: t.pts[0].x, z: t.pts[0].z, kind: 'race', start: true }));
  }

  update(dt, player, input, now = performance.now()) {
    // settle rings/beams/signs to ground height; keep correcting as terrain refines
    // (one ring per track per frame — cheap with BVH, and no more 'rings in the sky')
    this._rIdx = (this._rIdx || 0) + 1;
    for (const t of this.tracks) {
      const k = this._rIdx % t.rings.length;
      const ring = t.rings[k];
      this._tmp.set(ring.position.x, 400, ring.position.z);
      const hit = this.world.groundBelow(this._tmp, 900, true);
      if (hit) {
        const targetY = hit.point.y + 15;
        if (Math.abs(ring.position.y - targetY) > 1) { ring.position.y = targetY; t.beams[k].position.y = targetY + BEAM_H / 2; }
        if (t.gates && t.gates[k]) t.gates[k].position.y = hit.point.y;   // sit gate walls on the trench floor
        if (k === 0 && t.grid) t.grid.position.y = hit.point.y;
        if (ring === t.rings[0]) t.sign.position.y = hit.point.y + 38;
      }
      const d0 = Math.hypot(t.pts[0].x - player.position.x, t.pts[0].z - player.position.z);
      t.sign.material.opacity += ((d0 < 600 ? 1 : 0) - t.sign.material.opacity) * 0.1;
      t.sign.visible = t.sign.material.opacity > 0.02;
    }

    if (this.active) {
      const { track, idx, t0 } = this.active;
      const elapsed = now - t0;
      const target = track.rings[idx];
      const beam = track.beams[idx];
      const d = Math.hypot(target.position.x - player.position.x, target.position.z - player.position.z);
      this.hud.setRaceTimer(`${track.race.name}  ·  RING ${idx}/${track.rings.length - 1}  ·  ${fmt(elapsed)}  ·  ${Math.round(d)}m`);
      if (elapsed > TIMEOUT_MS) return this.cancel('TIMED OUT');
      // Dim every checkpoint except the live one. All remaining rings are drawn at once,
      // which is fine when they are kilometres apart but unreadable on the World Showcase
      // lap, where eleven identical rings sit in a 400 m circle and only a faint pulse
      // distinguished the one you actually had to fly through.
      for (let i = 0; i < track.rings.length; i++) {
        if (i === idx) continue;
        const r = track.rings[i]; if (r.visible) { r.material.opacity = 0.16; r.scale.setScalar(1); }
        const b = track.beams[i]; if (b.visible) b.material.opacity = 0.05;
      }
      // pulse the active checkpoint so it reads as "the one to hit"
      target.material.opacity = 0.6 + Math.sin(now / 120) * 0.4;
      target.scale.setScalar(1 + Math.sin(now / 200) * 0.06);
      beam.material.opacity = 0.26 + Math.sin(now / 220) * 0.12;
      const dy = player.position.y - target.position.y;   // +above the ring
      if (d < HIT_R && dy > -BEAM_BELOW && dy < BEAM_H) {
        target.visible = false; beam.visible = false;
        this.audio?.blip(900 + idx * 120);
        if (idx + 1 >= track.rings.length) {
          const ms = Math.round(elapsed);
          const prev = this.bestFor(track.race.id);
          const isBest = prev === null || ms < prev;
          if (isBest) this.best[track.race.id] = { bestMs: ms, at: Date.now() };
          try { localStorage.setItem(saveKey(), JSON.stringify(this.best)); } catch { /* ignore */ }
          this.audio?.fanfare();
          analytics.track('race_finish', { name: track.race.id, value: Math.round(ms / 1000) });
          this.hud.setRaceTimer(null);
          this.active = null;
          this.onFinish?.({ race: track.race, ms, isBest });
        } else {
          this.active.idx++;
          this.hud.toast(`RING ${idx}/${track.rings.length - 1} ✓`, 900);
        }
      }
      this.nearStart = null;
      return;
    }

    // idle: offer starts
    this.nearStart = null;
    for (const t of this.tracks) {
      const d = Math.hypot(t.pts[0].x - player.position.x, t.pts[0].z - player.position.z);
      if (d < START_R) { this.nearStart = t; break; }
    }
  }
}

/** Races belong to the active city. A city with none simply has no race modes. */
export function cityRaces() { return activeCity().races || []; }
