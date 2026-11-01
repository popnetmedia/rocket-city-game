/**
 * Privacy-light analytics via Vercel Web Analytics (no cookies, no fingerprinting).
 * Uses the official framework-agnostic @vercel/analytics package (this is a Vite
 * app, NOT Next.js — so we use `@vercel/analytics`, not `@vercel/analytics/next`).
 * - Page views + visitor counts appear in the Vercel dashboard once Web Analytics
 *   is enabled on the project (Project → Analytics → Enable).
 * - Custom gameplay events (place visits, missions, characters, flight/distance)
 *   use track(); they show under Analytics → Events. Deduped per session for
 *   spammy ones.
 * - No-ops on localhost; console.debug in dev.
 */
import { inject, track as vaTrack } from '@vercel/analytics';

const IS_PROD = import.meta.env.PROD && !/^(localhost|127\.)/.test(location.hostname);

let loaded = false;
function ensureLoaded() {
  if (loaded || !IS_PROD) return;
  loaded = true;
  inject();   // loads the Web Analytics beacon and wires page views
}

const seen = new Set(); // session-level dedupe for once() events

let _t0 = 0, _bannerMs = 0, _fired = new Set();
const MIN_MARKS = [1, 3, 5, 10, 20, 45];

export const analytics = {
  init() { ensureLoaded(); _t0 = performance.now(); this.track('session_start'); },
  /** Call each frame with the banner-visible flag; fires bucketed session + exposure milestones for advertisers. */
  tick(bannerVisible, dtMs) {
    if (!_t0) return;
    if (bannerVisible) _bannerMs += dtMs || 0;
    const mins = (performance.now() - _t0) / 60000;
    for (const m of MIN_MARKS) if (mins >= m && !_fired.has('s' + m)) { _fired.add('s' + m); this.track('session_reached', { name: m + 'min', value: m }); }
    const bmin = _bannerMs / 60000;
    for (const m of MIN_MARKS) if (bmin >= m && !_fired.has('b' + m)) { _fired.add('b' + m); this.track('banner_exposure', { name: m + 'min', value: m }); }
  },
  bannerSeconds() { return Math.round(_bannerMs / 1000); },
  /** Fire an event every time. */
  track(name, data) {
    if (!IS_PROD) { if (import.meta.env.DEV) console.debug('[analytics]', name, data || ''); return; }
    try { vaTrack(name, data || undefined); } catch { /* never break the game */ }
  },
  /** Fire an event once per session per unique key (e.g. zone names). */
  once(name, key, data) {
    const k = `${name}:${key}`;
    if (seen.has(k)) return;
    seen.add(k);
    this.track(name, data ?? { name: key, value: key, place: key });
  },
};
