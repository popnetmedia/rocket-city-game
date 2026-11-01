/**
 * Cloudflare Worker + Durable Object relay. Same Room logic as server/local.js.
 *
 *   npx wrangler dev server/do.js      # local: ws://localhost:8787
 *   npx wrangler deploy                # -> wss://rocket-city-relay.<you>.workers.dev
 *
 * One room ("huntsville") = one DO instance = one authoritative in-memory player list.
 * Cap/rate-limit/silent-drop live in room.js. Rejections close with 4001 "CITY FULL".
 */
import { Room, TICK_MS } from './room.js';
import { submitScore, getScores } from './scores.js';

export class HuntsvilleRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.room = new Room();
    this.timer = null;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response(JSON.stringify({ room: 'huntsville', online: this.room.size, cap: this.room.cap }), {
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const p = this.room.join(server); // null => already told "full" + closed
    if (p) {
      server.addEventListener('message', (e) => this.room.onMessage(p.id, e.data));
      const bye = () => { this.room.leave(p.id); this._maybeStop(); };
      server.addEventListener('close', bye);
      server.addEventListener('error', bye);
      this._ensureTick();
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  _ensureTick() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.room.tick(); this._maybeStop(); }, TICK_MS);
  }

  _maybeStop() {
    if (this.room.size === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

const MAX_ROOMS = 8; // 8 rooms x 30 players = 240 concurrent ceiling per city
// Rooms are per city: positions on the wire are scene-space, and each city has its own
// origin, so mixing cities in one room puts every remote player somewhere meaningless.
// This list is an ALLOWLIST, not a convenience — idFromName() on unvalidated input lets
// anyone mint unbounded Durable Object namespaces by passing ?city=<anything>.
// scripts/rooms.test.mjs asserts it matches the city registry, so it cannot drift.
const CITY_IDS = ['huntsville', 'chattanooga', 'knoxville', 'nashville', 'orlando', 'miami', 'anaheim', 'nyc'];
const cityOf = (url) => {
  const c = (url.searchParams.get('city') || '').toLowerCase();
  return CITY_IDS.includes(c) ? c : CITY_IDS[0];
};

async function occupancy(env, name) {
  const stub = env.ROOM.get(env.ROOM.idFromName(name));
  try {
    const res = await stub.fetch('https://room/occupancy');
    const j = await res.json();
    return j.online ?? 0;
  } catch { return 0; }
}

export class ScoresRoom {
  constructor(state) { this.state = state; this.store = {
    get: (k) => state.storage.get(k),
    put: (k, v) => state.storage.put(k, v),
  }; }
  async fetch(request) {
    const url = new URL(request.url);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'content-type': 'application/json' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method === 'POST') {
      let body = {}; try { body = await request.json(); } catch {}
      const res = await submitScore(this.store, body.race, body.name, body.ms, !!body.desc);
      if (res) for (const e of res.top) if (!e.at) e.at = Date.now();
      return new Response(JSON.stringify(res || { rank: null, top: [] }), { headers: cors });
    }
    const race = url.searchParams.get('race');
    const data = race ? await getScores(this.store, race) : {};
    return new Response(JSON.stringify(data), { headers: cors });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/scores') {
      const id = env.SCORES.idFromName('global');
      return env.SCORES.get(id).fetch(request);
    }
    if (url.pathname === '/health') {
      // ?city= reports one city; without it, every city, so the number is not a lie.
      const want = url.searchParams.get('city');
      const cities = want && CITY_IDS.includes(want) ? [want] : CITY_IDS;
      const rooms = [];
      let total = 0;
      for (const city of cities) {
        for (let i = 1; i <= MAX_ROOMS; i++) {
          const online = await occupancy(env, `${city}-${i}`);
          if (online) rooms.push({ room: `${city}-${i}`, online });
          total += online;
        }
      }
      return new Response(JSON.stringify({ total, cap: MAX_ROOMS * 30 * cities.length, cities: cities.length, rooms }), {
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      });
    }
    // Fill-first lobby: route each join to the first room with space. The room
    // itself still enforces its cap, so a lost race just means CITY FULL + retry.
    const city = cityOf(url);
    for (let i = 1; i <= MAX_ROOMS; i++) {
      const name = `${city}-${i}`;
      if (i === MAX_ROOMS || (await occupancy(env, name)) < 30) {
        return env.ROOM.get(env.ROOM.idFromName(name)).fetch(request);
      }
    }
    return new Response('no room', { status: 503 });
  },
};
