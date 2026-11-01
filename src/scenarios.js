import * as THREE from 'three';
import { activeCity, cityKey } from './cities/index.js';
import { makeSign } from './osm.js';
import { analytics } from './analytics.js';

/**
 * Toggleable sponsored "scenarios" (events). Each has stops on the real map;
 * fly/drive to a stop to collect it, press E nearby to open its overlay
 * (menu, blurb, link, coupon). Progress persists per scenario.
 *
 * NOTE: stop coordinates are real (geocoded from OSM); menu/blurb/coupon text
 * below is DEMO CONTENT — replace per deal before selling this.
 */
/**
 * 2026 Huntsville Restaurant Week (Aug 14-23, organized by the Huntsville/Madison
 * County CVB). Participant list from the Huntsville Business Journal guide + WAFF
 * coverage; coordinates geocoded via OSM Nominatim. No menus/coupons are invented -
 * the overlay links to the official menus page instead.
 */

/** Local events belong to the active city; read lazily, never at module scope. */
const cityScenarios = () => activeCity().scenarios || [];

// Per-city; see cityKey(). Must be called lazily, not read at module scope.
const saveKey = () => cityKey('rocketcity.scenarios.v1');
const COLLECT_RADIUS = 35;
const PROMPT_RADIUS = 55;

export class Scenarios {
  constructor({ scene, world, hud, audio, onComplete }) {
    this.scene = scene; this.world = world; this.hud = hud; this.audio = audio; this.onComplete = onComplete;
    this.activeId = null;
    this.collected = {}; // id -> [stop indexes]
    this.manual = false;
    try {
      const s = JSON.parse(localStorage.getItem(saveKey()) || '{}');
      this.activeId = s.activeId ?? null;
      this.collected = s.collected ?? {};
      this.manual = !!s.manual;
    } catch { /* fresh */ }
    // Scheduled events auto-activate during their window unless the player chose manually.
    if (!this.manual && !this.activeId) {
      const today = new Date().toISOString().slice(0, 10);
      const win = cityScenarios().find((sc) => sc.window && today >= sc.window.start && today <= sc.window.end);
      if (win) this.activeId = win.id;
    }
    this.objects = []; // { stop, i, group, ring, sign, snapped }
    this.nearStop = null;
    this._tmp = new THREE.Vector3();
    if (this.activeId) this._build();
  }

  get active() { return cityScenarios().find((s) => s.id === this.activeId) || null; }
  get label() { return this.active ? this.active.name : 'OFF'; }

  /** Local events belong to the active city. */
  static all() { return activeCity().scenarios || []; }

  /** Activate a scenario by id (null = off). */
  activate(id) {
    this.manual = true;
    const next = cityScenarios().find((s) => s.id === id) || null;
    this.activeId = next ? next.id : null;
    this._teardown();
    if (next) this._build();
    this._save();
    this.hud.toast(next ? `EVENT ON: ${next.name}` : 'EVENTS OFF', 2200);
    return this.label;
  }

  _save() { try { localStorage.setItem(saveKey(), JSON.stringify({ activeId: this.activeId, collected: this.collected, manual: this.manual })); } catch { /* ignore */ } }

  _build() {
    const sc = this.active; if (!sc) return;
    const done = this.collected[sc.id] || [];
    sc.stops.forEach((stop, i) => {
      const group = new THREE.Group();
      const pos = this.world.geoToScene(stop.lat, stop.lon, 0);
      group.position.set(pos.x, 0, pos.z);
      const color = new THREE.Color(sc.color);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.5, 8, 40), new THREE.MeshBasicMaterial({ color }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 18;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 200, 16, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
      pillar.position.y = 100;
      const sign = makeSign(stop.name.toUpperCase(), { color: sc.color, big: true });
      sign.position.y = 34; sign.material.opacity = 0;   // faded in by distance (nearest-few rule)
      group.add(ring, pillar, sign);
      group.visible = true;
      this.scene.add(group);
      this.objects.push({ stop, i, group, ring, sign, snapped: false, done: done.includes(i) });
      if (done.includes(i)) { pillar.visible = false; ring.material.color.multiplyScalar(0.4); }
    });
  }

  _teardown() {
    for (const o of this.objects) {
      this.scene.remove(o.group);
      o.group.traverse((x) => { x.geometry?.dispose(); if (x.material) { x.material.map?.dispose(); x.material.dispose(); } });
    }
    this.objects = [];
    this.nearStop = null;
  }

  update(dt, player, now = performance.now()) {
    if (!this.activeId) { this.nearStop = null; return; }
    const sc = this.active;
    let near = null, nearD = PROMPT_RADIUS;
    const SIGN_RANGE = 380, MAX_LABELS = 2;
    for (const o of this.objects) {
      { // keep correcting to ground as terrain refines (no more sky rings)
        this._tmp.set(o.group.position.x, 400, o.group.position.z);
        const hit = this.world.groundBelow(this._tmp, 2000, true);
        if (hit && Math.abs(o.group.position.y - hit.point.y) > 1) o.group.position.y = hit.point.y;
      }
      o.ring.rotation.z += dt * 0.8;
      o.ring.position.y = 18 + Math.sin(now / 500 + o.i) * 2;
      o._d = Math.hypot(player.position.x - o.group.position.x, player.position.z - o.group.position.z);
      const dy = player.position.y - o.group.position.y;
      if (o._d < nearD && dy > -10 && dy < 220) { nearD = o._d; near = o; }
      if (!o.done && o._d < COLLECT_RADIUS && dy > -10 && dy < 220) this._collect(sc, o);
    }
    // declutter: only the nearest few stop labels fade in at once
    const shown = new Set(this.objects.filter((o) => o._d < SIGN_RANGE).sort((a, b) => a._d - b._d).slice(0, MAX_LABELS));
    for (const o of this.objects) {
      const t = shown.has(o) ? Math.min(1, (SIGN_RANGE - o._d) / 60) : 0;
      o.sign.material.opacity += (t - o.sign.material.opacity) * 0.15;
      o.sign.visible = o.sign.material.opacity > 0.02;
    }
    this.nearStop = near;
  }

  /** Wipe trail progress so it can be walked again. */
  resetRun(id) {
    this.collected[id] = [];
    this._save();
    if (this.activeId === id) { this._teardown(); this._build(); }
  }

  _collect(sc, o) {
    o.done = true;
    (this.collected[sc.id] ||= []).push(o.i);
    o.group.children[1].visible = false; // pillar off
    o.ring.material.color.multiplyScalar(0.4);
    this.audio?.blip(1100);
    analytics.track('scenario_stop', { name: o.stop.name });
    const n = this.collected[sc.id].length;
    if (n >= sc.stops.length) {
      analytics.track('scenario_complete', { name: sc.id });
      this.onComplete?.(sc.id);
      this.hud.toast(`${sc.badge} EARNED!`, 6000);
      this.audio?.fanfare();
    } else {
      this.hud.toast(`${sc.name}: ${o.stop.name.toUpperCase()} ✓  (${n}/${sc.stops.length})`, 3000);
    }
    this._save();
  }

  progress() {
    const sc = this.active; if (!sc) return null;
    return `${(this.collected[sc.id] || []).length}/${sc.stops.length}`;
  }

  markers() {
    if (!this.activeId) return [];
    return this.objects.map((o) => ({ x: o.group.position.x, z: o.group.position.z, kind: 'stop', done: o.done }));
  }
}
