// Golf maths checks: node scripts/golf.test.mjs
import assert from 'node:assert/strict';
import { CLUBS, clubAt } from '../src/golf/clubs.js';

// --- clubs ---
assert.equal(CLUBS.length, 10, 'ten clubs, no putter');
assert.equal(CLUBS[0].id, 'driver');
assert.ok(!CLUBS.some((c) => c.id === 'putter'), 'no putter — there is no putting');
for (let i = 1; i < CLUBS.length; i++) {
  assert.ok(CLUBS[i].loft > CLUBS[i - 1].loft, `loft increases: ${CLUBS[i].id}`);
  assert.ok(CLUBS[i].speedFactor < CLUBS[i - 1].speedFactor, `speed drops: ${CLUBS[i].id}`);
  assert.ok(CLUBS[i].spin > CLUBS[i - 1].spin, `spin rises: ${CLUBS[i].id}`);
}
assert.equal(clubAt(-5).id, 'driver', 'index clamps low');
assert.equal(clubAt(99).id, CLUBS.at(-1).id, 'index clamps high');
console.log('clubs: all assertions passed');

import { createSwing } from '../src/golf/swing.js';

const H = 1000;                       // viewport height, so BACK_FULL = 280 px
const feed = (pts) => {               // pts: [x, y, t_ms]
  const s = createSwing(H);
  s.down(pts[0][0], pts[0][1], pts[0][2]);
  for (const [x, y, t] of pts.slice(1)) s.move(x, y, t);
  return s;
};

// A swing path as golf.js actually produces one: golf.js samples input.golfPointer
// ONCE PER ANIMATION FRAME, so a real gesture arrives as ~60 samples/s, not as the
// two-sample idealisation this test used to feed. `flick` builds that: a 300 ms
// pull-back to full depth, then a brisk 50 ms forward flick, both at 60 fps.
const FRAME = 50 / 3;                 // ms, one frame at 60 fps
const flick = (dx = 0, backMs = 300, fwdFrames = 3) => {
  const pts = [];
  const backSteps = Math.round(backMs / FRAME);
  for (let i = 0; i <= backSteps; i++) pts.push([500, 500 + 280 * (i / backSteps), i * FRAME]);
  const t0 = backSteps * FRAME;
  for (let i = 1; i <= fwdFrames; i++) {
    const k = i / fwdFrames;
    pts.push([500 + dx * k, 780 - 280 * k, t0 + i * FRAME]);
  }
  return pts;
};

// full backswing, straight, reference tempo -> full power, no curve
const straight = feed(flick());
assert.ok(straight.result, 'crossing the origin fires the shot');
assert.ok(straight.result.power > 0.95, `full power, got ${straight.result.power}`);
assert.ok(Math.abs(straight.result.faceAngle) < 0.5, 'straight swing does not curve');

// half backswing -> about half power
const half = feed([[500, 500, 0], [500, 640, 200], [500, 500, 375]]);
assert.ok(half.result.power > 0.4 && half.result.power < 0.6, `half power, got ${half.result.power}`);

// drifting right at the strike -> positive face angle (fade)
const fade = feed([[500, 500, 0], [500, 780, 200], [600, 500, 375]]);
assert.ok(fade.result.faceAngle > 5, `right drift fades, got ${fade.result.faceAngle}`);
const draw = feed([[500, 500, 0], [500, 780, 200], [400, 500, 375]]);
assert.ok(draw.result.faceAngle < -5, `left drift draws, got ${draw.result.faceAngle}`);

// releasing without crossing back = no shot
const aborted = feed([[500, 500, 0], [500, 780, 200]]);
aborted.up();
assert.equal(aborted.result, null, 'aborted gesture fires nothing');

// quality peaks at tempo 1 and falls off either side
assert.ok(straight.result.quality > 0.9, 'reference tempo is a clean strike');
const slow = feed([[500, 500, 0], [500, 780, 200], [500, 500, 1200]]);
assert.ok(slow.result.tempo < 1, 'slow forward move is fat');
assert.ok(slow.result.quality < straight.result.quality, 'fat strike scores worse');
console.log('swing: all assertions passed');

import { launchFrom, simulate } from '../src/golf/flight.js';

const flat = () => 0;                                  // flat ground at y=0
const perfect = { power: 1, faceAngle: 0, tempo: 1, quality: 1 };
const shot = (clubId, sw = perfect) => {
  const club = CLUBS.find((c) => c.id === clubId);
  const { vel, spin } = launchFrom(club, sw, 0);        // heading 0 = due north (-z)
  return simulate({ x: 0, y: 0, z: 0 }, vel, spin, flat);
};

// driver carry lands in the real-world band from the spec
const drv = shot('driver');
assert.ok(drv.carry > 215 && drv.carry < 250, `driver carry ${Math.round(drv.carry)} m out of band`);
assert.ok(drv.apex > 18 && drv.apex < 34, `driver apex ${Math.round(drv.apex)} m out of band`);

// a wedge goes much shorter and much steeper
const lw = shot('lw');
assert.ok(lw.carry < drv.carry * 0.6, `wedge should be far shorter: ${Math.round(lw.carry)} m`);
assert.ok(lw.apex > lw.carry * 0.4, 'wedge flies high for its distance');

// less power = less distance, monotonically.
// NOTE: names here are suffixed because every task appends to the SAME test file,
// and Task 2 already declared `half`, `fade` and `draw` at module scope.
const halfPowerShot = shot('driver', { ...perfect, power: 0.5 });
assert.ok(halfPowerShot.carry < drv.carry, 'half power carries less');

// face angle curves the ball the right way. heading 0 is -z, so +x is right.
const fadeShot = shot('driver', { ...perfect, faceAngle: 8 });
const drawShot = shot('driver', { ...perfect, faceAngle: -8 });
assert.ok(fadeShot.rest.x > 5, `fade should finish right, x=${fadeShot.rest.x.toFixed(1)}`);
assert.ok(drawShot.rest.x < -5, `draw should finish left, x=${drawShot.rest.x.toFixed(1)}`);

// every shot terminates
assert.ok(drv.flightTime > 3 && drv.flightTime < 12, `flight time ${drv.flightTime}`);
assert.ok(drv.points.length > 10, 'trajectory is sampled for the trail');

// determinism: identical input, identical output
assert.deepEqual(shot('driver').rest, drv.rest, 'flight is deterministic');
console.log('flight: all assertions passed');

import { readFileSync } from 'node:fs';

const holes = JSON.parse(readFileSync(new URL('../public/golf/holes.json', import.meta.url)));
// No course ships with sourced hole data yet. Any course added must pass these checks.
for (const [id, course] of Object.entries(holes)) {
  assert.ok(course.holes.length >= 1, `${id} has holes`);
  for (const h of course.holes) {
    assert.ok(h.n >= 1 && h.n <= 18, `hole number ${h.n}`);
    assert.ok(h.par >= 3 && h.par <= 5, `par ${h.par}`);
    assert.ok(h.r > 4 && h.r < 40, `green radius ${h.r} m`);
    // tee and green must actually be a hole apart
    const d = Math.hypot((h.tee[0] - h.green[0]) * 111320, (h.tee[1] - h.green[1]) * 91600);
    assert.ok(d > 80 && d < 600, `${id} hole ${h.n} plays ${Math.round(d)} m, implausible`);
  }
}
console.log(`holes: ${Object.keys(holes).length} course(s) checked`);

// rollout: driver carries ~232m but should roll 10-30m more; lob wedge rolls much less
const drvShot = shot('driver');
const lwShot = shot('lw');
const drvRollout = drvShot.rest.x * drvShot.rest.x + drvShot.rest.z * drvShot.rest.z;
const drvRestDist = Math.sqrt(drvRollout);
const lwRollout = lwShot.rest.x * lwShot.rest.x + lwShot.rest.z * lwShot.rest.z;
const lwRestDist = Math.sqrt(lwRollout);
const drvRoll = drvRestDist - drvShot.carry;
const lwRoll = lwRestDist - lwShot.carry;
assert.ok(drvRoll > 8, `driver must roll >8m, got ${drvRoll.toFixed(1)}m`);
assert.ok(drvRoll < 50, `driver roll must be reasonable, got ${drvRoll.toFixed(1)}m`);
assert.ok(lwRoll < drvRoll, `wedge rolls less than driver: wedge=${lwRoll.toFixed(1)}m vs driver=${drvRoll.toFixed(1)}m`);
assert.ok(drvShot.flightTime > 0, 'all shots terminate');
console.log('rollout: all assertions passed');
