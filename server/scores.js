/**
 * Leaderboard logic, platform-agnostic. Backed by an async key/value store
 * ({ get(k), put(k,v) } — Map-wrapped for the local mock, DO storage in prod).
 * Keeps the top N times per race id. Lower ms = better.
 */
export const TOP_N = 10;
const CALLSIGN_RE = /^[A-Z0-9]{1,4}$/;

function clean(name) {
  const n = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return CALLSIGN_RE.test(n) ? n : 'ACE';
}

export async function submitScore(store, raceId, name, ms, desc = false) {
  raceId = String(raceId).slice(0, 40);
  ms = Math.max(0, Math.round(+ms) || 0);
  if (!raceId || !ms) return null;
  const key = `lb:${raceId}`;
  const list = (await store.get(key)) || [];
  list.push({ name: clean(name), ms, at: Date.now ? undefined : 0 }); // no Date in DO-safe path; server stamps
  list.sort((a, b) => desc ? b.ms - a.ms : a.ms - b.ms);
  const top = list.slice(0, TOP_N);
  await store.put(key, top);
  const rank = top.findIndex((e) => e.ms === ms && e.name === clean(name));
  return { rank: rank >= 0 ? rank + 1 : null, top };
}

export async function getScores(store, raceId) {
  return (await store.get(`lb:${String(raceId).slice(0, 40)}`)) || [];
}
