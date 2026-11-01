/**
 * Interiors: pause reasons, clamp geometry, and the per-city data contract.
 *
 * Everything exercised here is a pure module under src/interior/, never
 * src/world.js or src/interior.js. Those read import.meta.env at module scope,
 * which Vite supplies and node does not. Same reason golf.test.mjs imports
 * src/golf/clubs.js rather than src/golf.js.
 */
import assert from 'node:assert/strict';
import { PauseReasons } from '../src/interior/pause.js';

{
  const r = new PauseReasons();
  assert.equal(r.paused, false, 'holding nothing is not paused');
  r.add('idle');
  assert.equal(r.paused, true, 'one reason pauses');
}

{
  const r = new PauseReasons();
  r.add('interior');
  r.add('idle');
  r.delete('idle');
  assert.equal(r.paused, true, 'still paused while the interior holds its reason');
  r.delete('interior');
  assert.equal(r.paused, false, 'the last reason releasing unpauses');
}

{
  const r = new PauseReasons();
  r.add('idle');
  r.add('idle');
  r.delete('idle');
  assert.equal(r.paused, false, 'reasons are a set, not a counter: a repeat needs one release');
}

{
  const r = new PauseReasons();
  r.delete('never-added');
  assert.equal(r.paused, false, 'releasing an unheld reason is a no-op, not a throw');
}

// --- clamp geometry --------------------------------------------------------
const clamp = await import('../src/interior/clamp.js');
const { clampToRoom, pushOutOfBox, clampInterior, doorAnchor, doorInset, clampCameraToRoom, CAMERA_INSET, PLAYER_RADIUS: R } = clamp;

{
  const p = { x: 0, z: 0 };
  assert.equal(clampToRoom(p, 12, 9), false, 'a point at the centre is untouched');
  assert.deepEqual(p, { x: 0, z: 0 });
}

{
  const p = { x: 99, z: 0 };
  assert.equal(clampToRoom(p, 12, 9), true, 'a point past the east wall is moved');
  assert.equal(p.x, 6 - R, 'it lands one player radius inside the wall');
}

{
  const p = { x: 0, z: -99 };
  clampToRoom(p, 12, 9);
  assert.equal(p.z, -(4.5 - R), 'the north wall clamps on negative z');
}

{
  const p = { x: NaN, z: 3 };
  assert.equal(clampToRoom(p, 12, 9), true, 'a NaN coordinate is caught');
  assert.deepEqual(p, { x: 0, z: 0 }, 'and resets to the room centre rather than propagating');
}

{
  // A 2x2 box at the origin. The player starts just inside its east half.
  const box = { x: 0, z: 0, w: 2, d: 2 };
  const p = { x: 0.8, z: 0.1 };
  assert.equal(pushOutOfBox(p, box), true, 'a point inside the box is pushed out');
  assert.equal(p.x, 1 + R, 'along the shallowest axis, which here is east');
  assert.equal(p.z, 0.1, 'the other axis is untouched');
}

{
  const box = { x: 0, z: 0, w: 2, d: 2 };
  const p = { x: 0.1, z: -0.8 };
  pushOutOfBox(p, box);
  assert.equal(p.z, -(1 + R), 'a point nearest the north face leaves through it');
}

{
  const box = { x: 0, z: 0, w: 2, d: 2 };
  const p = { x: 5, z: 5 };
  assert.equal(pushOutOfBox(p, box), false, 'a point well outside is untouched');
  assert.deepEqual(p, { x: 5, z: 5 });
}

{
  // Two boxes with a gap the player actually fits through. 2 m boxes centred 3.4 m
  // apart leave 1.4 m between their faces, and the player is 0.9 m wide. A point
  // inside the first must settle in that gap, not inside the second.
  const boxes = [{ x: 0, z: 0, w: 2, d: 2 }, { x: 3.4, z: 0, w: 2, d: 2 }];
  const p = { x: 0.9, z: 0 };
  clampInterior(p, { w: 20, d: 20 }, boxes);
  for (const b of boxes) {
    const insideX = Math.abs(p.x - b.x) < b.w / 2 + R - 1e-9;
    const insideZ = Math.abs(p.z - b.z) < b.d / 2 + R - 1e-9;
    assert.ok(!(insideX && insideZ), 'the settled point is outside every prop box');
  }
}

{
  // A gap narrower than the player has no solution, and the clamp does not pretend
  // otherwise. 2 m boxes centred 2.4 m apart leave 0.4 m for a 0.9 m player, so their
  // exclusion zones overlap and no point between them is legal. What matters is that
  // the call terminates and yields usable numbers rather than looping or going NaN.
  // An unwalkable layout is Task 9's validator to catch, not this function's.
  const boxes = [{ x: 0, z: 0, w: 2, d: 2 }, { x: 2.4, z: 0, w: 2, d: 2 }];
  const p = { x: 0.9, z: 0 };
  clampInterior(p, { w: 20, d: 20 }, boxes);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'an impossible gap still yields finite coordinates');
}

{
  // The trailing room pass in clampInterior is load-bearing, and this is the fixture
  // that proves it. Room half-width is 6, so the walkable edge is 5.55. The player
  // starts outside at 6.3 and the first room clamp brings them to 5.55, which sits
  // just EAST of a box centred at 5.5. The push therefore goes east, to 6.95, back
  // through the wall. Only the trailing room clamp recovers it.
  //
  // Delete the second clampToRoom call in clampInterior and this assertion fails.
  // The player ends up inside the prop, which is the deliberate trade: being outside
  // the room is a far worse failure than being inside a crate.
  const p = { x: 6.3, z: 0 };
  clampInterior(p, { w: 12, d: 9 }, [{ x: 5.5, z: 0, w: 2, d: 2 }]);
  assert.ok(p.x <= 6 - R + 1e-9, 'the room wins: a prop by the wall cannot push you outside it');
}

// --- kit geometry -----------------------------------------------------------
// Counting children proves nothing about where they are. A wall on the wrong
// axis, or art hung behind its wall, keeps the same count. These check numbers.
import { buildProp, buildRoom, KINDS } from '../src/interior/kit.js';

const approx = (got, want, msg, eps = 1e-6) =>
  assert.ok(Math.abs(got - want) < eps, `${msg}: got ${got}, want ${want}`);

{
  // Rotated collision footprint. A 3 x 0.8 counter turned 45 degrees does not keep
  // either extent: its true bound is (3 + 0.8) / sqrt(2) on BOTH axes. The old
  // width/depth swap returned 3 x 0.8 there and under-covered the prop.
  const at = (rot) => buildProp({ kind: 'counter', x: 0, z: 0, w: 3, d: 0.8, rot }).box;
  approx(at(0).w, 3, 'rot 0 width'); approx(at(0).d, 0.8, 'rot 0 depth');
  approx(at(90).w, 0.8, 'rot 90 width'); approx(at(90).d, 3, 'rot 90 depth');
  approx(at(180).w, 3, 'rot 180 width'); approx(at(180).d, 0.8, 'rot 180 depth');
  approx(at(-90).w, 0.8, 'rot -90 width'); approx(at(-90).d, 3, 'rot -90 depth');

  const diag = at(45), want = (3 + 0.8) * Math.SQRT1_2;
  approx(diag.w, want, '45 degrees bounds x');
  approx(diag.d, want, '45 degrees bounds z');
  assert.ok(diag.d > 0.8, '45 degrees is deeper than the unrotated depth a swap would have kept');
}

{
  // Wall placement. North is -z, east is +x (src/minimap.js:5). Walls are the only
  // meshes as tall as the room; the floor and ceiling slabs are 0.2 thick.
  const { group } = buildRoom({ size: { w: 10, d: 6, h: 3 }, palette: 'warm-wood', props: [] }, '/x/');
  const walls = group.children.filter((c) => c.isMesh && c.geometry.parameters.height === 3);
  assert.equal(walls.length, 4, 'four walls');

  const at = (x, z) => walls.find((w) => Math.abs(w.position.x - x) < 1e-6 && Math.abs(w.position.z - z) < 1e-6);
  const north = at(0, -3), south = at(0, 3), east = at(5, 0), west = at(-5, 0);
  assert.ok(north && south && east && west, 'one wall per side, each at half the room extent');

  approx(north.geometry.parameters.width, 10, 'the north wall spans the room width');
  approx(south.geometry.parameters.width, 10, 'the south wall spans the room width');
  approx(east.geometry.parameters.width, 6, 'the east wall spans the room depth');
  approx(west.geometry.parameters.width, 6, 'the west wall spans the room depth');
  approx(north.rotation.y, 0, 'the north wall faces south, into the room');
  approx(east.rotation.y, -Math.PI / 2, 'the east wall is turned to face west, into the room');
  approx(west.rotation.y, Math.PI / 2, 'the west wall is turned to face east, into the room');
}

// --- door anchor (facing bearing -> stand point + yaw) -----------------------
// This is the sign-convention arithmetic that used to live inline in
// src/interior.js. Pinned here because it is exactly the bug class that has
// already bitten this plan once (src/main.js's own bearing-vs-yaw mixup), and
// this file is node-testable where src/interior.js categorically is not.
{
  const inset = 2.5;

  const south = doorAnchor(180, inset);
  approx(south.dx, 0, 'south door: dx centred');
  approx(south.dz, inset, 'south door: player stands on the south side (+z)');
  approx(south.yaw, 0, 'south door: yaw 0 faces north, into the room');

  const north = doorAnchor(0, inset);
  approx(north.dx, 0, 'north door: dx centred');
  approx(north.dz, -inset, 'north door: player stands on the north side (-z)');
  approx(north.yaw, Math.PI, 'north door: yaw PI faces south, into the room');

  const east = doorAnchor(90, inset);
  approx(east.dx, inset, 'east door: player stands on the east side (+x)');
  approx(east.dz, 0, 'east door: dz centred');
  approx(east.yaw, Math.PI / 2, 'east door: yaw PI/2');
  // Forward is (-sin yaw, -cos yaw) (src/player.js:268). At yaw PI/2 that is
  // (-1, ~0): due west — back into the room from a door on the east wall.
  const forward = { x: -Math.sin(east.yaw), z: -Math.cos(east.yaw) };
  assert.ok(forward.x < -0.99, 'an east door leaves the player facing west');
  approx(forward.z, 0, 'an east door leaves no north/south component to the forward vector');

  // An omitted facing (undefined, as with a hand-edited def missing the field)
  // defaults to 0 degrees, same as the original inline `def.facing ?? 0`.
  const omitted = doorAnchor(undefined, inset);
  assert.deepEqual(omitted, north, 'an undefined facing defaults to 0 degrees, same as north');
}

// --- how far in from the wall the door drops you -----------------------------
{
  // 12 wide by 9 deep: the north and south walls are 4.5 m from the centre, the
  // east and west walls 6 m. Measuring every door against the smaller extent
  // left an east door 2.5 m inside the room instead of the intended 1 m.
  assert.equal(doorInset(0, 12, 9, 1.0), 3.5, 'a north door measures across the depth');
  assert.equal(doorInset(180, 12, 9, 1.0), 3.5, 'a south door measures across the depth');
  assert.equal(doorInset(90, 12, 9, 1.0), 5.0, 'an east door measures across the width, not the depth');
  assert.equal(doorInset(270, 12, 9, 1.0), 5.0, 'a west door measures across the width, not the depth');
  assert.equal(doorInset(undefined, 12, 9, 1.0), 3.5, 'an undefined facing is north');

  // Every cardinal door lands exactly `gap` from its own wall.
  for (const [facing, wall] of [[0, 4.5], [90, 6], [180, 4.5], [270, 6]]) {
    const a = doorAnchor(facing, doorInset(facing, 12, 9, 1.0));
    const off = Math.hypot(a.dx, a.dz);
    approx(wall - off, 1.0, `a door facing ${facing} leaves the player 1 m from its wall`);
  }

  // A room smaller than the gap cannot put the player a metre in; it must not
  // answer with a negative inset, which would anchor them on the far wall.
  assert.equal(doorInset(0, 3, 1.4, 1.0), 0, 'a room shallower than the gap anchors at the centre, never behind the player');
}

// --- layouts and photographs exist on disk ---------------------------------
// A missing texture must fail the build, not render as a black wall.
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const reg = await import('../src/cities/index.js');
const referenced = new Set();

// Numbers the room shape is actually accountable to, named rather than inlined.
// src/constants.js cannot be imported here — it reads import.meta.env at module
// scope — so JUMP_VELOCITY and GRAVITY are transcribed from src/constants.js:25-26.
const PROBE_LIFT = 3;             // src/player.js:304, `probeFrom.y += 3`
const CEILING_THICKNESS = 0.2;    // buildRoom's ceiling slab, src/interior/kit.js
const JUMP_VELOCITY = 6.5, GRAVITY = 18;
const JUMP_APEX = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);   // ~1.17 m
const MIN_ROOM_HEIGHT = PROBE_LIFT + JUMP_APEX - CEILING_THICKNESS;  // ~3.97 m

for (const c of reg.CITIES) {
  for (const def of (c.interiors || [])) {
    const path = `public/interiors/${c.meta.id}/${def.layout}.json`;
    assert.ok(existsSync(path), `${c.meta.id}: interior ${def.id} has no layout at ${path}`);
    referenced.add(path);

    const layout = JSON.parse(readFileSync(path, 'utf8'));
    const { w, d, h } = layout.size || {};
    // Not merely positive: a room narrower than the player collapses the walkable
    // rectangle to nothing, and a ceiling under PLAYER_HEIGHT (1.8 m) is unusable.
    assert.ok(w > 2 && d > 2, `${path}: a room must be more than 2 m across, got ${w} x ${d}`);
    // The ceiling is bounded by the GROUND PROBE, not by the player's height.
    // src/player.js:304 casts downward from `position.y + 3` and takes the
    // nearest hit, and buildRoom's ceiling slab spans local [h, h + 0.2]. Once
    // the probe origin clears the slab's top face, the nearest hit IS that top
    // face and the player is snapped onto the roof — standing still on the very
    // first frame in a room under 2.8 m, and at the top of a jump in anything
    // under about 3.97. A 2.2 m room passed the old assertion and was unplayable.
    assert.ok(h > MIN_ROOM_HEIGHT,
      `${path}: ceiling must clear the ground probe at a jump's apex (> ${MIN_ROOM_HEIGHT.toFixed(2)} m), got ${h} — `
      + 'below that the probe starts above the ceiling slab and src/player.js:304 snaps the player onto the roof');

    for (const p of (layout.props || [])) {
      assert.ok(KINDS.includes(p.kind), `${path}: unknown prop kind ${p.kind}`);
      // EXTENTS, not the centre. A 4 m counter centred 100 mm inside the wall
      // passes a centre test with two metres of itself through the plaster.
      // buildProp already returns the rotated footprint, so reuse it rather than
      // re-deriving one; a prop you can walk over reports no box and is judged
      // on its centre alone.
      const { box } = buildProp(p);
      const hw = box ? box.w / 2 : 0, hd = box ? box.d / 2 : 0;
      assert.ok(Math.abs(p.x ?? 0) + hw <= w / 2 + 1e-9, `${path}: prop ${p.kind} overhangs the room on x`);
      assert.ok(Math.abs(p.z ?? 0) + hd <= d / 2 + 1e-9, `${path}: prop ${p.kind} overhangs the room on z`);
    }

    for (const a of (layout.art || [])) {
      assert.ok(['north', 'south', 'east', 'west'].includes(a.wall), `${path}: bad wall ${a.wall}`);
      // `along`, not `x`: src/interior/kit.js reads `a.along` for the offset
      // along the wall, so a layout that says `x` hangs its picture dead centre
      // and says nothing about it. `w` and `h` are required for the same class
      // of reason — PlaneGeometry(undefined, undefined) is a plane with NaN
      // dimensions, which renders as nothing at all.
      assert.ok(Number.isFinite(a.along),
        `${path}: art ${a.src} needs a finite \`along\` (metres along the wall from the room centre); \`x\` is ignored`);
      assert.ok(Number.isFinite(a.w) && a.w > 0, `${path}: art ${a.src} needs a positive \`w\``);
      assert.ok(Number.isFinite(a.h) && a.h > 0, `${path}: art ${a.src} needs a positive \`h\``);
      const img = `public/interiors/${c.meta.id}/${def.layout}/${a.src}`;
      assert.ok(existsSync(img), `${path}: art references a missing file, ${img}`);
    }
  }
}

// An orphan layout is a layout nobody can reach, the same failure the golf
// course check guards at scripts/validate-data.mjs:71.
if (existsSync('public/interiors')) {
  for (const city of readdirSync('public/interiors')) {
    for (const f of readdirSync(`public/interiors/${city}`)) {
      if (!f.endsWith('.json')) continue;
      const path = `public/interiors/${city}/${f}`;
      assert.ok(referenced.has(path), `orphan layout: ${path} is not referenced by any city`);
    }
  }
}

// --- the indoor camera stays in the room -------------------------------------
// The chase boom is sized against the room's SMALLEST half-extent, as though the
// player stood at the centre. They do not: they are placed one metre in from the
// door's wall. Before clampCameraToRoom, Clinton Row's entry pose put the camera
// three metres outside the south wall, and because the walls are boxes with
// outward-facing normals the first frame after the fade was flat plaster.
//
// This mirrors updateCamera's interior branch (src/main.js) in the room's local
// frame, where the room centre is the origin and the floor is y = 0.
const CHASE = { '3RD': 5, DRONE: 26, HIGH: 60 };   // src/main.js: the WALK boom per camera mode

function entryCamera(size, facing, { camMode = '3RD', pitch = 0 } = {}) {
  const { w, d } = size;
  const anchor = doorAnchor(facing, doorInset(facing, w, d, 1.0));
  const p = { x: anchor.dx, z: anchor.dz };
  clampToRoom(p, w, d);                                   // src/interior.js, the entry anchor
  const fit = Math.min(w, d) / 2 - 0.4;                   // src/main.js, the boom that assumes the centre
  const dist = Math.min(CHASE[camMode], Math.max(0.8, fit));
  const yaw = anchor.yaw;
  return {
    x: p.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    y: 0.1 + 1.4 + 2.0 + Math.sin(-pitch) * dist * 0.8,   // player feet + camTarget lift + chase height
    z: p.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  };
}

{
  // The real fixture: Clinton Row's shipped size and its shipped door facing.
  const def = reg.CITIES.flatMap((c) => c.interiors || []).find((i) => i.id === 'clinton-row');
  assert.ok(def, 'the Clinton Row interior is still in the city data');
  const size = JSON.parse(readFileSync(`public/interiors/huntsville/${def.layout}.json`, 'utf8')).size;

  const raw = entryCamera(size, def.facing);
  // Document the bug this guards: unclamped, the entry pose is outside the shell.
  assert.ok(Math.abs(raw.z) > size.d / 2,
    'the fixture must still reproduce the out-of-room boom, or it is guarding nothing');

  const cam = clampCameraToRoom({ ...raw }, { x: 0, y: 0, z: 0 }, size);
  assert.ok(Math.abs(cam.z) <= size.d / 2 - CAMERA_INSET + 1e-9,
    `the entry camera must be inside the room on z, got ${cam.z} in a ${size.d} m deep room`);
  assert.ok(Math.abs(cam.x) <= size.w / 2 - CAMERA_INSET + 1e-9,
    `the entry camera must be inside the room on x, got ${cam.x} in a ${size.w} m wide room`);
  assert.ok(cam.y >= CAMERA_INSET - 1e-9 && cam.y <= size.h - CAMERA_INSET + 1e-9,
    `the entry camera must be between the floor and the ceiling, got ${cam.y} in a ${size.h} m room`);
}

{
  // Not just the entry pose and not just Clinton Row: every shipped room, every
  // door facing, every camera mode, and a full look up and down.
  const sizes = [{ w: 12, d: 9, h: 4 }, { w: 4, d: 14, h: 3 }, { w: 3, d: 3, h: 2.5 }];
  for (const c of reg.CITIES) {
    for (const i of (c.interiors || [])) {
      sizes.push(JSON.parse(readFileSync(`public/interiors/${c.meta.id}/${i.layout}.json`, 'utf8')).size);
    }
  }
  const origin = { x: 130.5, y: 191.2, z: -42.75 };   // a room built at a real street address
  for (const size of sizes) {
    for (const facing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const camMode of Object.keys(CHASE)) {
        for (const pitch of [-1.2, -0.4, 0, 0.4, 1.2]) {
          const local = entryCamera(size, facing, { camMode, pitch });
          const cam = clampCameraToRoom(
            { x: origin.x + local.x, y: origin.y + local.y, z: origin.z + local.z }, origin, size,
          );
          const label = `${size.w}x${size.d}x${size.h}, facing ${facing}, ${camMode}, pitch ${pitch}`;
          assert.ok(Math.abs(cam.x - origin.x) <= size.w / 2 - CAMERA_INSET + 1e-9, `camera outside on x: ${label}`);
          assert.ok(Math.abs(cam.z - origin.z) <= size.d / 2 - CAMERA_INSET + 1e-9, `camera outside on z: ${label}`);
          assert.ok(cam.y - origin.y >= CAMERA_INSET - 1e-9, `camera under the floor: ${label}`);
          assert.ok(cam.y - origin.y <= size.h - CAMERA_INSET + 1e-9, `camera through the ceiling: ${label}`);
        }
      }
    }
  }
}

// --- the ground probe must only ever find the floor -------------------------
// The player's ground probe starts 3 m above their feet and takes the nearest hit
// below it (src/player.js:304), and the step-up rule snaps them onto anything
// between 0.6 m and 3 m above them. So if a prop or the ceiling answers that
// probe, stepping onto the 2 m shelf lifts the probe past the 4 m ceiling slab,
// it finds the slab's top face, and the next frame puts the player on the roof
// with the camera clamped below the ceiling: stuck, staring into it, no way down.
// Collision indoors is the clamp. The raycast answers one question only.
{
  for (const c of reg.CITIES) {
    for (const def of (c.interiors || [])) {
      const layout = JSON.parse(readFileSync(`public/interiors/${c.meta.id}/${def.layout}.json`, 'utf8'));
      const { group } = buildRoom(layout, '/x/');
      const hittable = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        if (o.raycast && o.raycast.length === 0 && /\{\s*\}/.test(o.raycast.toString())) return;  // stubbed out
        hittable.push(`${o.geometry.type} at y=${o.position.y.toFixed(2)}`);
      });
      assert.equal(hittable.length, 1,
        `${c.meta.id}/${def.layout}: exactly one mesh may answer the ground probe, got ${hittable.length}: ${hittable.join(', ')}`);
      assert.ok(hittable[0].startsWith('BoxGeometry at y=-0.1'),
        `${c.meta.id}/${def.layout}: the one raycastable mesh must be the floor slab, got ${hittable[0]}`);
    }
  }
}

// --- walkability ------------------------------------------------------------
// Flood fill the floor on a coarse grid and require most of the free area to be
// one connected region. A layout that splits the room in two, or leaves a gap
// narrower than the 0.9 m player, fails here rather than in someone's session.
//
// Merge `KINDS` into the kit import Task 6 already added to this file rather than
// adding a second import line from the same module.
import { PLAYER_RADIUS } from '../src/interior/clamp.js';

const STEP = 0.25;

function walkableFraction(layout) {
  const { w, d } = layout.size;
  // Reuse the real prop builder so kinds you can walk over (rug, lamp, sign)
  // report no box here exactly as they do at runtime.
  const boxes = (layout.props || []).map(buildProp).map((r) => r.box).filter(Boolean);
  const nx = Math.floor(w / STEP), nz = Math.floor(d / STEP);
  const free = (ix, iz) => {
    const x = -w / 2 + (ix + 0.5) * STEP;
    const z = -d / 2 + (iz + 0.5) * STEP;
    if (Math.abs(x) > w / 2 - PLAYER_RADIUS || Math.abs(z) > d / 2 - PLAYER_RADIUS) return false;
    return !boxes.some((b) => Math.abs(x - b.x) < b.w / 2 + PLAYER_RADIUS
                           && Math.abs(z - b.z) < b.d / 2 + PLAYER_RADIUS);
  };

  const cells = [];
  let total = 0;
  for (let ix = 0; ix < nx; ix++) {
    cells[ix] = [];
    for (let iz = 0; iz < nz; iz++) { cells[ix][iz] = free(ix, iz); if (cells[ix][iz]) total++; }
  }
  if (!total) return 0;

  // Measure the LARGEST connected region, not the first one found. Seeding from
  // whichever free cell the scan happens to reach first can land in a small pocket
  // and report a split room as tiny rather than as split.
  const seen = new Set();
  let largest = 0;
  for (let sx = 0; sx < nx; sx++) {
    for (let sz = 0; sz < nz; sz++) {
      if (!cells[sx][sz] || seen.has(`${sx},${sz}`)) continue;
      let size = 0;
      const queue = [[sx, sz]];
      seen.add(`${sx},${sz}`);
      while (queue.length) {
        const [ix, iz] = queue.pop();
        size++;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const jx = ix + dx, jz = iz + dz;
          if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
          if (!cells[jx][jz] || seen.has(`${jx},${jz}`)) continue;
          seen.add(`${jx},${jz}`);
          queue.push([jx, jz]);
        }
      }
      if (size > largest) largest = size;
    }
  }
  return largest / total;
}

for (const c of reg.CITIES) {
  for (const def of (c.interiors || [])) {
    const layout = JSON.parse(readFileSync(`public/interiors/${c.meta.id}/${def.layout}.json`, 'utf8'));
    const frac = walkableFraction(layout);
    assert.ok(frac > 0.9, `${c.meta.id}/${def.layout}: only ${Math.round(frac * 100)}% of the free floor is reachable — furniture is splitting the room`);
  }
}

console.log('interiors: all assertions passed');
