/**
 * The interior furniture kit: a fixed vocabulary of procedural shapes.
 *
 * Everything here is built from primitives, the same way src/characters.js and
 * src/devworld.js are. Nothing is loaded from a model file. A room is then a
 * JSON list of placements, which is what keeps the art style consistent for
 * free and keeps authoring a room to writing data.
 */
import * as THREE from 'three';

export const PALETTES = {
  'warm-wood': { floor: 0x7a5230, wall: 0xd9c7a3, trim: 0x4a3320, light: 0xffd9a0 },
  'cool-concrete': { floor: 0x6e7376, wall: 0xb9c0c4, trim: 0x3b4145, light: 0xd8ecff },
  'bright-retail': { floor: 0xe8e4dc, wall: 0xf6f3ec, trim: 0xc4bcae, light: 0xffffff },
};

const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

/** Box helper: centred on x/z, sitting on the floor, height h. */
const slab = (w, h, d, color, y = h / 2) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.y = y;
  return m;
};

/**
 * Each kind reads its own dimensions off the spec with a sensible default, so a
 * layout can say `{ kind: 'table' }` and get a table, or override any extent.
 * `box` is the collision footprint in local space; the caller rotates it.
 */
export const KIND = {
  counter: (s) => {
    const w = s.w ?? 3, d = s.d ?? 0.8, h = s.h ?? 1.05;
    const g = new THREE.Group();
    g.add(slab(w, h, d, 0x6b4a2f));
    g.add(slab(w + 0.12, 0.06, d + 0.12, 0x2f2016, h + 0.03));
    return { group: g, box: { w, d } };
  },
  table: (s) => {
    const w = s.w ?? 1.2, d = s.d ?? 1.2, h = s.h ?? 0.75;
    const g = new THREE.Group();
    g.add(slab(w, 0.06, d, 0x8a6236, h));
    const leg = (dx, dz) => { const l = slab(0.08, h, 0.08, 0x4a3320, h / 2); l.position.x = dx; l.position.z = dz; g.add(l); };
    leg(w / 2 - 0.12, d / 2 - 0.12); leg(-(w / 2 - 0.12), d / 2 - 0.12);
    leg(w / 2 - 0.12, -(d / 2 - 0.12)); leg(-(w / 2 - 0.12), -(d / 2 - 0.12));
    return { group: g, box: { w, d } };
  },
  chair: (s) => {
    const w = s.w ?? 0.45, d = s.d ?? 0.45;
    const g = new THREE.Group();
    g.add(slab(w, 0.06, d, 0x8a6236, 0.45));
    // NB: Object3D.add() returns the PARENT, not the child, so the offset has to
    // be applied to the mesh before it is added. `g.add(mesh).position.z = …`
    // silently moves the whole chair instead of its back.
    const back = slab(w, 0.5, 0.06, 0x8a6236, 0.7);
    back.position.z = -(d / 2 - 0.03);
    g.add(back);
    return { group: g, box: { w, d } };
  },
  stool: (s) => {
    const r = (s.w ?? 0.34) / 2, h = s.h ?? 0.68;
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 12), mat(0x8a6236));
    top.position.y = h; g.add(top);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 8), mat(0x3a3a3a));
    post.position.y = h / 2; g.add(post);
    return { group: g, box: { w: r * 2, d: r * 2 } };
  },
  shelf: (s) => {
    const w = s.w ?? 1.6, d = s.d ?? 0.35, h = s.h ?? 2.0;
    const g = new THREE.Group();
    const backPanel = slab(w, h, 0.05, 0x5c4126, h / 2);
    backPanel.position.z = -(d / 2);          // set before add(); see the note on `chair`
    g.add(backPanel);
    for (let i = 1; i <= 3; i++) g.add(slab(w, 0.05, d, 0x6b4a2f, (h / 4) * i));
    return { group: g, box: { w, d } };
  },
  crate: (s) => {
    const w = s.w ?? 0.6, d = s.d ?? 0.6, h = s.h ?? 0.6;
    return { group: new THREE.Group().add(slab(w, h, d, 0x9a7645)), box: { w, d } };
  },
  plant: (s) => {
    const r = (s.w ?? 0.5) / 2;
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.55, 0.4, 10), mat(0x8c5a3c));
    pot.position.y = 0.2; g.add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(0x3f7a3f));
    leaf.position.y = 0.4 + r * 0.8; leaf.scale.y = 1.3; g.add(leaf);
    return { group: g, box: { w: r * 1.4, d: r * 1.4 } };
  },
  rug: (s) => {
    const w = s.w ?? 2.4, d = s.d ?? 1.6;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0x7d3b3b));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.raycast = () => {};
    return { group: new THREE.Group().add(m), box: null };   // walk straight over it
  },
  lamp: (s) => {
    const h = s.h ?? 2.6;
    const g = new THREE.Group();
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.26, 12, 1, true), mat(0x2b2b2b, { side: THREE.DoubleSide }));
    shade.position.y = h; g.add(shade);
    const bulb = new THREE.PointLight(0xffd9a0, 12, 9, 2);
    bulb.position.y = h - 0.16; g.add(bulb);
    return { group: g, box: null };                          // hangs above head height
  },
  sign: (s) => {
    const w = s.w ?? 1.6, h = s.h ?? 0.4;
    const m = slab(w, h, 0.06, 0x1c1c1c, s.y ?? 2.6);
    return { group: new THREE.Group().add(m), box: null };
  },
  window: (s) => {
    const w = s.w ?? 1.4, h = s.h ?? 1.3;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    m.position.y = s.y ?? 1.5; m.raycast = () => {};
    return { group: new THREE.Group().add(m), box: null };
  },
  door: (s) => {
    const w = s.w ?? 1.1, h = s.h ?? 2.1;
    const m = slab(w, h, 0.08, 0x3a2a1a, h / 2);
    return { group: new THREE.Group().add(m), box: null };   // you must be able to walk out
  },
};

export const KINDS = Object.keys(KIND);

/**
 * Build one prop and place it. Rotation is degrees clockwise seen from above,
 * which is -y in three.js. The collision box is axis-aligned, so a prop rotated
 * off the axes gets its extents swapped at right angles and otherwise keeps its
 * footprint: exact enough for furniture, and far cheaper than oriented boxes.
 */
export function buildProp(spec) {
  const make = KIND[spec.kind];
  if (!make) throw new Error(`unknown interior prop kind: ${spec.kind}`);
  const { group, box } = make(spec);
  const rot = spec.rot ?? 0;
  group.position.set(spec.x ?? 0, 0, spec.z ?? 0);
  group.rotation.y = -THREE.MathUtils.degToRad(rot);
  if (!box) return { group, box: null };
  // True axis-aligned bounds of the ROTATED footprint, not a width/depth swap.
  // A swap is only right at multiples of 90. At 45 degrees it returns the
  // unrotated extents, which under-covers the prop and lets a player clip a
  // corner. This form reduces to (w, d) at 0 and (d, w) at 90, so cardinal
  // rotations are unchanged, and it degrades correctly at every angle between.
  const rad = THREE.MathUtils.degToRad(rot);
  const c = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
  return {
    group,
    box: {
      x: spec.x ?? 0,
      z: spec.z ?? 0,
      w: box.w * c + box.d * sn,
      d: box.w * sn + box.d * c,
    },
  };
}

// Photographs are the first real textures in this project; everything else is a
// CanvasTexture drawn at runtime. Cache by URL so re-entering a room is free.
const _texCache = new Map();
const _loader = new THREE.TextureLoader();

function photo(url) {
  let t = _texCache.get(url);
  if (!t) {
    t = _loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    _texCache.set(url, t);
  }
  return t;
}

/** north is -z, south is +z, east is +x, west is -x. See src/minimap.js:5. */
const WALL_AT = {
  north: (w, d) => ({ pos: [0, 0, -d / 2], rotY: 0 }),
  south: (w, d) => ({ pos: [0, 0, d / 2], rotY: Math.PI }),
  east: (w, d) => ({ pos: [w / 2, 0, 0], rotY: -Math.PI / 2 }),
  west: (w, d) => ({ pos: [-w / 2, 0, 0], rotY: Math.PI / 2 }),
};

/**
 * Assemble a room: shell, props, and photographs hung on the walls.
 * The group's origin is the room centre at floor level, so the caller only has
 * to position it at the door's ground point.
 *
 * NOT node-safe once `art` is non-empty: TextureLoader.load reaches for
 * `document`. KIND and buildProp are node-safe and are what the layout
 * validator imports; do not write a node test that calls buildRoom with art.
 */
export function buildRoom(layout, baseUrl) {
  const { w, d, h } = layout.size;
  const pal = PALETTES[layout.palette] || PALETTES['warm-wood'];
  const group = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), mat(pal.floor));
  floor.position.y = -0.1;
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), mat(pal.trim));
  ceil.position.y = h + 0.1;
  group.add(ceil);

  // Walls face inward. BackSide would be cheaper but then the ground raycast
  // finds nothing to stand on when the player is pressed against one.
  for (const [name, at] of Object.entries(WALL_AT)) {
    const { pos, rotY } = at(w, d);
    const span = name === 'north' || name === 'south' ? w : d;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(span, h, 0.2), mat(pal.wall));
    wall.position.set(pos[0], h / 2, pos[2]);
    wall.rotation.y = rotY;
    group.add(wall);
  }

  const boxes = [];
  for (const spec of (layout.props || [])) {
    const { group: g, box } = buildProp(spec);
    group.add(g);
    if (box) boxes.push(box);
  }

  for (const a of (layout.art || [])) {
    const at = WALL_AT[a.wall];
    if (!at) throw new Error(`unknown wall: ${a.wall}`);
    const { pos, rotY } = at(w, d);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(a.w, a.h),
      new THREE.MeshBasicMaterial({ map: photo(baseUrl + a.src) }),
    );
    // Half the 0.2 m wall (its centre line is the room half-extent, so its inner
    // face is 0.1 m in) plus 6 cm, which is the gap that stops the z-fighting.
    const inset = 0.16;
    // `along` is the offset ALONG the wall, which lands on world x for the north
    // and south walls and on world z for east and west. Naming it `x` made a
    // value that becomes a z coordinate read like an x one.
    plane.position.set(
      pos[0] === 0 ? (a.along ?? 0) : pos[0] - Math.sign(pos[0]) * inset,
      a.y ?? 1.7,
      pos[2] === 0 ? (a.along ?? 0) : pos[2] - Math.sign(pos[2]) * inset,
    );
    plane.rotation.y = rotY;
    plane.raycast = () => {};
    group.add(plane);
  }

  // A soft fill so the room is never pitch black when a layout defines no lamp.
  const fill = new THREE.HemisphereLight(pal.light, pal.floor, 1.1);
  group.add(fill);

  // The clamp is this room's collision system; the ground raycast is only ever
  // meant to answer "how high is the floor". Leaving props and the ceiling
  // raycastable produced a hard stick: the probe starts 3 m above the player, so
  // stepping onto the 2 m shelf put it above the 4 m ceiling slab, it found the
  // slab's TOP face, and the step-up rule snapped the player onto the roof. The
  // camera clamp then held the view below the ceiling, so you were left staring
  // into it, unable to turn or get down. Only the floor answers the probe.
  group.traverse((o) => { if (o.isMesh && o !== floor) o.raycast = () => {}; });

  return { group, boxes, size: { w, d, h } };
}
