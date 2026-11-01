#!/usr/bin/env node
/**
 * Refilter a city's baked ALPR set to its CURRENT border lobes.
 *
 * Run after reshaping a city's border by hand: the file was filtered to whatever radius
 * the scaffold used, so a tighter border leaves cameras stranded outside the playable
 * area — on the map but unreachable, which is clutter rather than transparency.
 *
 *   node scripts/refilter-alpr.mjs orlando miami
 */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 91600);

for (const id of process.argv.slice(2)) {
  const city = (await import(`../src/cities/${id}.js`)).default;
  if (!city.alpr) { console.log(`  ${id}: no alpr file`); continue; }
  const path = `${root}public${city.alpr}`;
  const all = JSON.parse(readFileSync(path, 'utf8'));
  const lobes = city.border.lobes, zones = city.border.nofly || [];
  const kept = all.filter(([lat, lon]) => {
    const p = { lat, lon };
    return lobes.some((l) => dist(p, l) <= l.r) && !zones.some((z) => dist(p, z) < z.r);
  });
  writeFileSync(path, JSON.stringify(kept));
  console.log(`  ${id}: ${all.length} -> ${kept.length} cameras (${all.length - kept.length} outside the border removed)`);
}
