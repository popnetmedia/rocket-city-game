#!/usr/bin/env node
/**
 * Bake OSM cells from LOCAL .osm XML instead of Overpass.
 *
 *   node scripts/bake-osm-local.mjs --city orlando --src <dir-of-.osm-files>
 *
 * Why this exists: bake-osm.mjs talks to Overpass, and Overpass has been returning 500s
 * or refusing connections across every mirror for days. Without baked cells the client
 * falls back to live Overpass, so a city with neither renders NO building outlines, road
 * labels or trees at all — which is what "the mapping around the buildings is off" looks
 * like from the air. The OSM core API (api.openstreetmap.org/api/0.6/map) still works; it
 * is capped at 50k nodes per call, so the data arrives as a pile of bbox downloads rather
 * than one query. This turns that pile into the same slim per-cell JSON the client reads.
 *
 * Cell keys are scene-space and therefore city-specific — the same flat-earth frame
 * bake-osm.mjs uses, so both writers agree.
 */
import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const CITY_ID = arg('--city', 'orlando');
const SRC = arg('--src', null);
if (!SRC) { console.error('need --src <dir of .osm files>'); process.exit(1); }

const city = (await import(`../src/cities/${CITY_ID}.js`)).default;
const CELL = 600;
const ORIGIN = { lat: city.origin.lat, lon: city.origin.lon };
const mPerLat = 110574, mPerLon = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toScene = (lat, lon) => ({ x: (lon - ORIGIN.lon) * mPerLon, z: -(lat - ORIGIN.lat) * mPerLat });
const OUT = new URL(`../public/osm/${CITY_ID}/`, import.meta.url).pathname;

// Only what the client actually renders, and only the tags it reads (see osm.js _ingest).
const KEEP = ['building', 'building:levels', 'height', 'name', 'natural', 'highway', 'man_made', 'surveillance:type', 'manufacturer', 'brand'];
const ROADS = /^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$/;
// Mirrors src/osm.js: canopies have no walls, and sub-60 m2 footprints are kiosk noise.
// Filtering here too keeps the shipped cells from carrying geometry the client discards.
const MIN_FOOTPRINT = 60;
// Mirrors src/osm.js. Residential stock is never drawn. Huntsville's baked cells hold 2,501 buildings of
// which 2% carry a real height and 1,143 are explicitly houses, garages or sheds — so a
// suburb rendered as a field of translucent boxes at a guessed 5-13 m, which is what it
// looked like. building=yes is ambiguous: downtown it is a real building, in a
// subdivision it is an untyped house, so it has to earn its place on footprint.
const RESIDENTIAL = new Set([
  'house', 'houses', 'residential', 'detached', 'semidetached_house', 'terrace',
  'bungalow', 'cabin', 'garage', 'garages', 'shed', 'carport', 'hut', 'roof',
]);
const MIN_UNTYPED = 400;    // m2 — building=yes below this is a house

const ringArea = (g) => {
  let a = 0;
  for (let i = 0; i < g.length; i++) {
    const p = g[i], q = g[(i + 1) % g.length];
    a += (p.lon * q.lat - q.lon * p.lat);
  }
  return Math.abs(a / 2) * 111320 * (111320 * Math.cos((g[0].lat * Math.PI) / 180));
};

const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function tagsOf(block) {
  const t = {};
  for (const m of block.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) t[unesc(m[1])] = unesc(m[2]);
  return t;
}
const slimTags = (t) => { const k = {}; for (const n of KEEP) if (t[n]) k[n] = t[n]; return k; };

const nodes = new Map();          // id -> [lat, lon]
const elements = new Map();       // dedupe across overlapping bboxes, by type:id

const files = readdirSync(SRC).filter((f) => f.endsWith('.osm'));
console.log(`reading ${files.length} .osm file(s) from ${SRC}`);

// pass 1: every node position, across all files (ways reference nodes from any bbox)
for (const f of files) {
  let xml;
  try { xml = readFileSync(`${SRC}/${f}`, 'utf8'); } catch { continue; }
  if (!xml.startsWith('<?xml')) { console.log(`  skip ${f} (not XML)`); continue; }
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) {
    nodes.set(m[1], [+m[2], +m[3]]);
  }
}
console.log(`  ${nodes.size} nodes`);

// pass 2: the features the client draws
for (const f of files) {
  let xml;
  try { xml = readFileSync(`${SRC}/${f}`, 'utf8'); } catch { continue; }
  if (!xml.startsWith('<?xml')) continue;
  // standalone nodes with tags (trees, cameras)
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"[^>]*?>([\s\S]*?)<\/node>/g)) {
    const t = tagsOf(m[4]);
    if (t.natural !== 'tree' && !t['surveillance:type'] && !t.man_made) continue;
    elements.set(`node:${m[1]}`, { type: 'node', id: +m[1], tags: slimTags(t), lat: +(+m[2]).toFixed(6), lon: +(+m[3]).toFixed(6) });
  }
  for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    const body = m[2];
    const t = tagsOf(body);
    const isBuilding = !!t.building;
    const isRoad = t.highway && ROADS.test(t.highway);
    if (!isBuilding && !isRoad) continue;
    const geometry = [];
    for (const nd of body.matchAll(/<nd ref="(\d+)"\s*\/>/g)) {
      const p = nodes.get(nd[1]);
      if (p) geometry.push({ lat: +p[0].toFixed(6), lon: +p[1].toFixed(6) });
    }
    if (geometry.length < (isBuilding ? 4 : 2)) continue;
    if (isBuilding) {
      if (RESIDENTIAL.has(t.building)) continue;
      const a = ringArea(geometry);
      if (a < MIN_FOOTPRINT) continue;
      if (t.building === 'yes' && a < MIN_UNTYPED) continue;
    }
    elements.set(`way:${m[1]}`, { type: 'way', id: +m[1], tags: slimTags(t), geometry });
  }
}
console.log(`  ${elements.size} drawable feature(s)`);

// bucket by the cell of each feature's centroid
const byCell = new Map();
for (const el of elements.values()) {
  const pts = el.geometry || [{ lat: el.lat, lon: el.lon }];
  let la = 0, lo = 0;
  for (const p of pts) { la += p.lat; lo += p.lon; }
  const s = toScene(la / pts.length, lo / pts.length);
  const key = `${Math.round(s.x / CELL)},${Math.round(s.z / CELL)}`;
  if (!byCell.has(key)) byCell.set(key, []);
  byCell.get(key).push(el);
}

mkdirSync(OUT, { recursive: true });
let written = 0, bytes = 0, merged = 0;
for (const [key, els] of byCell) {
  const path = `${OUT}${key}.json`;
  let all = els;
  if (existsSync(path)) {                       // never drop a previously baked cell
    try {
      const prev = JSON.parse(readFileSync(path, 'utf8')).elements || [];
      const seen = new Set(els.map((e) => `${e.type}:${e.id}`));
      all = [...els, ...prev.filter((e) => !seen.has(`${e.type}:${e.id}`))];
      merged++;
    } catch { /* corrupt cell: overwrite */ }
  }
  const json = JSON.stringify({ elements: all });
  writeFileSync(path, json);
  written++; bytes += json.length;
}
console.log(`bake-osm-local: wrote ${written} cell(s) for ${CITY_ID} (${(bytes / 1e6).toFixed(1)} MB, ${merged} merged)`);
