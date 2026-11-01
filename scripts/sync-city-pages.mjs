#!/usr/bin/env node
/**
 * Render every city's play page from one template.
 *
 * The pages are 348 lines of identical HUD markup that differ in about ten <head> lines.
 * Kept by hand they drift: a HUD element added to one city's page and not another's is
 * invisible until that city boots and a getElementById returns null. One template, one
 * command, and `--check` (wired into npm test) fails if a page no longer matches.
 *
 *   node scripts/sync-city-pages.mjs           rewrite the pages
 *   node scripts/sync-city-pages.mjs --check   fail if any page is stale
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { CITIES } from '../src/cities/index.js';
import { huntsForCity } from '../src/huntdefs.js';

const root = new URL('..', import.meta.url).pathname;
// cities rendering with the generic fallback blurb; reported at the end of a sync
const genericBlurbs = [];
const template = readFileSync(root + 'scripts/templates/play-city.html', 'utf8');
const landingTpl = readFileSync(root + 'scripts/templates/city-landing.html', 'utf8');
const homeStyle = readFileSync(root + 'scripts/templates/_home-style.css', 'utf8');
const homeTpl = readFileSync(root + 'scripts/templates/home.html', 'utf8');
const check = process.argv.includes('--check');

/** Origin city lives at /play; every other city at /play/<id>. */
export const pagePathFor = (city) => (city.meta.origin ? 'play.html' : `play/${city.meta.id}.html`);
export const routeFor = (city) => (city.meta.origin ? '/play' : `/play/${city.meta.id}`);

function render(city) {
  const m = city.meta;
  const seo = m.seo || {};
  const where = m.region ? `${m.name}, ${m.region}` : m.name;
  const fields = {
    CITY_ID: m.id,
    TITLE: `Play Rocket City CC — 3D ${m.name} Flight Game`,
    URL: `https://rocketcity.cc${routeFor(city)}`,
    DESCRIPTION: seo.description
      || `Play Rocket City CC in your browser. Fly a rocket over photoreal 3D ${where}. Free, no install.`,
    OG_DESCRIPTION: seo.ogDescription || `Fly over ${where} in a rocket. Free in your browser.`,
    TWITTER_DESCRIPTION: seo.twitterDescription || `Fly over ${where} in a rocket. Free in your browser.`,
    IMAGE_ALT: seo.imageAlt || `A rocket flying over a photorealistic 3D ${where}.`,
  };
  let out = template;
  for (const [k, v] of Object.entries(fields)) out = out.replaceAll(`{{${k}}}`, v);
  const left = out.match(/\{\{(\w+)\}\}/g);
  if (left) throw new Error(`unfilled token(s) in ${m.id}: ${[...new Set(left)].join(', ')}`);
  return out;
}

/**
 * Races a city actually shows. huntsForCity() already drops hidden hunts, but races are
 * read straight off the module in three places here — so a race hidden in-game was still
 * being advertised on the landing page, with a leaderboard for a mode nobody can start.
 */
const visibleRaces = (city) => {
  const hidden = new Set(city.meta?.hiddenModes || []);
  return (city.races || []).filter((r) => !hidden.has(r.id));
};

/** Leaderboards this city actually has: its own races, plus the hunts it has data for. */
function boardsFor(city) {
  const races = visibleRaces(city).map((r) => ({ id: r.id, name: r.name, sub: 'Race · best time', type: 'time' }));
  const hunts = huntsForCity(city).map((h) => ({
    id: h.board, name: h.name.replace(/^[^A-Za-z]+/, ''), sub: `Hunt · ${h.label.toLowerCase()}`, type: 'count',
  }));
  return [...races, ...hunts];
}

/** Only claim what the city actually has — an empty list is left out, never padded. */
function statsFor(city) {
  const p = city.pois || {};
  const cams = city.alpr ? JSON.parse(readFileSync(root + 'public' + city.alpr, 'utf8')).length : 0;
  const rows = [
    [cams, 'mapped ALPR cameras', 'Real DeFlock data, hunted in-game'],
    [(city.shops || []).length, 'storefronts', 'Standing at their surveyed addresses'],
    [visibleRaces(city).length, 'races', 'Timed runs with public leaderboards'],
    [(city.presets || []).length, 'quick-jump landmarks', 'Teleport straight to them'],
    [(city.districts || []).length, 'named districts', 'Announced as you cross into them'],
    [(p.golfCourses || []).length, 'golf courses', 'Playable holes on real geometry'],
  ].filter(([n]) => n > 0);
  return rows.map(([n, label, sub]) =>
    `<div class="board"><h3>${n}</h3><div class="sub">${esc(label)}</div><p class="muted" style="font-size:13px;margin-top:6px">${esc(sub)}</p></div>`).join('\n      ');
}

function modesFor(city) {
  const out = [];
  if (city.alpr) out.push(['Find the Flock', 'Hunt every mapped surveillance camera in the city.']);
  for (const r of visibleRaces(city)) out.push([r.name, 'Timed run against a public leaderboard.']);
  if (city.pois?.honkytonks?.length) out.push(['Honky-Tonk Crawl', `Hit all ${city.pois.honkytonks.length} bars on the strip.`]);
  if (city.pois?.golfCourses?.length) out.push(['Golf', 'Play real holes on real course geometry.']);
  if (city.tours?.length) out.push(['Guided tours', 'Sit back and let the city fly itself.']);
  out.push(['Free flight', 'No objective — just fly the real city.']);
  return out.map(([n, d]) =>
    `<div class="board"><h3>${esc(n)}</h3><p class="muted" style="font-size:13px;margin-top:6px">${esc(d)}</p></div>`).join('\n      ');
}

const missingShots = [];
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderLanding(city) {
  const m = city.meta;
  const where = m.region ? `${m.name}, ${m.region}` : m.name;
  const play = routeFor(city);
  const url = `https://rocketcity.cc/${m.id}`;
  const nav = CITIES.map((c) => `<a href="/${c.meta.id}">${esc(c.meta.name)}</a>`).join('');
  const boards = boardsFor(city);
  const desc = `Fly a rocket over a photorealistic 3D ${where} in your browser. `
    + `${boards.length ? boards.length + ' scored modes, ' : ''}real landmarks, free, no install.`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'VideoGame', '@id': `${url}#game`, name: `Rocket City CC — ${m.name}`, url,
        description: desc, playMode: 'SinglePlayer',
        applicationCategory: 'GameApplication', gamePlatform: 'Web browser', operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        gameLocation: { '@type': 'Place', name: where,
          geo: { '@type': 'GeoCoordinates', latitude: city.origin.lat, longitude: city.origin.lon } } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Rocket City CC', item: 'https://rocketcity.cc/' },
        { '@type': 'ListItem', position: 2, name: m.name, item: url }] },
    ],
  }, null, 2);
  // The hero was hardcoded to /img/hero-saturn-v.jpg in the shared stylesheet, so
  // every city's sales page led with Huntsville's rocket. Same convention as the
  // home page rows: img/city-<id>.jpg when it exists. When it does not, no image at
  // all -- the dark hero reads as deliberate, where another city's skyline reads as
  // a mistake, which is the bug being fixed here. Missing shots are named on stdout.
  const shot = `img/city-${m.id}.jpg`;
  const hasShot = existsSync(root + 'public/' + shot);
  if (!hasShot) missingShots.push(m.id);

  const fields = {
    HERO_STYLE: hasShot ? ` style="background-image:url('/${shot}')"` : ' style="background-image:none"',
    TITLE: `Fly ${where} in 3D — Rocket City CC`,
    DESCRIPTION: desc, URL: url, STYLE: homeStyle, JSONLD: jsonld, NAV: nav,
    CITY: m.name, CITY_UPPER: m.name.toUpperCase(), PLAY_PATH: play,
    LEDE: `${m.tagline ? esc(m.tagline) + '. ' : ''}Photorealistic Google 3D of the real ${esc(m.name)}, `
      + `flown in a browser. ${boards.length ? 'Race it, hunt it, or just explore.' : 'Free flight while the local games are built.'}`,
    HEADLINE: `The real ${esc(m.name)}, at its real coordinates`,
    BLURB: 'Everything below is sourced data at surveyed positions — nothing is invented or decorative.',
    STATS: statsFor(city), MODES: modesFor(city),
    BOARDS_JSON: JSON.stringify(boards),
  };
  let out = landingTpl;
  for (const [k, v] of Object.entries(fields)) out = out.replaceAll(`{{${k}}}`, v);
  const left = out.match(/\{\{(\w+)\}\}/g);
  if (left) throw new Error(`unfilled token(s) on the ${m.id} landing page: ${[...new Set(left)].join(', ')}`);
  return out;
}

/**
 * One full-width row per city on the home page, generated so a new city appears there the
 * day it is scaffolded. Uses /img/city-<id>.jpg when that screenshot exists and a tinted
 * gradient when it does not, so an un-photographed city still looks deliberate.
 */
function homeRows() {
  return CITIES.map((c) => {
    const m = c.meta;
    const shot = `img/city-${m.id}.jpg`;
    const hasShot = existsSync(root + 'public/' + shot);
    const p = c.pois || {};
    const cams = c.alpr ? JSON.parse(readFileSync(root + 'public' + c.alpr, 'utf8')).length : 0;
    const bits = [
      cams && `${cams} mapped cameras`,
      visibleRaces(c).length && `${visibleRaces(c).length} race${visibleRaces(c).length > 1 ? 's' : ''}`,
      (c.shops || []).length && `${c.shops.length} storefronts`,
      p.golfCourses?.length && `${p.golfCourses.length} golf courses`,
    ].filter(Boolean);
    // Keyed, not a ternary chain. The chain ended in Chattanooga's sentence as its
    // fallback, so Anaheim shipped describing "the Tennessee River, the bridges and
    // downtown" — a new city silently inherited another city's copy. The fallback is now
    // generic and therefore never wrong, and anything using it is named on stdout.
    const BLURBS = {
      huntsville: 'The original, and much the deepest: nineteen districts, power-line trench runs through the mountains, playable golf on real course geometry, and coin runs to real venues.',
      nashville: 'Lower Broadway at surveyed coordinates \u2014 39 venues, eleven of them carrying a country star\u2019s name \u2014 plus the alley the Opry crowd used to reach Tootsie\u2019s back door.',
      orlando: 'The Universal corridor and the whole Walt Disney World resort \u2014 four Disney parks, Epic Universe, Volcano Bay and SeaWorld, with twenty-one coasters and every park land naming itself as you cross it.',
      miami: 'Miami and the Beach, up the coast to Fort Lauderdale and west to Sunrise \u2014 a corridor rather than a circle.',
      knoxville: 'Downtown and the Tennessee River valley, flown with the Sunsphere itself.',
      chattanooga: 'The Tennessee River, the bridges and downtown, in photoreal 3D.',
      anaheim: 'Disneyland and California Adventure at surveyed coordinates, Knott\u2019s Berry Farm eight kilometres up the road, and both arenas \u2014 fourteen coasters across three parks, flown on a surfboard.',
    };
    const blurb = BLURBS[m.id]
      || `Photorealistic Google 3D of the real ${esc(m.name)}, ${esc(m.region)}.`;
    if (!BLURBS[m.id]) genericBlurbs.push(m.id);
    const style = hasShot ? ` style="background-image:url('/${shot}')"` : '';
    return `  <section class="cityRow${hasShot ? '' : ' noshot'}"${style}><div class="wrap">
    <div class="where">${esc(m.region)}${m.tagline ? ' · ' + esc(m.tagline) : ''}</div>
    <h3>${esc(m.name)}</h3>
    <p>${blurb}</p>
    ${bits.length ? `<div class="stat">${esc(bits.join(' · '))}</div>` : ''}
    <div class="row-actions">
      <a class="btn" href="${routeFor(city_route(c))}">▶ Fly over ${esc(m.name)}</a>
      <a class="more" href="/${m.id}">City details &amp; leaderboards</a>
    </div>
  </div></section>`;
  }).join('\n');
}
const city_route = (c) => c;   // routeFor takes the city object

let stale = 0;

// home page: regenerated so its city rows never drift from the registry
{
  const html = homeTpl.replaceAll('{{CITY_ROWS}}', homeRows());
  const left = html.match(/\{\{(\w+)\}\}/g);
  if (left) throw new Error(`unfilled token(s) on the home page: ${[...new Set(left)].join(', ')}`);
  let cur = null;
  try { cur = readFileSync(root + 'index.html', 'utf8'); } catch { /* new */ }
  if (cur !== html) {
    if (check) { console.error('STALE  index.html — differs from the template; run: npm run cities:sync'); stale++; }
    else { writeFileSync(root + 'index.html', html); console.log('  wrote index.html'); }
  }
}

for (const city of CITIES) {
  // city landing page: /<id>
  const lrel = `${city.meta.id}.html`;
  const lhtml = renderLanding(city);
  let lcur = null;
  try { lcur = readFileSync(root + lrel, 'utf8'); } catch { /* new */ }
  if (lcur !== lhtml) {
    if (check) { console.error(`STALE  ${lrel} — differs from the template; run: npm run cities:sync`); stale++; }
    else { writeFileSync(root + lrel, lhtml); console.log(`  wrote ${lrel}`); }
  }
}

for (const city of CITIES) {
  const rel = pagePathFor(city);
  const html = render(city);
  let current = null;
  try { current = readFileSync(root + rel, 'utf8'); } catch { /* new city */ }
  if (current === html) continue;
  if (check) {
    console.error(`STALE  ${rel} — differs from the template; run: npm run cities:sync`);
    stale++;
  } else {
    mkdirSync(dirname(root + rel), { recursive: true });
    writeFileSync(root + rel, html);
    console.log(`  wrote ${rel}`);
  }
}

// A city with no photo leads with a blank hero: correct, but temporary. Reported in
// both modes, the way the generic-blurb fallback already is.
if (missingShots.length) {
  console.log(`      no featured image (public/img/city-<id>.jpg), hero left blank: ${missingShots.join(', ')}`);
}

if (check) {
  if (stale) { console.error(`sync-city-pages: ${stale} page(s) stale`); process.exit(1); }
  console.log(`sync-city-pages: ${CITIES.length} city page(s) match the template`);
} else {
  if (genericBlurbs.length) {
  console.log(`      generic home-page blurb (write real copy): ${genericBlurbs.join(', ')}`);
}
console.log(`sync-city-pages: ${CITIES.length} city page(s) rendered`);
}
