#!/usr/bin/env node
/**
 * Guard: a top-level statement in main.js must not read a top-level const/let that is
 * declared further down the file.
 *
 * This exists because the video screens were constructed on line 78 with `world`, and
 * `world` was not declared until line 111. That is a ReferenceError (temporal dead zone)
 * the moment the module evaluates, which means main.js never finished booting: no mode
 * grid, no city name, and a FREE FLIGHT button with no listener, in every city at once.
 * `node --check`, the Vite build and every other test were green — the file is valid
 * JavaScript, it just cannot run.
 *
 * Only depth-0 lines are checked. A function body referencing a later const is fine,
 * because it runs after the whole module has evaluated. An IIFE would slip past this
 * (its body is not at depth 0), which is an accepted gap: the common case is a plain
 * `const a = new Thing(b)` landing above `const b`.
 *
 * Run: node scripts/tdz.test.mjs   (wired into `npm test`)
 */
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const FILES = ['src/main.js'];

function stripComments(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const chunk = src.slice(i, e < 0 ? n : e + 2); out += chunk.replace(/[^\n]/g, ' '); i = e < 0 ? n : e + 2; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); out += ' '.repeat((e < 0 ? n : e) - i); i = e < 0 ? n : e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; let j = i + 1;
      while (j < n && src[j] !== q) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1).replace(/[^\n]/g, ' '); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

let failed = 0;
for (const rel of FILES) {
  const lines = stripComments(readFileSync(root + rel, 'utf8')).split('\n');
  // Pass 1: which line declares each top-level const/let.
  const declLine = new Map();
  let depth = 0;
  const depthAt = [];
  for (let i = 0; i < lines.length; i++) {
    depthAt[i] = depth;
    const m = depth === 0 && /^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/.exec(lines[i]);
    if (m && !declLine.has(m[1])) declLine.set(m[1], i);
    for (const ch of lines[i]) { if (ch === '{' || ch === '(' || ch === '[') depth++; else if (ch === '}' || ch === ')' || ch === ']') depth--; }
  }
  // Pass 2: a depth-0 line that reads a name declared on a LATER line is a TDZ error.
  for (let i = 0; i < lines.length; i++) {
    if (depthAt[i] !== 0) continue;
    if (/^\s*(?:async\s+)?function\b/.test(lines[i])) continue; // hoisted; body runs later
    for (const [name, at] of declLine) {
      if (at <= i) continue;
      const re = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`);
      // Anything after `=>` is an arrow body: it runs later, so it may read a later const.
      const evaluatedNow = lines[i].split('=>')[0];
      if (re.test(evaluatedNow)) {
        // `const name = ...` on this very line declares it; anything else reads it.
        if (at === i) continue;
        console.error(`FAIL ${rel}:${i + 1} reads '${name}' before its declaration on line ${at + 1}`);
        failed++;
      }
    }
  }
}
if (failed) { console.error(`\n${failed} temporal-dead-zone reference(s). main.js will throw at boot.`); process.exit(1); }
console.log('tdz.test: ok');
