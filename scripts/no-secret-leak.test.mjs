/**
 * The server-only keys must never reach the browser bundle.
 *
 * This repo's convention is VITE_-prefixed env vars, and Vite inlines those into the
 * client. TICKETMASTER_API_KEY deliberately breaks that convention; this test makes the
 * rule enforceable instead of a comment someone can forget.
 *
 * Skips quietly when dist/ has not been built.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const dist = root + 'dist';
if (!existsSync(dist)) {
  console.log('no-secret-leak: dist/ not built, skipped');
  process.exit(0);
}

const SERVER_ONLY = ['TICKETMASTER_API_KEY', 'TICKETMASTER_AFFILIATE'];
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|css|json|map)$/.test(e.name)) files.push(p);
  }
})(dist);

let bad = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const name of SERVER_ONLY) {
    if (text.includes(name)) {
      console.error(`FAIL  ${f.replace(root, '')} mentions ${name} — server-only keys must not ship`);
      bad++;
    }
  }
  // a literal Ticketmaster key would be a 32-char alnum next to the apikey param
  if (/apikey=[A-Za-z0-9]{20,}/.test(text)) {
    console.error(`FAIL  ${f.replace(root, '')} contains a literal apikey= value`);
    bad++;
  }
}
// A production bundle that still points at localhost is silently broken: multiplayer,
// and leaderboards all POST to the player's own machine and fail
// quietly. That shipped, and nothing caught it — VITE_MP_SERVER simply was not set in the
// Vercel project, so base() fell back to its dev default.
//
// Locally that default is CORRECT, so this only fails the build where it is not: Vercel
// sets VERCEL=1 on its builders. Everywhere else it warns.
{
  const onVercel = process.env.VERCEL === '1' || process.env.CI === 'true';
  // Match the RELAY specifically, not any mention of localhost: hud.js ships help text
  // for the API-key banner containing http://localhost:5173/* , which is documentation
  // and not a misconfiguration. Matching it failed every build for the wrong reason.
  const offenders = files.filter((f) => /ws:\/\/localhost|localhost:8787/.test(readFileSync(f, 'utf8')));
  if (offenders.length) {
    const how = onVercel ? 'FAIL ' : 'WARN ';
    console.error(`${how} bundle points at localhost — set VITE_MP_SERVER (and VITE_SCORES_URL) to the deployed worker,`);
    console.error(`       or multiplayer and leaderboards fail silently in production.`);
    for (const f of offenders) console.error(`       ${f.replace(root, '')}`);
    if (onVercel) bad++;
  }
}

// A high-entropy blob inlined into the client is a leaked key, whatever it is named.
// This has happened: a server-side token (openssl rand -base64 32) was pasted into
// VITE_MP_SERVER by mistake and went out in the public bundle. Because VITE_* is inlined
// by design, nothing else catches it. A URL never looks like this, so the check costs
// nothing and the failure mode is severe.
{
  const B64_32 = /["'`][A-Za-z0-9+/]{42,86}={0,2}["'`]/g;   // 32-64 raw bytes, base64
  const hits = [];
  for (const f of files) {
    for (const m of (readFileSync(f, 'utf8').match(B64_32) || [])) {
      const v = m.slice(1, -1);
      // base64 of a real key decodes to a round byte length and is not mostly one char
      if (v.length % 4 !== 0) continue;
      if (new Set(v).size < 16) continue;                    // padding, hashes of zeros, etc
      hits.push(`${f.replace(root, '')}: ${v.slice(0, 4)}… (${v.length} chars)`);
    }
  }
  if (hits.length) {
    console.error('FAIL  high-entropy value inlined into the client bundle — a key, not config:');
    for (const h of hits.slice(0, 6)) console.error(`       ${h}`);
    console.error('       VITE_* is inlined and public. If this is a secret, ROTATE it, then');
    console.error('       move it to a non-VITE_ variable read on the server.');
    bad++;
  }
}

console.log(`no-secret-leak: ${files.length} built files scanned`);
if (bad) process.exit(1);
console.log('no-secret-leak: no server-only key reached the bundle');
