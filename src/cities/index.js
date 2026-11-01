import huntsville from './huntsville.js';
import chattanooga from './chattanooga.js';
import knoxville from './knoxville.js';
import nashville from './nashville.js';
import orlando from './orlando.js';
import miami from './miami.js';
import anaheim from './anaheim.js';
import nyc from './nyc.js';

/** Every city the build knows about. Huntsville is the origin city. */
export const CITIES = [huntsville, chattanooga, knoxville, nashville, orlando, miami, anaheim, nyc];
export const DEFAULT_CITY_ID = 'huntsville';

let _active = CITIES.find((c) => c.meta.id === DEFAULT_CITY_ID);

/** The city currently loaded. Never null — the default is selected at module load. */
export function activeCity() { return _active; }

/** Select a city by id. Throws on an unknown id rather than silently falling back. */
export function selectCity(id) {
  const c = CITIES.find((x) => x.meta.id === id);
  if (!c) throw new Error(`unknown city: ${id}`);
  _active = c;
  return c;
}

/**
 * Choose the city a page asked for. Unknown or absent ids fall back to the default:
 * booting the origin city beats booting a world whose frame and data disagree.
 * selectCity() still throws — the refusal belongs in the registry, the tolerance here.
 */
export function selectCityForPage(id) {
  if (!id || id === DEFAULT_CITY_ID) return selectCity(DEFAULT_CITY_ID);
  try { return selectCity(id); }
  catch { console.warn(`unknown city "${id}", using ${DEFAULT_CITY_ID}`); return selectCity(DEFAULT_CITY_ID); }
}

/**
 * Namespace a localStorage key to the active city. Saved progress is city-specific —
 * the Flock hunt stores CAMERA INDEXES, so index 5 in one city is a different camera in
 * another and unscoped keys silently mark the wrong ones claimed.
 *
 * The default city keeps the bare key so existing players keep their progress; every
 * other city gets a suffix. Call this at use time, never at module scope: modules are
 * evaluated before the page selects its city, so a module-scope call captures the default.
 */
/**
 * Modes a city deliberately does not show. The data stays in the module — the hunt still
 * validates, the race still has its gates — so bringing one back is deleting a string,
 * not re-sourcing coordinates. Read lazily: never at module scope.
 */
export function isModeHidden(id) {
  return (activeCity().meta.hiddenModes || []).includes(id);
}

export function cityKey(base) {
  const id = activeCity().meta.id;
  return id === DEFAULT_CITY_ID ? base : `${base}.${id}`;
}

/** "HUNTSVILLE, AL" — the caption/label form of the active city. */
export function cityPlaceLabel() {
  const m = activeCity().meta;
  return `${m.name.toUpperCase()}${m.regionCode ? ', ' + m.regionCode : ''}`;
}

/**
 * Bias a free-text geocoder query to the active city. Backs off when the text already names
 * ANY city the build knows about, or ends in a US state code — otherwise typing a Huntsville
 * address while flying Chattanooga produced "…, Huntsville, Chattanooga, TN".
 */
export function localizeQuery(raw) {
  const m = activeCity().meta;
  const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = CITIES.flatMap((c) => [c.meta.name, c.meta.region, c.meta.regionCode].filter(Boolean));
  const re = new RegExp(`\\b(${named.map(esc).join('|')})\\b|,\\s*[A-Z]{2}\\s*$`, 'i');
  return re.test(raw) ? raw : `${raw}, ${m.name}, ${m.regionCode}`;
}
