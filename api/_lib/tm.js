/**
 * Ticketmaster Discovery helpers — pure, so they can be unit-tested without a key or a
 * network. The serverless handler in ../whats-on.js is a thin shell around these.
 *
 * Live Nation needs no separate integration: Live Nation owns Ticketmaster and its events
 * are in this same inventory.
 */

export const DISCOVERY = 'https://app.ticketmaster.com/discovery/v2/events.json';

/** How far ahead to look. A single night is often empty midweek and reads as broken. */
export const DEFAULT_DAYS = 7;
export const DEFAULT_RADIUS_MILES = 15;
export const MAX_EVENTS = 12;

/** Ticketmaster wants ISO-8601 with no milliseconds. */
export function tmDate(d) {
  return new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Build the Discovery request for a city.
 * A city may pin venue ids; otherwise we search a radius around its own origin, which
 * every city already has, so this works for a city scaffolded five minutes ago.
 */
export function buildDiscoveryUrl(city, key, { now = new Date(), days = DEFAULT_DAYS } = {}) {
  if (!city || !key) return null;
  const cfg = city.whatsOn || {};
  const u = new URL(DISCOVERY);
  u.searchParams.set('apikey', key);
  u.searchParams.set('size', String(MAX_EVENTS));
  u.searchParams.set('sort', 'date,asc');
  u.searchParams.set('startDateTime', tmDate(now));
  u.searchParams.set('endDateTime', tmDate(new Date(now.getTime() + days * 864e5)));
  if (cfg.venueIds?.length) {
    u.searchParams.set('venueId', cfg.venueIds.join(','));
  } else {
    u.searchParams.set('geoPoint', geohash(city.origin.lat, city.origin.lon));
    u.searchParams.set('radius', String(cfg.radiusMiles || DEFAULT_RADIUS_MILES));
    u.searchParams.set('unit', 'miles');
  }
  return u.toString();
}

const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
/** Discovery takes a geohash rather than a lat/lon pair. 9 chars is ~2 m, far more than enough. */
export function geohash(lat, lon, precision = 9) {
  let latR = [-90, 90], lonR = [-180, 180], hash = '', bits = 0, bit = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonR[0] + lonR[1]) / 2;
      if (lon > mid) { bits = (bits << 1) + 1; lonR[0] = mid; } else { bits <<= 1; lonR[1] = mid; }
    } else {
      const mid = (latR[0] + latR[1]) / 2;
      if (lat > mid) { bits = (bits << 1) + 1; latR[0] = mid; } else { bits <<= 1; latR[1] = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += B32[bits]; bits = 0; bit = 0; }
  }
  return hash;
}

/**
 * Reduce a Discovery response to what the game shows. The raw payload is large and its
 * shape shifts, so nothing is passed through untouched. Anything missing a name, a start
 * time or a URL is dropped rather than rendered half-blank.
 */
export function slimEvents(json, { affiliate = '' } = {}) {
  const raw = json?._embedded?.events;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    const starts = e?.dates?.start?.dateTime;
    const venue = e?._embedded?.venues?.[0]?.name;
    if (!e?.name || !starts || !e?.url) continue;
    out.push({
      name: String(e.name),
      venue: venue ? String(venue) : '',
      starts,
      url: withAffiliate(e.url, affiliate),
    });
  }
  return out.slice(0, MAX_EVENTS);
}

/** Append the affiliate tag if one is configured. No tag = the plain link, never a broken one. */
export function withAffiliate(url, affiliate) {
  if (!affiliate) return url;
  try {
    const u = new URL(url);
    for (const pair of String(affiliate).split('&')) {
      const [k, v] = pair.split('=');
      if (k && v) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch { return url; }
}

/**
 * CDN caching is what makes the quota irrelevant: every visitor is served from the edge and
 * Ticketmaster sees roughly two calls an hour per city however much traffic arrives.
 */
export function cacheHeader(ok) {
  return ok
    ? 'public, s-maxage=1800, stale-while-revalidate=86400'
    : 'public, s-maxage=60';          // back off briefly on failure, do not cache it all day
}
