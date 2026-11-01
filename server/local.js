#!/usr/bin/env node
/**
 * Local mock multiplayer server — plain Node + `ws`, same Room logic as the Durable Object.
 *   node server/local.js            # ws://localhost:8787
 *   PORT=9000 node server/local.js
 */
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { Room, TICK_MS } from './room.js';
import { submitScore, getScores } from './scores.js';

const PORT = Number(process.env.PORT) || 8787;
const room = new Room();

// in-memory leaderboard store (persists to disk so local best-times survive restarts)
import { readFileSync, writeFileSync } from 'node:fs';
const LB_FILE = new URL('./scores.local.json', import.meta.url).pathname;
let lb = {}; try { lb = JSON.parse(readFileSync(LB_FILE, 'utf8')); } catch {}
const store = { get: async (k) => lb[k], put: async (k, v) => { lb[k] = v; try { writeFileSync(LB_FILE, JSON.stringify(lb)); } catch {} } };

const httpServer = createServer(async (req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'content-type': 'application/json' };
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname !== '/scores') { res.writeHead(404); res.end(); return; }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (req.method === 'POST') {
    let data = ''; req.on('data', (c) => (data += c)); req.on('end', async () => {
      let body = {}; try { body = JSON.parse(data); } catch {}
      const r = await submitScore(store, body.race, body.name, body.ms, !!body.desc);
      if (r) for (const e of r.top) if (!e.at) e.at = Date.now();
      res.writeHead(200, cors); res.end(JSON.stringify(r || { rank: null, top: [] }));
    });
    return;
  }
  const race = u.searchParams.get('race');
  res.writeHead(200, cors); res.end(JSON.stringify(race ? await getScores(store, race) : {}));
});
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT, '0.0.0.0');

wss.on('connection', (ws, req) => {
  const p = room.join(ws);
  if (!p) { log(`rejected (full) from ${req.socket.remoteAddress}`); return; }
  log(`+ ${p.callsign} (#${p.id}) — ${room.size} online`);
  ws.on('message', (data) => room.onMessage(p.id, data));
  ws.on('close', () => { room.leave(p.id); log(`- ${p.callsign} (#${p.id}) — ${room.size} online`); });
  ws.on('error', () => { /* close follows */ });
});

const timer = setInterval(() => room.tick(), TICK_MS);
httpServer.on('listening', () => log(`Rocket City relay + scores on http://localhost:${PORT}  (ws + /scores)`));

function log(msg) { console.log(`[relay ${new Date().toISOString().slice(11, 19)}] ${msg}`); }
process.on('SIGINT', () => { clearInterval(timer); wss.close(); process.exit(0); });
