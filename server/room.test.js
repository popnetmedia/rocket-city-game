// Quick protocol check: node server/room.test.js
import assert from 'node:assert/strict';
import { Room, SILENT_TIMEOUT_MS, CHAT_INTERVAL_MS } from './room.js';

let now = 100000;
const room = new Room({ now: () => now, cap: 2 });
const mk = () => { const s = { out: [], closed: null, send(x) { this.out.push(JSON.parse(x)); }, close(c, r) { this.closed = [c, r]; } }; return s; };

const a = mk(), b = mk(), c = mk();
const pa = room.join(a), pb = room.join(b);
assert.equal(a.out[0].t, 'welcome'); assert.match(pa.callsign, /^ROCKET-\d+$/);
assert.equal(b.out[0].players.length, 1, 'b sees a in welcome');
assert.equal(room.join(c), null); assert.equal(c.out[0].t, 'full'); assert.deepEqual(c.closed, [4001, 'CITY FULL']);

room.onMessage(pa.id, JSON.stringify({ t: 'pos', pos: [1, 2, 3], rot: 0.5, state: 'car' }));
room.onMessage(pa.id, JSON.stringify({ t: 'pos', pos: ['x'], state: 'hack' })); // ignored
room.tick();
const st = b.out.at(-1); assert.equal(st.t, 'state');
const pa_view = st.players.find((p) => p.id === pa.id);
assert.deepEqual(pa_view.pos, [1, 2, 3]); assert.equal(pa_view.state, 'car');

room.onMessage(pb.id, JSON.stringify({ t: 'chat', msg: '<b>hi</b> <script>x</script> ' + 'y'.repeat(200) }));
const chat = a.out.at(-1); assert.equal(chat.t, 'chat'); assert.equal(chat.callsign, pb.callsign);
assert.ok(!chat.msg.includes('<')); assert.ok(chat.msg.length <= 140);
const n = a.out.length;
room.onMessage(pb.id, JSON.stringify({ t: 'chat', msg: 'spam' })); assert.equal(a.out.length, n, 'rate limited');
now += CHAT_INTERVAL_MS; room.onMessage(pb.id, JSON.stringify({ t: 'chat', msg: 'ok' })); assert.equal(a.out.at(-1).msg, 'ok');

now += SILENT_TIMEOUT_MS + 1; room.onMessage(pb.id, JSON.stringify({ t: 'ping' })); room.tick();
assert.equal(room.size, 1, 'silent a dropped'); assert.deepEqual(a.closed, [4000, 'SILENT']);
assert.equal(b.out.find((m) => m.t === 'leave')?.id, pa.id);
console.log('room.test.js: all assertions passed');
