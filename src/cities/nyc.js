/**
 * New York City, New York.
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
    id: 'nyc',
    name: 'New York City',
    region: 'New York',
    regionCode: 'NY',
    tagline: 'Manhattan and Queens',     // the two boroughs inside the border
    origin: false,
    // The torch is the thruster: see buildLiberty in src/characters.js.
    character: 'liberty',
  },
  origin: { lat: 40.7549, lon: -73.984, name: 'Midtown Manhattan' },
  // 1200 m against the 320 m default. One World Trade is 541 m to the spire and the
  // Midtown supertalls sit in the 430-470 m band, so the default ceiling was BELOW the
  // skyline -- there was no altitude from which Manhattan could be flown over. 700 was
  // the first attempt and only cleared One WTC by 160 m, which is enough to pass over a
  // building and not enough to look at a skyline. 1200 is roughly 4,000 ft.
  //
  // This costs tile requests -- the cap is a streaming budget and Google bills per
  // request -- which is exactly why it is per city rather than raised for everyone.
  flyCeiling: 1200,
  // Arriving at 210 m in Midtown puts you in a canyon looking at walls. 520 opens on
  // the skyline instead, still under the ceiling.
  spawn: { look: [40.7549, -73.984], from: [40.7509, -73.9820], alt: 520 },
  weather: { station: 'KNYC' },
  // 1548 real DeFlock ALPR cameras (OSM-derived, ODbL) inside the playable lobe.
  alpr: '/alpr/nyc.json',
  // Permanent ad slot, top-left on desktop. Set enabled + image to sell it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  // Playable area. TODO: shape these lobes to the real city; one circle is a placeholder.
  // Two lobes, not one 25 km circle from Midtown, which would have reached well
  // into New Jersey. The lobes overlap (centres 15.3 km apart, radii 11 + 13), so
  // Manhattan and Queens are one contiguous playable area rather than two islands
  // with a dead river between them.
  //
  // Circles cannot cleanly trace two boroughs. Downtown Brooklyn is 1.5 km across
  // the East River and the South Bronx is across the Harlem, so both fall inside
  // any lobe that covers the whole of Manhattan, and both are in bounds. Checked
  // rather than claimed: Times Square, Battery Park, Inwood, Long Island City,
  // Flushing, JFK and Douglaston are all inside; Newark and Staten Island are out.
  border: {
    lobes: [
      { lat: 40.7880, lon: -73.9680, r: 11000 },   // Manhattan, Battery to Inwood
      { lat: 40.7100, lon: -73.8200, r: 13000 },   // Queens, LIC out to Douglaston and JFK
      // Upper New York Bay. Liberty Island fell 1.8 km outside the Manhattan lobe, so
      // the city's own flyer was somewhere you could not go. Overlaps Manhattan
      // (12.8 km between centres, 11 + 4 radii) so the harbour stays contiguous.
      { lat: 40.6892, lon: -74.0444, r: 4000 },    // Liberty and Ellis Islands
    ],
    nofly: [],                           // TODO: restricted airspace, if any
  },
  /**
   * Video screens standing in the world. See src/videoscreen.js: these are real
   * YouTube iframes placed by CSS3DRenderer, not textures -- a cross-origin embed
   * cannot be read into WebGL.
   *
   * Position and facing were read in game, standing in front of the board, rather
   * than derived. The screen sits about 43 m north of the stadium centroid and
   * looks south down the field, which is why `facing` is 180.
   */
  videoScreens: [
    {
      id: 'metlife-stage',
      name: 'MetLife Stadium',
      lat: 40.81392, lon: -74.07446,
      facing: 180,        // compass bearing the screen looks along; 180 = south
      agl: 20,            // metres from the ground to the middle of the board
      w: 28,              // metres wide; height follows from 16:9
      range: 900,         // how close before it wakes up and loads
      youtube: 'dQw4w9WgXcQ',
    },
  ],
  // Every coordinate from Wikipedia via the MediaWiki API; none estimated.
  presets: [
    { name: 'Statue of Liberty', lat: 40.68917, lon: -74.04444, spawn: [40.68333, -74.04444], alt: 420 },
    { name: 'Ellis Island', lat: 40.6995, lon: -74.0397, spawn: [40.69366, -74.0397], alt: 380 },
    { name: 'One World Trade Center', lat: 40.71306, lon: -74.01333, spawn: [40.70722, -74.01333], alt: 700 },
    { name: 'Brooklyn Bridge', lat: 40.7057, lon: -73.9964, spawn: [40.69986, -73.9964], alt: 380 },
    { name: 'Empire State Building', lat: 40.7483, lon: -73.9856, spawn: [40.74246, -73.9856], alt: 700 },
    { name: 'Times Square', lat: 40.7575, lon: -73.9858, spawn: [40.75166, -73.9858], alt: 480 },
    { name: 'Grand Central Terminal', lat: 40.7528, lon: -73.9772, spawn: [40.74696, -73.9772], alt: 420 },
    { name: 'Rockefeller Center', lat: 40.75861, lon: -73.97917, spawn: [40.75277, -73.97917], alt: 520 },
    { name: 'Central Park', lat: 40.78222, lon: -73.96528, spawn: [40.77638, -73.96528], alt: 600 },
    { name: 'Yankee Stadium', lat: 40.82917, lon: -73.92639, spawn: [40.82333, -73.92639], alt: 420 },
    { name: 'MetLife Stadium', lat: 40.81353, lon: -74.07436, spawn: [40.80769, -74.07436], alt: 420 },
    { name: 'Citi Field', lat: 40.75694, lon: -73.84583, spawn: [40.75110, -73.84583], alt: 400 },
    { name: 'Arthur Ashe Stadium', lat: 40.74989, lon: -73.84703, spawn: [40.74405, -73.84703], alt: 400 },
    { name: 'Flushing Meadows', lat: 40.74583, lon: -73.84472, spawn: [40.73999, -73.84472], alt: 450 },
  ],
  pois: {
    starbucks: [], breweries: [], bowling: [], pickleball: [], hospitals: [], golfCourses: [],
  },
  races: [],                             // TODO: race routes
  tours: [],                             // TODO: guided tours
  districts: [],                         // TODO: named neighbourhoods
  scenarios: [],                         // TODO: local events
  landmarks: [],                         // TODO: curated landmark signs
  shops: [],                             // TODO: storefront cards
  interiors: [],                         // TODO: enterable rooms
  ballparks: [],                         // TODO: home run derby fields
  fieldDecals: [],                       // TODO: stadium roundels
};
