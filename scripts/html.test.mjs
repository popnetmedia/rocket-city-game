/**
 * Structural check on every shipped HTML page.
 *
 * index.html was malformed (a stray </div>) and a landing page lost its </head> in an
 * edit, and neither showed up in a build or a browser, because browsers silently repair
 * broken markup. Agent crawlers and the accessibility tree are less forgiving, so this
 * makes the structure enforceable.
 */
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const VOID = new Set(['meta', 'link', 'br', 'img', 'input', 'hr', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

const pages = [
  ...readdirSync(root).filter((f) => f.endsWith('.html')),
  ...readdirSync(root + 'play').filter((f) => f.endsWith('.html')).map((f) => `play/${f}`),
];

let bad = 0;
for (const rel of pages) {
  // Script and style bodies contain markup inside string literals; strip them first.
  const src = readFileSync(root + rel, 'utf8')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const stack = [];
  const errs = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const [, close, tagRaw, attrs, selfClose] = m;
    const tag = tagRaw.toLowerCase();
    if (VOID.has(tag) || selfClose) continue;
    if (!close) { stack.push(tag); continue; }
    if (!stack.length) { errs.push(`stray </${tag}>`); continue; }
    if (stack[stack.length - 1] === tag) { stack.pop(); continue; }
    const at = stack.lastIndexOf(tag);
    if (at === -1) errs.push(`stray </${tag}>`);
    else { errs.push(`<${stack[stack.length - 1]}> not closed before </${tag}>`); stack.length = at; }
  }
  for (const t of stack) errs.push(`<${t}> never closed`);

  // essentials every page must carry
  const raw = readFileSync(root + rel, 'utf8');
  if (!/<\/head>/i.test(raw)) errs.push('missing </head>');
  if (!/<title>[^<]+<\/title>/i.test(raw)) errs.push('missing or empty <title>');
  if (!/rel="canonical"/i.test(raw)) errs.push('missing canonical link');
  // The city-landing template was the one template with no icon block, so all seven
  // city pages shipped without a declared favicon. Browsers fall
  // back to /favicon.ico so it was invisible, but the SVG, the apple-touch icon and
  // the manifest link were all lost on exactly the pages search traffic lands on.
  if (!/rel="(shortcut )?icon"/i.test(raw)) errs.push('no favicon declared');
  if (!/rel="apple-touch-icon"/i.test(raw)) errs.push('no apple-touch-icon');
  if (!/rel="manifest"/i.test(raw)) errs.push('no manifest link');
  for (const img of raw.match(/<img\b[^>]*>/gi) || []) {
    if (!/\balt=/i.test(img)) errs.push(`<img> without alt: ${img.slice(0, 50)}`);
  }

  if (errs.length) { bad++; console.error(`FAIL  ${rel}`); errs.slice(0, 5).forEach((e) => console.error(`        ${e}`)); }
}

// The home page carries a city count ("EIGHT CITIES ONLINE") and nothing watched it, so it
// once read "FOUR CITIES ONLINE" while eight were live. It is rendered from the registry
// and checked here, in both the template and the generated page.
{
  const { CITIES } = await import('../src/cities/index.js');
  // EVERY occurrence, not just the first: .match() without /g returns one hit.
  const WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const counted = {};
  for (const page of ['index.html', 'scripts/templates/home.html']) counted[page] = readFileSync(root + page, 'utf8');
  for (const [page, html] of Object.entries(counted)) {
    for (const m of html.matchAll(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+cities\b/gi)) {
      if (WORDS[m[1].toLowerCase()] !== CITIES.length) {
        bad++;
        console.error(`FAIL  ${page} — claims "${m[0]}" but ${CITIES.length} are live`);
      }
    }
  }
}

console.log(`html: ${pages.length} pages checked`);
if (bad) { console.error(`html: ${bad} page(s) with structural problems`); process.exit(1); }
console.log('html: all pages well-formed');
