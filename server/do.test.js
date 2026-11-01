// Exercises the Worker + DO handler in Node with a fake WebSocketPair / env. node server/do.test.js
import assert from 'node:assert/strict';

class FakeSocket extends EventTarget {
  constructor() { super(); this.sent = []; this.closed = null; this.peer = null; }
  accept() {}
  send(x) { this.sent.push(JSON.parse(x)); }
  close(c, r) { this.closed = [c, r]; this.dispatchEvent(new Event('close')); }
  say(obj) { this.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(obj) })); }
}
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket(); } };
globalThis.Response = class { constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.webSocket = init.webSocket; this.headers = init.headers; } async json() { return JSON.parse(this.body); } };

const { default: worker, HuntsvilleRoom } = await import('./do.js');
const dos = new Map();
const env = { ROOM: { idFromName: (n) => n, get: (id) => ({ fetch: (req) => {
  if (!dos.has(id)) dos.set(id, new HuntsvilleRoom({}, env));
  const r = typeof req === 'string' ? { url: req, headers: { get: () => null } } : req;
  return dos.get(id).fetch(r);
} }) } };
const wsReq = (path = '/') => ({ url: 'https://relay.example' + path, headers: { get: (h) => (h === 'Upgrade' ? 'websocket' : null) } });
const httpReq = (path = '/') => ({ url: 'https://relay.example' + path, headers: { get: () => null } });



const socks = [];
for (let i = 0; i < 35; i++) {
  const res = await worker.fetch(wsReq(), env);
  assert.equal(res.status, 101);
  socks.push(res.webSocket);
}
const room = dos.get('huntsville-1');
assert.equal(room.room.size, 30, 'room 1 caps at 30');
const room2 = dos.get('huntsville-2');
assert.equal(room2.room.size, 5, 'overflow lands in room 2');
const serverSides = [...room.room.players.values()].map((p) => p.socket);
const health = JSON.parse((await worker.fetch(httpReq('/health'), env)).body);
assert.equal(health.total, 35); assert.equal(health.rooms[0].online, 30); assert.equal(health.rooms[1].online, 5);

// occupancy endpoint on a room
const occ = JSON.parse((await dos.get('huntsville-1').fetch(httpReq('/occupancy'))).body);
assert.equal(occ.online, 30);

// chat relays between server-side sockets
serverSides[0].say({ t: 'chat', msg: 'hi <b>x</b>' });
assert.equal(serverSides[1].sent.at(-1).msg, 'hi x');

// tick runs and stops when empty
assert.ok(room.timer, 'tick timer running');
room.room.tick();
assert.equal(serverSides[5].sent.at(-1).t, 'state');
for (const s of serverSides) s.close(1000, 'bye');
assert.equal(room.room.size, 0); assert.equal(room.timer, null, 'timer stopped when empty');
// ---- rooms are per city ------------------------------------------------------------
// Positions on the wire are scene-space and every city has its own origin, so a join must
// land in its OWN city's room. Before this, every city shared huntsville-N.
{
  const seen = [];
  const spyEnv = { ROOM: { idFromName: (n) => n, get: (id) => ({ fetch: () => { seen.push(id); return new Response(null, { status: 101 }); } }) } };
  const join = (q) => worker.fetch({ url: 'https://relay.example/' + q, headers: { get: (h) => (h === 'Upgrade' ? 'websocket' : null) } }, spyEnv);

  await join('?city=orlando');
  assert.ok(seen.at(-1).startsWith('orlando-'), `orlando join went to ${seen.at(-1)}`);
  await join('?city=anaheim');
  assert.ok(seen.at(-1).startsWith('anaheim-'), `anaheim join went to ${seen.at(-1)}`);
  await join('?city=huntsville');
  assert.ok(seen.at(-1).startsWith('huntsville-'), 'huntsville join');
  await join('');
  assert.ok(seen.at(-1).startsWith('huntsville-'), 'no city -> origin city, not a new namespace');

  // idFromName() on unvalidated input would mint an unbounded number of Durable Object
  // namespaces, so anything off the allowlist must collapse to the fallback.
  for (const bad of ['?city=../etc', '?city=' + 'x'.repeat(200), '?city=ORLANDO%00', '?city=notacity']) {
    await join(bad);
    assert.ok(seen.at(-1).startsWith('huntsville-'), `unknown city ${bad} must fall back, got ${seen.at(-1)}`);
  }
  assert.equal(new Set(seen.map((n) => n.replace(/-\d+$/, ''))).size, 3, 'only real cities ever became namespaces');
}

console.log('do.test.js: all assertions passed');
