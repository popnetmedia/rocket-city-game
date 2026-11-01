import * as THREE from 'three';
import { activeCity } from './cities/index.js';

/**
 * ALPR (license-plate reader) camera layer — the DeFlock dataset. The baked file and
 * the fallback's bounding box both come from the active city, so a second city loads
 * its own cameras instead of Huntsville's. Data is OSM-derived (ODbL) via DeFlock.me.
 *
 * Rendering is deliberately zero-cost per frame: every camera beam is built ONCE
 * at load as a tall column spanning all local terrain heights (no ground raycasts,
 * so beams never lag or vanish while flying). Red triangles on the minimap.
 */
const REGION_URL = 'https://cdn.deflock.me/regions/20/-100.json';
const EMPTY = [];   // shared, so a disabled layer allocates nothing per frame

/** Bounding box around the active city's playable lobes, with a little slack. */
function cityBounds() {
  const lobes = activeCity().border.lobes;
  let latMin = Infinity, latMax = -Infinity, lonMin = Infinity, lonMax = -Infinity;
  for (const l of lobes) {
    const dLat = l.r / 111320, dLon = l.r / 91600;
    latMin = Math.min(latMin, l.lat - dLat); latMax = Math.max(latMax, l.lat + dLat);
    lonMin = Math.min(lonMin, l.lon - dLon); lonMax = Math.max(lonMax, l.lon + dLon);
  }
  return { latMin, latMax, lonMin, lonMax };
}
const BEAM_BASE = -150;   // scene-Y bottom of the beam (below the lowest local terrain)
const BEAM_TOP = 260;     // scene-Y top
const CONE_DIR = true;    // orient the little head to the mapped direction

export class ALPRLayer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.enabled = true;
    this.cams = [];        // { x, z, dir } — for the minimap + Ghost Run
    this.count = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    if (world.tiles) this._load();
  }

  async _load() {
    let list = null;
    const baked = activeCity().alpr;
    if (baked) {
      try { const r = await fetch(baked); if (r.ok) list = await r.json(); } catch { /* none */ }
    }
    if (!list) {
      try {
        const r = await fetch(REGION_URL);
        if (r.ok) {
          const all = await r.json();
          const B = cityBounds();
          list = all.filter((e) => e.lat > B.latMin && e.lat < B.latMax && e.lon > B.lonMin && e.lon < B.lonMax)
            .map((e) => [e.lat, e.lon, (e.tags && e.tags.direction != null) ? +e.tags.direction || 0 : 0]);
        }
      } catch { /* offline — layer stays empty */ }
    }
    if (!list || !list.length) return;
    const v = new THREE.Vector3();
    this.cams = list.map(([lat, lon, dir]) => { this.world.geoToSceneFlat(lat, lon, v); return { x: v.x, z: v.z, lat, lon, dir: ((+dir || 0) * Math.PI) / 180 }; });
    this.count = this.cams.length;
    // The map deliberately shows every camera, including ones beyond the playable border —
    // that is the point of a surveillance map. The HUNT, though, can only ever score the
    // ones a player can fly to, so it counts those separately. Huntsville's set has 113
    // unreachable cameras; scoring them made "FIND THE FLOCK" impossible to finish.
    // cams[] itself is never filtered: claimed progress is stored as indexes into it.
    const { lobes, nofly = [] } = activeCity().border;
    const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 91600);
    for (const c of this.cams) {
      c.inPlay = lobes.some((l) => dist(c, l) <= l.r) && !nofly.some((z) => dist(c, z) < z.r);
    }
    this.huntCount = this.cams.filter((c) => c.inPlay).length;
    this._build();
  }

  _build() {
    const n = this.count;
    const midY = (BEAM_BASE + BEAM_TOP) / 2, h = BEAM_TOP - BEAM_BASE;
    // tall translucent beam + brighter thin core, both open cylinders (read from any side)
    const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, h, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: false, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }), n);
    const cores = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, h, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false }), n);
    this._colFound = new THREE.Color(0x39ff88); this._colUnfound = new THREE.Color(0xff2233);
    this._coreFound = new THREE.Color(0x8dffb8); this._coreUnfound = new THREE.Color(0xff4455);
    // small camera head near ground level (a marker, not ground-accurate — cheap, no raycast)
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.32, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x111316, fog: false }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    this.beams = beams; this.cores = cores; this._h = h; this._midY = midY;
    this.cams.forEach((c, i) => {
      m.compose(pos.set(c.x, midY, c.z), q, s);
      beams.setMatrixAt(i, m); cores.setMatrixAt(i, m);
      const found = this._claimed && this._claimed.has(i);
      beams.setColorAt(i, found ? this._colFound : this._colUnfound);
      cores.setColorAt(i, found ? this._coreFound : this._coreUnfound);
      if (CONE_DIR) q.setFromAxisAngle(up, -c.dir);
      m.compose(pos.set(c.x, 3, c.z), q, s); heads.setMatrixAt(i, m);
      q.identity();
    });
    for (const mm of [beams, cores, heads]) { mm.raycast = () => {}; this.group.add(mm); }
    beams.instanceColor.needsUpdate = true; cores.instanceColor.needsUpdate = true;
  }

  /** Pass the set of already-claimed camera indexes before/after load so found beams show green. */
  setClaimed(set) { this._claimed = set; if (this.beams) for (const i of set) this.markClaimed(i); }
  markClaimed(i) {
    if (!this.beams || i >= this.cams.length) return;
    this.beams.setColorAt(i, this._colFound); this.cores.setColorAt(i, this._coreFound);
    this.beams.instanceColor.needsUpdate = true; this.cores.instanceColor.needsUpdate = true;
  }

  setEnabled(on) { this.enabled = on; this.group.visible = on; }

  update() { /* nothing per frame — beams are static */ }

  /**
   * Cameras never move, so this array is built once rather than re-mapped every call.
   * With 914 of them in Miami the old version allocated ~55,000 objects a second.
   */
  markers() {
    if (!this.enabled) return EMPTY;
    if (!this._markerCache || this._markerCache.length !== this.cams.length) {
      this._markerCache = this.cams.map((c) => ({ x: c.x, z: c.z, kind: 'cam', alpr: true }));
    }
    return this._markerCache;
  }

  /** Nearest camera within `radius` metres of a scene point, or null. */
  nearest(pos, radius = 60) {
    let best = null, bd = radius;
    for (const c of this.cams) { const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d < bd) { bd = d; best = c; } }
    return best;
  }
}
