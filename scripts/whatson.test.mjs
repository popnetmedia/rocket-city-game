/**
 * Tests for the Ticketmaster helpers. No key and no network: the point is that the query
 * building and the response slimming are correct before anyone wires a real key up.
 */
import assert from 'node:assert';
import { buildDiscoveryUrl, slimEvents, withAffiliate, geohash, cacheHeader, MAX_EVENTS } from '../api/_lib/tm.js';

const NOW = new Date('2026-08-31T18:00:00Z');
const city = (extra = {}) => ({ meta: { id: 'nashville' }, origin: { lat: 36.1627, lon: -86.7816 }, ...extra });

// ---- geohash ----
// Known reference: Nashville (36.1627, -86.7816) begins 'dn6' in geohash space.
assert.ok(geohash(36.1627, -86.7816).startsWith('dn6'), 'nashville geohash prefix');
assert.strictEqual(geohash(36.1627, -86.7816).length, 9);
assert.notStrictEqual(geohash(36.1627, -86.7816), geohash(35.0456, -85.3097), 'different cities differ');

// ---- query building ----
assert.strictEqual(buildDiscoveryUrl(city(), ''), null, 'no key -> no request');
assert.strictEqual(buildDiscoveryUrl(null, 'k'), null, 'no city -> no request');

const u = new URL(buildDiscoveryUrl(city(), 'KEY123', { now: NOW }));
assert.strictEqual(u.searchParams.get('apikey'), 'KEY123');
assert.strictEqual(u.searchParams.get('startDateTime'), '2026-08-31T18:00:00Z', 'no milliseconds');
assert.strictEqual(u.searchParams.get('endDateTime'), '2026-09-07T18:00:00Z', 'seven day horizon');
assert.strictEqual(u.searchParams.get('radius'), '15');
assert.strictEqual(u.searchParams.get('unit'), 'miles');
assert.ok(u.searchParams.get('geoPoint'), 'falls back to the city origin');
assert.strictEqual(u.searchParams.get('venueId'), null);

// pinned venues take precedence over the radius search
const pinned = new URL(buildDiscoveryUrl(city({ whatsOn: { venueIds: ['A', 'B'] } }), 'K', { now: NOW }));
assert.strictEqual(pinned.searchParams.get('venueId'), 'A,B');
assert.strictEqual(pinned.searchParams.get('geoPoint'), null, 'no radius search when venues are pinned');

const wide = new URL(buildDiscoveryUrl(city({ whatsOn: { radiusMiles: 40 } }), 'K', { now: NOW }));
assert.strictEqual(wide.searchParams.get('radius'), '40');

// ---- response slimming ----
const fixture = {
  _embedded: {
    events: [
      { name: 'A Real Show', url: 'https://www.ticketmaster.com/event/1',
        dates: { start: { dateTime: '2026-09-01T01:00:00Z' } },
        _embedded: { venues: [{ name: 'Ryman Auditorium' }] } },
      { name: 'No URL', dates: { start: { dateTime: '2026-09-02T01:00:00Z' } } },
      { name: 'No Date', url: 'https://x/2' },
      { url: 'https://x/3', dates: { start: { dateTime: '2026-09-03T01:00:00Z' } } },
      { name: 'No Venue', url: 'https://www.ticketmaster.com/event/4',
        dates: { start: { dateTime: '2026-09-04T01:00:00Z' } } },
    ],
  },
};
const ev = slimEvents(fixture);
assert.strictEqual(ev.length, 2, 'drops entries missing a name, a start or a url');
assert.deepStrictEqual(ev[0], { name: 'A Real Show', venue: 'Ryman Auditorium',
  starts: '2026-09-01T01:00:00Z', url: 'https://www.ticketmaster.com/event/1' });
assert.strictEqual(ev[1].venue, '', 'a missing venue is empty, not undefined');

assert.deepStrictEqual(slimEvents(null), [], 'null response');
assert.deepStrictEqual(slimEvents({}), [], 'empty response');
assert.deepStrictEqual(slimEvents({ _embedded: { events: 'nope' } }), [], 'malformed response');
assert.ok(slimEvents({ _embedded: { events: Array.from({ length: 50 }, (_, i) => ({
  name: 'E' + i, url: 'https://x/' + i, dates: { start: { dateTime: '2026-09-01T01:00:00Z' } },
})) } }).length <= MAX_EVENTS, 'caps the list');

// ---- affiliate tagging ----
assert.strictEqual(withAffiliate('https://x/e?a=1', ''), 'https://x/e?a=1', 'no tag = untouched');
const tagged = new URL(withAffiliate('https://x/e?a=1', 'irclickid=abc&utm_source=rc'));
assert.strictEqual(tagged.searchParams.get('irclickid'), 'abc');
assert.strictEqual(tagged.searchParams.get('a'), '1', 'existing params survive');
assert.strictEqual(withAffiliate('not a url', 'x=1'), 'not a url', 'garbage in, same garbage out');
assert.ok(slimEvents(fixture, { affiliate: 'x=1' })[0].url.includes('x=1'), 'affiliate reaches the events');

// ---- caching ----
assert.ok(cacheHeader(true).includes('s-maxage=1800'));
assert.ok(cacheHeader(false).includes('s-maxage=60'), 'failures are not cached all day');

console.log('whatson: all assertions passed');
