/**
 * Room: platform-agnostic multiplayer relay logic.
 * Used verbatim by server/local.js (Node `ws`) and server/do.js (Cloudflare Durable Object).
 *
 * A "socket" is anything with .send(string) and .close(code, reason).
 *
 * Wire protocol (JSON, one object per message):
 *   client -> server
 *     { t:'pos',  pos:[x,y,z], rot:yaw, state:'walk'|'car'|'glider'|'fly' }   (10 Hz)
 *     { t:'chat', msg }                                                   (<=140 chars, 1 per 2 s)
 *   server -> client
 *     { t:'welcome', id, callsign, players:[...] }
 *     { t:'state', players:[{ id, callsign, pos, rot, state }] }          (10 Hz)
 *     { t:'chat', id, callsign, msg }
 *     { t:'leave', id }
 *     { t:'full' }  then close(4001, 'CITY FULL')
 */

export const ROOM_CAP = 30;
export const TICK_MS = 100;          // 10 Hz broadcast
export const SILENT_TIMEOUT_MS = 15000;
export const CHAT_MAX = 140;
export const CHAT_INTERVAL_MS = 2000;
const STATES = new Set(['walk', 'car', 'glider', 'fly']);
const CHARS = new Set(['saturn', 'panda', 'astro', 'ufo']);

function randomCallsign(taken) {
  for (let i = 0; i < 50; i++) {
    const c = `ROCKET-${Math.floor(Math.random() * 90) + 10}`;
    if (!taken.has(c)) return c;
  }
  return `ROCKET-${Math.floor(Math.random() * 9000) + 1000}`;
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

function finiteArray(a, n) {
  return Array.isArray(a) && a.length === n && a.every((v) => typeof v === 'number' && Number.isFinite(v));
}

export class Room {
  constructor({ now = () => Date.now(), cap = ROOM_CAP } = {}) {
    this.now = now;
    this.cap = cap;
    this.players = new Map(); // id -> { id, callsign, socket, pos, rot, state, lastSeen, lastChat }
    this.nextId = 1;
  }

  get size() { return this.players.size; }

  /** Returns the player record, or null if the room is full (socket already told + closed). */
  join(socket) {
    if (this.players.size >= this.cap) {
      this._send(socket, { t: 'full' });
      try { socket.close(4001, 'CITY FULL'); } catch { /* ignore */ }
      return null;
    }
    const taken = new Set([...this.players.values()].map((p) => p.callsign));
    const p = {
      id: this.nextId++,
      callsign: randomCallsign(taken),
      socket,
      pos: [0, 0, 0], rot: 0, state: 'walk', char: 'saturn',
      lastSeen: this.now(), lastChat: 0,
    };
    this.players.set(p.id, p);
    this._send(socket, { t: 'welcome', id: p.id, callsign: p.callsign, players: this._snapshot(p.id) });
    return p;
  }

  leave(id) {
    if (!this.players.delete(id)) return;
    this.broadcast({ t: 'leave', id });
  }

  /** Handle one raw message from player `id`. Ignores garbage. */
  onMessage(id, raw) {
    const p = this.players.get(id);
    if (!p) return;
    let m;
    try { m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch { return; }
    if (!m || typeof m !== 'object') return;
    p.lastSeen = this.now();

    if (m.t === 'pos') {
      if (finiteArray(m.pos, 3)) p.pos = m.pos;
      if (typeof m.rot === 'number' && Number.isFinite(m.rot)) p.rot = m.rot;
      if (STATES.has(m.state)) p.state = m.state;
      if (CHARS.has(m.char)) p.char = m.char;
    } else if (m.t === 'chat') {
      const t = this.now();
      if (t - p.lastChat < CHAT_INTERVAL_MS) return; // rate limit: drop silently
      const msg = stripHtml(m.msg ?? '').slice(0, CHAT_MAX);
      if (!msg) return;
      p.lastChat = t;
      this.broadcast({ t: 'chat', id: p.id, callsign: p.callsign, msg });
    } else if (m.t === 'ping') {
      this._send(p.socket, { t: 'pong' });
    }
  }

  /** Call every TICK_MS: drops silent players, broadcasts state. */
  tick() {
    const t = this.now();
    for (const p of [...this.players.values()]) {
      if (t - p.lastSeen > SILENT_TIMEOUT_MS) {
        try { p.socket.close(4000, 'SILENT'); } catch { /* ignore */ }
        this.leave(p.id);
      }
    }
    if (this.players.size === 0) return;
    const payload = JSON.stringify({ t: 'state', players: this._snapshot() });
    for (const p of this.players.values()) this._sendRaw(p.socket, payload);
  }

  broadcast(obj) {
    const payload = JSON.stringify(obj);
    for (const p of this.players.values()) this._sendRaw(p.socket, payload);
  }

  _snapshot(excludeId = null) {
    const out = [];
    for (const p of this.players.values()) {
      if (p.id === excludeId) continue;
      out.push({ id: p.id, callsign: p.callsign, pos: p.pos, rot: p.rot, state: p.state, char: p.char });
    }
    return out;
  }

  _send(socket, obj) { this._sendRaw(socket, JSON.stringify(obj)); }
  _sendRaw(socket, payload) { try { socket.send(payload); } catch { /* socket gone; sweep will drop it */ } }
}
