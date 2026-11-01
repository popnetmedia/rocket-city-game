/**
 * Miami, Florida.
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
    id: 'miami',
    name: 'Miami',
    region: 'Florida',
    regionCode: 'FL',
    // Names the areas the border actually covers, which the generated default cannot know.
    seo: {
      description: 'Fly a rocket over photoreal 3D Miami, Fort Lauderdale and Sunrise in your browser. Free, no install.',
      ogDescription: 'Fly a rocket over photoreal 3D Miami, Fort Lauderdale and Sunrise in your browser. Free, no install.',
      twitterDescription: 'Fly a rocket over photoreal 3D Miami, Fort Lauderdale and Sunrise in your browser. Free, no install.',
    },
    tagline: 'Magic City',
    origin: false,
    // Every city flies something of its own. 'saturn' is Huntsville's — leaving it here
    // would hand this city the origin city's rocket. Build one in src/characters.js.
    character: 'flamingo',
  },
  origin: { lat: 25.95, lon: -80.21, name: 'Downtown' },
  spawn: { look: [25.7617, -80.1918], from: [25.75, -80.185], alt: 300 },  // under the 320 m ceiling; above it the arrival is clamped
  weather: { station: 'KHWO' },
  // 1388 real DeFlock ALPR cameras (OSM-derived, ODbL) inside the playable lobe.
  alpr: '/alpr/miami.json',
  // Permanent ad slot, top-left on desktop. Set enabled + image to sell it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  // South Florida is a corridor, not a circle: Miami and the Beach, Fort Lauderdale, and
  // west to Sunrise. Three lobes rather than one huge one, so the water between them is
  // not playable airspace.
  border: {
    lobes: [
      { lat: 25.7743, lon: -80.1937, r: 15000 },   // Miami / Brickell / Miami Beach
      { lat: 26.1224, lon: -80.1373, r: 13000 },   // Fort Lauderdale
      { lat: 26.1500, lon: -80.3000, r: 10000 },   // Sunrise / Plantation
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
