import * as THREE from 'three';
import { World } from './world.js';
import { Player, CHARACTERS } from './player.js';
import { activeCity, selectCityForPage, cityPlaceLabel, isModeHidden } from './cities/index.js';
import { Vehicle } from './vehicle.js';
import { Input } from './input.js';
import { HUD, keyMissingBannerHTML, tileErrorBannerHTML } from './hud.js';
import { CostGuard } from './costguard.js';
import { buildDevWorld } from './devworld.js';
import { GameAudio } from './audio.js';
import { MultiplayerClient } from './net.js';
import { RemotePlayers } from './remotes.js';
import { Minimap } from './minimap.js';
import { Missions } from './missions.js';
import { CarFleet } from './cars.js';
import { OSMBuildings } from './osm.js';
import { ALPRLayer } from './alpr.js';
import { GhostRun, hasGhostRun } from './ghostrun.js';
import { Collectibles, HUNTS } from './collect.js';
import { awards, AWARDS } from './awards.js';
import { Scenarios } from './scenarios.js';
import { SPONSOR } from './sponsors.js';
import { analytics } from './analytics.js';
import { Districts } from './districts.js';
import { Border } from './border.js';
import { Races, cityRaces } from './races.js';
import { stats, onlineNow, fmtDur } from './stats.js';
import { submitScore, fetchScores, fmtTime, playerTag } from './leaderboard.js';
import { shareRun, shareFlockCam, sharePhoto } from './sharecard.js';
import { Grade } from './grade.js';
import { ContactShadows } from './shadows.js';
import { VideoScreens } from './videoscreen.js';
import { CAR_HALF } from './vehicle.js';
import { Shops } from './shops.js';
import { WhatsOn, formatEvent } from './whatson.js';
import { Sky } from './sky.js';
import { Tour } from './tour.js';
import { FieldDecals } from './fielddecal.js';
import { cityTours, golfTour, starbucksTour, landmarksStops } from './tours.js';
import { Golf } from './golf.js';
import { Interior } from './interior.js';
import { Derby } from './derby.js';
import { clampCameraToRoom } from './interior/clamp.js';
import { MAX_PIXEL_RATIO, PLAYER_HEIGHT, QUALITY, DEFAULT_QUALITY, BASE_FOG_DENSITY } from './constants.js';

const API_KEY = (import.meta.env.VITE_GOOGLE_TILES_KEY || '').trim();
const keyOk = API_KEY && API_KEY !== 'REPLACE_ME';

// ---------- city selection ----------
// The page names its city (route-per-city: /play, /play/chattanooga, …). This MUST run before
// anything that reads activeCity(), and several readers are eager: the HUD constructor builds
// the teleport chips from activeCity().presets, and World takes the origin. Keep this at the
// very top of the module body — selecting after a constructor has already read the registry
// silently boots one city's world with another city's data.
selectCityForPage(document.body?.dataset?.city);

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || /[?&]touch\b/.test(location.search);
const PIXEL_CAP = IS_TOUCH ? 1.0 : MAX_PIXEL_RATIO;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_CAP));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const SKY = 0x8fb8d8;
scene.background = new THREE.Color(SKY);
// Exponential, not linear: real aerial perspective has no near cutoff, and the
// tier's scale is stashed on the scene because sky.js owns fog every frame and
// world.js only learns of a quality change. See BASE_FOG_DENSITY.
scene.userData.fogScale = QUALITY[DEFAULT_QUALITY]?.fogScale ?? 1;
scene.fog = new THREE.FogExp2(SKY, BASE_FOG_DENSITY * scene.userData.fogScale);
const shadows = new ContactShadows(scene);
const _shadowTmp = new THREE.Vector3();
let _shadowProbe = 0;                     // round-robin index for remote ground probes
const PERSON_HALF = 0.42;                 // a person's footprint, metres

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 60000);
camera.position.set(0, 50, 50);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x556677, 1.6); scene.add(hemiLight);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.4);
sun.position.set(300, 500, 200);
scene.add(sun);
const sky = new Sky({ scene, sun, hemi: hemiLight, renderer });
const grade = new Grade(renderer, scene, camera);

// ---------- systems ----------
const input = new Input(canvas);
const hud = new HUD({
  onTeleport: teleport,
  onMpToggle: () => {
    if (!MP_ENABLED) { hud.toast('🚀 MULTIPLAYER COMING SOON — solo for now', 2500); return; }
    mp.setEnabled(!mp.enabled); refreshMp();
    // Remember an opt-out only. On is the default (see the mp boot below), so a
    // stored 'on' would be noise.
    try { if (mp.enabled) localStorage.removeItem('rocketcity.mp'); else localStorage.setItem('rocketcity.mp', 'off'); } catch { /* ignore */ }
  },
  onChatSend: (emoji) => { showLocalEmoji(emoji); mp.sendChat(emoji); },
  onChatOpen: (open) => input.setChatOpen(open),
});

// ---------- game world ----------
hud.setCityLabel(activeCity().meta.name);
// Permanent per-city ad slot; a city with no billboard just keeps the wordmark.
if (hud.setBillboard(activeCity().billboard)) {
  analytics.track('billboard_view', { city: activeCity().meta.id });
  document.getElementById('billboard')?.addEventListener('click',
    () => analytics.track('billboard_click', { city: activeCity().meta.id }));
}
let bannerShown = false;
const world = new World({
  scene, camera, renderer, apiKey: keyOk ? API_KEY : null,
  origin: activeCity().origin,
  onError: (err, url) => {
    if (bannerShown) return;
    bannerShown = true;
    hud.showTileError(err, url);           // themed retry overlay
    hud.showBanner('TILE LOAD FAILED', tileErrorBannerHTML(err, url)); // detailed how-to below it
    hud.setStatus('UPLINK ERROR');
  },
});
// Real YouTube iframes standing at real coordinates, composited over the canvas by
// CSS3DRenderer. Empty on every city but New York, and it loads nothing until a
// player is actually within range of one. Built here, not with the
// scene above: it holds `world`, which is only declared just above this line.
const screens = new VideoScreens(scene, world, activeCity().videoScreens || []);
const audio = new GameAudio();
const minimap = new Minimap({ canvas: document.getElementById('minimap'), world });
document.getElementById('mm-in').addEventListener('click', (e) => { minimap.zoom(-1); e.currentTarget.blur(); });
document.getElementById('mm-out').addEventListener('click', (e) => { minimap.zoom(1); e.currentTarget.blur(); });
world.setQuality(DEFAULT_QUALITY); hud.setQuality(DEFAULT_QUALITY);
const player = new Player(scene, world);
// Dev only: lets a console (or a browser-driving agent) inspect the boot state.
const remotes = new RemotePlayers(scene);
// Dev only: lets a console (or a browser-driving agent) inspect the boot state.
if (import.meta.env.DEV) Object.assign(window, { __world: world, __player: player, __remotes: remotes });
let _emojiSprites = [];
function showLocalEmoji(emoji) {
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128;
  const g = cvs.getContext('2d'); g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 72);
  const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(2.4, 2.4, 1); spr.userData.born = performance.now(); scene.add(spr); _emojiSprites.push(spr);
}
const missions = new Missions({ scene, world, hud, audio, onFlightUnlock: () => { player.flightUnlocked = true; } });
const scenarios = new Scenarios({ scene, world, hud, audio, onComplete: (id) => grantAward(id) });
hud.setSponsor(SPONSOR);
analytics.init();
window.addEventListener('pagehide', () => stats.persist());
document.addEventListener('visibilitychange', () => { if (document.hidden) stats.persist(); });
let _photoPlace = cityPlaceLabel();
const districts = new Districts(world, (name) => { _photoPlace = name.toUpperCase(); hud.setZone(`ENTERING ${name.toUpperCase()}`); });
const border = new Border(scene, world, hud);
minimap.nofly = border.nofly;   // show the restricted perimeter on the radar
const golf = new Golf(scene, world, hud, player, border);
golf.load();
const interior = new Interior({
  scene, world, hud, player,
  // A room is built at the door's own ground point, so every outdoor object at
  // that address ends up inside it: the OSM building and road overlay extruded
  // from the same terrain height, shop pillars, ALPR cameras, traffic, and other
  // players' avatars. Hiding only the streamed tiles left all of that rendering
  // through the furniture. Interior adds its own door markers and the tile group.
  //
  // A callback, not an array: osm, shops, cars and alpr are all constructed
  // below this line, and it is only ever called on entry.
  hideWhileInside: () => [osm.group, shops.group, cars.group, alpr.group, remotes.group, derby.group, ...missions.hideables()],
});
// Set by the KeyE entry arm below, so onRoundEnd can key the leaderboard off
// the park's stable id rather than its display name (two similarly named parks
// in different cities must not share a board). derby.park is already null by
// the time onRoundEnd fires — _finish() calls exit() before the callback.
let derbyParkId = null;
const derby = new Derby({ scene, world, hud, player });
derby.onRoundEnd = async ({ homeRuns, longest }) => {
  const tag = playerTag(mp.status === 'online' ? mp.callsign : null);
  const boardId = `derby-${derbyParkId}`;
  // desc: true because more home runs wins, the way collect.js scores a hunt.
  const res = await submitScore(boardId, tag, homeRuns, true);
  const board = (res?.top || await fetchScores(boardId) || []).map((e) => ({ name: e.name, t: `${e.ms} HR`, me: e.name === tag && e.ms === homeRuns }));
  hud.showResults({
    title: 'DERBY COMPLETE',
    time: `${homeRuns} HOME RUN${homeRuns === 1 ? '' : 'S'} · LONGEST ${Math.round(longest)} FT`,
    board, tag,
    onShare: null,
  });
};
const races = new Races({ scene, world, hud, audio, onFinish: onRaceFinish });
async function onRaceFinish({ race, ms, isBest }) {
  stats.raceDone();
  if (AWARDS[race.id]) setTimeout(() => grantAward(race.id), 200);
  const tag = playerTag(mp.status === 'online' ? mp.callsign : null);
  const res = await submitScore(race.id, tag, ms);
  const board = (res?.top || await fetchScores(race.id) || []).map((e) => ({ name: e.name, t: fmtTime(e.ms), me: e.name === tag && e.ms === ms }));
  hud.showResults({
    title: `${race.name} — ${isBest ? 'NEW BEST!' : 'FINISH'}`,
    time: fmtTime(ms),
    board, tag,
    onShare: async () => {
      const hero = null; // no bundled hero image; the share card draws without one
      const r = await shareRun({ title: race.name, time: fmtTime(ms), tag, rank: res?.rank, hero });
      hud.toast(r === 'shared' ? 'SHARED!' : 'SAVED PNG + LINK COPIED', 2500);
      analytics.track('share_run', { name: race.id });
    },
  });
  analytics.track('race_finish_board', { name: race.id, value: res?.rank || 0 });
}

// A city only advertises what it actually has data for. A row with no data behind it is
// omitted, not rendered as a dead button that toasts an apology.
// Mission 1/2 are hand-authored Huntsville content, so the panel is opt-in per city
// (meta.missions) rather than inferred from having presets — every city has presets now.
const hasCurated = () => !!activeCity().meta.missions && activeCity().presets.length > 0;
/** How many guided tours a city can actually offer, curated plus the POI-derived ones. */
const tourOptionCount = () => cityTours().length
  + (activeCity().pois?.starbucks?.length ? 1 : 0)
  + (activeCity().pois?.golfCourses?.length ? 1 : 0);
const hasAlpr = () => !!activeCity().alpr;
/** After Dark: forced night plus signage that reads from further out. */
function setAfterDark(on) {
  sky.setNight(on);
  shops.setNight(on);
  hud.toast(on ? 'AFTER DARK — THE SIGNS COME UP' : 'BACK TO THE LIVE SKY', 2600);
}
// flock is gated on the city declaring a camera set, not on hunts.total(): the ALPR file
// loads asynchronously, so its count is still 0 on the first menu render.
const huntAvailable = (id) => !isModeHidden(id) && (id === 'flock' ? hasAlpr() : hunts.total(id) > 0);

let sessionOpen = false;   // '— SESSION —' stats start collapsed
function refreshMissionsMenu() {
  const m1 = missions.state.m1, m2 = missions.state.m2;
  hud.setMissionPanelVisible(hasCurated());
  const rows = [];
  if (hasCurated()) {
    // The fuel run is generic — cells sit around the spawn in any city.
    rows.push({ label: 'M1 · FUEL RUN', status: m1.done ? 'COMPLETE ✓' : `${m1.collected.length}/10`, statusClass: m1.done ? 'done' : 'active' });
    // The Grand Tour and the tour picker only exist where there is something to fly to.
    // Nashville has presets but no tour stops, and both rendered empty before this.
    if (missions.beacons.length) {
      rows.push({ label: 'M2 · GRAND TOUR', status: !m1.done ? 'LOCKED' : m2.done ? 'COMPLETE ✓' : `${m2.visited.length}/${missions.beacons.length}`, statusClass: m2.done ? 'done' : m1.done ? 'active' : '' });
    }
    if (tourOptionCount()) {
      rows.push({ label: '🎬 GUIDED TOURS', status: tour.active ? 'PLAYING' : 'WATCH', statusClass: tour.active ? 'active' : '', button: tour.active ? 'STOP' : 'PICK', buttonOn: tour.active, onClick: () => { if (tour.active) { tour.stop(); document.body.classList.remove('tour-on'); } else openTourPicker(); } });
    }
  }
  // "Who owns Broadway": how many of a city's storefronts carry a celebrity name. Only
  // shown where the city actually tags them, so it stays a Nashville thing until another
  // city has the same story.
  const starred = (activeCity().shops || []).filter((sh) => sh.star);
  if (starred.length) {
    const total = (activeCity().shops || []).length;
    rows.push({
      label: '🎤 WHO OWNS BROADWAY', status: `${starred.length}/${total} STARS`,
      statusClass: shops.starsOnly ? 'active' : '',
      button: shops.starsOnly ? 'SHOW ALL' : 'SHOW STARS', buttonOn: shops.starsOnly,
      onClick: () => {
        const on = shops.setStarsOnly(!shops.starsOnly);
        hud.toast(on
          ? `${starred.length} of ${total} venues on Lower Broadway carry a country star's name`
          : 'SHOWING EVERY VENUE ON BROADWAY', 5200);
        refreshMissionsMenu();
      },
    });
  }
  rows.push({
    label: '🌆 AFTER DARK', status: sky.nightOverride ? 'NIGHT' : 'LIVE SKY',
    statusClass: sky.nightOverride ? 'active' : '',
    button: sky.nightOverride ? 'LIVE SKY' : 'GO DARK', buttonOn: sky.nightOverride,
    onClick: () => { setAfterDark(!sky.nightOverride); refreshMissionsMenu(); },
  });
  // Ticketed venues only — Broadway's honky-tonks are free and never appear here, so the
  // row names the venue rather than implying a strip line-up.
  const onSoon = whatsOn.soon(24);
  if (whatsOn.count) {
    const next = onSoon[0] || whatsOn.events[0];
    rows.push({
      label: onSoon.length ? `🎫 TONIGHT · ${onSoon.length}` : `🎫 THIS WEEK · ${whatsOn.count}`,
      status: next.name.length > 22 ? next.name.slice(0, 21) + '…' : next.name,
      statusClass: 'active', button: 'TICKETS',
      onClick: () => {
        analytics.track('whatson_click', { name: next.name, venue: next.venue });
        window.open(next.url, '_blank', 'noopener');
      },
    });
  }
  rows.push({ label: '🏆 BRIEFCASE', status: `${awards.count()}/${awards.list().length}`, statusClass: awards.count() ? 'done' : '', button: 'OPEN', onClick: () => openBriefcase() });
  for (const sc of Scenarios.all()) {
    if (isModeHidden(sc.id)) continue;
    const on = scenarios.activeId === sc.id;
    const got = (scenarios.collected[sc.id] || []).length;
    rows.push({
      label: `EVENT · ${sc.name}`,
      status: got >= sc.stops.length ? 'BADGE ✓' : on ? `${got}/${sc.stops.length}` : 'OFF',
      statusClass: got >= sc.stops.length ? 'done' : on ? 'active' : '',
      button: on ? 'DEACTIVATE' : 'ACTIVATE', buttonOn: on,
      onClick: () => { if (scenarios.activeId !== sc.id) { scenarios.activate(sc.id); analytics.track('scenario_activated', { name: sc.id }); } else scenarios.activate(null); refreshMissionsMenu(); },
    });
  }
  for (const id of Object.keys(HUNTS)) {
    if (!huntAvailable(id)) continue;
    const on = !!hunts.active[id];
    rows.push({
      label: `HUNT · ${HUNTS[id].name}`,
      status: `${hunts.count(id)}${hunts.total(id) ? '/' + hunts.total(id) : ''}`,
      statusClass: on ? 'active' : '',
      button: on ? 'STOP' : 'PLAY', buttonOn: on,
      onClick: () => { const nowOn = hunts.toggle(id); if (id === 'flock' && nowOn) alpr.setEnabled(true); refreshMissionsMenu(); },
    });
  }
  if (hasAlpr()) rows.push({
    label: 'FLOCK CAMERA MAP',
    status: `${alpr.count} CAMS`,
    statusClass: alpr.enabled ? 'active' : '',
    button: alpr.enabled ? 'HIDE' : 'SHOW', buttonOn: alpr.enabled,
    onClick: () => { alpr.setEnabled(!alpr.enabled); refreshMissionsMenu(); },
  });
  if (hasGhostRun()) rows.push({
    label: 'STEALTH · GHOST RUN',
    status: ghost.active ? `SPOTTED ${ghost.detections}×` : 'READY',
    statusClass: ghost.active ? 'active' : '',
    button: ghost.active ? 'ABORT' : 'START',
    buttonOn: ghost.active,
    onClick: () => { if (ghost.active) ghost.stop('GHOST RUN ABORTED'); else { alpr.setEnabled(true); ghost.start(teleport); } refreshMissionsMenu(); },
  });
  for (const r of cityRaces()) {
    if (isModeHidden(r.id)) continue;
    const best = races.bestFor(r.id);
    rows.push({
      label: `RACE · ${r.name}`,
      status: best ? `BEST ${(best / 1000 / 60 | 0)}:${((best / 1000) % 60).toFixed(1).padStart(4, '0')}` : 'NO TIME SET',
      statusClass: best ? 'done' : '',
      button: 'GO', onClick: () => { const t = races.tracks.find((x) => x.race.id === r.id); teleport(r.points[0][0], r.points[0][1], `race:${r.id}`, { alt: 90 }); if (t) setTimeout(() => races.start(t), 1300); hud.closeMenu?.(); },
    });
  }
  rows.push({
    label: 'FLIGHT FUEL', status: missions.gamify ? 'GAMIFY' : 'EXPLORER ∞', statusClass: missions.gamify ? 'active' : 'done',
    button: missions.gamify ? 'GO EXPLORER' : 'GO GAMIFY',
    onClick: () => { missions.setGamify(!missions.gamify); refreshMissionsMenu(); },
  });
  // Session stats are read-only and were five of sixteen rows in a panel that only fits
  // about six. Collapsed by default so the playable rows are the ones you can see.
  const su = stats.summary();
  rows.push({
    label: '— SESSION —', status: sessionOpen ? '' : `${fmtDur(su.flightSec)} · ${su.distMi.toFixed(1)} mi`,
    statusClass: 'active', button: sessionOpen ? 'HIDE' : 'SHOW', buttonOn: sessionOpen,
    onClick: () => { sessionOpen = !sessionOpen; refreshMissionsMenu(); },
  });
  if (sessionOpen) {
    rows.push({ label: '⏱ FLIGHT TIME', status: fmtDur(su.flightSec), statusClass: 'active' });
    rows.push({ label: '🛰 DISTANCE', status: su.distMi.toFixed(1) + ' mi', statusClass: 'active' });
    rows.push({ label: '📍 PLACES VISITED', status: String(su.places), statusClass: '' });
    rows.push({ label: '🏷 CARDS SEEN', status: String(su.cardsSeen), statusClass: '' });
    rows.push({ label: '🛍 CARDS OPENED', status: `${su.cardsOpened}${su.cardsClicked ? ' · ' + su.cardsClicked + ' clicked' : ''}`, statusClass: su.cardsClicked ? 'done' : '' });
  }
  // With the relay live, ONLINE NOW is the real room count: you plus everyone the
  // relay is sending us. Without it, the drifting placeholder in stats.js stands in.
  const real = (MP_ENABLED && mp.status === 'online') ? remotes.count + 1 : 0;
  hud.setOnline(MP_ENABLED ? Math.max(1, real) : onlineNow(real));
  hud.renderMissions(rows);
}
// refreshMissionsMenu() runs after alpr/ghost are constructed (see below)
player.onLudicrous = () => { hud.toast('🚀 LUDICROUS SPEED — PLAID!', 1800); audio.fanfare?.(); analytics.track('ludicrous'); };
player.flightUnlocked = true; // flight available from the start
player.canFly = () => (!missions.gamify || missions.fuel > 0);
// The room is scoped by city. Players relay SCENE-space positions, and every city has
// its own ENU origin, so a Huntsville player and an Orlando player in one room would
// render each other at meaningless coordinates — someone floating miles off in the wrong
// direction. Harmless until now only because multiplayer never reached production.
const MP_URL = `${(import.meta.env.VITE_MP_SERVER || 'ws://localhost:8787').trim()}?city=${encodeURIComponent(activeCity().meta.id)}`;
const MP_ENABLED = String(import.meta.env.VITE_MP_ENABLED).toLowerCase() === 'true';
const mp = new MultiplayerClient({
  url: MP_URL,
  onChat: (m) => {
    if (m.id === mp.id) return; // our own emoji is shown locally on send
    const rp = remotes.get(m.id);
    if (rp) rp.showEmoji(m.msg); else hud.toast(`${m.callsign} ${m.msg}`, 2000);
  },
  onStatus: (st) => {
    refreshMp();
    if (st === 'online') hud.addChat({ sys: true, msg: `Linked to ${MP_URL} as ${mp.callsign}.` });
    else if (st === 'offline' && mp.enabled) hud.addChat({ sys: true, msg: 'Relay unreachable — solo mode. Retrying every 30 s.' });
    else if (st === 'full') hud.addChat({ sys: true, msg: 'CITY FULL — 30 explorers already online. Retrying in 30 s.' });
  },
  onState: (list) => { remotes.apply(list); refreshMp(); },
});
function remoteColor(id) { const c = remotes.players.get(id)?.color; return c ? '#' + c.getHexString() : ''; }
function refreshMp() { if (!MP_ENABLED) { hud.setMp({ enabled: false, status: 'soon', count: 1, callsign: '--' }); return; } hud.setMp({ enabled: mp.enabled, status: mp.status, count: mp.status === 'online' ? remotes.count + 1 : 1, callsign: mp.callsign }); }
refreshMp();
// Multiplayer is on by default once the relay is configured: the point is seeing the
// other rockets, and an opt-in toggle in the HUD is one most players never find. The
// HUD toggle still turns it off, and that choice is remembered per browser.
if (MP_ENABLED) {
  let optedOut = false;
  try { optedOut = localStorage.getItem('rocketcity.mp') === 'off'; } catch { /* ignore */ }
  if (!optedOut) { mp.setEnabled(true); refreshMp(); }
}
const vehicle = new Vehicle(scene, world);
const osm = new OSMBuildings(scene, world);
minimap.roadSource = osm;   // draw the real street grid on the radar
const cars = new CarFleet(scene, world, osm);
const alpr = new ALPRLayer(scene, world);
const ghost = new GhostRun({ scene, world, hud, audio, alpr });
const hunts = new Collectibles({ scene, world, hud, audio, alpr, onAward: (huntId) => grantAward(huntId) });
const shops = new Shops({ scene, world, hud, camera });
const tour = new Tour({ world, hud });
// Live event listings for this city. Decoration on top of a running game: it never blocks
// the world, and an empty list simply means no row.
const whatsOn = new WhatsOn({ onChange: () => { refreshMissionsMenu(); applyWhatsOnSigns(); } });
// once the Flock layer finishes loading, colour already-found beams green
(function applyFoundBeams(){ let n=0; const iv=setInterval(()=>{ if(alpr.count>0){ alpr.setClaimed(new Set(hunts.claimed.flock||[])); clearInterval(iv); } if(++n>60) clearInterval(iv); },500); })();
hunts.tag = (()=>{ try { return localStorage.getItem('rocketcity.tag'); } catch { return null; } })();
refreshMissionsMenu();
setInterval(refreshMissionsMenu, 2000);

function startNamedTour(list, label) {
  if (mode === 'GOLF') leaveGolf();   // a tour drives the player; can't do that mid-round
  if (mode === 'INTERIOR') leaveInterior();
  if (mode === 'DERBY') leaveDerby();
  player.flightUnlocked = true;
  const pts = list.map(([name, lat, lon]) => { const s = world.geoToScene(lat, lon, 0); return { x: s.x, z: s.z, name }; });
  document.getElementById('tour-picker').classList.add('hidden');
  document.body.classList.remove('paused-menu');
  tour.start(player, pts);
  analytics.track('tour_start', { name: label });
  stats.tourStarted();
}
function openTourPicker() {
  const list = document.getElementById('tour-list'); list.innerHTML = '';
  const options = [...cityTours().map((t) => ({ name: t.name, stops: t.stops })), starbucksTour(), golfTour()];
  // if an event is active, offer it first
  if (scenarios.activeId && scenarios.objects.length) options.unshift({ name: 'EVENT · ' + (scenarios.active?.name || 'STOPS'), stops: scenarios.objects.map((o) => [o.stop.name, o.stop.lat, o.stop.lon]) });
  for (const opt of options) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = '▶ ' + opt.name;
    b.addEventListener('click', () => startNamedTour(opt.stops, opt.name));
    list.appendChild(b);
  }
  document.getElementById('tour-picker').classList.remove('hidden');
  document.exitPointerLock?.();
}
document.getElementById('legend-toggle')?.addEventListener('click', () => document.getElementById('legend').classList.toggle('collapsed'));
document.getElementById('tour-picker-close').addEventListener('click', () => document.getElementById('tour-picker').classList.add('hidden'));

// ---- wayfinding: point at whatever you're supposed to reach next ----
/** The single most relevant target right now, or null. { x, z, label } */
function nextObjective() {
  // 1) an active race checkpoint always wins
  if (races.active) {
    const t = races.active.track, ring = t.rings[races.active.idx];
    if (ring) return { x: ring.position.x, z: ring.position.z, label: `RING ${races.active.idx}/${t.rings.length - 1}` };
  }
  const near = (list, label) => {
    let best = null, bd = Infinity;
    for (const m of list) {
      const d = Math.hypot(m.x - player.position.x, m.z - player.position.z);
      if (d < bd) { bd = d; best = { x: m.x, z: m.z, label: m.name || label, d }; }
    }
    return best;
  };
  // 2) nearest un-grabbed coin across active runs
  const coin = near(hunts.markers(), 'NEXT COIN');
  // 3) nearest uncollected trail stop
  const stops = scenarios.markers().filter((m) => !m.done);
  const stop = near(stops, 'NEXT STOP');
  // 4) mission markers (fuel cells / landmarks)
  const mission = near(missions.markers(), 'OBJECTIVE');
  // A coin run or a trail is something the player deliberately switched on, so it
  // outranks Mission 1's fuel cells no matter which happens to be nearer. Sorting all
  // three by distance meant that clearing Magic Kingdom's five coasters pointed you at
  // a fuel cell instead of the next park — the "what do I do now?" dead end.
  // hunts.markers() only covers coin runs (flock is not one), so onboarding is untouched
  // for anyone who has not started one.
  const chosen = [coin, stop].filter(Boolean).sort((a, b) => a.d - b.d);
  return chosen[0] || mission || null;
}
let _navT = 0;
function updateNavGuide(now) {
  // Was touch-only. On desktop that left every long-range objective with no direction
  // at all: Park Hopper's second ring is 5.8 km out and a 16 m ring is invisible there,
  // and the World Showcase lap puts eleven near-identical rings in a 400 m circle where
  // only a faint pulse marks the live one. Both read as "the race is broken". Same for a
  // coaster hunt whose next target is in another park.
  if (now - _navT < 120) return;                  // 8Hz is plenty for a compass
  _navT = now;
  const el = document.getElementById('nav-guide');
  if (!el) return;
  const o = nextObjective();
  const hide = !o || hud.menuOpen || tour.active || !document.getElementById('welcome')?.classList.contains('hidden');
  el.classList.toggle('hidden', !!hide);
  if (hide) return;
  const dx = o.x - player.position.x, dz = o.z - player.position.z;
  const dist = Math.hypot(dx, dz);
  // Bearing relative to where the player is facing (0 = straight ahead). Measured
  // convention: forward = (-sin yaw, -cos yaw), so yaw 0 faces -Z and INCREASING yaw
  // turns LEFT.
  const rel = Math.atan2(-dx, -dz) - player.yaw;
  // Two corrections, both of which were missing and which together made the arrow spin
  // the wrong way:
  //   -rel   CSS rotation is clockwise-positive while yaw is counter-clockwise-positive,
  //          so the sign has to flip or the arrow tracks a mirror image of the turn.
  //   -90deg the glyph is a right-pointing arrow, so rotate(0) reads as "to your right".
  //          Straight ahead has to be a quarter turn back from there.
  // Check: target dead right gives rel = -90deg, which lands on rotate(0) — the glyph's
  // natural direction. Ahead -> up, behind -> down.
  document.getElementById('nav-arrow').style.transform = `rotate(${-rel - Math.PI / 2}rad)`;
  document.getElementById('nav-name').textContent = o.label;
  document.getElementById('nav-dist').textContent = dist > 950 ? `${(dist / 1609.34).toFixed(1)} MI` : `${Math.round(dist)} M`;
}

// ---- awards + briefcase ----
function grantAward(id) {
  const a = AWARDS[id]; if (!a) return;
  const isNew = awards.grant(id);          // first time, or bumps the run count
  const runs = awards.runs(id);
  audio.fanfare?.();
  hud.showAward(a, { runs, isNew });
  analytics.track('award', { name: id, value: runs });
}
/** Clear a mode's progress so "run it again" actually starts over. */
function resetRunProgress(id) {
  if (HUNTS[id]) hunts.resetRun(id);
  if (Scenarios.all().some((sc) => sc.id === id)) scenarios.resetRun(id);
  refreshMissionsMenu();
}

/** Launch the mode that grants a given award id (from the briefcase). */
function runAward(id) {
  resetRunProgress(id);                    // repeat runs start from zero finds
  if (cityRaces().some((r) => r.id === id)) return launchRace(id);
  if (Scenarios.all().some((sc) => sc.id === id)) return launchScenario(id);
  const p = activeCity().pois;
  const FIRST = { starbucks: p.starbucks, bowling: p.bowling, pickleball: p.pickleball, er: p.hospitals, beer: p.breweries, golf: p.golfCourses };
  if (FIRST[id]) return launchHunt(id, [FIRST[id][0].lat, FIRST[id][0].lon]);
  hud.toast('THAT ONE IS EARNED BY EXPLORING', 2000);
}
function openBriefcase() { hud.openBriefcase(awards.list(), runAward); }
document.getElementById('nav-guide')?.addEventListener('click', () => { document.body.classList.toggle('mini-on'); });
document.getElementById('award-close').addEventListener('click', () => hud.closeAward());
document.getElementById('briefcase-close').addEventListener('click', () => hud.closeBriefcase());
document.getElementById('award-briefcase').addEventListener('click', () => { hud.closeAward(); openBriefcase(); });
// Shareable branded screenshot (📷 button / O key)
let _photoBusy = false;
const _viewRay = new THREE.Raycaster();
/** Where the CAMERA is aimed (ground point it's looking at), as {lat,lon} — not where the rocket is. */
function viewTargetGeo() {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  // 1) raycast the tiles along the view direction (BVH-accelerated)
  const root = world.tiles?.group;
  if (root) { _viewRay.set(camera.position, dir); _viewRay.far = 9000; const hits = _viewRay.intersectObject(root, true); if (hits.length) return world.sceneToGeo(hits[0].point); }
  // 2) fallback: intersect the forward ray with the ground plane under the camera
  const gy = Number.isFinite(player._lastGroundY) ? player._lastGroundY : (world.groundBelow(player.position.clone(), 4000, true)?.point.y ?? 190);
  if (dir.y < -0.02) { const t = (camera.position.y - gy) / -dir.y; if (t > 0 && t < 12000) return world.sceneToGeo(camera.position.clone().addScaledVector(dir, t)); }
  return world.sceneToGeo(player.position);
}
/** Nearest named landmark/place to a geo point (for the photo caption). */
function nearestPlaceName(geo) {
  if (!geo) return cityPlaceLabel();
  const places = [...cityLandmarks(), ...activeCity().presets];
  let best = null, bestD = Infinity;
  for (const pl of places) {
    const d = Math.hypot((pl.lat - geo.lat) * 111000, (pl.lon - geo.lon) * 91500);
    if (d < bestD) { bestD = d; best = pl; }
  }
  return best && bestD < 1500 ? best.name : cityPlaceLabel();
}
async function capturePhoto() {
  if (_photoBusy) return; _photoBusy = true;
  try {
    hud.toast('📸 CAPTURING…', 900);
    const target = viewTargetGeo();
    const place = nearestPlaceName(target);
    const w = sky?.status?.() || '';
    const when = new Date().toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const sub = `${when}${w ? '  ·  ' + w : ''}`;
    // render one clean frame, then grab it
    grade.render();
    const r = await sharePhoto({ renderer, caption: place, sub });
    hud.toast(r === 'shared' ? 'SHARED!' : 'PHOTO SAVED + LINK COPIED', 2600);
    analytics.track('photo_share');
  } catch (e) { console.error('photo capture failed:', e); hud.toast('COULD NOT CAPTURE', 1800); }
  finally { _photoBusy = false; }
}
document.getElementById('btn-photo')?.addEventListener('click', (e) => { e.currentTarget.blur(); capturePhoto(); });

// GOLF: click the ball to address it. While aiming the pointer is locked for free
// look, so the crosshair is screen centre — raycast from there. Addressing releases
// the lock and hands the pointer to the swing drag; the shot then flies along
// whatever heading the player aimed.
const _golfRay = new THREE.Raycaster();
canvas.addEventListener('click', () => {
  if (mode !== 'GOLF' || !golf.aiming) return;
  // First click just takes pointer lock so the player can look around; only a click
  // made while already locked addresses the ball. Without this the opening click
  // would arm the swing instantly, since the camera already frames the ball.
  if (!input.locked) return;
  _golfRay.setFromCamera({ x: 0, y: 0 }, camera);            // screen centre
  const b = golf.ballPos;
  // generous pick radius: the ball is small at address distance
  const near = _golfRay.ray.distanceToPoint(b) < 2.5;
  if (!near) { hud.toast('AIM AT THE BALL, THEN CLICK', 1800); return; }
  if (golf.arm()) input.setGolfCapture(true);
});


// First-run welcome: gives new players clear direction and covers the initial
// tile load. Returning visitors skip straight to free flight.
let _hintUntil = performance.now() + 5000;   // must be initialized before initWelcome() may call showSpawnHint()
/** Launch a race by id: warp to its start line, then drop the flag. */
/**
 * Start a round from the welcome launcher. teleport() must run FIRST — it routes
 * through leaveGolf(), so calling it after entering would immediately end the round.
 * holes.json is fetched async and may still be in flight when the launcher is used,
 * so poll hasCourse() rather than calling enter() and eating its "no data" toast.
 */
function launchGolf(courseId) {
  const c = activeCity().pois.golfCourses.find((x) => x.id === courseId);
  if (!c) return;
  teleport(c.lat, c.lon, `golf:${courseId}`, { alt: 120 });
  let tries = 0;
  const tee = () => {
    if (!golf.hasCourse(courseId)) { if (++tries < 20) setTimeout(tee, 300); return; }
    if (golf.enter(courseId, 0)) { mode = 'GOLF'; }
  };
  setTimeout(tee, 1200);
}

function launchRace(id) {
  const r = cityRaces().find((x) => x.id === id); if (!r) return;
  const t = races.tracks.find((x) => x.race.id === id);
  teleport(r.points[0][0], r.points[0][1], `race:${id}`, { alt: 90 });
  if (t) setTimeout(() => races.start(t), 1300);
}
/** Start a trail/scenario and fly to its first stop. */
function launchScenario(id) {
  scenarios.activate(id);
  const sc = Scenarios.all().find((s) => s.id === id);
  if (sc?.stops?.length) teleport(sc.stops[0].lat, sc.stops[0].lon, sc.name, { alt: 120 });
  refreshMissionsMenu();
}
/** Turn on a hunt and fly to its first target. */
function launchHunt(id, ll) {
  if (!hunts.active[id]) hunts.toggle(id);
  if (id === 'flock') alpr.setEnabled(true);
  // Start an APPROACH away from the first target, facing it: the beacon is
  // visible on the horizon but you still have to fly to it. Landing right on
  // top of a target gives the hunt away.
  if (ll) {
    const APPROACH_M = 900;
    const brg = Math.random() * Math.PI * 2;
    const dLat = (Math.cos(brg) * APPROACH_M) / 111000;
    const dLon = (Math.sin(brg) * APPROACH_M) / (111000 * Math.cos(ll[0] * Math.PI / 180));
    teleport(ll[0], ll[1], id, { alt: 220, spawn: [ll[0] + dLat, ll[1] + dLon] });
  }
  refreshMissionsMenu();
}

// The opening menu doubles as a launcher: pick a mode and go straight into it.
// A function, not a module-scope const: several entries read activeCity().pois
// directly (not just inside a `go` closure), so this must be built at call
// time — inside initWelcome() — rather than once at import time.
function welcomeModes() {
  const p = activeCity().pois;
  // Race ids that already have a hand-written card below, so the generic pass does not
  // duplicate them.
  const NAMED_MODE_RACES = new Set(['trench-chapman', 'stovehouse-sprint', 'world-showcase-lap']);
  const hasRace = (id) => cityRaces().some((r) => r.id === id);
  // Modes built off a curated POI list only make sense (and only avoid indexing
  // into an empty array) where that city actually has the data — a new city like
  // Chattanooga starts with every pois.* list empty, so those modes are left out
  // of the grid entirely rather than shown as dead buttons.
  return [
    // The camera count is deliberately not baked into this copy: the ALPR file loads
    // asynchronously, so any number here would be wrong on first paint, and it differs per city.
    activeCity().alpr && { em: '📸', name: 'FIND THE FLOCK', desc: 'Featured — hunt every mapped camera', featured: true, go: () => launchHunt('flock') },
    cityTours()[0]?.stops?.length && { em: '🎬', name: 'GRAND TOUR', desc: 'Sit back — auto-fly the city', go: () => startNamedTour(cityTours()[0].stops, cityTours()[0].name) },
    hasRace('trench-chapman') && { em: '⚡', name: 'TRENCH RUNS', desc: '4 power-line cuts + a rail line', go: () => launchRace('trench-chapman') },
    p.golfCourses.length && { em: '⛳', name: 'GOLF', desc: 'Play the real RTJ Hampton Cove', go: () => launchGolf('rtj-hampton-cove') },
    p.starbucks.length && { em: '☕', name: 'STARBUCKS RUN', desc: `Grab all ${p.starbucks.length} coffee coins`, go: () => launchHunt('starbucks', [p.starbucks[0].lat, p.starbucks[0].lon]) },
    p.breweries.length && { em: '🍺', name: 'CRAFT BEER RUN', desc: '8 taprooms & breweries', go: () => launchHunt('beer', [p.breweries[0].lat, p.breweries[0].lon]) },
    p.bowling.length && { id: 'bowling', em: '🎳', name: 'BOWLING RUN', desc: 'Every lane in the valley', go: () => launchHunt('bowling', [p.bowling[0].lat, p.bowling[0].lon]) },
    p.pickleball.length && { id: 'pickleball', em: '🥒', name: 'PICKLEBALL RUN', desc: 'Find every court', go: () => launchHunt('pickleball', [p.pickleball[0].lat, p.pickleball[0].lon]) },
    p.hospitals.length && { id: 'er', em: '🚑', name: 'ER RUN', desc: 'Major & minor hospitals', go: () => launchHunt('er', [p.hospitals[0].lat, p.hospitals[0].lon]) },
    Scenarios.all().some((x) => x.id === 'animal-shelters') && { id: 'animal-shelters', em: '🐾', name: 'SHELTER RUN', desc: 'Visit every animal rescue', go: () => launchScenario('animal-shelters') },
    hasRace('stovehouse-sprint') && { id: 'stovehouse-sprint', em: '🏁', name: 'STOVEHOUSE SPRINT', desc: 'Timed ring race downtown', go: () => launchRace('stovehouse-sprint') },
    p.honkytonks?.length && { em: '\u{1F303}', name: 'AFTER DARK', desc: 'Neon run down the strip', go: () => { setAfterDark(true); const b = p.honkytonks[0]; teleport(b.lat, b.lon, 'after-dark', { alt: 120 }); } },
    p.honkytonks?.length && { em: '\u{1F3B8}', name: 'HONKY-TONK CRAWL', desc: `Hit all ${p.honkytonks.length} bars on the strip`, go: () => launchHunt('honkytonk', [p.honkytonks[0].lat, p.honkytonks[0].lon]) },
    p.coasters?.length && { em: '\u{1F3A2}', name: 'COASTER RUN', desc: `${p.coasters.length} coasters across four parks`, go: () => launchHunt('coaster', [p.coasters[0].lat, p.coasters[0].lon]) },
    p.animals?.length && { em: '\u{1F981}', name: 'SAFARI SPOTTING', desc: `Find all ${p.animals.length} animal habitats`, go: () => launchHunt('safari', [p.animals[0].lat, p.animals[0].lon]) },
    hasRace('world-showcase-lap') && { em: '\u{1F30D}', name: 'WORLD SHOWCASE LAP', desc: 'One lap, eleven countries', go: () => launchRace('world-showcase-lap') },
    // Any race this city defines that the named cards above did not already cover, so a
    // new city's routes reach the welcome screen without anyone editing this list.
    ...cityRaces()
      .filter((r) => !NAMED_MODE_RACES.has(r.id) && !isModeHidden(r.id))
      .slice(0, 2)
      .map((r) => ({ em: '\u{1F3C1}', name: r.name, desc: 'Timed run \u2014 beat the clock', go: () => launchRace(r.id) })),
  ].filter(Boolean)
    // A card carrying an id can be switched off per city via meta.hiddenModes.
    .filter((e) => !e.id || !isModeHidden(e.id));
}

(function initWelcome() {
  const w = document.getElementById('welcome');
  if (!w) return;
  let dismissed = false;
  const dismiss = (startFree) => {
    if (dismissed) return; dismissed = true;
    try { localStorage.setItem('rocketcity.welcomed', '1'); } catch { /* ignore */ }
    w.classList.add('hidden');
    if (startFree) showSpawnHint();
  };
  // Name the welcome for the city you are about to fly, and say what you fly it in.
  // Huntsville is the origin city and keeps the bare game name — "Rocket City" IS the
  // game; Huntsville is just where it was made. Every other city is labelled.
  const cm = activeCity().meta;
  const titleEl = w.querySelector('.welcome-title');
  const subEl = w.querySelector('.welcome-sub');
  if (titleEl && !cm.origin) {
    // Two-line lockup rather than one long string: "ROCKET CITY CC — CHATTANOOGA" wraps at
    // this size and leaves the em dash dangling at the start of line two.
    // The city is the headline here; the game name rides above it as a smaller kicker.
    // Sized in style.css so the mobile breakpoint still applies to both lines.
    titleEl.textContent = 'ROCKET CITY CC';
    titleEl.classList.add('has-city');
    const cityLine = document.createElement('div');
    cityLine.className = 'welcome-title-city';
    cityLine.textContent = cm.name.toUpperCase();
    titleEl.insertAdjacentElement('afterend', cityLine);
  }
  if (subEl && !cm.origin) {
    // Name what the player will ACTUALLY fly. A saved per-city choice beats the city
    // default (see Player's constructor), so reading cm.character alone promised a
    // broomstick to someone whose browser had a flamingo saved from a previous visit.
    const ride = CHARACTERS[player.characterKey]?.name || CHARACTERS[cm.character]?.name || 'ROCKET';
    subEl.textContent = `Fly the ${ride} over ${cm.name}. Pick a mode and jump right in — or free-fly and explore.`;
  }

  // mode grid — one click launches that mode
  const grid = document.getElementById('welcome-modes');
  if (grid) {
    for (const m of welcomeModes()) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wmode' + (m.featured ? ' featured' : '');
      b.innerHTML = `<span class="wm-em"></span><span class="wm-txt"><span class="wm-name"></span><span class="wm-desc"></span></span>`;
      b.querySelector('.wm-em').textContent = m.em;
      b.querySelector('.wm-name').textContent = m.name;
      b.querySelector('.wm-desc').textContent = m.desc;
      b.addEventListener('click', () => { dismiss(false); analytics.track('welcome_mode', { name: m.name }); try { m.go(); } catch { /* keep the menu closing */ } });
      grid.appendChild(b);
    }
  }
  document.getElementById('welcome-fly').addEventListener('click', () => dismiss(true));
  w.addEventListener('click', (e) => { if (e.target === w) dismiss(true); });
  window.addEventListener('keydown', (e) => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) dismiss(true); });
})();

// Deep-link: /play.html?game=<id> auto-starts a game once the world is ready.
(function handleGameParam() {
  const id = new URLSearchParams(location.search).get('game');
  if (!id) return;
  const RACE = cityRaces().find((r) => r.id === id);
  const start = () => {
    if (RACE) { const t = races.tracks.find((x) => x.race.id === RACE.id); if (t) { teleport(RACE.points[0][0], RACE.points[0][1], `race:${RACE.id}`); setTimeout(() => races.start(t), 1200); } return; }
    if (id === 'flock-hunt') { if (!hunts.active.flock) hunts.toggle('flock'); alpr.setEnabled(true); hud.toast('FIND THE FLOCK — GO!', 2500); return; }
    const p = activeCity().pois;
    if (id === 'golf-hunt') { if (!p.golfCourses.length) return; if (!hunts.active.golf) hunts.toggle('golf'); teleport(p.golfCourses[0].lat, p.golfCourses[0].lon, 'golf'); hud.toast('FIND THE GOLF — GO!', 2500); return; }
    // coin-run boards from the home page: starbucks-run, bowling-run, pickleball-run, er-run
    const COIN_BOARDS = { 'starbucks-run': ['starbucks', p.starbucks], 'bowling-run': ['bowling', p.bowling], 'pickleball-run': ['pickleball', p.pickleball], 'er-run': ['er', p.hospitals], 'beer-run': ['beer', p.breweries] };
    if (COIN_BOARDS[id] && COIN_BOARDS[id][1].length) { const [hid, data] = COIN_BOARDS[id]; launchHunt(hid, [data[0].lat, data[0].lon]); return; }
    if (id === 'ghost') { alpr.setEnabled(true); ghost.start(teleport); return; }
    if (scenarios && [...Scenarios.all()].some((sc) => sc.id === id)) { scenarios.activate(id); return; }
  };
  // wait until flight is unlocked / player settled, then fire once
  let done = false;
  const iv = setInterval(() => { if (done) return; if (!player.frozen) { done = true; clearInterval(iv); start(); refreshMissionsMenu(); } }, 300);
  setTimeout(() => { if (!done) { done = true; clearInterval(iv); start(); } }, 12000);
})();
// Deep-link: /play?goto=<preset name|lat,lon>[&alt=<metres>] drops you in the air
// facing that landmark, using the preset's scenic spawn point. Used for demo and
// pitch links, and for capturing flyover footage of a specific location.
(function handleGotoParam() {
  const qs = new URLSearchParams(location.search);
  const q = qs.get('goto');
  if (!q) return;
  const slug = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const alt = Number(qs.get('alt'));
  let target = null;
  const ll = q.split(',').map(Number);
  if (ll.length === 2 && ll.every(Number.isFinite)) {
    target = { name: `${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`, lat: ll[0], lon: ll[1] };
  } else {
    const presets = activeCity().presets;
    target = presets.find((p) => slug(p.name) === slug(q))
          || presets.find((p) => slug(p.name).startsWith(slug(q)));
  }
  if (!target) { hud.toast(`UNKNOWN DESTINATION "${q}"`, 3000); return; }
  const go = () => teleport(target.lat, target.lon, target.name, {
    alt: Number.isFinite(alt) ? alt : (target.alt ?? 90),
    spawn: target.spawn,
  });
  // same settle-then-fire pattern as ?game= above
  let done = false;
  const iv = setInterval(() => { if (done) return; if (!player.frozen) { done = true; clearInterval(iv); go(); } }, 300);
  setTimeout(() => { if (!done) { done = true; clearInterval(iv); go(); } }, 12000);
})();

osm.onZone = (name) => { _photoPlace = name; hud.setZone(name); };

/** Curated landmark signs belong to the active city. */
const cityLandmarks = () => activeCity().landmarks || [];

let fieldDecals = null;
if (keyOk) {
  for (const l of cityLandmarks()) osm.addLandmarkSign(l.name, world.geoToScene(l.lat, l.lon, 0), { height: l.height || 45, range: l.range });

  // Park-scale wayfinding. Only cities that define beacons get them.
  for (const b of (activeCity().skyBeacons || [])) {
    osm.addSkyBeacon(b.name, world.geoToScene(b.lat, b.lon, 0),
      { color: b.color, alt: b.alt, range: b.range, scale: b.scale });
  }

  // Original-art roundels on the two real stadium fields (see fielddecal.js).
  fieldDecals = new FieldDecals(scene, world);
}

/**
 * Hang tonight's act under any landmark that is also a ticketed venue — the Ryman is
 * already a curated sign in Nashville, so flying past it reads "TONIGHT — <artist>".
 * A second sprite rather than a rewrite of the first, so nothing is lost if the feed is
 * empty, and each venue only ever gets one.
 */
const _whatsOnSigned = new Set();
function applyWhatsOnSigns() {
  if (!keyOk || !osm?.addLandmarkSign) return;
  for (const l of cityLandmarks()) {
    if (_whatsOnSigned.has(l.name)) continue;
    const ev = whatsOn.nextAt(l.name);
    if (!ev) continue;
    _whatsOnSigned.add(l.name);
    osm.addLandmarkSign(`TONIGHT — ${ev.name}`, world.geoToScene(l.lat, l.lon, 0),
      { color: '#ff5fa2', height: (l.height || 45) + 16, range: l.range });
  }
}

if (!keyOk) {
  hud.showBanner('MAP TILES API KEY MISSING', keyMissingBannerHTML());
  hud.setStatus('NO UPLINK — KEY MISSING');
  hud.setLoading(0, 'NO API KEY — CITY CANNOT LOAD');
  // Dev world: flat plane + box buildings + ramp, raycast through the same World.groundBelow path.
  const devWorld = buildDevWorld();
  world.useDevWorld(devWorld);
  minimap.setFootprints(devWorld);
  hud.showWatermark('DEV WORLD — NO API KEY');
}
if (input.isTouch) { hud.showTouchNote(); input.attachTouchUI(document.getElementById('touch-ui')); }

let mode = 'WALK';       // WALK | DRIVE | GOLF | INTERIOR | DERBY
// Shared golf-round cleanup: anything that yanks the player elsewhere
// (KeyL, a race GO, a preset teleport, starting a tour) must exit the
// round through here so mode / golfCapture / player visibility never drift.
function leaveGolf() { golf.exit(); input.setGolfCapture(false); mode = 'WALK'; player.setVisible(true); }
/**
 * Every path out of an interior funnels through here, exactly as leaveGolf()
 * does: the key handler, the reconciliation check in step(), a teleport, and
 * the start of a tour or a race. A second exit() is a no-op by design.
 */
function leaveInterior() {
  // NO `if (!interior.active) return` guard here. The reconciliation in step()
  // calls this precisely when interior.active is false, so a guard on that
  // condition would return immediately and strand mode at 'INTERIOR' forever.
  // interior.exit() is idempotent by design, and all four call sites already
  // test `mode === 'INTERIOR'`. leaveGolf() has no guard for the same reason.
  interior.exit();
  mode = 'WALK';
  hud.setPrompt('');
}

/**
 * Every path out of the derby funnels through here. No guard on derby.active:
 * the reconciliation in step() calls this precisely when it is false, and a
 * guard on that condition would strand mode at 'DERBY'. Same reasoning as
 * leaveInterior(), and the same reason leaveGolf() has no guard either.
 */
function leaveDerby() {
  derby.exit();
  mode = 'WALK';
  hud.setPrompt('');
}

// Entering dips to black and comes back once the room stands (see the KeyE
// handler below), and the spec has the exit reverse all of it — so stepping out
// is a fade too, not an instant cut. Only the deliberate E press gets it: a
// teleport, a tour or a race calls leaveInterior() directly and runs its own
// transition. The flag keeps a second press during the dip from queueing a
// second exit.
const INTERIOR_EXIT_FADE_MS = 260;
let _leavingInterior = false;
function fadeOutOfInterior() {
  if (_leavingInterior) return;
  _leavingInterior = true;
  hud.fadeOut();
  setTimeout(() => {
    _leavingInterior = false;
    if (mode === 'INTERIOR') leaveInterior();
    hud.fadeIn();
  }, INTERIOR_EXIT_FADE_MS);
}
let firstPerson = false;
const CAM_MODES = ['3RD', '1ST', 'DRONE', 'HIGH'];
let camMode = 0; // index into CAM_MODES
let inDevNote = '';

// Initial spawn: a high establishing shot SSE of downtown, looking NNW across
// the skyline. Higher + pulled back so the opening frame reads as a clean aerial
// vista while tiles stream in (a low ground start renders as blurry blobs).
{
  const c = activeCity();
  const look = world.geoToScene(c.spawn.look[0], c.spawn.look[1], 0);
  const sp = world.geoToScene(c.spawn.from[0], c.spawn.from[1], 0);
  player.yaw = Math.atan2(-(look.x - sp.x), -(look.z - sp.z));
  player.spawnAt(sp, { hoverAGL: c.spawn.alt });
}
function showSpawnHint(){ _hintUntil = performance.now() + 5000; document.getElementById('spawn-hint').classList.remove('hidden'); }

// ---------- cost guard ----------
// Set VITE_IDLE_MS for testing (e.g. 5000). Defaults to 5 minutes.
const idleMs = Number(import.meta.env.VITE_IDLE_MS) || undefined;
const guard = new CostGuard({
  input, idleMs,
  onPause: (why) => { world.pauseFor('idle'); if (MP_ENABLED) mp.suspend(); hud.showPaused(why === 'idle'); console.info(`[cost-guard] paused (${why})`); },
  onResume: () => { world.resumeFor('idle'); if (MP_ENABLED) mp.resume(); hud.showPaused(false); console.info('[cost-guard] resumed'); },
  onSessionEnd: () => { stats.persist(); analytics.track('session_cap'); world.pauseFor('session'); mp.disconnect('off'); hud.showSessionEnd(); console.info('[cost-guard] session cap reached'); },
});

// ---------- teleport ----------
function teleport(lat, lon, placeName, opts = {}) {
  races.cancel?.('CANCELLED');
  analytics.track('teleport', { name: placeName || `${lat.toFixed(3)},${lon.toFixed(3)}` });
  if (placeName && !String(placeName).startsWith('race:')) stats.place(placeName);
  const spawnLL = opts.spawn || [lat, lon];
  const p = world.geoToScene(spawnLL[0], spawnLL[1], 0);
  if (mode === 'DRIVE') { vehicle.exit(); mode = 'WALK'; player.setVisible(true); }
  else if (mode === 'GOLF') { leaveGolf(); }
  else if (mode === 'INTERIOR') { leaveInterior(); }
  else if (mode === 'DERBY') { leaveDerby(); }
  // face the landmark from the spawn point
  const look = world.geoToScene(lat, lon, 0);
  const yaw = Math.atan2(-(look.x - p.x), -(look.z - p.z));
  player.stowGlider();
  player.spawnAt(p, { hoverAGL: opts.alt ?? 60, yaw: opts.spawn ? yaw : player.yaw });
  hud.fadeOut();
  showSpawnHint();
  hud.setStatus('RELOCATING…');
  hud.setLoading(0.2, `WARPING TO ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  document.getElementById('loading').classList.remove('hidden');
  input.lastActivity = performance.now();
}

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const camOffset = new THREE.Vector3();
const _hitProbe = new THREE.Vector3();
function updateCamera(dt) {
  if (mode === 'DERBY' && derby.active) {
    // Frame the ball, exactly as golf does: because update() writes ball.position
    // every frame of the flight, following the hit comes for free and no camera
    // code needs to know flight exists. Behind the plate looking out at the field.
    //
    // But NOT during 'wind' or 'pitch': the ball only gets a real position once
    // the pitch branch starts driving it, so before that (and again between
    // pitches, where _next() leaves it parked at the previous ball's rest spot)
    // it is stale — at the scene origin on the very first pitch of a round.
    // Anchor on the plate instead whenever the ball isn't actually flying.
    // derby.park always has x/y/z here: it's set in enter() and cleared only in
    // exit(), and the `derby.active` check above already guarantees enter() ran.
    const anchor = derby.state === 'flight' ? derby.ball.position : derby.park;
    const back = derby.state === 'flight' ? 18 : 9;
    const up = derby.state === 'flight' ? 8 : 4;
    camTarget.set(anchor.x, anchor.y + 2, anchor.z);
    camPos.set(anchor.x + Math.sin(player.yaw) * back, anchor.y + up, anchor.z + Math.cos(player.yaw) * back);
    camera.position.lerp(camPos, Math.min(1, dt * 4));
    camera.lookAt(camTarget);
    return;
  }
  if (mode === 'GOLF' && golf.active) {
    // Behind the ball, down the target line: golf.js points player.yaw at the
    // green on every tee and settle. Offset is -forward * back with player.js's
    // forward = (-sin yaw, -cos yaw), i.e. the same (+sin, +cos) chase offset the
    // WALK/DRIVE camera below uses — the previous -sin here mirrored the shot.
    const b = golf.ballPos;
    camTarget.set(b.x, b.y + 2, b.z);
    const back = 14, up = 6;
    camPos.set(b.x + Math.sin(player.yaw) * back, b.y + up, b.z + Math.cos(player.yaw) * back);
    camera.position.lerp(camPos, Math.min(1, dt * 4));
    camera.lookAt(camTarget);
    return;
  }
  const yaw = mode === 'DRIVE' ? vehicle.heading : player.yaw;
  const base = mode === 'DRIVE' ? vehicle.position : player.position;
  const pitch = player.pitch;

  if (firstPerson && mode === 'WALK' && !player.flying) {
    camPos.copy(base); camPos.y += PLAYER_HEIGHT * 0.92;
    camera.position.copy(camPos);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotation.y = yaw; camera.rotation.x = pitch;
    return;
  }

  const cm = CAM_MODES[camMode];
  let dist = mode === 'DRIVE' ? 9 : player.flying ? 8 : 5;
  let height = mode === 'DRIVE' ? 3.2 : player.flying ? 2.6 : 2.0;
  if (cm === 'DRONE') { dist = 26; height = 22; }        // GTA-style elevated chase cam
  if (cm === 'HIGH') { dist = 60; height = 70; }         // near top-down city view
  if (mode === 'INTERIOR' && interior.room) {
    // DRONE (26 m back) and HIGH (60 m) would put the camera outside the
    // building. Pull the chase in to fit the room.
    const fit = Math.min(interior.room.size.w, interior.room.size.d) / 2 - 0.4;
    dist = Math.min(dist, Math.max(0.8, fit));
  }
  camTarget.copy(base); camTarget.y += (mode === 'DRIVE' ? 1.2 : 1.4);
  camOffset.set(
    Math.sin(yaw) * Math.cos(pitch) * dist,
    height + Math.sin(-pitch) * dist * 0.8,
    Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camPos.copy(camTarget).add(camOffset);

  if (mode === 'INTERIOR' && interior.room) {
    // Clamp the final camera POSITION, on all three axes, not the offset that
    // produced it. The `fit` boom above measures against the smallest half-extent
    // as though the player stood at the room centre; they stand one metre in from
    // the door's wall, so a full boom pointed away from that wall still lands
    // outside the shell — Clinton Row's entry pose put camPos.z at 7.6 with the
    // south wall's outer face at 4.6. The walls are boxes with outward-facing
    // normals, so from out there the first frame after the fade is flat plaster.
    // Vertically it is the same clamp as before: camTarget already sits 1.4 m
    // above the player, and looking up hard subtracts from camPos.y via
    // camOffset's sin(-pitch) term, so both bounds are needed. See
    // src/interior/clamp.js, which is node-tested against this exact entry pose.
    clampCameraToRoom(camPos, interior.room.group.position, interior.room.size);
  }

  // Keep camera above the terrain.
  // Skip indoors: the first hit under this probe is the ceiling, and lifting the
  // camera 0.8 m above THAT puts it through the roof. The dist clamp above and the
  // floor/ceiling clamp on camPos.y already keep the camera inside the room.
  if (mode !== 'INTERIOR') {
    _hitProbe.copy(camPos); _hitProbe.y += 20;
    const hit = world.groundBelow(_hitProbe, 40);
    if (hit && camPos.y < hit.point.y + 0.8) camPos.y = hit.point.y + 0.8;
  }

  const k = 1 - Math.pow(0.001, dt);
  camera.position.lerp(camPos, mode === 'DRIVE' ? k * 0.9 : k);
  camera.lookAt(camTarget);
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let boostTipUntil = 0, boostTipShown = false;
try { boostTipShown = localStorage.getItem('rocketcity.boostTip') === '1'; } catch {}
let stillSince = 999; // HUD focus mode timer (start 'still' so instructions show at spawn)
let firstGround = false;
const _bootT = performance.now();   // for the tile-server timeout
let lastRender = 0;

function frame() {
  requestAnimationFrame(frame);
  const running = guard.tick();
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!running) return; // paused / hidden / ended: no tile updates, no render
  step(dt);
}

function step(dt) {
  // mouse look
  const m = input.consumeMouse();
  const sens = 0.0022;
  const yawDelta = -m.x * sens;
  player.pitch = THREE.MathUtils.clamp(player.pitch - m.y * sens, -1.2, 1.2);
  if (mode === 'WALK') player.yaw += yawDelta;
  // GOLF aims by free-look. Once the ball is addressed the pointer belongs to the
  // swing drag (and pointer lock is released), so stop steering then.
  else if (mode === 'GOLF' && golf.aiming) player.yaw += yawDelta;
  // Unconditional, unlike golf: a timing swing never takes the pointer, so
  // there is no capture phase to exclude. Aim comes from where the player is
  // looking (src/derby.js, src/minigame/contact.js), and yaw is otherwise
  // frozen dead-centre-field by enter() — every ball would leave on the same
  // line without this.
  else if (mode === 'DERBY') player.yaw += yawDelta;
  // src/interior.js sets the player's facing on entry and restores it on exit,
  // but nothing in between ever wrote to it, so the mouse could not turn the
  // player while inside a room. Live on main, fixed here since this is the
  // commit that turns this chain from two arms into three.
  else if (mode === 'INTERIOR') player.yaw += yawDelta;
  // In DRIVE mode the mouse orbits pitch only; heading comes from the car.

  // toggles
  if (input.justPressed('KeyC')) { camMode = (camMode + 1) % CAM_MODES.length; firstPerson = CAM_MODES[camMode] === '1ST'; hud.toast(`CAMERA: ${CAM_MODES[camMode]}`, 1200); }
  if (input.justPressed('KeyM')) hud.setMuted(audio.toggleMute());
  if (input.justPressed('KeyR')) {
    if (mode === 'INTERIOR') leaveInterior();   // recovery key: leave the room first
    if (mode === 'DERBY') leaveDerby();          // recovery key: leave the plate first
    if (mode === 'DRIVE') toggleVehicle();
    player.stowGlider(); player.flying = false;
    player.spawnAt(player.position.clone().setY(0));
    hud.toast('RETURNING TO SURFACE…', 1500);
  }
  if (input.justPressed('KeyP') && mode === 'WALK') {
    const name = player.nextCharacter();
    if (name) { hud.toast(`CHARACTER: ${name}`, 1500); analytics.track('character', { name: player.characterKey }); }
  }
  if (input.justPressed('KeyB')) { osm.setEnabled(!osm.enabled); hud.toast(osm.enabled ? 'CITY DETAIL: ON' : 'CITY DETAIL: OFF', 1200); }
  if (input.justPressed('KeyT') && alpr.enabled) {
    const cam = alpr.nearest(player.position, 70);
    if (cam) {
      hud.toast('CAPTURING…', 900);
      requestAnimationFrame(async () => {
        const r = await shareFlockCam({ renderer, lat: cam.lat, lon: cam.lon, count: alpr.count });
        hud.toast(r === 'shared' ? 'SHARED!' : 'SAVED PNG + LINK COPIED', 2600);
        analytics.track('share_flock', { name: `${cam.lat.toFixed(4)},${cam.lon.toFixed(4)}` });
      });
    } else hud.toast('NO FLOCK CAMERA NEARBY', 1400);
  }
  // Browsers refuse autoplay with sound without a gesture, so the screen starts
  // muted and this keypress is the gesture that unmutes it.
  if (input.justPressed('KeyU') && screens.near) {
    hud.toast(screens.toggleSound() ? 'SCREEN SOUND: ON' : 'SCREEN SOUND: MUTED', 1600);
  }
  if (input.justPressed('KeyJ')) { const on = grade.toggle(); hud.toast(on ? 'CINEMATIC GRADE: ON' : 'CINEMATIC GRADE: OFF', 1400); analytics.track('grade_toggle', { name: on ? 'on' : 'off' }); }
  if (input.justPressed('KeyK')) { alpr.setEnabled(!alpr.enabled); hud.toast(alpr.enabled ? `FLOCK CAMERAS: ON (${alpr.count})` : 'FLOCK CAMERAS: OFF', 1500); analytics.track('flock_toggle', { name: alpr.enabled ? 'on' : 'off' }); }
  if (input.justPressed('KeyG')) {
    const names = Object.keys(QUALITY); const next = names[(names.indexOf(world.quality || DEFAULT_QUALITY) + 1) % names.length];
    world.setQuality(next); hud.setQuality(next); hud.toast(`TILE QUALITY: ${next}`);
  }
  // L — tee off when standing on a course with hole data, or leave golf.
  // (Not KeyG: that's already bound to the tile-quality cycle above, and
  // reusing it would fire both actions at once when near a course.)
  if (input.justPressed('KeyL')) {
    if (mode === 'GOLF') { leaveGolf(); }
    else if (mode === 'WALK') {
      const near = activeCity().pois.golfCourses.find((c) => {
        const p = world.geoToScene(c.lat, c.lon, 0);
        return Math.hypot(player.position.x - p.x, player.position.z - p.z) < 900;
      });
      if (!near) hud.toast('STAND ON A GOLF COURSE TO TEE OFF', 2400);
      // Only the course you are standing on, and only if holes.json has it —
      // entering a course 15 km away warps the player onto unloaded tiles where
      // there is no ground to place the ball on.
      else if (!golf.hasCourse(near.id)) hud.toast(`NO HOLE DATA FOR ${near.name.toUpperCase()} YET`, 2800);
      else if (golf.enter(near.id, 0)) { mode = 'GOLF'; }   // starts aiming; click the ball to address
    }
  }
  if (mode === 'GOLF') {
    if (input.justPressed('BracketLeft')) golf.nextClub(-1);
    if (input.justPressed('BracketRight')) golf.nextClub(1);
  }
  if (input.justPressed('KeyO')) capturePhoto();
  if (input.justPressed('KeyV') && mode !== 'GOLF') toggleVehicle();
  if (input.justPressed('KeyH') && mode === 'WALK') {
    if (player.gliding) player.stowGlider(); else player.deployGlider();
  }
  if (input.justPressed('KeyY') && mode === 'WALK') {
    if (tour.active) tour.pause();
    else if (tour.paused) tour.resume(player);
    else openTourPicker();
  }
  if (input.justPressed('KeyF') && mode === 'WALK') {
    const r = player.toggleFlight();
    if (r === null) hud.toast(missions.flightUnlocked ? 'NO FUEL — COLLECT FUEL CELLS' : 'FLIGHT LOCKED — FINISH MISSION 1: FUEL RUN');
  }

  // simulation
  if (tour.active) {
    const a = input.moveAxis();
    if (Math.hypot(a.x, a.y) > 0.1 || input.justPressed('Space') || input.justPressed('KeyF') || input.justPressed('KeyV')) tour.pause();
    else { tour.update(dt, player); input.lastActivity = performance.now(); } // keep-alive: don't idle-pause mid-tour
  }
  { // tour bar
    const bar = document.getElementById('tour-bar');
    document.body.classList.toggle('tour-on', tour.active);
    { const fb = document.getElementById('btn-fly'); if (fb) fb.textContent = (player.flying && mode === 'WALK') ? 'LAND' : 'FLY'; }
    if (tour.active) { bar.classList.remove('hidden'); document.getElementById('tour-label').textContent = '▶ ' + tour.name.toUpperCase(); document.getElementById('tour-action').textContent = 'TAKE OVER'; document.getElementById('tour-speed').style.display = ''; }
    else if (tour.paused) { bar.classList.remove('hidden'); document.getElementById('tour-label').textContent = '⏸ TOUR PAUSED'; document.getElementById('tour-action').textContent = 'RESUME'; document.getElementById('tour-speed').style.display = 'none'; }
    else bar.classList.add('hidden');
  }
  if (mode === 'GOLF') {
    golf.update(dt, input);
    if (golf.aiming && input.golfCapture) input.setGolfCapture(false);  // shot away: pointer back to look
    // golf.js can end the round on its own (ROUND COMPLETE) and clear golf.active
    // internally without main.js ever hearing about it via the L key — catch that
    // here so the player isn't left stuck in a mode with no player.update calls.
    if (!golf.active) leaveGolf();
  }
  if (mode === 'DRIVE') {
    vehicle.update(dt, input);
    player.position.copy(vehicle.position);
    player.yaw = vehicle.heading;
  } else if (mode === 'GOLF' || mode === 'DERBY') {
    // golf.js places the character at each lie with player.spawnAt(); this is
    // what resolves that spawn onto the terrain and keeps them standing there as
    // tile LOD moves the surface. Movement input is off — in GOLF the pointer
    // drag is the swing and WASD is not a walk.
    // Both stand still and act on a gesture. allowMove:false also disables the
    // Space jump at player.js:378, which matters here because justPressed is not
    // consumed by the first reader — without this, one Space press would jump
    // and swing on the same frame.
    player.update(dt, input, { allowMove: false });
  } else if (!tour.active) {
    player.update(dt, input);
  }
  // AFTER the player update, not before it. interior.update() is what holds the
  // player inside the walls, and updateCamera() below reads the position it
  // leaves behind: running it first clamped last frame's position and let a
  // sprinting player at a low frame rate be drawn a step through the wall.
  if (mode === 'INTERIOR') {
    interior.update(dt, input);
    if (!interior.active) leaveInterior();          // the room can end itself
    input.lastActivity = performance.now();          // keep the idle guard off indoors
  } else {
    interior.updateDoors(player);
  }
  if (mode === 'DERBY') {
    derby.update(dt, input);
    if (!derby.active) leaveDerby();     // the round can end itself
    input.lastActivity = performance.now();
  } else if (mode !== 'INTERIOR') {
    // Skipped indoors for the same reason interior.updateDoors() has no
    // equivalent gate need here: with the tiles hidden, an unsnapped plate's
    // ground raycast never finds terrain and re-fires every frame for nothing.
    derby.updatePlates(player);
  }
  if (!firstGround && !player.frozen) {
    firstGround = true;
    hud.hideLoading();
    hud.fadeIn();
    showSpawnHint();
    hud.setStatus('CITY ONLINE');
    setInterval(() => { if (firstGround) hud.setWeather(sky.status()); }, 5000);
  } else if (player.frozen && !bannerShown) {
    const p = world.loadProgress;
    // If the tile server never answers (down / quota / offline), don't hang the
    // loading screen forever — surface the retry overlay after a timeout.
    if (keyOk && !world.ready && performance.now() - _bootT > 25000) {
      bannerShown = true;
      hud.showTileError(new Error('Tile server not responding — check your connection, or the map tiles quota may be exhausted.'), 'tile.googleapis.com');
    } else {
      hud.setLoading(keyOk ? 0.1 + p * 0.9 : 0, keyOk ? (world.ready ? `STREAMING TILES ${(p * 100).toFixed(0)}%` : 'CONTACTING TILE SERVER') : undefined);
    }
  } else if (firstGround && !document.getElementById('loading').classList.contains('hidden')) {
    hud.hideLoading();
    hud.fadeIn();
    hud.setStatus('CITY ONLINE');
  }

  mp.update(dt, {
    pos: [player.position.x, player.position.y, player.position.z],
    rot: player.yaw,
    state: mode === 'DRIVE' ? 'car' : player.flying ? 'fly' : player.gliding ? 'glider' : 'walk',
    char: player.characterKey,
  });
  if (player.flying && !boostTipShown) { boostTipShown = true; boostTipUntil = performance.now() + 5000; try { localStorage.setItem('rocketcity.boostTip', '1'); } catch {} }
  { const bt = document.getElementById('boost-tip'); if (bt) bt.classList.toggle('hidden', performance.now() > boostTipUntil); }
  // Steering tip: while flying on desktop without pointer lock, tell them to click.
  updateNavGuide(performance.now());
  { const st = document.getElementById('steer-tip');
    if (st) {
      const welcomeUp = !document.getElementById('welcome')?.classList.contains('hidden');
      const show = player.flying && !input.isTouch && !input.locked && !hud.menuOpen && !tour.active && !welcomeUp;
      st.classList.toggle('hidden', !show);
    } }
  remotes.update();
  for (let i = _emojiSprites.length - 1; i >= 0; i--) {
    const e = _emojiSprites[i], age = (performance.now() - e.userData.born) / 2000;
    if (age >= 1) { scene.remove(e); e.material.map.dispose(); e.material.dispose(); _emojiSprites.splice(i, 1); continue; }
    e.position.set(player.position.x, player.position.y + 3 + age * 1.6, player.position.z); e.material.opacity = 1 - age;
  }

  updateCamera(dt);
  camera.updateMatrixWorld();
  if (mode !== 'INTERIOR') {
    sky.update(dt);
    world.dynamicDetail(mode === 'DRIVE' ? vehicle.speedMps : player.speedMps);
  }
  world.update();
  grade.render();

  audio.update({
    airspeed: mode === 'DRIVE' ? vehicle.speedMps : Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z),
    driving: mode === 'DRIVE', carSpeed: vehicle.speedMps, throttle: input.moveAxis().y, gliding: player.gliding,
  });

  if (mode === 'INTERIOR') {
    // The shadow pass lives in the else branch, so without this the last outdoor
    // frame's blobs would hang in the room -- a car's shadow across the carpet.
    shadows.clear();
    screens.hide(camera);
    // The player's world position is the door's, so every proximity system below
    // would fire on whatever stands at that spot outside. Skip the block whole
    // rather than gating fourteen calls, and let the room own the prompt.
    // Always say something indoors. With a prompt only inside the exit radius, the
    // first person to walk in could not work out how to leave the room at all.
    hud.setPrompt(interior.canExit ? 'E — STEP BACK OUTSIDE' : 'RETURN TO THE DOOR TO LEAVE  ·  R TO BAIL OUT');
  } else {
    if (mode === 'DRIVE') { if (border.clamp(vehicle.position, vehicle.vel)) vehicle.speed *= 0.5; }
    else border.clamp(player.position, player.velocity);
    districts.update(player.position);
    stats.frame(dt, mode === 'DRIVE' ? vehicle.position : player.position, player.flying);
    cars.update(dt, player.position);

    // Contact shadows. Nothing here casts a real shadow -- the tiles carry baked
    // ones and a second set would fight them -- so these blobs exist purely to
    // stop cars and people floating on the imagery.
    shadows.begin();
    for (const c of cars.cars) {
      // A driven car's own position is stale until the player gets out; the
      // vehicle below is the live one.
      if (!c.snapped || c.driver) continue;
      shadows.add(c.position.x, c.position.y, c.position.z,
                  CAR_HALF.w * c.kind.scale[0], CAR_HALF.d * c.kind.scale[2], 0, c.heading);
    }
    if (mode === 'DRIVE') {
      shadows.add(vehicle.position.x, vehicle.position.y, vehicle.position.z,
                  CAR_HALF.w, CAR_HALF.d, 0, vehicle.heading);
    } else {
      const gy = player.groundY;
      if (gy != null) {
        shadows.add(player.position.x, gy, player.position.z,
                    PERSON_HALF, PERSON_HALF, player.position.y - gy, player.yaw);
      }
    }
    // Remote avatars send their feet position, which is the ground only while they
    // are standing on it. Re-probe one player per frame, round-robin, so a flying
    // remote does not drag a disc through the air; at 10 Hz rooms of 30 that is a
    // fresh height twice a second per player and one raycast a frame in total.
    const rl = [...remotes.players.values()];
    if (rl.length) {
      const r = rl[_shadowProbe++ % rl.length];
      const p = r.group.position;
      const hit = world.groundBelow(_shadowTmp.set(p.x, p.y + 200, p.z), 2000, true);
      r._groundY = hit ? hit.point.y : null;
    }
    for (const r of rl) {
      const p = r.group.position;
      const gy = r._groundY ?? p.y;
      const inCar = !!r.car?.visible;
      shadows.add(p.x, gy, p.z, inCar ? CAR_HALF.w : PERSON_HALF,
                  inCar ? CAR_HALF.d : PERSON_HALF, p.y - gy, r.group.rotation.y);
    }
    shadows.end();
    screens.update(camera, player.position);
    osm.update(player.position);
    alpr.update();
    ghost.update(dt, player, mode);
    hunts.update(dt, player);
    shops.update(dt, player);
    whatsOn.update();          // long-interval poll; cheap to call every frame
    fieldDecals?.update(dt);
    hud.setHunts(hunts.status());
    scenarios.update(dt, player);
    races.update(dt, player, input);
    if (!races.active && races.nearStart && !scenarios.nearStop) {
      hud.setPrompt(`E — START ${races.nearStart.race.name}`);
      if (input.justPressed('KeyE') && !hud.menuOpen) races.start(races.nearStart);
    } else if (scenarios.nearStop) {
      hud.setPrompt(`E — ${scenarios.nearStop.stop.name.toUpperCase()} MENU`);
      if (input.justPressed('KeyE') && !hud.menuOpen) {
        const done = (scenarios.collected[scenarios.activeId] || []).includes(scenarios.nearStop.i);
        hud.openMenu(scenarios.nearStop.stop, { collected: done, coupon: scenarios.nearStop.stop.coupon, footer: scenarios.active?.footer });
        analytics.track('menu_open', { name: scenarios.nearStop.stop.name });
      }
    } else if (mode === 'WALK' && derby.nearPlate) {
      // Ahead of the on-foot branch, because a round can be started from the air
      // as well as from the dirt and that branch excludes flight.
      hud.setPrompt('E — PLAY HOME RUN DERBY');
    } else if (mode === 'WALK' && !player.flying) {
      const near = cars.nearest(player.position);
      if (near) hud.setPrompt(`PRESS V — JACK ${near.name}`);
      else if (interior.nearDoor) hud.setPrompt(`E — GO INSIDE ${interior.nearDoor.def.name.toUpperCase()}`);
      else if (shops.nearShop) hud.setPrompt(shopPrompt());
      else if (alpr.enabled && alpr.nearest(player.position, 70)) hud.setPrompt('T — SHARE THIS FLOCK CAMERA');
      else hud.setPrompt('');
    } else if (shops.nearShop) hud.setPrompt(shopPrompt());
    else if (alpr.enabled && alpr.nearest(player.position, 70)) hud.setPrompt('T — SHARE THIS FLOCK CAMERA');
    else hud.setPrompt('');
    // A hotel card books a room; a storefront opens a shop. Same key, honest wording.
    function shopPrompt() {
      const s0 = shops.nearShop;
      return `E — ${s0.kind === 'hotel' ? 'BOOK' : 'SHOP'} ${s0.name.toUpperCase()}`;
    }
  }
  if (mode === 'DERBY') {
    // The aim rides along with the key hint: reaching left or right field means
    // turning to face it, and nothing else on screen says which way you point.
    hud.setPrompt(`${derby.state === 'pitch' ? 'SPACE — SWING' : 'E — LEAVE THE PLATE'} \u00b7 ${derby.aimText()}`);
  }
  if (races.active && input.justPressed('KeyR')) races.cancel();
  if (mode === 'INTERIOR') {
    if (interior.canExit && input.justPressed('KeyE') && !hud.menuOpen) fadeOutOfInterior();
  } else if (mode === 'DERBY') {
    // Folded into this same arbitration chain, not a preceding standalone `if`:
    // input.justPressed is not consumed by its first reader, so a standalone
    // exit here left mode WALK for the rest of this same tick, and the derby
    // entry arm below re-entered on the very press that was meant to leave —
    // exit() had just cleared active, the plate was still nearest, and enter()
    // succeeded, looping the round with outs/home runs reset. One E press now
    // takes exactly one arm.
    if (input.justPressed('KeyE') && !hud.menuOpen) leaveDerby();
  } else if (mode === 'WALK' && !player.flying && input.justPressed('KeyE') && interior.nearDoor
             && !hud.menuOpen && !races.nearStart && !scenarios.nearStop) {
    const def = interior.nearDoor.def;
    hud.fadeOut();
    interior.enter(def)
      .then((ok) => {
        // The mode can change while the layout is fetching: a V press, a teleport
        // chip, a tour starting. Only claim it if we are still where we started,
        // otherwise unwind the room we just built.
        if (ok) { if (mode === 'WALK') mode = 'INTERIOR'; else interior.exit(); }
        hud.fadeIn();
      })
      .catch((e) => { console.warn('[interior] entry threw', e); hud.fadeIn(); });
  } else if (mode === 'WALK' && input.justPressed('KeyE') && derby.nearPlate
             && !hud.menuOpen && !races.nearStart && !scenarios.nearStop) {
    // No !player.flying here, unlike the door arm above: you can drop straight
    // into a round from the air. placeAt clears flight and stows the glider, so
    // the batter lands on the plate rather than hovering over it.
    if (derby.enter(derby.nearPlate.def)) { mode = 'DERBY'; derbyParkId = derby.nearPlate.def.id; }
  } else if (input.justPressed('KeyE') && shops.nearShop && !hud.menuOpen && !races.nearStart && !scenarios.nearStop) {
    shops.open(shops.nearShop);
  }
  if (mode !== 'INTERIOR') missions.update(dt, player);
  // The minimap redraws at ~15fps, so only pay for the marker list on the frames it will
  // actually use one. Cities with big camera sets made this expensive: Miami's 914 markers
  // cost 1.9ms a frame, an eighth of a 60fps budget, three quarters of it discarded.
  if (minimap.due()) {
    minimap.update({
      pos: player.position, yaw: player.yaw, driving: mode === 'DRIVE',
      markers: [...missions.markers(), ...races.markers(), ...hunts.markers(), ...cars.markers(), ...scenarios.markers(), ...shops.markers(), ...interior.markers(), ...derby.markers(), ...alpr.markers()],
      remotes: [...remotes.players.values()].map((r) => ({ pos: r.group.position, color: '#' + r.color.getHexString() })),
    });
  }

  hud.update({
    mode: mode === 'DRIVE' ? `DRIVE · ${CAM_MODES[camMode]}` : player.flying ? 'FLY' : player.gliding ? 'GLIDE' : `WALK · ${CAM_MODES[camMode]}`,
    glider: player.flying ? 'ENGINES ON' : player.gliding ? 'DEPLOYED' : (mode === 'WALK' && !player.grounded ? 'READY (H)' : 'STOWED'),
    speedMps: mode === 'DRIVE' ? vehicle.speedMps : player.speedMps,
    geo: world.sceneToGeo(player.position),
    tilesStats: world.stats,
    activeMs: guard.activeMs,
    attributions: world.getAttributions(),
    osmActive: osm.enabled && osm.count > 0,
    alprActive: alpr.enabled && alpr.count > 0,
  });
  // HUD focus: dim chrome while moving, restore ~1.5 s after stopping (never while chat is open)
  const inMotion = !hud.chatOpen && (mode === 'DRIVE' ? vehicle.speedMps > 3 : player.speedMps > 6);
  if (inMotion) stillSince = 0; else stillSince += dt;
  document.body.classList.toggle('moving', inMotion || stillSince < 1.5);

  { const sh = document.getElementById('spawn-hint'); if (sh) { const show = performance.now() < _hintUntil && player.speedMps < 6 && !player.frozen; sh.classList.toggle('hidden', !show); } }
  analytics.tick(document.body.classList.contains('moving'), dt * 1000);
  input.endFrame();
}

function toggleVehicle() {
  if (mode === 'WALK') {
    if (player.frozen) return;
    const car = cars.nearest(player.position);
    if (!car) { hud.toast('NO CAR NEARBY — FIND ONE TO JACK'); return; }
    player.stowGlider(); player.flying = false;
    vehicle.enter(car);
    player.setVisible(false);
    mode = 'DRIVE';
    if (CAM_MODES[camMode] === '1ST') { camMode = 0; firstPerson = false; }
    hud.toast(`${car.name} — V TO EXIT`, 1800);
  } else if (mode === 'DRIVE') {
    // Was a bare `else`. From any third mode that reached here it ran the
    // vehicle-exit path and set mode = 'WALK', which for an interior meant
    // leaving the room standing with collision still pointed at it.
    // exit: step out to the left of the car
    const side = new THREE.Vector3(Math.cos(vehicle.heading), 0, -Math.sin(vehicle.heading)).multiplyScalar(-2);
    player.position.copy(vehicle.position).add(side);
    player.position.y += 0.5;
    player.velocity.set(0, 0, 0);
    player.yaw = vehicle.heading;
    player.setVisible(true);
    vehicle.exit();
    mode = 'WALK';
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !hud.chatOpen) { e.preventDefault(); document.body.classList.toggle('hud-hidden'); }
  if (e.key === 'Escape' && !hud.chatOpen && !hud.menuOpen) {
    // ESC brings up the pause menu (and shows the HUD even mid-flight)
    const pm = document.getElementById('pause-modal');
    const open = pm.classList.toggle('hidden');
    document.body.classList.toggle('paused-menu', !open);
    if (!open) document.exitPointerLock?.();
  }
});
const mm = document.getElementById('mobile-menu');
if (mm) mm.addEventListener('click', () => {
  const pm = document.getElementById('pause-modal');
  const wasHidden = pm.classList.contains('hidden');
  pm.classList.toggle('hidden', !wasHidden);
  document.body.classList.toggle('paused-menu', wasHidden);
  document.exitPointerLock?.();
});
document.getElementById('tour-action').addEventListener('click', () => { if (tour.active) tour.pause(); else if (tour.paused) tour.resume(player); });
document.getElementById('tour-speed').addEventListener('click', (e) => { e.currentTarget.textContent = tour.cycleRate ? (tour.cycleRate(), tour.rateLabel()) : '1×'; });
document.getElementById('pause-resume').addEventListener('click', () => {
  document.getElementById('pause-modal').classList.add('hidden');
  document.body.classList.remove('paused-menu');
});
// Motion banner (config in src/sponsors.js). Off unless a sponsor is configured.
{
  const mb = document.getElementById('motion-banner');
  if (SPONSOR.enabled && SPONSOR.motionBanner) mb.innerHTML = SPONSOR.motionBanner;
  else { mb.remove(); document.body.classList.add('no-motion-banner'); }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_CAP));
  world.onResize();
  grade.resize();
  screens.resize();
});

// Storefront cards open on E only. Clicking is how you steer, and on a dense strip like
// Lower Broadway — 39 venues inside a few hundred metres — you are always within range of
// something, so every steering click was opening a card.

frame();

// Dev-only hook so the loop can be driven manually (tests / hidden tabs).
if (import.meta.env.DEV) {
  window.__rc = { step, guard, world, player, vehicle, teleport, audio, mp, remotes, hud, missions, cars, osm, alpr, ghost, races, hunts, grade, shops, sky, tour, scenarios, whatsOn, applyWhatsOnSigns, refreshMissionsMenu, get mode() { return mode; } };
}
