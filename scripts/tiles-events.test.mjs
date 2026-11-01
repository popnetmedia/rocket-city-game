#!/usr/bin/env node
/**
 * Guard: every event world.js subscribes to on the TilesRenderer must be one the
 * installed 3d-tiles-renderer actually dispatches.
 *
 * This exists because world.js listened for 'load-tile-set' to flip `world.ready`,
 * and 3d-tiles-renderer 0.5 fires 'load-root-tileset' instead. Nothing threw. The
 * flag just never went true, so the loading screen always read CONTACTING TILE
 * SERVER, and any boot that took longer than the 25 s watchdog (a cold cache, a slow
 * parse) was reported as UPLINK LOST while the tiles were streaming fine.
 *
 * Run: node scripts/tiles-events.test.mjs   (wired into `npm test`)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

// Events the library can emit: every `type: '<name>'` inside its source tree.
const dispatched = new Set();
for (const f of walk(join(root, 'node_modules/3d-tiles-renderer/src'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/type:\s*'([a-z][a-z-]*)'/g)) dispatched.add(m[1]);
}
if (!dispatched.size) { console.error('tiles-events: no events found in node_modules/3d-tiles-renderer/src'); process.exit(1); }

// Events world.js subscribes to on the tiles object.
const src = readFileSync(join(root, 'src/world.js'), 'utf8');
const listened = [...src.matchAll(/tiles\.addEventListener\(\s*'([^']+)'/g)].map((m) => m[1]);
if (!listened.length) { console.error('tiles-events: no tiles.addEventListener calls found in src/world.js'); process.exit(1); }

let failed = 0;
for (const ev of listened) {
  if (!dispatched.has(ev)) { console.error(`FAIL src/world.js listens for '${ev}', which 3d-tiles-renderer never dispatches`); failed++; }
}
if (failed) process.exit(1);
console.log(`tiles-events: ${listened.length} listener(s) checked, all dispatched by the library`);
