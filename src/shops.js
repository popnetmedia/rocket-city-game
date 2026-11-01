/**
 * Storefront cards. The shop data itself lives on the city module (city.shops);
 * this file is just the rendering, proximity and offer-modal behaviour.
 */
import * as THREE from 'three';
import { activeCity } from './cities/index.js';
import { makeSign } from './osm.js';
import { analytics } from './analytics.js';
import { stats } from './stats.js';

const OPEN_RADIUS = 50;    // how close you must be to click/open (tight: stores are ~38m apart)
const COLOR = 0xffcc33;
// Hotels are approached at flight speed rather than walked past, so they need a much
// wider band than a storefront on foot: a 50 m open radius is a few frames at 120 m/s.
const HOTEL_OPEN_RADIUS = 130;
const HOTEL_COLOR = 0x5fd0ff;
// Ground-snap raycasts, capped per frame — see the note in update().
const SNAP_RADIUS = 1800, SNAP_PER_FRAME = 6;

/**
 * Storefront cards belong to the active city. Hotels are folded in here rather than
 * given their own system: they want exactly the same pillar, label, proximity prompt,
 * modal and click analytics, and duplicating that would mean two of everything.
 */
const cityShops = () => {
  const c = activeCity();
  const hotels = (c.pois?.hotels || []).map((h) => ({
    name: h.name, lat: h.lat, lon: h.lon, kind: 'hotel',
    blurb: h.near ? `Hotel — ${h.km} km from ${h.near}.` : 'Hotel.',
  }));
  return [...(c.shops || []), ...hotels];
};

export class Shops {
  constructor({ scene, world, hud, camera }) {
    this.scene = scene; this.world = world; this.hud = hud; this.camera = camera;
    this.group = new THREE.Group(); scene.add(this.group);
    this._tmp = new THREE.Vector3();
    this.starsOnly = false;   // 'Who owns Broadway' — show only celebrity-branded venues
    this.night = false;
    this.shops = cityShops().map((sh) => {
      const p = world.geoToScene(sh.lat, sh.lon, 0);
      const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z);
      const col = sh.kind === 'hotel' ? HOTEL_COLOR : COLOR;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 120, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      pillar.position.y = 60; pillar.raycast = () => {};
      // small always-on tag marker so a shop reads as a dot from afar
      const tag = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshBasicMaterial({ color: col, fog: false }));
      tag.position.y = 14; tag.raycast = () => {};
      // name label only fades in when you're close (keeps clustered shops readable)
      const sign = makeSign(sh.name.toUpperCase(), { color: sh.star ? '#ff5fa2' : sh.kind === 'hotel' ? '#5fd0ff' : '#ffcc33', big: false });
      // Storefront labels are read on foot from ~20 m; hotel labels are read from the air
      // at a few hundred, so they need to be meaningfully larger and sit higher.
      sign.position.y = sh.kind === 'hotel' ? 46 : 20;
      sign.scale.multiplyScalar(sh.kind === 'hotel' ? 1.5 : 0.7);
      sign.material.opacity = 0;
      // No invisible hit-box any more: it existed only for click-to-open, which is gone,
      // and it was one extra mesh per venue (39 of them on Broadway alone).
      grp.add(pillar, tag, sign);
      grp.userData = { snapped: false, x: p.x, z: p.z };
      this.group.add(grp);
      return { ...sh, grp, sign, tag, x: p.x, z: p.z };
    });
    this._viewed = new Set();
    this.nearShop = null;
  }


  update(dt, player, now = performance.now()) {
    let near = null, nd = Infinity;
    let snapBudget = SNAP_PER_FRAME;
    for (const s of this.shops) {
      const d = Math.hypot(player.position.x - s.x, player.position.z - s.z);
      // Ground-snap is a raycast, and an unsnapped entry retries it EVERY frame. Broadway's
      // 39 venues share one block, so that cost was invisible. 156 Orlando hotels spread
      // across a 15 km resort are mostly over terrain that is never loaded, so they would
      // never snap and would burn one raycast each, every frame, for the whole session.
      // Only snap what is close enough to be looked at, and cap the attempts per frame.
      if (!s.grp.userData.snapped && d < SNAP_RADIUS && snapBudget > 0) {
        snapBudget--;
        this._tmp.set(s.x, 400, s.z);
        const hit = this.world.groundBelow(this._tmp, 2000, true);
        if (hit) { s.grp.position.y = hit.point.y; s.grp.userData.snapped = true; }
      }
      // narrow band: full within 22m, gone by 50m. In stars-only mode the unbranded
      // venues drop out entirely, so what is left standing IS the answer.
      const hidden = this.starsOnly && !s.star;
      s.grp.visible = !hidden;              // drop the pillar and tag too, not just the label
      // At night the labels carry much further, so a strip of venues reads as a lit row
      // from the air instead of resolving one sign at a time.
      // NB: `near` is the running nearest-shop accumulator declared above — do not shadow
      // it here. Naming these fadeNear/fadeFar; the earlier `const near` made the whole
      // update() throw "Assignment to constant variable" on the very next line.
      const hotel = s.kind === 'hotel';
      const fadeNear = hotel ? 300 : this.night ? 90 : 22;
      const fadeFar = hotel ? 950 : this.night ? 220 : 50;
      const target = hidden ? 0 : d < fadeNear ? 1 : d < fadeFar ? (fadeFar - d) / (fadeFar - fadeNear) : 0;
      s.sign.material.opacity += (target - s.sign.material.opacity) * 0.15;
      s.sign.visible = s.sign.material.opacity > 0.03;
      const openR = hotel ? HOTEL_OPEN_RADIUS : OPEN_RADIUS;
      if (d < openR && d < nd) { nd = d; near = s; }
      if (d < openR * 2 && !this._viewed.has(s.name)) { this._viewed.add(s.name); stats.card('view'); analytics.track('shop_view', { name: s.name }); }
    }
    this.nearShop = near;
  }

  open(s) {
    this.hud.openShop(s, () => {
      stats.card('click');
      analytics.track('shop_click', { name: s.name });
      window.open(s.url, '_blank', 'noopener');
    });
    stats.card('open');
    analytics.track('shop_open', { name: s.name });
  }

  /** After Dark: let the signs read from much further away. */
  setNight(on) { this.night = !!on; }

  /** Show only celebrity-branded venues (or all of them again). */
  setStarsOnly(on) { this.starsOnly = !!on; return this.starsOnly; }

  markers() {
    return this.shops.filter((s) => !this.starsOnly || s.star).map((s) => ({ x: s.x, z: s.z, kind: 'shop' }));
  }
}
