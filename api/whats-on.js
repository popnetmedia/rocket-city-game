/**
 * GET /api/whats-on?city=<id>  ->  { city, fetched, events: [...] }
 *
 * Ticketmaster Discovery, proxied so the key stays on the server. NOTE: every other env
 * var in this repo is VITE_-prefixed, which Vite inlines into the client bundle — this key
 * deliberately is not, and scripts/no-secret-leak.test.mjs fails the build if it ever
 * reaches dist/.
 *
 * Never throws at the caller: on a missing key, an upstream error or a timeout it answers
 * with an empty list, and the client simply shows nothing. A city with no events is
 * indistinguishable from a city we could not reach, on purpose — neither is worth an error
 * message on top of a flight game.
 */
import { CITIES } from '../src/cities/index.js';
import { buildDiscoveryUrl, slimEvents, cacheHeader } from './_lib/tm.js';

const TIMEOUT_MS = 6000;

export default async function handler(req, res) {
  const id = String(new URL(req.url, 'http://localhost').searchParams.get('city') || '').toLowerCase();
  const city = CITIES.find((c) => c.meta.id === id);
  const key = process.env.TICKETMASTER_API_KEY;

  const send = (events, ok) => {
    res.setHeader('Cache-Control', cacheHeader(ok));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).end(JSON.stringify({ city: id, fetched: new Date().toISOString(), events }));
  };

  if (!city || !key) return send([], false);

  const url = buildDiscoveryUrl(city, key);
  if (!url) return send([], false);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return send([], false);
    const json = await r.json();
    return send(slimEvents(json, { affiliate: process.env.TICKETMASTER_AFFILIATE || '' }), true);
  } catch {
    return send([], false);            // upstream down or slow — the game does not care
  } finally {
    clearTimeout(timer);
  }
}
