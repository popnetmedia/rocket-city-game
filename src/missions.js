import * as THREE from 'three';
import { activeCity, cityKey } from './cities/index.js';
import { analytics } from './analytics.js';

// Per-city; see cityKey(). Must be called lazily, not read at module scope.
const saveKey = () => cityKey('rocketcity.missions.v1');
const FUEL_MAX = 100;
const FUEL_BURN_PER_S = 100 / 75;      // full tank = 75 s of flight
const FUEL_PER_CELL = 25;
const CELL_RESPAWN_MS = 60000;
const PICKUP_RADIUS = 2.2;
const BEACON_RADIUS = 30;

// Fuel cell positions (scene metres, relative to courthouse origin). Snapped to ground at runtime.
const CELL_OFFSETS = [
  [18, -12], [-26, 8], [34, 30], [-48, -30], [0, -63], [62, -70], [-80, 40], [95, 5], [-40, 95], [120, -110],
];

function makeCell() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16),
    new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.35, metalness: 0.3, emissive: 0xff5a00, emissiveIntensity: 0.35 }));
  body.position.y = 0.75;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.3 }));
  cap.position.y = 1.3;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x1b1f24 }));
  band.position.y = 0.75;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.6 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.05;
  const light = new THREE.PointLight(0xff8a1f, 6, 8);
  light.position.y = 1;
  g.add(body, cap, band, ring, light);
  g.userData.ring = ring;
  return g;
}

function makeBeacon(color) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 400, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 200;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(BEACON_RADIUS * 0.5, 0.6, 8, 48), new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 25;
  g.add(pillar, ring);
  g.userData.ring = ring;
  return g;
}

export class Missions {
  constructor({ scene, world, hud, audio, onFlightUnlock }) {
    this.scene = scene; this.world = world; this.hud = hud; this.audio = audio; this.onFlightUnlock = onFlightUnlock;
    this.fuel = 0;
    // Opt-in per city. Mission 1 is Huntsville content: the cell offsets were laid out
    // around Courthouse Square and the hint literally says "AROUND THE SQUARE". Because
    // the offsets are scene-relative, every other city was still spawning ten fuel cells
    // by its own origin and captioning them with Huntsville's copy.
    this.enabled = !!activeCity().meta.missions;
    this.cells = !this.enabled ? []
      : CELL_OFFSETS.map(([x, z], i) => ({ i, x, z, mesh: makeCell(), snapped: false, collected: false, respawnAt: 0 }));
    // Grand Tour stays the classic five landmarks (fixed list — adding teleport
    // presets must not grow the mission or shift saved progress indexes).
    const TOUR = ['Courthouse Square', 'Saturn V', 'Bridge Street', 'Big Spring Park', 'Toyota Field'];
    const presets = activeCity().presets;
    // A city whose presets do not include a tour stop simply has no beacon for it. Keep the
    // original TOUR index on the ones that do resolve, so saved progress never shifts, and
    // never dereference a missing preset — that threw at module scope and killed the whole
    // boot, leaving the welcome screen up with no working buttons.
    this.beacons = !this.enabled ? [] : TOUR
      .map((name, i) => ({ i, name, p: presets.find((x) => x.name === name) }))
      .filter((b) => b.p)
      .map(({ i, name, p }) => (
        { i, name, pos: world.geoToScene(p.lat, p.lon, 0), mesh: makeBeacon(0x39ff88), done: false }
      ));
    this.state = { m1: { collected: [], done: false }, m2: { visited: [], done: false } };
    this.gamify = false; // false = EXPLORER (infinite flight fuel); true = fuel burns + cells refill
    this._load();
    this.cells.forEach((c) => { c.mesh.position.set(c.x, 0, c.z); if (!c.collected) scene.add(c.mesh); });
    this.beacons.forEach((b) => { b.mesh.position.copy(b.pos); b.mesh.visible = this.state.m1.done && !b.done; scene.add(b.mesh); });
    this._tmp = new THREE.Vector3();
    this._announce = 0;
    this.refreshHud();
  }

  /**
   * Every world-space mesh this module owns. Interiors hide the outdoors while
   * the player is in a room built at a real street address, and a fuel cell
   * sitting on that pavement would otherwise be floating in the furniture.
   * Cells and beacons are added to and removed from the scene as they are
   * collected, so this is a live read, not a cached list.
   */
  hideables() { return [...this.cells.map((c) => c.mesh), ...this.beacons.map((b) => b.mesh)]; }

  get flightUnlocked() { return this.state.m1.done; }
  get active() { return !this.state.m1.done ? 1 : !this.state.m2.done ? 2 : 0; }

  _load() {
    try {
      const s = JSON.parse(localStorage.getItem(saveKey()) || 'null');
      if (s && s.m1 && s.m2) { this.state = s; this.fuel = s.fuel ?? 0; this.gamify = !!s.gamify; }
    } catch { /* fresh */ }
    for (const c of this.cells) c.collected = this.state.m1.collected.includes(c.i) && !this.state.m1.done;
    for (const b of this.beacons) b.done = this.state.m2.visited.includes(b.i);
    if (this.state.m1.done && this.fuel <= 0 && !this.state.fuelInit) { this.fuel = FUEL_MAX; }
  }
  _save() { try { localStorage.setItem(saveKey(), JSON.stringify({ ...this.state, fuel: this.fuel, gamify: this.gamify })); } catch { /* ignore */ } }

  reset() { try { localStorage.removeItem(saveKey()); } catch {} location.reload(); }

  /** dt seconds; player = { position, flying } */
  update(dt, player, now = performance.now()) {
    // snap cells to ground once the mesh under them exists (tiles stream in lazily)
    for (const c of this.cells) {
      if (!c.snapped) {
        this._tmp.set(c.x, 500, c.z);
        const hit = this.world.groundBelow(this._tmp, 2000);
        if (hit) { c.mesh.position.y = hit.point.y; c.snapped = true; }
      }
      if (c.collected) {
        if (this.state.m1.done && now >= c.respawnAt) { c.collected = false; this.scene.add(c.mesh); }
        continue;
      }
      c.mesh.rotation.y += dt * 1.6;
      c.mesh.userData.ring.rotation.z += dt * 0.8;
      c.mesh.children[0].position.y = 0.75 + Math.sin(now / 400 + c.i) * 0.08;
      if (c.snapped && player.position.distanceTo(c.mesh.position) < PICKUP_RADIUS) this._collect(c, now);
    }

    // fuel burn while flying (GAMIFY mode only; EXPLORER = infinite)
    if (player.flying && this.gamify) {
      this.fuel = Math.max(0, this.fuel - FUEL_BURN_PER_S * dt);
      if (this.fuel <= 0) { player.flying = false; this.hud.toast('OUT OF FUEL — FIND FUEL CELLS'); this._save(); }
    }

    // mission 2 beacons: snap bases to the streamed-in ground, register anywhere inside the pillar
    if (this.state.m1.done && !this.state.m2.done) {
      for (const b of this.beacons) {
        if (b.done) continue;
        if (!b.snapped) {
          this._tmp.set(b.pos.x, b.pos.y + 500, b.pos.z);
          const hit = this.world.groundBelow(this._tmp, 2000, true);
          if (hit) { b.base = hit.point.y; b.mesh.position.y = b.base; b.snapped = true; }
        }
        const base = b.snapped ? b.base : b.pos.y;
        b.mesh.userData.ring.rotation.z += dt * 0.5;
        b.mesh.userData.ring.position.y = 30 + Math.sin(now / 600) * 3;
        const dx = player.position.x - b.pos.x, dz = player.position.z - b.pos.z;
        const dy = player.position.y - base;
        if (Math.hypot(dx, dz) < BEACON_RADIUS && dy > -20 && dy < 400) this._visit(b);
      }
    }
    if (now - this._announce > 250) { this._announce = now; this.refreshHud(); }
  }

  _collect(c, now) {
    c.collected = true; c.respawnAt = now + CELL_RESPAWN_MS;
    this.scene.remove(c.mesh);
    this.audio?.blip(880);
    if (!this.state.m1.done) {
      if (!this.state.m1.collected.includes(c.i)) this.state.m1.collected.push(c.i);
      const n = this.state.m1.collected.length;
      this.fuel = Math.min(FUEL_MAX, (n / this.cells.length) * FUEL_MAX);
      if (n >= this.cells.length) {
        this.state.m1.done = true; this.fuel = FUEL_MAX;
        analytics.track('mission_complete', { name: 'fuel-run' });
        this.beacons.forEach((b) => { b.mesh.visible = !b.done; });
        this.hud.toast('MISSION 1 COMPLETE — TANKS FULL. PRESS F TO FLY!', 6000);
        this.audio?.fanfare();
        this.onFlightUnlock?.();
      } else {
        this.hud.toast(`FUEL CELL ${n}/${this.cells.length}`);
      }
    } else {
      this.fuel = Math.min(FUEL_MAX, this.fuel + FUEL_PER_CELL);
      this.hud.toast(`+${FUEL_PER_CELL}% FUEL`);
    }
    this._save(); this.refreshHud();
  }

  _visit(b) {
    b.done = true; b.mesh.visible = false;
    this.state.m2.visited.push(b.i);
    this.audio?.blip(1320);
    const n = this.state.m2.visited.length;
    if (n >= this.beacons.length) {
      this.state.m2.done = true;
      analytics.track('mission_complete', { name: 'grand-tour' });
      this.hud.toast('MISSION 2 COMPLETE — GRAND TOUR OF THE ROCKET CITY!', 7000);
      this.audio?.fanfare();
    } else this.hud.toast(`BEACON ${n}/${this.beacons.length} — ${b.name.toUpperCase()}`);
    this._save(); this.refreshHud();
  }

  setGamify(on) {
    this.gamify = !!on;
    if (this.gamify && this.fuel <= 0) this.fuel = FUEL_MAX;
    this._save(); this.refreshHud();
    this.hud.toast(this.gamify ? 'GAMIFY FLIGHT — FUEL BURNS, CELLS REFILL' : 'EXPLORER FLIGHT — INFINITE FUEL', 2800);
  }

  refreshHud() {
    if (!this.enabled) { this.hud.setMissionPanelVisible(false); return; }
    const m1 = this.state.m1, m2 = this.state.m2;
    let title, progress, hint;
    if (!m1.done) {
      title = 'MISSION 1 — FUEL RUN'; progress = `${m1.collected.length}/${this.cells.length} FUEL CELLS`;
      hint = 'COLLECT THE GLOWING FUEL CELLS AROUND THE SQUARE';
    } else if (!m2.done) {
      title = 'MISSION 2 — GRAND TOUR'; progress = `${m2.visited.length}/${this.beacons.length} BEACONS`;
      const next = this.beacons.find((b) => !b.done); hint = next ? `FLY TO ${next.name.toUpperCase()}` : '';
    } else { title = 'ALL MISSIONS COMPLETE'; progress = 'FREE FLIGHT'; hint = 'FUEL CELLS RESPAWN EVERY 60 S'; }
    this.hud.setMission({ title, progress, hint, fuel: this.fuel / FUEL_MAX, unlocked: true, gamify: this.gamify });
  }

  /** Markers for the minimap. */
  markers() {
    const out = [];
    for (const c of this.cells) if (!c.collected) out.push({ x: c.mesh.position.x, z: c.mesh.position.z, kind: 'cell' });
    if (this.state.m1.done) for (const b of this.beacons) if (!b.done) out.push({ x: b.pos.x, z: b.pos.z, kind: 'beacon' });
    return out;
  }
}
