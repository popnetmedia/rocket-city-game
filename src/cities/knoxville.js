/**
 * Knoxville, Tennessee.
 *
 * Scaffolded by scripts/new-city.mjs. The world boots and flies from this alone.
 *
 * Every content list below is deliberately EMPTY. Do not invent coordinates to fill
 * them — source real ones the way Huntsville's were (see src/cities/huntsville.js) and
 * add them here. The menus omit whatever is missing, so an empty list costs nothing but
 * a made-up one ships an objective nobody can reach.
 */
export default {
  meta: {
    id: 'knoxville',
    name: 'Knoxville',
    region: 'Tennessee',
    regionCode: 'TN',
    tagline: 'Marble City',              // long-standing local nickname, from the quarries
    origin: false,
    character: 'sunsphere',              // the 1982 World's Fair tower
  },
  origin: { lat: 35.9606, lon: -83.9207, name: 'Downtown' },
  spawn: { look: [35.9606, -83.9207], from: [35.9566, -83.9187], alt: 210 },
  weather: { station: 'KTYS' },
  // 216 real DeFlock ALPR cameras (OSM-derived, ODbL) inside the playable lobe.
  alpr: '/alpr/knoxville.json',
  // Playable area. TODO: shape these lobes to the real city; one circle is a placeholder.
  // Permanent ad slot, top-left on desktop, replacing the wordmark when enabled.
  // Standard horizontal creative — 320x50 by default; a larger size scales to the column
  // and keeps its aspect. Drop the file in public/ads/ and point `image` at it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  border: {
    lobes: [
      { lat: 35.9606, lon: -83.9207, r: 16000 },
    ],
    nofly: [],                           // TODO: restricted airspace, if any
  },
  presets: [],                           // TODO: teleport landmarks
  pois: {
    starbucks: [], breweries: [], bowling: [], pickleball: [], hospitals: [], golfCourses: [],
  },
  races: [],                             // TODO: race routes
  tours: [],                             // TODO: guided tours
  districts: [],                         // TODO: named neighbourhoods
  scenarios: [],                         // TODO: local events
  landmarks: [],                         // TODO: curated landmark signs
  shops: [],                             // TODO: storefront cards
  interiors: [],                       // TODO: enterable rooms
  ballparks: [],                       // TODO: home run derby fields
  fieldDecals: [],                       // TODO: stadium roundels
};
