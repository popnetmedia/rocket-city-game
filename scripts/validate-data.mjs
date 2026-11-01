#!/usr/bin/env node
/**
 * Guard: every objective must be reachable, in every city.
 *
 * A coin, hunt target or race gate outside its city's playable border can never be
 * claimed, which makes the whole run uncompletable — the player hits 19/20 and has no
 * way to know why. This caught exactly that: a real Starbucks on Winchester Rd NE
 * sitting 1.8 km beyond the border.
 *
 * Every city in the registry is checked against ITS OWN border, so a new city's data is
 * guarded the moment the city is added — nothing here is Huntsville-specific.
 *
 * Run: node scripts/validate-data.mjs   (wired into `npm test`)
 */
import { readFileSync } from 'node:fs';
import { CITIES } from '../src/cities/index.js';

const root = new URL('..', import.meta.url).pathname;
const src = (f) => readFileSync(root + f, 'utf8');

// flat-earth metres; accurate enough at city scale and matches the client's frame
const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 91600);

const holesData = JSON.parse(src('public/golf/holes.json'));

let failures = 0;
let checked = 0;

for (const city of CITIES) {
  const id = city.meta.id;
  const lobes = city.border.lobes;
  const zones = city.border.nofly || [];
  const inPlayable = (p) => lobes.some((l) => dist(p, l) <= l.r);
  const marginOutside = (p) => Math.min(...lobes.map((l) => dist(p, l) - l.r));
  const inRestricted = (p) => zones.find((z) => dist(p, z) < z.r);

  const check = (label, p) => {
    checked++;
    if (!inPlayable(p)) {
      console.error(`FAIL  ${id} :: ${label} — ${Math.round(marginOutside(p))} m outside the playable border`);
      failures++;
      return;
    }
    const z = inRestricted(p);
    if (z) {
      console.error(`FAIL  ${id} :: ${label} — inside restricted zone ${z.name}`);
      failures++;
    }
  };

  // teleport presets + every POI list a hunt can score
  const lists = {
    presets: city.presets,
    starbucks: city.pois?.starbucks,
    breweries: city.pois?.breweries,
    bowling: city.pois?.bowling,
    pickleball: city.pois?.pickleball,
    hospitals: city.pois?.hospitals,
    golfCourses: city.pois?.golfCourses,
    coasters: city.pois?.coasters,
    animals: city.pois?.animals,
    hotels: city.pois?.hotels,
    interiors: city.interiors,
    ballparks: city.ballparks,
  };
  for (const [name, list] of Object.entries(lists)) {
    for (const e of (list || [])) check(`${name} ${e.name}`, e);
  }

  // race gates — a waypoint out of bounds is the same uncompletable-run bug
  for (const r of (city.races || [])) {
    r.points.forEach(([lat, lon], i) => check(`race ${r.id} gate ${i + 1}`, { lat, lon }));
  }

  // golf tees and greens, for the courses this city owns
  const courseIds = new Set((city.pois?.golfCourses || []).map((g) => g.id));
  for (const [courseId, course] of Object.entries(holesData)) {
    if (!courseIds.has(courseId)) continue;
    for (const hole of course.holes) {
      check(`${courseId} hole ${hole.n} tee`, { lat: hole.tee[0], lon: hole.tee[1] });
      check(`${courseId} hole ${hole.n} green`, { lat: hole.green[0], lon: hole.green[1] });
    }
  }

  // ALPR: the map deliberately shows cameras beyond the border, but the Flock hunt only
  // scores reachable ones (see alpr.js huntCount), so the invariant is that it has some.
  if (city.alpr) {
    const cams = JSON.parse(src(`public${city.alpr}`));
    let reachable = 0;
    for (const [lat, lon] of cams) {
      checked++;
      const p = { lat, lon };
      if (inPlayable(p) && !inRestricted(p)) reachable++;
    }
    if (!cams.length || !reachable) {
      console.error(`FAIL  ${id} :: alpr — 0 of ${cams.length} cameras reachable; the Flock hunt cannot be completed`);
      failures++;
    } else {
      console.log(`      ${id}: Flock hunt scores ${reachable} of ${cams.length} cameras (${cams.length - reachable} mapped but out of bounds)`);
    }
  }
}

// Any golf course with holes but no owning city would never be validated above.
const owned = new Set(CITIES.flatMap((c) => (c.pois?.golfCourses || []).map((g) => g.id)));
for (const courseId of Object.keys(holesData)) {
  if (!owned.has(courseId)) {
    console.error(`FAIL  golf ${courseId} — holes.json has this course but no city lists it; it would go unchecked`);
    failures++;
  }
}

// Flight ceiling vs spawn altitude. spawn.alt becomes the hover height in
// player.spawnAt, and _updateFlight clamps anything above ground + ceiling, so a
// spawn set above its city's ceiling is silently pulled down and the scenic arrival
// someone chose never happens. constants.js reads import.meta.env at module scope and
// cannot be imported here, so the default is read as text -- the same approach
// rooms.test.mjs uses on the worker's city list.
{
  const constantsSrc = readFileSync(new URL('../src/constants.js', import.meta.url), 'utf8');
  const m = constantsSrc.match(/DEFAULT_FLY_CEILING\s*=\s*(\d+)/);
  if (!m) { console.error(`FAIL  constants.js no longer exports DEFAULT_FLY_CEILING — this check is blind`); failures++; }
  const DEF = m ? Number(m[1]) : 320;
  for (const c of CITIES) {
    const ceil = c.flyCeiling ?? DEF;
    if (!Number.isFinite(ceil) || ceil <= 0) { console.error(`FAIL  ${c.meta.id} :: flyCeiling must be a positive number, got ${ceil}`); failures++; }
    const alt = c.spawn?.alt;
    if (Number.isFinite(alt) && alt >= ceil) {
      console.error(`FAIL  ${c.meta.id} :: spawn.alt ${alt} m is at or above its ${ceil} m flight ceiling — the arrival will be clamped`);
      failures++;
    }
    for (const p of c.presets || []) {
      if (Number.isFinite(p.alt) && p.alt >= ceil) {
        console.error(`FAIL  ${c.meta.id} :: preset "${p.name}" alt ${p.alt} m is at or above the ${ceil} m ceiling`);
        failures++;
      }
    }
  }
}

console.log(`validate-data: ${checked} points checked across ${CITIES.length} cities`);
if (failures) {
  console.error(`validate-data: ${failures} unreachable location(s)`);
  process.exit(1);
}
console.log('validate-data: all locations reachable');
