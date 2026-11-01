#!/usr/bin/env node
/**
 * Guard: a helper that is USED must actually be IMPORTED.
 *
 * This exists because the share-card photo button was broken in production and no
 * existing check could see it. When the cards were made city-aware, the import line
 * landed INSIDE the file's opening block comment:
 *
 *     /**
 *     import { activeCity, cityPlaceLabel } from './cities/index.js';
 *      * Generates a shareable score card ...
 *      *\/
 *
 * That is valid JavaScript — it is just comment text — so `node --check` passed, the
 * Vite build passed, and every test passed. An undefined free variable is only an
 * error when the line actually runs, which for a share card is a button almost no
 * automated path clicks. It shipped, and stayed shipped.
 *
 * So: strip comments first, then confirm every cross-module helper a file calls is
 * genuinely imported (or declared locally) in the stripped source.
 *
 * Run: node scripts/imports.test.mjs   (wired into `npm test`)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;

/** Remove block and line comments so anything hiding inside them stops counting as code. */
function stripComments(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; out += ' '; continue; }
    // skip string and template literals so a helper named inside prose is not "used"
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++; out += ' ';
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; continue;
    }
    out += c; i++;
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = `${dir}/${e}`;
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (e.endsWith('.js')) acc.push(p);
  }
  return acc;
}

// The helpers worth guarding: cross-module functions whose absence is a silent
// runtime ReferenceError rather than a build failure.
const SOURCES = {
  'src/cities/index.js': [],
  'src/huntdefs.js': [],
};
for (const f of Object.keys(SOURCES)) {
  const src = stripComments(readFileSync(root + f, 'utf8'));
  SOURCES[f] = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
}
const GUARDED = new Map();
for (const [file, names] of Object.entries(SOURCES)) for (const n of names) GUARDED.set(n, file);

let failures = 0, checked = 0;
for (const path of walk(root + 'src')) {
  const rel = path.slice(root.length);
  if (Object.keys(SOURCES).includes(rel)) continue;
  const code = stripComments(readFileSync(path, 'utf8'));
  for (const [name, from] of GUARDED) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(code)) continue;   // not used here
    checked++;
    const imported = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(code);
    const declared = new RegExp(`(?:function|const|let|var|class)\\s+${name}\\b`).test(code);
    if (!imported && !declared) {
      console.error(`FAIL  ${rel} calls ${name}() but never imports it (expected from ${from})`);
      failures++;
    }
  }
}

console.log(`imports: ${checked} cross-module call site(s) checked across src/`);
if (failures) { console.error(`imports: ${failures} missing import(s)`); process.exit(1); }
console.log('imports: every guarded helper is imported where it is used');
