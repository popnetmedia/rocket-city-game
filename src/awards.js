/**
 * Awards / "briefcase": earned badges persisted in localStorage (no accounts —
 * per-browser, like the rest of the game's progress). Keyed by the id of the
 * thing that grants them (e.g. a hunt id), so completing a run awards its badge.
 */
const KEY = 'rocketcity.awards.v1';

export const AWARDS = {
  starbucks: { id: 'starbucks', name: 'STARBUCK AWARD', emoji: '☕', color: '#00754a', blurb: 'Grabbed a coffee coin at every Starbucks in the city.' },
  golf: { id: 'golf', name: 'LINKS LEGEND', emoji: '⛳', color: '#39ff88', blurb: 'Found every golf course around Huntsville.' },
  bowling: { id: 'bowling', name: 'PERFECT GAME', emoji: '🎳', color: '#b5179e', blurb: 'Found every bowling alley in Huntsville and Madison.' },
  pickleball: { id: 'pickleball', name: 'DINK MASTER', emoji: '🥒', color: '#4f8f1f', blurb: 'Found every pickleball court in the valley.' },
  beer: { id: 'beer', name: 'TAPROOM TOURIST', emoji: '🍺', color: '#c8791a', blurb: 'Grabbed a pint coin at every craft brewery in Huntsville and Madison.' },
  er: { id: 'er', name: 'FIRST RESPONDER', emoji: '🚑', color: '#c1121f', blurb: 'Visited every major and minor hospital in the area.' },
  'animal-shelters': { id: 'animal-shelters', name: 'ANIMAL ALLY', emoji: '🐾', color: '#ff9e5e', blurb: 'Visited every animal shelter & rescue in Huntsville and Madison.' },
  'trench-chapman': { id: 'trench-chapman', name: 'CHAPMAN TRENCH', emoji: '⚡', color: '#4fd8ff', blurb: 'Ran the Chapman Mountain power-line cut, gate to gate.' },
  'trench-hampton': { id: 'trench-hampton', name: 'HAMPTON TRENCH', emoji: '⚡', color: '#7fffd4', blurb: 'Ran the Hampton Cove power-line cut through the valley.' },
  'trench-maysville': { id: 'trench-maysville', name: 'MAYSVILLE TRENCH', emoji: '⚡', color: '#9d8cff', blurb: 'Ran the long Maysville corridor across the ridges.' },
  'rail-memphis': { id: 'rail-memphis', name: 'MEMPHIS DISTRICT', emoji: '🚂', color: '#ffd166', blurb: 'Flew the Norfolk Southern main line east of the city, gate to gate.' },
  'trench-jones': { id: 'trench-jones', name: 'JONES VALLEY TRENCH', emoji: '⚡', color: '#ff9e5e', blurb: 'Ran the Jones Valley loop under the towers.' },
};

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function save(e) { try { localStorage.setItem(KEY, JSON.stringify(e)); } catch { /* ignore */ } }

export const awards = {
  // id -> { at, runs }. Legacy saves stored a bare timestamp; _rec normalizes both.
  earned: load(),
  _rec(id) {
    const v = this.earned[id];
    if (!v) return null;
    return typeof v === 'number' ? { at: v, runs: 1 } : { at: v.at, runs: v.runs || 1 };
  },
  has(id) { return !!this.earned[id]; },
  /** How many times this run has been completed (0 if never). */
  runs(id) { return this._rec(id)?.runs || 0; },
  /** Record a completion. Returns true only if it's NEW (first time earned). */
  grant(id) {
    const cur = this._rec(id);
    if (cur) { this.earned[id] = { at: cur.at, runs: cur.runs + 1 }; save(this.earned); return false; }
    this.earned[id] = { at: Date.now(), runs: 1 }; save(this.earned); return true;
  },
  count() { return Object.keys(this.earned).length; },
  /** All defined awards with earned/locked state for the briefcase. */
  list() {
    return Object.values(AWARDS).map((a) => {
      const r = this._rec(a.id);
      return { ...a, earned: !!r, at: r?.at || null, runs: r?.runs || 0 };
    });
  },
};
