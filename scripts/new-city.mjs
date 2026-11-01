#!/usr/bin/env node
/**
 * Scaffold a new city.
 *
 *   node scripts/new-city.mjs --id chattanooga --name Chattanooga \
 *     --region Tennessee --region-code TN --lat 35.0456 --lon -85.3097 [--radius 16000]
 *
 * Writes src/cities/<id>.js, fetches that city's real ALPR cameras, renders its play
 * page, and wires up vite.config.js, the sitemap and the home page. Then runs the
 * validator, because an unreachable objective is the one bug class this project has
 * shipped twice.
 *
 * IT NEVER INVENTS A COORDINATE. Presets, POIs, races, tours, districts, shops, events
 * and landmarks are written empty with a TODO naming what has to be sourced by hand.
 * The city boots and flies; its local content is a research job, not a codegen job.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
// DeFlock publishes cameras in 20-degree region tiles. This was hardcoded to 20/-100,
// which covers the south-east US — every city built so far. Anaheim sits in 20/-120, so
// the hardcoded tile would have returned a city with ZERO cameras and no Flock hunt,
// silently. Derive the tiles from the coordinates instead, and take every tile the
// radius touches so a city near a boundary does not lose half its cameras.
const REGION_STEP = 20;
const regionTiles = (lat, lon, radiusM) => {
  const dLat = radiusM / 111320, dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const floor = (v) => Math.floor(v / REGION_STEP) * REGION_STEP;
  const tiles = new Set();
  for (const la of [lat - dLat, lat + dLat]) {
    for (const lo of [lon - dLon, lon + dLon]) tiles.add(`${floor(la)}/${floor(lo)}`);
  }
  return [...tiles].map((t) => `https://cdn.deflock.me/regions/${t}.json`);
};

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i === process.argv.length - 1) {
    if (fallback !== undefined) return fallback;
    console.error(`missing required --${name}`);
    process.exit(1);
  }
  return process.argv[i + 1];
}

const id = arg('id').toLowerCase();
const name = arg('name');
const region = arg('region');
const regionCode = arg('region-code').toUpperCase();
const lat = Number(arg('lat'));
const lon = Number(arg('lon'));
const radius = Number(arg('radius', '16000'));

if (!/^[a-z][a-z0-9-]*$/.test(id)) { console.error(`--id must be kebab-case: got "${id}"`); process.exit(1); }
if (!Number.isFinite(lat) || Math.abs(lat) > 90) { console.error(`--lat out of range: ${lat}`); process.exit(1); }
if (!Number.isFinite(lon) || Math.abs(lon) > 180) { console.error(`--lon out of range: ${lon}`); process.exit(1); }
if (!Number.isFinite(radius) || radius <= 0) { console.error(`--radius must be positive`); process.exit(1); }
if (existsSync(`${root}src/cities/${id}.js`)) { console.error(`src/cities/${id}.js already exists`); process.exit(1); }

const dist = (aLat, aLon, bLat, bLon) => Math.hypot((aLat - bLat) * 111320, (aLon - bLon) * 91600);

/** Nearest NWS observation station — keyless, and drives the live weather readout. */
async function nearestStation() {
  try {
    const pts = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers: { 'User-Agent': 'rocketcity.cc' } });
    if (!pts.ok) return null;
    const url = (await pts.json())?.properties?.observationStations;
    if (!url) return null;
    const st = await fetch(url, { headers: { 'User-Agent': 'rocketcity.cc' } });
    if (!st.ok) return null;
    const first = (await st.json())?.features?.[0]?.properties?.stationIdentifier;
    return first || null;
  } catch { return null; }
}

/** Real ALPR cameras inside the playable lobe, from the same OSM-derived DeFlock feed. */
async function fetchCameras() {
  const urls = regionTiles(lat, lon, radius);
  const all = [];
  for (const u of urls) {
    const r = await fetch(u);
    // A tile that is all ocean legitimately 404s; only fail if NOTHING resolved.
    if (!r.ok) { console.warn(`  DeFlock ${u.split('/regions/')[1]} -> ${r.status}, skipping`); continue; }
    all.push(...(await r.json()));
  }
  if (!all.length) throw new Error(`DeFlock returned no data for ${urls.join(', ')}`);
  console.log(`  DeFlock: ${all.length} cameras across ${urls.length} region tile(s)`);
  const out = all
    .filter((e) => dist(e.lat, e.lon, lat, lon) <= radius)
    .map((e) => {
      let dir = Number((e.tags || {}).direction);
      if (!Number.isFinite(dir)) dir = 0;
      return [Number(e.lat.toFixed(6)), Number(e.lon.toFixed(6)), ((Math.round(dir) % 360) + 360) % 360];
    });
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out;
}

console.log(`scaffolding ${name} (${id}) at ${lat}, ${lon} — ${(radius / 1000).toFixed(1)} km lobe`);
const station = await nearestStation();
console.log(station ? `  weather station: ${station}` : '  weather station: NOT FOUND — set city.weather.station by hand');

let cams = [];
try { cams = await fetchCameras(); } catch (e) { console.warn(`  ALPR feed unavailable (${e.message}); leaving the camera set out`); }
const alprPath = cams.length ? `/alpr/${id}.json` : null;
if (cams.length) {
  writeFileSync(`${root}public/alpr/${id}.json`, JSON.stringify(cams));
  console.log(`  ${cams.length} ALPR cameras -> public/alpr/${id}.json`);
} else {
  console.log('  no ALPR cameras in range — the Flock hunt will not be offered here');
}

// ---- the city module ----
writeFileSync(`${root}src/cities/${id}.js`, `/**
 * ${name}, ${region}.
 *
 * Scaffolded by scripts/new-city.mjs. The world boots and flies from this alone.
 *
 * Every content list below is deliberately EMPTY. Do not invent coordinates to fill
 * them — source real ones the way Huntsville's were (see src/cities/huntsville.js) and
 * add them here. The menus omit whatever is missing, so an empty list costs nothing but
 * a made-up one ships an objective nobody can reach.
 */
export default {
  meta: {
    id: '${id}',
    name: '${name}',
    region: '${region}',
    regionCode: '${regionCode}',
    tagline: '',                         // TODO: a short local nickname
    origin: false,
    // Every city flies something of its own. 'saturn' is Huntsville's — leaving it here
    // would hand this city the origin city's rocket. Build one in src/characters.js.
    character: 'saturn',                 // TODO: replace with a local flyer
  },
  origin: { lat: ${lat}, lon: ${lon}, name: 'Downtown' },
  spawn: { look: [${lat}, ${lon}], from: [${(lat - 0.004).toFixed(4)}, ${(lon + 0.002).toFixed(4)}], alt: 210 },
  weather: { station: ${station ? `'${station}'` : "null /* TODO: nearest NWS station */"} },
${alprPath ? `  // ${cams.length} real DeFlock ALPR cameras (OSM-derived, ODbL) inside the playable lobe.\n  alpr: '${alprPath}',\n` : '  // No ALPR cameras found in range.\n  alpr: null,\n'}  // Optional billboard slot, top-left on desktop. Hidden unless enabled + image are set.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  // Playable area. TODO: shape these lobes to the real city; one circle is a placeholder.
  border: {
    lobes: [
      { lat: ${lat}, lon: ${lon}, r: ${radius} },
    ],
    nofly: [],                           // TODO: restricted airspace, if any
  },
  presets: [],                           // TODO: teleport landmarks
  pois: {
    starbucks: [], breweries: [], bowling: [], pickleball: [], hospitals: [], golfCourses: [],
  },
  races: [],                             // TODO: race routes
  tours: [],                             // TODO: guided tours
  districts: [],                         // TODO: named neighbourhoods
  scenarios: [],                         // TODO: local events
  landmarks: [],                         // TODO: curated landmark signs
  shops: [],                             // TODO: storefront cards
  interiors: [],                         // TODO: enterable rooms
  ballparks: [],                         // TODO: home run derby fields
  fieldDecals: [],                       // TODO: stadium roundels
};
`);
console.log(`  wrote src/cities/${id}.js`);

// ---- registry ----
const regPath = `${root}src/cities/index.js`;
let reg = readFileSync(regPath, 'utf8');
reg = reg.replace(/^(import .+ from '\.\/[a-z0-9-]+\.js';\n)(?![\s\S]*^import .+ from '\.\/[a-z0-9-]+\.js';)/m,
  (m0) => `${m0}import ${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} from './${id}.js';\n`);
reg = reg.replace(/export const CITIES = \[([^\]]*)\]/,
  (_, inner) => `export const CITIES = [${inner.trim().replace(/,$/, '')}, ${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}]`);
writeFileSync(regPath, reg);
console.log('  registered in src/cities/index.js');

// ---- vite input ----
const vitePath = `${root}vite.config.js`;
let vite = readFileSync(vitePath, 'utf8');
const key = 'play' + id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
if (!vite.includes(`play/${id}.html`)) {
  vite = vite.replace(/(\n(\s*)play: resolve\(__dirname, 'play\.html'\),)/,
    `$1\n$2${key}: resolve(__dirname, 'play/${id}.html'),`);
  // the city's landing page (/<id>) is a separate entry from its play page
  vite = vite.replace(/(\n(\s*)play: resolve\(__dirname, 'play\.html'\),)/,
    `$1\n$2city${id.charAt(0).toUpperCase()}${id.slice(1)}: resolve(__dirname, '${id}.html'),`);
  writeFileSync(vitePath, vite);
  console.log(`  added ${key} + landing page to vite.config.js`);
}

// ---- sitemap ----
const smPath = `${root}public/sitemap.xml`;
let sm = readFileSync(smPath, 'utf8');
if (!sm.includes(`/play/${id}<`)) {
  sm = sm.replace('</urlset>', `  <url>\n    <loc>https://rocketcity.cc/play/${id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`);
  writeFileSync(smPath, sm);
  console.log('  added to public/sitemap.xml');
}

// ---- home page nav ----
const idxPath = `${root}index.html`;
let idx = readFileSync(idxPath, 'utf8');
if (!idx.includes(`/play/${id}"`)) {
  idx = idx.replace('<a href="https://github.com/popnetmedia/rocket-city-game">GitHub</a>', `<a href="/play/${id}">${name}</a><a href="https://github.com/popnetmedia/rocket-city-game">GitHub</a>`);
  // hero button too — the nav link alone leaves the new city invisible above the fold
  idx = idx.replace(/(\n(\s*)<span class="free">)/,
    `\n$2<a class="btn alt" href="/play/${id}">▶ ${name}</a>$1`);
  writeFileSync(idxPath, idx);
  console.log('  linked from index.html (nav + hero)');
}
console.log('  NOTE: the hero blurb still describes the launch cities — reword it by hand.');

console.log('\nrendering play pages…');
execFileSync(process.execPath, [`${root}scripts/sync-city-pages.mjs`], { stdio: 'inherit' });
console.log('\nvalidating…');
execFileSync(process.execPath, [`${root}scripts/validate-data.mjs`], { stdio: 'inherit' });
console.log(`\n${name} is bootable at /play/${id}. Everything marked TODO still needs real, sourced data.`);
