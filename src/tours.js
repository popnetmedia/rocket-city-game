import { activeCity } from './cities/index.js';


/** Named guided tours belong to the active city. */
export function cityTours() { return activeCity().tours || []; }

export function golfTour() { return { id: 'golf', name: 'GOLF COURSES', stops: activeCity().pois.golfCourses.map((g) => [g.name, g.lat, g.lon]) }; }
export function starbucksTour() { return { id: 'starbucks', name: '☕ STARBUCKS RUN', stops: activeCity().pois.starbucks.map((s) => [s.name, s.lat, s.lon]) }; }
export function landmarksStops() { return activeCity().presets.map((p) => [p.name, p.lat, p.lon]); }
