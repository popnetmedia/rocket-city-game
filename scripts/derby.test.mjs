/**
 * Home run derby: terrain probes, contact, fence and the data contract.
 *
 * Everything exercised here is node-importable. src/derby.js and src/main.js are
 * not, because they read import.meta.env at module scope, which Vite supplies and
 * node does not. Same split as scripts/interiors.test.mjs.
 */
import assert from 'node:assert/strict';
import { makeFlightGround, makeSmoothGround, FLIGHT_PROBE_HIGH } from '../src/minigame/terrain.js';

// A stub world: flat ground at y=100 except a ridge, and it counts probes.
const stubWorld = (heightAt = () => 100) => {
  const w = { probes: 0 };
  w.groundBelow = (v) => { w.probes++; return { point: { y: heightAt(v.x, v.z) } }; };
  return w;
};

{
  const w = stubWorld();
  const ground = makeFlightGround(w);
  assert.equal(ground(0, 0, 200), 100, 'a cold probe returns the real height');
  assert.equal(w.probes, 1, 'and costs one raycast');
}

{
  // The whole point of the cache: a ball high above a known surface and barely
  // moved horizontally must not re-probe.
  const w = stubWorld();
  const ground = makeFlightGround(w);
  ground(0, 0, 200);
  const before = w.probes;
  ground(0.5, 0.5, 100 + FLIGHT_PROBE_HIGH + 5);
  assert.equal(w.probes, before, 'high and close enough reuses the cached height');
}

{
  // ... but a ball that has travelled must re-probe, or it sails over a hillside.
  const w = stubWorld();
  const ground = makeFlightGround(w);
  ground(0, 0, 200);
  const before = w.probes;
  ground(50, 0, 300);
  assert.ok(w.probes > before, 'travelling far horizontally forces a fresh probe');
}

{
  // Low over the surface must always re-probe, however little it moved.
  const w = stubWorld();
  const ground = makeFlightGround(w);
  ground(0, 0, 200);
  const before = w.probes;
  ground(0.2, 0.2, 101);
  assert.ok(w.probes > before, 'a ball near the surface re-probes every call');
}

{
  const w = stubWorld();
  const ground = makeFlightGround(w);
  ground.seed(10, 20, 100);
  const before = w.probes;
  ground(10, 20, 500);
  assert.ok(w.probes > before, 'seed primes the position but not the height: the next call probes');
}

{
  // The smoothed probe trades rays for stability under a resting ball.
  const w = stubWorld((x) => (x > 0 ? 110 : 100));
  const smooth = makeSmoothGround(w);
  const h = smooth(0, 0);
  assert.equal(w.probes, 5, 'five rays in a plus pattern');
  assert.ok(h > 100 && h < 110, `the step is averaged, not snapped: got ${h}`);
}

// --- the ball is a parameter, not a constant --------------------------------
import { simulate, GOLF_BALL, BASEBALL } from '../src/golf/flight.js';

const flat = () => 0;
const launch = (speed, deg, headingDeg = 0) => {
  const a = (deg * Math.PI) / 180, h = (headingDeg * Math.PI) / 180;
  return { x: Math.sin(h) * speed * Math.cos(a), y: speed * Math.sin(a), z: -Math.cos(h) * speed * Math.cos(a) };
};

{
  // Defaults must still be the golf ball, or Task 1's promise that golf did not
  // move is worthless.
  const bare = simulate({ x: 0, y: 0, z: 0 }, launch(60, 12), { back: 2800, side: 0 }, flat);
  const explicit = simulate({ x: 0, y: 0, z: 0 }, launch(60, 12), { back: 2800, side: 0 }, flat, GOLF_BALL);
  assert.equal(bare.carry.toFixed(6), explicit.carry.toFixed(6), 'no opts means a golf ball');
}

{
  // Struck identically, a baseball must fly SHORTER than a golf ball, and by a
  // lot. Mass and radius alone cannot produce that — their ballistic
  // coefficients are within 7% — so this assertion is really checking that the
  // aerodynamic coefficients reached the integrator too. With only mass and
  // radius parameterised the gap measured 1.6 m and this failed, which is how
  // the missing parameters were found.
  const g = simulate({ x: 0, y: 1, z: 0 }, launch(45, 28), { back: 2000, side: 0 }, flat, GOLF_BALL);
  const b = simulate({ x: 0, y: 1, z: 0 }, launch(45, 28), { back: 2000, side: 0 }, flat, BASEBALL);
  assert.ok(b.carry < g.carry - 15,
    `a baseball must fly much shorter than a golf ball: golf ${g.carry.toFixed(1)}m vs baseball ${b.carry.toFixed(1)}m`);
}

{
  // The physical anchor. A 45 m/s exit at 28 degrees with 2000 rpm is a
  // well-measured real-world case that carries about 118 m. If this drifts, the
  // whole game's difficulty has drifted with it.
  const b = simulate({ x: 0, y: 1.1, z: 0 }, launch(45, 28), { back: 2000, side: 0 }, flat, BASEBALL);
  assert.ok(b.carry > 108 && b.carry < 128,
    `the calibration case should carry about 118 m, got ${b.carry.toFixed(1)}`);
}

{
  // A well-struck baseball has to reach the fence, or the game is unplayable.
  // Bands, not numbers: this is physics, not a golden file.
  const hit = simulate({ x: 0, y: 1, z: 0 }, launch(48, 28), { back: 2200, side: 0 }, flat, BASEBALL);
  assert.ok(hit.carry > 112 && hit.carry < 145,
    `a 48 m/s barrel at 28 degrees should carry 112-145 m, got ${hit.carry.toFixed(1)}`);
  assert.ok(hit.apex > 20, `and get up in the air, got apex ${hit.apex.toFixed(1)} m`);
}

{
  // Grass stops a ball faster than a fairway does.
  const soft = simulate({ x: 0, y: 0, z: 0 }, launch(30, 8), { back: 500, side: 0 }, flat,
    { ...BASEBALL, rollDecel: 20 });
  const slick = simulate({ x: 0, y: 0, z: 0 }, launch(30, 8), { back: 500, side: 0 }, flat,
    { ...BASEBALL, rollDecel: 2 });
  assert.ok(slick.rest.z < soft.rest.z, 'less friction rolls further from the plate');
}

// --- contact ----------------------------------------------------------------
import { contactFrom, launchFromContact, SWING_WINDOW, IDEAL_EXIT } from '../src/minigame/contact.js';

{
  const perfect = contactFrom(0);
  assert.equal(perfect.missed, false, 'a perfectly timed swing connects');
  assert.equal(perfect.exitSpeed, IDEAL_EXIT, 'and gets the full exit speed');
  assert.ok(Math.abs(perfect.sprayOffset) < 1e-9, 'straight up the middle');
}

{
  assert.equal(contactFrom(SWING_WINDOW * 1.01).missed, true, 'too late is a miss');
  assert.equal(contactFrom(-SWING_WINDOW * 1.01).missed, true, 'too early is a miss');
  assert.equal(contactFrom(SWING_WINDOW * 0.99).missed, false, 'the edge of the window still connects');
}

{
  // Early and late must spray in OPPOSITE directions, or timing means nothing.
  const early = contactFrom(-SWING_WINDOW * 0.6);
  const late = contactFrom(SWING_WINDOW * 0.6);
  assert.ok(early.sprayOffset * late.sprayOffset < 0,
    `early and late must pull opposite ways, got ${early.sprayOffset} and ${late.sprayOffset}`);
}

{
  // Exit speed must fall off monotonically either side of perfect. A dead spot
  // or a bump would make the timing unreadable. Walk both the late side (i > 0)
  // and the early side (i < 0) out from zero — a step expression that is always
  // positive would only ever exercise one of them.
  for (const sign of [1, -1]) {
    let prev = Infinity;
    for (let i = 0; i <= 10; i++) {
      const c = contactFrom(sign * (SWING_WINDOW * i) / 10.5);
      assert.ok(c.exitSpeed <= prev + 1e-9, `exit speed must not rise as timing worsens (step ${sign * i})`);
      prev = c.exitSpeed;
    }
  }
}

{
  // Late contact goes UP, early contact stays down. That is what makes a late
  // swing a pop-up and an early one a screaming foul.
  assert.ok(contactFrom(SWING_WINDOW * 0.8).launchAngle > contactFrom(-SWING_WINDOW * 0.8).launchAngle,
    'late must launch higher than early');
}

{
  // The launch conversion has to agree with flight.js's heading convention:
  // 0 = -z, forward is (sin a, -cos a).
  const { vel, spin } = launchFromContact(contactFrom(0), 0);
  assert.ok(vel.z < 0, 'heading 0 must send the ball toward -z');
  assert.ok(Math.abs(vel.x) < 1e-9, 'and with no sideways component');
  assert.ok(vel.y > 0, 'and upward');
  assert.ok(spin.back > 0, 'a struck ball carries backspin, which is what makes it carry');
}

{
  const east = launchFromContact(contactFrom(0), Math.PI / 2);
  assert.ok(east.vel.x > 0 && Math.abs(east.vel.z) < 1e-6, 'heading 90 degrees sends it toward +x');
}

// --- the fence --------------------------------------------------------------
import { fenceAt, callIt, sprayLabel } from '../src/minigame/fence.js';

const FENCE = { line: 100, gap: 112, center: 122, foulAngle: 45 };

{
  assert.equal(fenceAt(0, FENCE), 122, 'dead centre is the deepest');
  assert.equal(fenceAt(45, FENCE), 100, 'down the line is the shortest');
  assert.equal(fenceAt(-45, FENCE), 100, 'and it is symmetric');
  assert.ok(fenceAt(22.5, FENCE) > 100 && fenceAt(22.5, FENCE) < 122, 'the gap sits between them');
}

{
  let prev = fenceAt(0, FENCE);
  for (let a = 1; a <= 45; a++) {
    const d = fenceAt(a, FENCE);
    assert.ok(d <= prev + 1e-9, `the fence must not get deeper toward the line (at ${a} deg)`);
    prev = d;
  }
}

{
  assert.equal(callIt(200, 60, FENCE), 'FOUL', 'past the foul angle is foul however far it went');
  assert.equal(callIt(130, 0, FENCE), 'HOME RUN', 'over the fence in fair territory');
  assert.equal(callIt(80, 0, FENCE), 'IN PLAY', 'short of the fence stays in play');
  assert.equal(callIt(105, 44, FENCE), 'HOME RUN', 'a shorter poke down the line still clears');
  assert.equal(callIt(105, 0, FENCE), 'IN PLAY', 'the same distance to centre does not');
}

// --- shipped ballpark data --------------------------------------------------
const reg = await import('../src/cities/index.js');

for (const c of reg.CITIES) {
  for (const p of (c.ballparks || [])) {
    const f = p.fence;
    const where = `${c.meta.id}/${p.id}`;
    assert.ok(f && Number.isFinite(f.line) && Number.isFinite(f.gap) && Number.isFinite(f.center),
      `${where}: fence needs finite line, gap and center distances`);
    assert.ok(f.line <= f.gap && f.gap <= f.center,
      `${where}: the fence must not get shorter toward centre field, got ${f.line}/${f.gap}/${f.center}`);
    assert.ok(f.foulAngle > 20 && f.foulAngle < 90,
      `${where}: a foul angle of ${f.foulAngle} degrees is not a baseball field`);
    // A fence a perfect swing cannot clear makes the game unwinnable, and one it
    // always clears makes it pointless. Check against the real contact model.
    const best = launchFromContact(contactFrom(0), 0);
    const shot = simulate({ x: 0, y: 1.1, z: 0 }, best.vel, best.spin, () => 0, BASEBALL);
    assert.ok(shot.carry > f.line, `${where}: a perfect swing (${shot.carry.toFixed(0)} m) cannot even reach the foul line at ${f.line} m`);
    assert.ok(shot.carry < f.center * 2, `${where}: centre field at ${f.center} m is trivial for a ${shot.carry.toFixed(0)} m swing`);
  }
}

// The spray readout. Left/right must follow callIt's own sign convention, or the
// toast would tell the player the opposite of where the ball actually went --
// worse than printing nothing, since it is the instrument for checking whether a
// park's centreField bearing matches the stadium in the tiles.
{
  assert.equal(sprayLabel(0), 'DEAD CENTRE');
  assert.equal(sprayLabel(2), 'DEAD CENTRE', 'a couple of degrees either way is still centre');
  assert.ok(sprayLabel(-30).includes('LEFT'), 'negative is left, as in callIt');
  assert.ok(sprayLabel(30).includes('RIGHT'), 'positive is right, as in callIt');
  assert.ok(sprayLabel(-30).startsWith('30'), 'the magnitude is the angle off centre');

  // The sign convention is shared with the fence, so pin them against each other
  // rather than against a hard-coded string: a ball at the left-field pole and one
  // at the right pole are the same distance out and must read as opposite sides.
  const f = { line: 100, gap: 112, center: 122, foulAngle: 45 };
  assert.equal(fenceAt(-44, f), fenceAt(44, f), 'the fence itself is symmetric');
  assert.notEqual(sprayLabel(-44), sprayLabel(44), 'but the readout must distinguish the two poles');
}

console.log('derby: all assertions passed');
