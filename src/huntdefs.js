/**
 * Hunt definitions — deliberately free of THREE and of any DOM, so build-time scripts
 * (the city landing-page generator) can import the same source of truth the game uses
 * instead of keeping a second copy that drifts.
 *
 * `coin.data` names the city POI list a coin run scores; `board` is the leaderboard id.
 */
export const HUNTS = {
  flock: { id: 'flock', name: 'FIND THE FLOCK', color: 0xff3344, radius: 45, board: 'flock-hunt', sound: 'powerDown', label: 'FLOCK FOUND' },
  golf: { id: 'golf', name: 'FIND THE GOLF', color: 0x39ff88, radius: 80, board: 'golf-hunt', sound: 'ding', label: 'COURSES FOUND' },
  starbucks: { id: 'starbucks', name: '☕ STARBUCKS RUN', color: 0x00754a, radius: 90, board: 'starbucks-run', sound: 'ding', label: 'CUPS GRABBED', coin: { emoji: '☕', hex: '#00754a', data: 'STARBUCKS' } },
  bowling: { id: 'bowling', name: '🎳 BOWLING RUN', color: 0xff6ec7, radius: 90, board: 'bowling-run', sound: 'ding', label: 'LANES FOUND', coin: { emoji: '🎳', hex: '#b5179e', data: 'BOWLING' } },
  pickleball: { id: 'pickleball', name: '🥒 PICKLEBALL RUN', color: 0x9ee34a, radius: 90, board: 'pickleball-run', sound: 'ding', label: 'COURTS FOUND', coin: { emoji: '🥒', hex: '#4f8f1f', data: 'PICKLEBALL' } },
  beer: { id: 'beer', name: '🍺 CRAFT BEER RUN', color: 0xffa62b, radius: 90, board: 'beer-run', sound: 'ding', label: 'TAPROOMS FOUND', coin: { emoji: '🍺', hex: '#c8791a', data: 'BREWERIES' } },
  er: { id: 'er', name: '🚑 ER RUN', color: 0xff4d5a, radius: 100, board: 'er-run', sound: 'ding', label: 'HOSPITALS FOUND', coin: { emoji: '🚑', hex: '#c1121f', data: 'HOSPITALS' } },
  honkytonk: { id: 'honkytonk', name: '🎸 HONKY-TONK CRAWL', color: 0xffcc33, radius: 60, board: 'honkytonk-crawl', sound: 'ding', label: 'HONKY-TONKS HIT', coin: { emoji: '🎸', hex: '#c9922a', data: 'HONKYTONKS' } },
  coaster: { id: 'coaster', name: '🎢 COASTER RUN', color: 0xff7a3d, radius: 70, board: 'coaster-run', sound: 'ding', label: 'COASTERS RIDDEN', coin: { emoji: '🎢', hex: '#d2541c', data: 'COASTERS' } },
  safari: { id: 'safari', name: '🦁 SAFARI SPOTTING', color: 0xffc94a, radius: 55, board: 'safari-spotting', sound: 'ding', label: 'ANIMALS SPOTTED', coin: { emoji: '🦁', hex: '#c08a1e', data: 'ANIMALS' } },
};

/** POI list on the city module that each coin hunt scores. */
export const HUNT_POI = {
  golf: 'golfCourses', starbucks: 'starbucks', bowling: 'bowling',
  pickleball: 'pickleball', beer: 'breweries', er: 'hospitals', honkytonk: 'honkytonks',
  coaster: 'coasters', safari: 'animals',
};

/** Which hunts a given city actually has data for — the same rule the menu uses. */
export function huntsForCity(city) {
  const hidden = new Set(city.meta?.hiddenModes || []);
  return Object.values(HUNTS).filter((h) => {
    if (hidden.has(h.id)) return false;
    if (h.id === 'flock') return !!city.alpr;
    const key = HUNT_POI[h.id];
    return !!(key && city.pois?.[key]?.length);
  });
}
