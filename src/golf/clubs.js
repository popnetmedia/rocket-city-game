/**
 * Club table. Pure data — no THREE, no DOM.
 * loft: degrees. speedFactor: fraction of BALL_SPEED_MAX. spin: rpm backspin.
 * Ordered driver-first by increasing loft; golf.js relies on that order for [ ] cycling.
 * No putter: golf mode has no putting (see the spec's non-goals).
 */
export const CLUBS = [
  { id: 'driver', name: 'DRIVER',  loft: 10.5, speedFactor: 1.00, spin: 2600 },
  { id: '3w',     name: '3-WOOD',  loft: 15.0, speedFactor: 0.92, spin: 3400 },
  { id: '5w',     name: '5-WOOD',  loft: 18.0, speedFactor: 0.88, spin: 4000 },
  { id: '3i',     name: '3-IRON',  loft: 21.0, speedFactor: 0.83, spin: 4600 },
  { id: '5i',     name: '5-IRON',  loft: 27.0, speedFactor: 0.76, spin: 5400 },
  { id: '7i',     name: '7-IRON',  loft: 34.0, speedFactor: 0.69, spin: 7000 },
  { id: '9i',     name: '9-IRON',  loft: 42.0, speedFactor: 0.60, spin: 9000 },
  { id: 'pw',     name: 'PITCHING WEDGE', loft: 46.0, speedFactor: 0.55, spin: 9800 },
  { id: 'sw',     name: 'SAND WEDGE',     loft: 56.0, speedFactor: 0.45, spin: 11000 },
  { id: 'lw',     name: 'LOB WEDGE',      loft: 60.0, speedFactor: 0.39, spin: 11500 },
];

export function clubAt(i) {
  return CLUBS[Math.max(0, Math.min(CLUBS.length - 1, i | 0))];
}
