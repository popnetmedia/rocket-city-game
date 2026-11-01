import { analytics } from './analytics.js';

/**
 * Lightweight usage stats. Accumulates this session's flight time, distance,
 * places visited, and affiliate-card interactions, and mirrors lifetime totals
 * to localStorage. Milestone crossings fire analytics events so aggregate usage
 * (how much people actually fly, how far they roam) shows in the Vercel
 * dashboard alongside the per-place `teleport` and per-store `shop_*` events.
 */
const KEY = 'rocketcity.stats.v1';
const MILE = 1609.34;
const FLIGHT_MARKS = [1, 3, 5, 10, 20, 45];   // minutes of FLIGHT (not session)

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }

const l0 = load();

export const stats = {
  // this session
  flightSec: 0, groundSec: 0, distM: 0, airM: 0,
  places: new Set(), tours: 0, racesDone: 0,
  cardsSeen: 0, cardsOpened: 0, cardsClicked: 0,
  // lifetime baseline (loaded once; current lifetime = baseline + session)
  _l0: {
    flightSec: l0.flightSec || 0, distM: l0.distM || 0,
    places: new Set(l0.places || []), tours: l0.tours || 0, racesDone: l0.racesDone || 0,
    cardsSeen: l0.cardsSeen || 0, cardsOpened: l0.cardsOpened || 0, cardsClicked: l0.cardsClicked || 0,
  },
  _prev: null, _fmark: new Set(), _dmark: 0, _saveT: 0,

  /** Call each frame with the active body's position and whether we're flying. */
  frame(dt, pos, flying) {
    if (this._prev) {
      const d = Math.hypot(pos.x - this._prev.x, pos.z - this._prev.z);
      if (d < 2000) { this.distM += d; if (flying) this.airM += d; }   // guard teleports
    } else this._prev = { x: 0, z: 0 };
    this._prev.x = pos.x; this._prev.z = pos.z;
    if (flying) this.flightSec += dt; else this.groundSec += dt;

    const fmin = this.flightSec / 60;
    for (const m of FLIGHT_MARKS) if (fmin >= m && !this._fmark.has(m)) { this._fmark.add(m); analytics.track('flight_minutes', { name: m + 'min', value: m }); }
    const mi = Math.floor(this.distM / MILE);
    if (mi > this._dmark) { this._dmark = mi; if (mi % 2 === 0) analytics.track('distance_miles', { value: mi }); }

    if (performance.now() - this._saveT > 15000) this.persist();
  },

  place(name) { if (name) this.places.add(String(name)); },
  tourStarted() { this.tours++; },
  raceDone() { this.racesDone++; },
  card(kind) { if (kind === 'view') this.cardsSeen++; else if (kind === 'open') this.cardsOpened++; else if (kind === 'click') this.cardsClicked++; },

  persist() {
    this._saveT = performance.now();
    const places = new Set([...this._l0.places, ...this.places]);
    const out = {
      flightSec: this._l0.flightSec + this.flightSec,
      distM: this._l0.distM + this.distM,
      places: [...places],
      tours: this._l0.tours + this.tours,
      racesDone: this._l0.racesDone + this.racesDone,
      cardsSeen: this._l0.cardsSeen + this.cardsSeen,
      cardsOpened: this._l0.cardsOpened + this.cardsOpened,
      cardsClicked: this._l0.cardsClicked + this.cardsClicked,
    };
    try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* ignore */ }
  },

  /** Session summary for the on-screen panel. */
  summary() {
    return {
      flightSec: this.flightSec,
      distMi: this.distM / MILE,
      airMi: this.airM / MILE,
      places: this.places.size,
      cardsSeen: this.cardsSeen,
      cardsOpened: this.cardsOpened,
      cardsClicked: this.cardsClicked,
      lifePlaces: new Set([...this._l0.places, ...this.places]).size,
      lifeFlightSec: this._l0.flightSec + this.flightSec,
      lifeDistMi: (this._l0.distM + this.distM) / MILE,
    };
  },
};

/** mm:ss / h:mm for a duration in seconds. */
export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/**
 * "Online now" presence. Uses the real connected count when multiplayer is live;
 * otherwise a gently drifting number floored at the configured minimum so the
 * city never looks empty. Wire `real` to (remotes + 1) once MP is enabled.
 */
export function onlineNow(real = 0, min = 4) {
  const t = Date.now();
  const drift = 6 + 2.2 * Math.sin(t / 197000) + 1.6 * Math.sin(t / 43000) + 1.1 * Math.sin(t / 11000);
  return Math.max(min, real || 0, Math.round(drift));
}
