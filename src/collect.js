import * as THREE from 'three';
import { activeCity, cityKey } from './cities/index.js';
import { HUNTS } from './huntdefs.js';

export { HUNTS };
import { analytics } from './analytics.js';
import { submitScore } from './leaderboard.js';

/** Spinning collectible coin face: colored disc + an emoji. Generic — no brand logos. */
function coinTexture(emoji, hex) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = hex; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e7f3ea'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
  g.font = '68px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/**
 * Collectible "hunt" game modes: fly/drive within a target's radius to claim it.
 * Each claim plays a sound + a floating "+1" pop and bumps a persistent counter;
 * counts submit to a global leaderboard so hunts have a board of their own.
 *
 * Modes are independently toggleable (both can run at once).
 */

/** Datasets for coin runs, keyed by the HUNTS[].coin.data name. Read lazily —
 * not at module scope — so a city switch (full page reload) picks up the
 * newly active city rather than whichever city was active at import time. */
const coinData = () => {
  const p = activeCity().pois;
  // `|| []` matters: a city need not define every list, and an undefined dataset would
  // otherwise blow up total() before the menu could omit the hunt.
  return { STARBUCKS: p.starbucks || [], BOWLING: p.bowling || [], PICKLEBALL: p.pickleball || [],
           HOSPITALS: p.hospitals || [], BREWERIES: p.breweries || [], HONKYTONKS: p.honkytonks || [],
           COASTERS: p.coasters || [], ANIMALS: p.animals || [] };
};
/** Every hunt id that uses the generic coin-run machinery. */
const COIN_RUNS = Object.keys(HUNTS).filter((k) => HUNTS[k].coin);

export class Collectibles {
  constructor({ scene, world, hud, audio, alpr, onAward }) {
    this.scene = scene; this.world = world; this.hud = hud; this.audio = audio; this.alpr = alpr; this.onAward = onAward;
    this.active = {};       // id -> true
    this.claimed = {};      // id -> array of claimed indexes
    this.tag = null;        // player leaderboard tag (set by main)
    let hadSave = false;
    try { const raw = localStorage.getItem(cityKey('rocketcity.hunts.v1')); if (raw) { const s = JSON.parse(raw); this.active = s.active || {}; this.claimed = s.claimed || {}; hadSave = true; } } catch { /* fresh */ }
    if (!hadSave) this.active.flock = true; // new players start hunting Flock cameras
    this._tmp = new THREE.Vector3();
    this.golfGroup = new THREE.Group(); scene.add(this.golfGroup);
    this._golfBuilt = false;
    // one group + target list per coin run (starbucks / bowling / pickleball / er)
    this.coinGroups = {}; this.coins = {};
    for (const id of COIN_RUNS) { const g = new THREE.Group(); scene.add(g); this.coinGroups[id] = g; }
    if (this.alpr) this.alpr.setClaimed(new Set(this.claimed.flock || []));
  }

  _save() { try { localStorage.setItem(cityKey('rocketcity.hunts.v1'), JSON.stringify({ active: this.active, claimed: this.claimed })); } catch { /* ignore */ } }

  count(id) { return (this.claimed[id] || []).length; }
  total(id) {
    if (id === 'flock') return this.alpr?.huntCount ?? this.alpr?.count ?? 0;  // reachable only — see alpr.js
    if (HUNTS[id]?.coin) return coinData()[HUNTS[id].coin.data].length;
    return activeCity().pois.golfCourses.length;
  }

  toggle(id) {
    this.active[id] = !this.active[id];
    if (id === 'golf') this.golfGroup.visible = !!this.active.golf;
    if (HUNTS[id]?.coin) { if (this.active[id] && !this.coins[id]) this._buildCoinRun(id); this.coinGroups[id].visible = !!this.active[id]; }
    if (this.active[id] && id === 'golf' && !this._golfBuilt) this._buildGolf();
    if (id === 'flock' && this.alpr) this.alpr.setClaimed(new Set(this.claimed.flock || []));
    this._save();
    this.hud.toast(this.active[id] ? `${HUNTS[id].name} — ON` : `${HUNTS[id].name} — OFF`, 1800);
    return this.active[id];
  }

  _targets(id) {
    if (id === 'flock') return (this.alpr?.cams) || [];
    if (id === 'golf') return this._golf || [];
    if (HUNTS[id]?.coin) return this.coins[id] || [];
    return [];
  }

  /** Build a coin run: a beacon + spinning emoji coin over each real location. */
  _buildCoinRun(id) {
    const cfg = HUNTS[id], data = coinData()[cfg.coin.data];
    const tex = coinTexture(cfg.coin.emoji, cfg.coin.hex);
    this.coins[id] = data.map((s, i) => {
      const p = this.world.geoToScene(s.lat, s.lon, 0);
      const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 300, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      pillar.position.y = 150; pillar.raycast = () => {};
      const coin = new THREE.Mesh(new THREE.CircleGeometry(7, 40),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: false }));
      coin.position.y = 42; coin.raycast = () => {};
      grp.add(pillar, coin);
      grp.userData = { snapped: false, name: s.name, x: p.x, z: p.z };
      this.coinGroups[id].add(grp);
      return { x: p.x, z: p.z, name: s.name, addr: s.addr, grp, coin, baseY: 42, i };
    });
    this.coinGroups[id].visible = !!this.active[id];
    for (const idx of (this.claimed[id] || [])) {
      const t = this.coins[id][idx];
      if (t) { t.coin.visible = false; t.grp.children[0].material.opacity = 0.04; }
    }
  }

  _buildGolf() {
    this._golfBuilt = true;
    this._golf = activeCity().pois.golfCourses.map((g, i) => {
      const p = this.world.geoToScene(g.lat, g.lon, 0);
      const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 300, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      pillar.position.y = 150; pillar.raycast = () => {};
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); pole.position.y = 4;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshBasicMaterial({ color: 0x39ff88, side: THREE.DoubleSide })); flag.position.set(1.4, 7, 0);
      grp.add(pillar, pole, flag); grp.userData = { snapped: false, name: g.name, x: p.x, z: p.z };
      this.golfGroup.add(grp);
      return { x: p.x, z: p.z, name: g.name, addr: g.addr, grp };
    });
    this.golfGroup.visible = !!this.active.golf;
    // dim already-claimed
    for (const idx of (this.claimed.golf || [])) if (this._golf[idx]) this._golf[idx].grp.children[0].material.opacity = 0.05;
  }

  update(dt, player, now = performance.now()) {
    // Lazily build any hunt that's active but not yet in the scene. Runs restored
    // from localStorage never pass through toggle(), so without this an active
    // hunt would show a counter with no beacons or coins to find.
    for (const id of COIN_RUNS) {
      if (this.active[id] && !this.coins[id]) { this._buildCoinRun(id); this.coinGroups[id].visible = true; }
    }
    if (this.active.golf && !this._golfBuilt) { this._buildGolf(); this.golfGroup.visible = true; }

    // settle golf pillars to ground
    if (this._golf) for (const t of this._golf) {
      if (t.grp.userData.snapped) continue;
      this._tmp.set(t.x, 400, t.z);
      const hit = this.world.groundBelow(this._tmp, 2000, true);
      if (hit) { t.grp.position.y = hit.point.y; t.grp.userData.snapped = true; }
      break;
    }
    // coin runs: settle one beacon per frame, then spin/bob the un-grabbed coins
    for (const id of COIN_RUNS) {
      const list = this.active[id] && this.coins[id];
      if (!list) continue;
      for (const t of list) {
        if (t.grp.userData.snapped) continue;
        this._tmp.set(t.x, 400, t.z);
        const hit = this.world.groundBelow(this._tmp, 2000, true);
        if (hit) { t.grp.position.y = hit.point.y; t.grp.userData.snapped = true; }
        break;
      }
      for (const t of list) {
        if (!t.coin.visible) continue;
        t.coin.rotation.y += dt * 2.6;
        t.coin.position.y = t.baseY + Math.sin(now / 500 + t.i) * 2.5;
      }
    }
    for (const id of Object.keys(HUNTS)) {
      if (!this.active[id]) continue;
      const targets = this._targets(id);
      const claimed = (this.claimed[id] ||= []);
      const r = HUNTS[id].radius;
      for (let i = 0; i < targets.length; i++) {
        if (claimed.includes(i)) continue;
        const t = targets[i];
        if (Math.hypot(player.position.x - t.x, player.position.z - t.z) < r) this._claim(id, i, t);
      }
    }
  }

  _claim(id, i, t) {
    const hunt = HUNTS[id];
    (this.claimed[id] ||= []).push(i);
    this.audio?.[hunt.sound]?.();
    if (id === 'golf' && t.grp) t.grp.children[0].material.opacity = 0.05; // dim claimed pillar
    if (HUNTS[id]?.coin && t.grp) { t.coin.visible = false; t.grp.children[0].material.opacity = 0.04; } // grab the coin, dim beacon
    if (id === 'flock' && this.alpr) this.alpr.markClaimed(i); // turn the found beam green
    const n = this.count(id), total = this.total(id);
    this.hud.popCollect(hunt.color, `+1 ${t.name ? t.name.toUpperCase() : hunt.label}`);
    // Name the place and hold it — 1.4s was too short to read, and the count
    // alone doesn't tell you which location you just grabbed. Address is shown
    // when we have a verified one (not every venue in the data has one).
    const norm = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
    // skip the name line when the address already contains it ("Highway 72 West"
    // above "7779 Highway 72 West" just reads as a stutter)
    const dupe = t?.name && t?.addr && norm(t.addr).includes(norm(t.name));
    const lines = [`${hunt.name} ${n}${total ? '/' + total : ''}`];
    if (t?.name && !dupe) lines.push(t.name);
    if (t?.addr) lines.push(t.addr);
    this.hud.toast(lines.join('\n'), 4600);
    this._save();
    analytics.track('hunt_claim', { name: id, value: n });
    if (this.tag) submitScore(hunt.board, this.tag, n, true).catch(() => {}); // desc: higher count wins
    if (total && n >= total) { analytics.track('hunt_complete', { name: id }); this.onAward?.(id); } // full set → award badge
  }

  /** Wipe progress for a run so it can be played again from scratch. */
  resetRun(id) {
    this.claimed[id] = [];
    if (HUNTS[id]?.coin && !this.coins[id]) this._buildCoinRun(id);   // may not exist yet
    if (this.coins[id]) for (const t of this.coins[id]) { t.coin.visible = true; t.grp.children[0].material.opacity = 0.16; }
    if (id === 'golf' && this._golf) for (const t of this._golf) t.grp.children[0].material.opacity = 0.16;
    if (id === 'flock' && this.alpr) this.alpr.setClaimed(new Set());
    this._save();
  }

  /** Minimap pins for every active coin run (un-grabbed coins only). */
  markers() {
    const out = [];
    for (const id of COIN_RUNS) {
      if (!this.active[id] || !this.coins[id]) continue;
      const col = HUNTS[id].coin.hex;
      for (const t of this.coins[id]) if (t.coin.visible) out.push({ x: t.x, z: t.z, kind: 'coin', color: col, name: t.name });
    }
    return out;
  }

  /** HUD counter rows for active hunts. */
  status() {
    return Object.keys(HUNTS).filter((id) => this.active[id]).map((id) => ({
      label: HUNTS[id].label, value: `${this.count(id)}${this.total(id) ? ' / ' + this.total(id) : ''}`, color: '#' + new THREE.Color(HUNTS[id].color).getHexString(),
    }));
  }
}
