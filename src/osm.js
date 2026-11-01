import * as THREE from 'three';
import { activeCity } from './cities/index.js';

/**
 * City detail from OpenStreetMap (Overpass API), drawn over the melted Google photogrammetry:
 *  - buildings: translucent crisp WALLS + edge lines (no roof cap — the photo roof shows through)
 *  - trees: low-poly instanced trunk+canopy at natural=tree nodes
 *  - roads: flat asphalt ribbons by highway class
 *
 * Performance model: nothing is added to the scene until its ground height is known
 * (probes are budgeted per frame); resolved features are baked into ONE merged mesh
 * per kind per cell (walls / edges / roads, vertex-colored, shared materials), so a
 * whole cell costs ~5 draw calls. Merged wall geometry gets a BVH for cheap raycasts.
 *
 * Real-tiles mode only. Data © OpenStreetMap contributors (ODbL) — attributed in the HUD.
 */
const CELL = 600;
// A theme park is mapped in far more detail than a downtown: OSM has every kiosk, ticket
// booth, restroom and shade sail. Drawn as walls they became "borders around everything
// on the ground" at Animal Kingdom, where 60 of 123 buildings in one cell are under
// 50 m2. Anything smaller than this reads as outline noise from the air, never a
// building, so it is not drawn.
const MIN_FOOTPRINT = 60;   // m2
// Residential stock is never drawn. Huntsville's baked cells hold 2,501 buildings of
// which 2% carry a real height and 1,143 are explicitly houses, garages or sheds — so a
// suburb rendered as a field of translucent boxes at a guessed 5-13 m, which is what it
// looked like. building=yes is ambiguous: downtown it is a real building, in a
// subdivision it is an untyped house, so it has to earn its place on footprint.
const RESIDENTIAL = new Set([
  'house', 'houses', 'residential', 'detached', 'semidetached_house', 'terrace',
  'bungalow', 'cabin', 'garage', 'garages', 'shed', 'carport', 'hut', 'roof',
]);
const MIN_UNTYPED = 400;    // m2 — building=yes below this is a house


/**
 * Whether this city draws OSM building walls. Read lazily — never at module scope —
 * so a city switch picks up the new city.
 *
 * Heights are the reason this is a per-city choice. Only 0.5% of Huntsville's buildings
 * and 4.7% of Orlando's carry a real height/levels tag, so almost every wall is drawn at
 * a 5-13 m guess. Downtown Huntsville genuinely is two to four storeys, so the guess
 * reads as a skyline. A theme park is show buildings and low themed facades, so the same
 * guess reads as low outlines tracing footprints — "borders around everything on the
 * ground". Roads, labels and trees still draw; only the walls are dropped.
 */
const buildingsOn = () => activeCity().meta.osmBuildings !== false;
const UNLOAD_DIST = 2000;
const FETCH_COOLDOWN = 4000;
const PROBE_BUDGET = 14;          // ground raycasts per frame across all pending features
const REBUILD_INTERVAL = 800;     // ms between merged-geometry rebuilds per cell
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const ROAD_WIDTH = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 9, residential: 7, unclassified: 6, service: 4 };
const MAJOR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary']);
// Streets that get a name painted on the tarmac. Everything except service
// roads/alleys, so you can always tell which street you're standing on.
const NAMED_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified']);
const WALL_PALETTE = [0xbfd8e8, 0xc9e0d4, 0xdcd2c0, 0xd0cfe0, 0xd8e2ea];

/** Billboard sign: dark plate, glowing text. */
export function makeSign(text, { color = '#39ff88', big = false } = {}) {
  const c = document.createElement('canvas');
  const pad = 30; const MAXW = 1600; let fs = big ? 88 : 58;
  const g0 = c.getContext('2d'); g0.font = `bold ${fs}px Menlo, monospace`;
  let tw = g0.measureText(text).width;
  if (tw + pad * 2 > MAXW) { fs = Math.max(30, Math.floor(fs * (MAXW - pad * 2) / tw)); g0.font = `bold ${fs}px Menlo, monospace`; tw = g0.measureText(text).width; }
  c.width = Math.ceil(tw) + pad * 2; c.height = fs + pad * 1.5;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(4,10,14,0.82)'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.font = `bold ${fs}px Menlo, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 22;
  g.fillStyle = color;
  // draw a few times to fatten the strokes — reads noticeably bolder in 3D
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  g.shadowBlur = 0; g.lineWidth = 2.5; g.strokeStyle = color;
  g.strokeText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 0 }));
  const worldW = (big ? 0.07 : 0.047) * c.width;
  spr.scale.set(worldW, worldW * c.height / c.width, 1);
  spr.renderOrder = 5;
  spr.raycast = () => {};
  return spr;
}

/**
 * Flat map-style road label. Textures are CACHED BY NAME — a road is split into
 * many OSM ways across many cells, so without this we'd upload the same texture
 * dozens of times. One texture per unique name, reused everywhere.
 */
const _roadTexCache = new Map();
function roadLabelTexture(text) {
  let tex = _roadTexCache.get(text);
  if (tex) return tex;
  const c = document.createElement('canvas');
  const fs = 40, pad = 12;
  const g0 = c.getContext('2d'); g0.font = `600 ${fs}px Menlo, monospace`;
  c.width = Math.min(768, Math.ceil(g0.measureText(text).width) + pad * 2);
  c.height = fs + pad;
  const g = c.getContext('2d');
  g.font = `600 ${fs}px Menlo, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  // Thin dark outline for legibility over pale tarmac, no glow — these sit flat
  // on the road and should read like paint, not like a HUD element.
  g.lineWidth = 5; g.strokeStyle = 'rgba(3,8,12,0.55)';
  g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = 'rgba(238,246,241,0.95)';
  g.fillText(text, c.width / 2, c.height / 2);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  _roadTexCache.set(text, tex);
  return tex;
}
/**
 * Street name painted flat on the road, aligned to its bearing. `major` scales
 * it up a little so arterials still read from altitude.
 */
function makeRoadLabel(text, rot, major) {
  const tex = roadLabelTexture(text);
  const w = tex.image.width, h = tex.image.height;
  const worldW = (major ? 0.30 : 0.20) * w;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldW * h / w),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;   // lay it on the tarmac
  mesh.rotation.z = rot;            // ...pointing along the street
  mesh.renderOrder = 3;
  mesh.raycast = () => {};
  mesh.userData.major = major;
  return mesh;
}

export class OSMBuildings {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.enabled = true;
    this.group = new THREE.Group();
    this.group.name = 'OSMBuildings';
    scene.add(this.group);
    world.extraCollision = this.group;
    this.cells = new Map();       // key -> { group, pending:[], walls:[], edges:[], roads:[], dirty, lastBuild, wallMesh, edgeMesh, roadMesh, n }
    this.pending = new Set();
    this.failedAt = -1e9;
    this.lastFetch = 0;
    this.endpoint = 0;
    this.count = 0;
    this.signs = [];              // { spr, name, range }
    this.beacons = [];            // { spr, beam, range } — park-scale wayfinding, see addSkyBeacon
    this.roadSigns = [];          // { spr, name } — major-road labels, own budget
    this.roadLines = [];          // world-space polylines [[x,z],...] for AI traffic
    this.cameras = [];            // { x, z, alpr } for the minimap
    this.zoneName = null; this._zoneShown = new Map();
    this.onZone = null;
    this._tmp = new THREE.Vector3();
    this._wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, flatShading: true });
    this._edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
    this._roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this._trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4a34, roughness: 0.9 });
    this._canopyMat = new THREE.MeshStandardMaterial({ color: 0x3f7d44, roughness: 0.9, flatShading: true });
  }

  setEnabled(on) { this.enabled = on; this.group.visible = on; }

  update(playerPos) {
    if (!this.enabled || !this.world.tiles) return;
    const now = performance.now();
    const cx = Math.round(playerPos.x / CELL), cz = Math.round(playerPos.z / CELL);
    if (now - this.lastFetch > FETCH_COOLDOWN && now - this.failedAt > 30000) {
      outer: for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const key = `${cx + dx},${cz + dz}`;
        if (!this.cells.has(key) && !this.pending.has(key)) { this._fetchCell(cx + dx, cz + dz, key); this.lastFetch = now; break outer; }
      }
    }

    // unload far cells
    for (const [key, cell] of this.cells) {
      if (!cell.group) continue;
      const [kx, kz] = key.split(',').map(Number);
      if (Math.hypot(kx * CELL - playerPos.x, kz * CELL - playerPos.z) > UNLOAD_DIST) {
        this._disposeCell(cell);
        this._disposeCellRoads(key);
        this.cells.delete(key);
      }
    }

    // resolve pending features (ground probes, budgeted) and rebuild dirty cells
    let budget = PROBE_BUDGET;
    for (const cell of this.cells.values()) {
      if (!cell.group) continue;
      while (budget > 0 && cell.pending.length > 0) {
        const f = cell.pending[0];
        const cost = f.kind === 'building' ? f.probes.length : 1;
        if (cost > budget) break;
        budget -= cost;
        const base = this._probeBase(f);
        if (base === null) { cell.pending.push(cell.pending.shift()); break; } // ground not streamed yet; rotate
        cell.pending.shift();
        this._bake(cell, f, base);
        cell.dirty = true;
      }
      if (cell.dirty && now - (cell.lastBuild || 0) > REBUILD_INTERVAL) this._rebuild(cell, now);
      // trees settle per-instance
      if (cell.trees && !cell.trees.doneAll && budget > 0) budget = this._settleTrees(cell, budget);
    }

    // signs fade + zone detection. Declutter rule: only the nearest few labels
    // within range ever fade in at once, so dense areas don't turn into a wall
    // of overlapping names (same idea as the Bridge Street shop band).
    const MAX_LABELS = 2;
    let nearest = null, nearestD = 1e9;
    const live = [];
    for (let i = this.signs.length - 1; i >= 0; i--) {
      const sg = this.signs[i];
      if (!sg.spr.parent) { this.signs.splice(i, 1); continue; }
      sg._d = Math.hypot(sg.spr.position.x - playerPos.x, sg.spr.position.z - playerPos.z);
      live.push(sg);
    }
    const shown = new Set(live.filter((sg) => sg._d < sg.range).sort((a, b) => a._d - b._d).slice(0, MAX_LABELS));
    for (const sg of live) {
      const d = sg._d;
      const target = shown.has(sg) ? Math.min(1, (sg.range - d) / 35) : 0;
      const m = sg.spr.material;
      m.opacity += (target - m.opacity) * 0.15;
      sg.spr.visible = m.opacity > 0.02;
      if (d < sg.range * 0.7 && d < nearestD) { nearestD = d; nearest = sg.name; }
    }
    // Sky beacons: deliberately NOT part of the MAX_LABELS declutter above. Those
    // cap at two and die off past a few hundred metres, which is right for street
    // signage and useless for "which way is Animal Kingdom" across a 15 km resort.
    // These stay lit from kilometres out, then fade as you arrive — once you are over
    // the park the land names take over, and a 300 m sign overhead is just in the way.
    for (const b of this.beacons) {
      const d = Math.hypot(b.spr.position.x - playerPos.x, b.spr.position.z - playerPos.z);
      let t = Math.min(1, (b.range - d) / (b.range * 0.5));
      if (d < 1600) t *= Math.max(0, (d - 700) / 900);
      t = Math.max(0, Math.min(1, t));
      const m = b.spr.material;
      m.opacity += (t - m.opacity) * 0.08;
      b.spr.visible = m.opacity > 0.02;
      // Grow the sign with distance so it holds a roughly constant size on screen.
      // A plain world-space sprite shrinks with perspective, which is precisely wrong
      // for a marker whose whole job is to be readable from the far side of the resort:
      // at 12 km a fixed sign is a few pixels of mush.
      // 780 is not arbitrary: apparent height works out to
      //   scale.y / divisor * (viewH/2) / tan(fov/2)
      // which for this sign geometry lands at ~34 px tall — big enough to letter out
      // "HOLLYWOOD STUDIOS" across the resort. The cap has to clear range/divisor
      // (22000/780 = 28) or the sign starts shrinking again at the far end.
      const k = Math.min(28, Math.max(1, d / 780));
      b.spr.scale.set(b.baseW * k, b.baseH * k, 1);
      b.beam.material.opacity = m.opacity * 0.38;
      b.beam.visible = b.spr.visible;
    }

    // Road labels: own budget so they don't crowd out landmark names. Only the
    // nearest few within range are ever visible — invisible sprites cost ~nothing.
    // Majors stay readable from altitude; minor streets only appear once you're
    // near them, so downtown reads as a few street names rather than a wall of text.
    const ROAD_RANGE = 900, MINOR_RANGE = 260, ROAD_MAX = 14;
    const rlive = [];
    for (let i = this.roadSigns.length - 1; i >= 0; i--) {
      const rg = this.roadSigns[i];
      if (!rg.spr.parent) { this.roadSigns.splice(i, 1); continue; }
      rg._d = Math.hypot(rg.spr.position.x - playerPos.x, rg.spr.position.z - playerPos.z);
      rlive.push(rg);
    }
    const rshown = new Set(rlive.filter((r) => r._d < (r.major ? ROAD_RANGE : MINOR_RANGE))
      .sort((a, b) => a._d - b._d).slice(0, ROAD_MAX));
    for (const rg of rlive) {
      const range = rg.major ? ROAD_RANGE : MINOR_RANGE;
      // capped well below 1 — these are wayfinding hints, not signage
      const t = rshown.has(rg) ? Math.min(rg.major ? 0.5 : 0.42, (range - rg._d) / (range * 0.55)) : 0;
      const m = rg.spr.material;
      m.opacity += (t - m.opacity) * 0.12;
      rg.spr.visible = m.opacity > 0.02;
    }

    if (nearest && nearest !== this.zoneName) {
      const last = this._zoneShown.get(nearest) || -1e9;
      if (now - last > 20000) { this._zoneShown.set(nearest, now); this.onZone?.(nearest); }
    }
    this.zoneName = nearest;
  }

  _probeBase(f) {
    let base = 1e9, any = false;
    for (const [px, pz] of f.probes) {
      this._tmp.set(px, 400, pz);
      const hit = this.world.groundBelow(this._tmp, 1200, true);
      if (hit) { base = Math.min(base, hit.point.y); any = true; }
    }
    return any ? base : null;
  }

  _bake(cell, f, base) {
    if (f.kind === 'building') {
      const y0 = base - 0.8, y1 = base - 0.8 + f.h;
      const c = f.color;
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [ax, az] = f.pts[i], [bx, bz] = f.pts[i + 1];
        // two triangles per wall quad, absolute coords
        cell.walls.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
        for (let k = 0; k < 6; k++) cell.wallCols.push(c.r, c.g, c.b);
        cell.edges.push(ax, y1, az, bx, y1, bz, ax, y0, az, ax, y1, az);
        for (let k = 0; k < 4; k++) cell.edgeCols.push(c.r * 0.8, c.g * 0.8, c.b * 0.8);
      }
      if (f.name) {
        const spr = makeSign(f.name.toUpperCase());
        spr.position.set(f.cx, y1 + 6, f.cz);
        cell.group.add(spr);
        this.signs.push({ spr, name: f.name.toUpperCase(), range: f.range });
      }
      this.count++;
      cell.n = (cell.n || 0) + 1;
    } else if (f.kind === 'camera') {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6), this._trunkMat);
      pole.position.y = 1.8;
      const cam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: f.alpr ? 0x1a1a1a : 0x3a3f45, roughness: 0.5 }));
      cam.position.set(0, 3.6, -0.1); cam.rotation.x = 0.35;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
      eye.position.set(0, 3.55, -0.32);
      g.add(pole, cam, eye);
      g.position.set(f.x, base, f.z);
      g.traverse((o) => { o.raycast = () => {}; });
      cell.group.add(g);
      this.cameras.push({ x: f.x, z: f.z, alpr: f.alpr });
      this.count++;
    } else if (f.kind === 'roadlabel') {
      const spr = makeRoadLabel(f.name, f.rot || 0, !!f.major);
      spr.position.set(f.x, base + 0.35, f.z);   // just above the road ribbon (base + 0.25)
      cell.group.add(spr);
      this.roadSigns.push({ spr, name: f.name, major: !!f.major });
    } else if (f.kind === 'road') {
      const y = base + 0.25;
      const [p0, p1] = f.seg, w = f.w / 2;
      const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len * w, nz = dx / len * w;
      const a = [p0[0] + nx, y, p0[1] + nz], b = [p0[0] - nx, y, p0[1] - nz];
      const c2 = [p1[0] - nx, y, p1[1] - nz], d2 = [p1[0] + nx, y, p1[1] + nz];
      cell.roads.push(...a, ...b, ...c2, ...a, ...c2, ...d2);
    }
  }

  _rebuild(cell, now) {
    cell.lastBuild = now; cell.dirty = false;
    const swap = (old, geoArr, colArr, make) => {
      if (old) { cell.group.remove(old); old.geometry.disposeBoundsTree?.(); old.geometry.dispose(); }
      if (geoArr.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(geoArr, 3));
      if (colArr) geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      const obj = make(geo);
      cell.group.add(obj);
      return obj;
    };
    cell.wallMesh = swap(cell.wallMesh, cell.walls, cell.wallCols, (geo) => {
      geo.computeVertexNormals();
      try { geo.computeBoundsTree({ maxLeafTris: 16 }); } catch { /* ok */ }
      const m = new THREE.Mesh(geo, this._wallMat); m.renderOrder = 2; return m;
    });
    cell.edgeMesh = swap(cell.edgeMesh, cell.edges, cell.edgeCols, (geo) => {
      const l = new THREE.LineSegments(geo, this._edgeMat); l.raycast = () => {}; return l;
    });
    cell.roadMesh = swap(cell.roadMesh, cell.roads, null, (geo) => {
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this._roadMat); m.renderOrder = 1; m.raycast = () => {}; return m;
    });
  }

  _disposeCellRoads(key) { this.roadLines = this.roadLines.filter((l) => l._cell !== key); }

  _disposeCell(cell) {
    // drop this cell's cameras from the minimap list
    this.cameras = this.cameras.filter((c) => !cell.group.children.some((g) => g.position && g.position.x === c.x && g.position.z === c.z));
    this.group.remove(cell.group);
    cell.group.traverse((o) => {
      o.geometry?.disposeBoundsTree?.();
      o.geometry?.dispose();
      if (o.material && o.material.map && o.isSprite) { o.material.map.dispose(); o.material.dispose(); }
    });
    this.count -= cell.n || 0;
  }

  async _fetchCell(cx, cz, key) {
    this.pending.add(key);
    this.cells.set(key, {});
    try {
      // Prefer the pre-baked static snapshot (scripts/bake-osm.mjs) — zero external load.
      // The key is a SCENE-space cell index, so it means a different place in every city:
      // unscoped, cell 0,-1 served Huntsville's streets to Chattanooga and Knoxville.
      try {
        const baked = await fetch(`/osm/${activeCity().meta.id}/${key}.json`);
        if (baked.ok) {
          const json = await baked.json();
          this._ingest(json.elements || [], key);
          this.pending.delete(key);
          return;
        }
      } catch { /* fall through to live Overpass */ }
      const centre = this.world.sceneToGeo(this._tmp.set(cx * CELL, 0, cz * CELL));
      const r = Math.round(CELL * 0.72);
      const at = `(around:${r},${centre.lat.toFixed(6)},${centre.lon.toFixed(6)})`;
      const q = `[out:json][timeout:20];(way["building"]${at};node["natural"="tree"]${at};way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"]${at};);out geom 1500;`;
      const res = await fetch(ENDPOINTS[this.endpoint % ENDPOINTS.length], {
        method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) throw new Error('overpass ' + res.status);
      const json = await res.json();
      this._ingest(json.elements || [], key);
    } catch {
      this.cells.delete(key);
      this.failedAt = performance.now();
      this.endpoint++;
    } finally {
      this.pending.delete(key);
    }
  }

  _ingest(elements, key) {
    const cell = {
      group: new THREE.Group(),
      pending: [], walls: [], wallCols: [], edges: [], edgeCols: [], roads: [],
      dirty: false, lastBuild: 0, wallMesh: null, edgeMesh: null, roadMesh: null, n: 0,
    };
    const v = new THREE.Vector3();
    const treePts = [];
    const seenRoadNames = new Set();   // one label per road name per cell
    for (const el of elements) {
      const tags = el.tags || {};
      if (el.type === 'node' && tags.natural === 'tree') {
        this.world.geoToSceneFlat(el.lat, el.lon, v);
        treePts.push([v.x, v.z, 5 + (el.id % 5)]);
      } else if (el.type === 'node' && tags.man_made === 'surveillance') {
        // ALPR / surveillance cameras — the same OSM data DeFlock maps.
        this.world.geoToSceneFlat(el.lat, el.lon, v);
        const alpr = (tags['surveillance:type'] || '').toUpperCase() === 'ALPR' || /flock/i.test(tags.manufacturer || tags.brand || '');
        cell.pending.push({ kind: 'camera', x: v.x, z: v.z, alpr, probes: [[v.x, v.z]] });
      } else if (el.type === 'way' && tags.building && el.geometry?.length >= 4) {
        // building=roof is a canopy: a shade structure standing on posts, with no walls.
        // Extruding walls under one draws a box around open ground — wrong by definition,
        // and theme parks are full of them.
        if (!buildingsOn()) continue;
        if (RESIDENTIAL.has(tags.building)) continue;
        const pts = el.geometry.map((p) => { this.world.geoToSceneFlat(p.lat, p.lon, v); return [v.x, v.z]; });
        // shoelace area, in scene metres
        let a2 = 0;
        for (let i = 0; i < pts.length; i++) {
          const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
          a2 += x1 * z2 - x2 * z1;
        }
        const areaM2 = Math.abs(a2) / 2;
        if (areaM2 < MIN_FOOTPRINT) continue;
        if (tags.building === 'yes' && areaM2 < MIN_UNTYPED) continue;
        let mx = 0, mz = 0; for (const [x, z] of pts) { mx += x; mz += z; } mx /= pts.length; mz /= pts.length;
        let h = parseFloat(tags.height) || (parseInt(tags['building:levels'], 10) || 0) * 3.2;
        if (!h || Number.isNaN(h)) h = 5 + ((el.id % 7) * 1.4);
        h = Math.min(h, 120);
        let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, footR = 0;
        for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); footR = Math.max(footR, Math.hypot(x - mx, z - mz)); }
        cell.pending.push({
          kind: 'building', pts, cx: mx, cz: mz, h, footR,
          name: tags.name || null, range: Math.max(55, footR + 35),
          color: new THREE.Color(WALL_PALETTE[el.id % WALL_PALETTE.length]),
          probes: [[mx, mz], [minX - 3, minZ - 3], [maxX + 3, minZ - 3], [minX - 3, maxZ + 3], [maxX + 3, maxZ + 3]],
        });
      } else if (el.type === 'way' && tags.highway && el.geometry?.length >= 2) {
        const w = ROAD_WIDTH[tags.highway] || 6;
        const pts = el.geometry.map((p) => { this.world.geoToSceneFlat(p.lat, p.lon, v); return [v.x, v.z]; });
        if (tags.highway !== 'service' && pts.length >= 2) { const line = pts.map((q) => [q[0], q[1]]); line._cell = key; this.roadLines.push(line); }
        // Label MAJOR named roads only (motorway/trunk/primary/secondary), one per
        // name per cell — residential streets would be hundreds of labels for no gain.
        if (NAMED_ROADS.has(tags.highway) && tags.name && !seenRoadNames.has(tags.name)) {
          seenRoadNames.add(tags.name);
          const mi = Math.floor(pts.length / 2);
          const mid = pts[mi];
          // bearing of the segment at the midpoint, so the name reads along the street
          const a = pts[Math.max(0, mi - 1)], b = pts[Math.min(pts.length - 1, mi + 1)];
          let rot = -Math.atan2(b[1] - a[1], b[0] - a[0]);
          // keep text upright-ish rather than upside down
          if (rot > Math.PI / 2) rot -= Math.PI; else if (rot < -Math.PI / 2) rot += Math.PI;
          cell.pending.push({ kind: 'roadlabel', name: tags.name, x: mid[0], z: mid[1],
            rot, major: MAJOR_ROADS.has(tags.highway), probes: [[mid[0], mid[1]]] });
        }
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const nSeg = Math.max(1, Math.ceil(len / 60));
          for (let sIdx = 0; sIdx < nSeg; sIdx++) {
            const p0 = [a[0] + (b[0] - a[0]) * sIdx / nSeg, a[1] + (b[1] - a[1]) * sIdx / nSeg];
            const p1 = [a[0] + (b[0] - a[0]) * (sIdx + 1) / nSeg, a[1] + (b[1] - a[1]) * (sIdx + 1) / nSeg];
            const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
            cell.pending.push({ kind: 'road', seg: [p0, p1], w, probes: [mid] });
          }
        }
      }
    }
    this._addTrees(cell, treePts);
    this.cells.set(key, cell);
    this.group.add(cell.group);
  }

  _addTrees(cell, trees) {
    if (trees.length === 0) return;
    const n = trees.length;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1, 6), this._trunkMat, n);
    const canopies = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), this._canopyMat, n);
    trunks.raycast = () => {}; canopies.raycast = () => {};
    trunks.count = 0; canopies.count = 0; // grow as instances settle
    cell.group.add(trunks, canopies);
    cell.trees = { list: trees, trunks, canopies, next: 0, doneAll: false };
  }

  _settleTrees(cell, budget) {
    const st = cell.trees;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    while (budget > 0 && st.next < st.list.length) {
      const [x, z, h] = st.list[st.next];
      budget--;
      this._tmp.set(x, 400, z);
      const hit = this.world.groundBelow(this._tmp, 1200, true);
      if (!hit) break; // ground not ready here; try again next frame
      const gy = hit.point.y;
      const i = st.trunks.count;
      q.identity();
      sc.set(1, h * 0.35, 1); m.compose(pos.set(x, gy + h * 0.35 / 2, z), q, sc); st.trunks.setMatrixAt(i, m);
      sc.set(h * 0.32, h * 0.65, h * 0.32); m.compose(pos.set(x, gy + h * 0.35 + h * 0.65 / 2, z), q, sc); st.canopies.setMatrixAt(i, m);
      st.trunks.count = i + 1; st.canopies.count = i + 1;
      st.trunks.instanceMatrix.needsUpdate = true; st.canopies.instanceMatrix.needsUpdate = true;
      st.next++;
    }
    if (st.next >= st.list.length) st.doneAll = true;
    return budget;
  }
}

/**
 * Park-scale wayfinding marker: an oversized sign parked high in the sky with a light
 * column dropping to the ground, so a park is findable from the far side of the resort.
 *
 * `alt` is absolute scene Y, not height above ground. Every Orlando park sits within a
 * few metres of the same elevation, so a shared ceiling keeps the beacons level with
 * each other; a city with real terrain would want this ground-relative instead.
 */
OSMBuildings.prototype.addSkyBeacon = function (name, scenePos, { color = '#7fe7ff', alt = 820, range = 20000, scale = 4.2 } = {}) {
  const spr = makeSign(name.toUpperCase(), { color, big: true });
  spr.scale.multiplyScalar(scale);
  spr.position.set(scenePos.x, alt, scenePos.z);
  this.scene.add(spr);
  // The column is what actually reads at distance — the lettering is unresolvable long
  // before the beam is. depthTest stays on so terrain occludes it honestly; the sprite
  // does not, so the label still shows over a ridge.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(30, 110, alt, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.set(scenePos.x, alt / 2, scenePos.z);
  beam.raycast = () => {};
  this.scene.add(beam);
  this.beacons.push({ spr, beam, range, baseW: spr.scale.x, baseH: spr.scale.y });
};

/** Standalone landmark sign (not tied to an OSM building). Settles onto the ground. */
OSMBuildings.prototype.addLandmarkSign = function (name, scenePos, { color = '#ffb347', height = 30, range = 150 } = {}) {
  const spr = makeSign(name.toUpperCase(), { color, big: true });
  spr.position.set(scenePos.x, height, scenePos.z);
  this.scene.add(spr);
  const sg = { spr, name: name.toUpperCase(), range };
  this.signs.push(sg);
  const trySettle = () => {
    this._tmp.set(scenePos.x, 500, scenePos.z);
    const hit = this.world.groundBelow(this._tmp, 2000, true);
    if (hit) spr.position.y = hit.point.y + height;
    else setTimeout(trySettle, 2000);
  };
  trySettle();
};
