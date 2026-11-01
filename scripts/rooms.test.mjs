#!/usr/bin/env node
/**
 * Guard: the worker's city allowlist must match the city registry.
 *
 * server/do.js routes multiplayer joins to `${city}-${n}` and passes that straight to
 * idFromName(). Two things depend on the list being right:
 *
 *   - A city MISSING from it silently falls back to Huntsville, so its players land in
 *     Huntsville's rooms and see each other at scene coordinates from another city's
 *     origin — remote players scattered miles from anything.
 *   - The list is also the ALLOWLIST. Without it, ?city=<anything> would mint a new
 *     Durable Object namespace per value, unbounded, from unauthenticated input.
 *
 * The worker cannot import the registry (it must stay dependency-free for the Workers
 * bundle), so the list is duplicated by necessity — and this test is what stops the
 * duplicate drifting.
 *
 * Run: node scripts/rooms.test.mjs   (wired into `npm test`)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITIES } from '../src/cities/index.js';

const root = new URL('..', import.meta.url).pathname;
const src = readFileSync(root + 'server/do.js', 'utf8');

const m = src.match(/const CITY_IDS = \[([^\]]*)\]/);
assert.ok(m, 'server/do.js must declare CITY_IDS');
const inWorker = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
const inRegistry = CITIES.map((c) => c.meta.id);

const missing = inRegistry.filter((id) => !inWorker.includes(id));
const extra = inWorker.filter((id) => !inRegistry.includes(id));
assert.deepEqual(missing, [], `city registered but not in the worker allowlist: ${missing.join(', ')} — its players would be routed into Huntsville's rooms`);
assert.deepEqual(extra, [], `worker allowlist names a city that does not exist: ${extra.join(', ')}`);
assert.equal(inWorker[0], 'huntsville', 'the fallback (first entry) must be the origin city');

// the join path must be scoped, not hardcoded to one city
assert.ok(!/`huntsville-\$\{i\}`/.test(src), 'room names must be built from the requested city, not hardcoded to huntsville');
assert.ok(/\$\{city\}-\$\{i\}/.test(src), 'join must route to `${city}-${i}`');

console.log(`rooms: worker allowlist matches all ${inRegistry.length} registered cities`);
