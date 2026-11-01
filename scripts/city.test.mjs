// Proves the city extraction changed no data: node scripts/city.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const listFrom = (text, name) => {
  const m = text.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\];`));
  if (!m) throw new Error(`missing ${name}`);
  return eval(`[${m[1].replace(/\/\/[^\n]*/g, '')}]`);
};

// Known-good counts, recorded from src/constants.js before the move.
const EXPECTED = { PRESETS: 15, GOLF_COURSES: 5, STARBUCKS: 19, BOWLING: 3, PICKLEBALL: 3, HOSPITALS: 5, BREWERIES: 8 };

const city = (await import('../src/cities/huntsville.js')).default;
const map = {
  PRESETS: city.presets,
  GOLF_COURSES: city.pois.golfCourses,
  STARBUCKS: city.pois.starbucks,
  BOWLING: city.pois.bowling,
  PICKLEBALL: city.pois.pickleball,
  HOSPITALS: city.pois.hospitals,
  BREWERIES: city.pois.breweries,
};
for (const [name, n] of Object.entries(EXPECTED)) {
  assert.equal(map[name].length, n, `${name} should have ${n} entries, got ${map[name].length}`);
  for (const e of map[name]) {
    assert.ok(typeof e.name === 'string' && e.name.length, `${name}: every entry has a name`);
    assert.ok(e.lat > 34.5 && e.lat < 35.0, `${name} ${e.name}: lat in region`);
    assert.ok(e.lon > -87 && e.lon < -86.3, `${name} ${e.name}: lon in region`);
  }
}

// The origin and spawn must match the values the game shipped with.
assert.deepEqual(city.origin, { lat: 34.7304, lon: -86.5861, name: 'Courthouse Square' });
assert.deepEqual(city.spawn.look, [34.730257, -86.585058]);
assert.deepEqual(city.spawn.from, [34.72640, -86.58380]);
assert.equal(city.spawn.alt, 210);
assert.equal(city.meta.id, 'huntsville');

// Registry
const reg = await import('../src/cities/index.js');
assert.equal(reg.DEFAULT_CITY_ID, 'huntsville');
// Assert the invariants, not the count: hardcoding the number here meant every new city
// broke the suite, and because `npm test` output was being grepped rather than checked for
// its exit code, that went unnoticed across several commits.
assert.ok(reg.CITIES.length >= 2, 'at least the origin city and one more');
const ids = reg.CITIES.map((c) => c.meta.id);
assert.ok(ids.includes('huntsville') && ids.includes('chattanooga'), 'the first two cities are registered');
assert.equal(new Set(ids).size, ids.length, 'city ids are unique');
for (const c of reg.CITIES) {
  const where = `city ${c.meta.id}`;
  assert.ok(/^[a-z][a-z0-9-]*$/.test(c.meta.id), `${where}: id is kebab-case`);
  assert.ok(c.meta.name, `${where}: has a name`);
  assert.ok(Number.isFinite(c.origin?.lat) && Number.isFinite(c.origin?.lon), `${where}: has a finite origin`);
  assert.ok(Math.abs(c.origin.lat) <= 90 && Math.abs(c.origin.lon) <= 180, `${where}: origin in range`);
  assert.ok(c.border?.lobes?.length, `${where}: has at least one border lobe`);
  assert.ok(Array.isArray(c.presets), `${where}: presets is an array`);
  assert.ok(c.pois && typeof c.pois === 'object', `${where}: has a pois object`);
  assert.ok(Array.isArray(c.interiors), `${where}: interiors is an array`);
  const intIds = c.interiors.map((i) => i.id);
  assert.equal(new Set(intIds).size, intIds.length, `${where}: interior ids are unique`);
  for (const i of c.interiors) {
    assert.ok(/^[a-z][a-z0-9-]*$/.test(i.id), `${where}: interior id ${i.id} is kebab-case`);
    assert.ok(i.name, `${where}: interior ${i.id} has a name`);
    assert.ok(Number.isFinite(i.lat) && Number.isFinite(i.lon), `${where}: interior ${i.id} has finite coordinates`);
    assert.ok(Number.isFinite(i.facing) && i.facing >= 0 && i.facing < 360, `${where}: interior ${i.id} faces 0-360`);
    assert.ok(typeof i.layout === 'string' && i.layout.length, `${where}: interior ${i.id} names a layout`);
  }
  assert.ok(Array.isArray(c.ballparks), `${where}: ballparks is an array`);
  const parkIds = c.ballparks.map((p) => p.id);
  assert.equal(new Set(parkIds).size, parkIds.length, `${where}: ballpark ids are unique`);
  for (const p of c.ballparks) {
    assert.ok(/^[a-z][a-z0-9-]*$/.test(p.id), `${where}: ballpark id ${p.id} is kebab-case`);
    assert.ok(p.name, `${where}: ballpark ${p.id} has a name`);
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon), `${where}: ballpark ${p.id} has finite coordinates`);
    assert.ok(Number.isFinite(p.centerField) && p.centerField >= 0 && p.centerField < 360,
      `${where}: ballpark ${p.id} needs a centre-field bearing of 0-360`);
    assert.ok(Number.isInteger(p.outs) && p.outs > 0, `${where}: ballpark ${p.id} needs a positive outs count`);
  }
  assert.ok(reg.CITIES.filter((x) => x.meta.origin).length === 1, 'exactly one origin city');
}
assert.equal(reg.activeCity().meta.id, 'huntsville', 'defaults to the origin city');
assert.equal(reg.selectCity('huntsville').meta.id, 'huntsville');
assert.equal(reg.selectCity('chattanooga').meta.id, 'chattanooga');
assert.throws(() => reg.selectCity('nope'), /unknown city/i, 'unknown id throws rather than silently defaulting');
reg.selectCity('huntsville'); // leave the registry on huntsville for the rest of this file
console.log('city: all assertions passed');

// Page-level city selection: the exported function used in main.js must handle
// known ids, unknown ids, undefined, and empty strings — never throwing, always returning.
assert.equal(reg.selectCityForPage('huntsville').meta.id, 'huntsville', 'a known id selects that city');
assert.equal(reg.selectCityForPage(undefined).meta.id, 'huntsville', 'a missing attribute falls back to the default');
assert.equal(reg.selectCityForPage('').meta.id, 'huntsville', 'an empty attribute falls back to the default');
assert.equal(reg.selectCityForPage('atlantis').meta.id, 'huntsville', 'an unknown id falls back rather than throwing');
assert.equal(reg.activeCity().meta.id, 'huntsville', 'the registry is left on a valid city');
console.log('city selection: all assertions passed');
