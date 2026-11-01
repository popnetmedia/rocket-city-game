/**
 * Client for the global leaderboard (Worker/local /scores endpoint) with graceful
 * fallback: if no server is reachable, races still keep LOCAL best times.
 * Base URL derived from VITE_MP_SERVER (ws->http) or VITE_SCORES_URL.
 */
function base() {
  const explicit = (import.meta.env.VITE_SCORES_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const mp = (import.meta.env.VITE_MP_SERVER || 'ws://localhost:8787').trim();
  return mp.replace(/^ws/, 'http').replace(/\/$/, '');
}

export async function submitScore(raceId, name, ms, desc = false) {
  try {
    const r = await fetch(`${base()}/scores`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ race: raceId, name, ms, desc }),
    });
    if (!r.ok) return null;
    return await r.json(); // { rank, top:[{name,ms}] }
  } catch { return null; }
}

export async function fetchScores(raceId) {
  try {
    const r = await fetch(`${base()}/scores?race=${encodeURIComponent(raceId)}`);
    if (!r.ok) return null;
    return await r.json(); // [{name,ms}]
  } catch { return null; }
}

export function fmtTime(ms) {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

/** Player's callsign for the board — MP callsign if online, else stored/prompted initials. */
export function playerTag(mpCallsign) {
  if (mpCallsign) return mpCallsign.replace('ROCKET-', 'R');
  let t = null;
  try { t = localStorage.getItem('rocketcity.tag'); } catch {}
  if (!t) {
    t = (prompt('Enter your initials for the leaderboard (1–4 letters):', 'ACE') || 'ACE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'ACE';
    try { localStorage.setItem('rocketcity.tag', t); } catch {}
  }
  return t;
}
