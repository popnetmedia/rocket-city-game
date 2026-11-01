#!/usr/bin/env node
/**
 * Pre-bake OSM cells to static JSON so players never hit Overpass.
 *
 *   node scripts/bake-osm.mjs                # bake all cells inside the border (~2300; 1 req/s ≈ 40-80 min)
 *   node scripts/bake-osm.mjs --limit 20     # bake the next N missing cells (resumable)
 *   node scripts/bake-osm.mjs --center-only  # just the 5x5 cells around downtown (quick start)
 *
 * Writes public/osm/<city>/<cx>,<cz>.json (slimmed elements). Cell keys are scene-space,
 * so they mean a different place in each city — hence the per-city folder.
 * Set CITY=<id> to bake another city and MILES=<n> for the radius (default 3).
 *
 * SIZE WARNING: cells are 600 m, so the count grows with the square of the radius.
 * 3 mi is ~200 cells and ~18 MB; 10 mi is ~2,260 cells and ~200 MB; 20 mi is ~9,000
 * cells, ~800 MB and 9,000 Overpass queries per city — which is both unshippable in
 * a static site and abusive to a free API. Bake the core, let Overpass do the rest.
 * Already-baked cells are
 * skipped, so you can run it in chunks / resume after rate limits. Deploy the
 * public/ folder as usual — the client prefers /osm/<city>/<key>.json and only falls
 * back to live Overpass for unbaked cells.
 */
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const CITY_ID = process.env.CITY || 'huntsville';
const city = (await import(`../src/cities/${CITY_ID}.js`)).default;

const CELL = 600;
// Radius to bake, in miles. The whole playable area is far more than is worth baking —
// see the note at the top — so this defaults to the downtown core and live Overpass
// fills the rest in when it is reachable.
const MILES = Number(process.env.MILES || 3);
const RADIUS = MILES * 1609.34;

// Origin, border centre and output folder all come from the city, so CITY=<id> bakes that
// city rather than writing Huntsville's geometry into another city's folder.
const ORIGIN = { lat: city.origin.lat, lon: city.origin.lon };
const biggest = city.border.lobes.reduce((a, b) => (b.r > a.r ? b : a));
const BORDER = { lat: biggest.lat, lon: biggest.lon };
const OUT = new URL(`../public/osm/${CITY_ID}/`, import.meta.url).pathname;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const CENTER_ONLY = args.includes('--center-only');

// flat-earth approximation of the client's ENU frame (fine at cell granularity)
const mPerLat = 110574, mPerLon = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toScene = (lat, lon) => ({ x: (lon - ORIGIN.lon) * mPerLon, z: -(lat - ORIGIN.lat) * mPerLat });
const toGeo = (x, z) => ({ lat: ORIGIN.lat - z / mPerLat, lon: ORIGIN.lon + x / mPerLon });
const bc = toScene(BORDER.lat, BORDER.lon);

const cells = [];
const range = Math.ceil((RADIUS + CELL) / CELL);
for (let cx = -range + Math.round(bc.x / CELL); cx <= range + Math.round(bc.x / CELL); cx++) {
  for (let cz = -range + Math.round(bc.z / CELL); cz <= range + Math.round(bc.z / CELL); cz++) {
    const d = Math.hypot(cx * CELL - bc.x, cz * CELL - bc.z);
    if (d > RADIUS + CELL) continue;
    if (CENTER_ONLY && (Math.abs(cx) > 2 || Math.abs(cz) > 2)) continue;
    cells.push([cx, cz]);
  }
}
// nearest-to-downtown first so partial bakes cover the interesting area
cells.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));

mkdirSync(OUT, { recursive: true });
const have = new Set(readdirSync(OUT).map((f) => f.replace('.json', '')));
const todo = cells.filter(([cx, cz]) => !have.has(`${cx},${cz}`)).slice(0, LIMIT);
console.log(`cells total ${cells.length}, baked ${have.size}, baking now: ${todo.length}`);

const slim = (el) => {
  const t = el.tags || {};
  const keep = {};
  for (const k of ['building', 'building:levels', 'height', 'name', 'natural', 'highway', 'man_made', 'surveillance:type', 'manufacturer', 'brand']) if (t[k]) keep[k] = t[k];
  const out = { type: el.type, id: el.id, tags: keep };
  if (el.geometry) out.geometry = el.geometry.map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) }));
  if (el.lat) { out.lat = +el.lat.toFixed(6); out.lon = +el.lon.toFixed(6); }
  return out;
};

let ep = 0, ok = 0, fail = 0;
for (const [cx, cz] of todo) {
  const centre = toGeo(cx * CELL, cz * CELL);
  const at = `(around:${Math.round(CELL * 0.72)},${centre.lat.toFixed(6)},${centre.lon.toFixed(6)})`;
  const q = `[out:json][timeout:25];(way["building"]${at};node["natural"="tree"]${at};way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"]${at};);out geom 1500;`;
  let done = false;
  for (let attempt = 0; attempt < ENDPOINTS.length && !done; attempt++) {
    try {
      const res = await fetch(ENDPOINTS[ep % ENDPOINTS.length], {
        method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'rocket-city-game-baker/1.0' },
      });
      if (!res.ok) throw new Error('http ' + res.status);
      const j = await res.json();
      const els = (j.elements || []).map(slim);
      writeFileSync(`${OUT}${cx},${cz}.json`, JSON.stringify({ elements: els }));
      ok++;
      console.log(`✓ ${cx},${cz}  (${els.length} elements)  [${ok}/${todo.length}]`);
      done = true;
    } catch (e) {
      ep++;
      console.log(`✗ ${cx},${cz} ${e.message} — rotating endpoint`);
    }
  }
  if (!done) { fail++; if (fail > 5) { console.log('too many failures — stopping (resume later, already-baked cells are kept)'); break; } }
  await new Promise((r) => setTimeout(r, 1100)); // Overpass etiquette: ~1 req/s
}
console.log(`done: ${ok} baked, ${fail} failed. Re-run to resume.`);

// ---- ALPR snapshot from DeFlock's CDN (fast, no rate limits) ----
try {
  const r = await fetch('https://cdn.deflock.me/regions/20/-100.json');
  const all = await r.json();
  const near = all.filter((e) => e.lat > 34.4 && e.lat < 35.05 && e.lon > -87.05 && e.lon < -86.2)
    .map((e) => [+e.lat.toFixed(6), +e.lon.toFixed(6), (e.tags && e.tags.direction != null) ? +e.tags.direction || 0 : 0]);
  writeFileSync(new URL('../public/alpr.json', import.meta.url).pathname, JSON.stringify(near));
  console.log(`alpr.json: ${near.length} cameras baked from DeFlock`);
} catch (e) { console.log('alpr bake failed:', e.message); }
