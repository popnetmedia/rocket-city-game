/**
 * Anaheim, California.
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
    id: 'anaheim',
    name: 'Anaheim',
    region: 'California',
    regionCode: 'CA',
    tagline: 'The Original',             // Disneyland, 1955 — the first one
    origin: false,
    // Every city flies something of its own. 'saturn' is Huntsville's — leaving it here
    // would hand this city the origin city's rocket. Build one in src/characters.js.
    character: 'surfboard',              // Southern California, and no one owns a surfboard
    // Google's tiles carry the parks; OSM has a real height for almost none of these
    // buildings, so extruded footprints would read as outlines. Same call as Orlando.
    osmBuildings: false,
  },
  origin: { lat: 33.8121, lon: -117.9190, name: 'Disneyland Resort' },
  spawn: { look: [33.812586, -117.919846], from: [33.80600, -117.91300], alt: 300 },
  weather: { station: 'F0058' },
  // 330 real DeFlock ALPR cameras (OSM-derived, ODbL) inside the playable lobe.
  alpr: '/alpr/anaheim.json',
  // Permanent ad slot, top-left on desktop. Set enabled + image to sell it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  // Playable area. TODO: shape these lobes to the real city; one circle is a placeholder.
  border: {
    lobes: [
      { lat: 33.8121, lon: -117.919, r: 11000 },
    ],
    nofly: [],                           // TODO: restricted airspace, if any
  },
  // Everything here is an OSM centroid — park polygons, ride geometry, stadium footprints.
  presets: [
    { name: 'Disneyland', lat: 33.812586, lon: -117.919846, spawn: [33.80900, -117.91980], alt: 240 },
    { name: 'Sleeping Beauty Castle', lat: 33.812770, lon: -117.918980, spawn: [33.80980, -117.91900], alt: 170 },
    { name: 'Matterhorn Bobsleds', lat: 33.813074, lon: -117.917822, spawn: [33.81010, -117.91780], alt: 170 },
    { name: 'Space Mountain', lat: 33.810962, lon: -117.917495, spawn: [33.80800, -117.91750], alt: 170 },
    { name: 'Big Thunder Mountain', lat: 33.812679, lon: -117.920344, spawn: [33.80970, -117.92030], alt: 170 },
    { name: 'Galaxy\u2019s Edge', lat: 33.814141, lon: -117.923054, spawn: [33.81110, -117.92300], alt: 180 },
    { name: 'California Adventure', lat: 33.807372, lon: -117.919416, spawn: [33.80430, -117.91940], alt: 230 },
    { name: 'Incredicoaster', lat: 33.804545, lon: -117.920533, spawn: [33.80150, -117.92050], alt: 170 },
    { name: 'Cars Land', lat: 33.805750, lon: -117.918935, spawn: [33.80270, -117.91890], alt: 170 },
    { name: 'Avengers Campus', lat: 33.806732, lon: -117.918026, spawn: [33.80370, -117.91800], alt: 170 },
    { name: 'Downtown Disney', lat: 33.808993, lon: -117.923710, spawn: [33.80600, -117.92370], alt: 190 },
    { name: 'Knott\u2019s Berry Farm', lat: 33.843485, lon: -117.999287, spawn: [33.84040, -117.99920], alt: 230 },
    { name: 'GhostRider', lat: 33.842982, lon: -117.999071, spawn: [33.83990, -117.99900], alt: 170 },
    { name: 'Angel Stadium', lat: 33.800141, lon: -117.882670, spawn: [33.79700, -117.88260], alt: 220 },
    { name: 'Honda Center', lat: 33.807732, lon: -117.876552, spawn: [33.80470, -117.87650], alt: 200 },
  ],
  // One lit column per park, readable across the whole 11 km lobe. Same system as Orlando.
  skyBeacons: [
    { name: 'Disneyland', lat: 33.812586, lon: -117.919846, color: '#ff8fd0', alt: 880, range: 16000 },
    { name: 'California Adventure', lat: 33.807372, lon: -117.919416, color: '#ffc857', alt: 700, range: 16000 },
    { name: 'Downtown Disney', lat: 33.808993, lon: -117.923710, color: '#c9a7ff', alt: 560, range: 12000 },
    { name: 'Knott\u2019s Berry Farm', lat: 33.843485, lon: -117.999287, color: '#8fe388', alt: 840, range: 16000 },
    { name: 'Angel Stadium', lat: 33.800141, lon: -117.882670, color: '#6fb8ff', alt: 760, range: 14000 },
    { name: 'Honda Center', lat: 33.807732, lon: -117.876552, color: '#5fe3c0', alt: 620, range: 12000 },
  ],
  pois: {
    starbucks: [], breweries: [], bowling: [], pickleball: [], hospitals: [], golfCourses: [],
    // Every OSM attraction=roller_coaster in the lobe, relations included. Split across
    // Disneyland, California Adventure and Knott's, so the run crosses all three.
    coasters: [
      { name: "Big Thunder Mountain Railroad", lat: 33.812679, lon: -117.920344 },
      { name: "Chip \u2018n\u2019 Dale\u2019s GADGETcoaster", lat: 33.815228, lon: -117.919475 },
      { name: "Coast Rider", lat: 33.845267, lon: -118.002049 },
      { name: "GhostRider", lat: 33.842982, lon: -117.999071 },
      { name: "Goofy's Sky School", lat: 33.806426, lon: -117.922853 },
      { name: "HangTime", lat: 33.844528, lon: -118.001497 },
      { name: "Incredicoaster", lat: 33.804545, lon: -117.920533 },
      { name: "Jaguar!", lat: 33.845828, lon: -117.999272 },
      { name: "Matterhorn Bobsleds", lat: 33.813074, lon: -117.917822 },
      { name: "Pony Express", lat: 33.842954, lon: -118.001273 },
      { name: "Silver Bullet", lat: 33.844661, lon: -118.000002 },
      { name: "Snoopy\u2019s Tenderpaw Twister Coaster", lat: 33.845885, lon: -117.998226 },
      { name: "Space Mountain", lat: 33.810962, lon: -117.917495 },
      { name: "Xcelerator", lat: 33.845933, lon: -118.000874 },
    ],
    // OSM tourism=hotel|resort inside the lobe, per-building duplicates collapsed.
    // `near`/`km` are computed from the park coordinates above, not asserted.
    hotels: [
      { name: "Alamo Inn & Suites", lat: 33.802849, lon: -117.925925, near: "Disney California Adventure", km: 0.8 },
      { name: "Alpine Inn", lat: 33.803828, lon: -117.917705, near: "Disney California Adventure", km: 0.4 },
      { name: "Americas Best Value - Astoria Inn & Suites", lat: 33.817738, lon: -117.91382, near: "Disneyland", km: 0.8 },
      { name: "Anaheim Carriage Inn", lat: 33.794994, lon: -117.915776, near: "Disney California Adventure", km: 1.4 },
      { name: "Anaheim Desert Inn and Suites", lat: 33.808735, lon: -117.914348, near: "Disney California Adventure", km: 0.5 },
      { name: "Anaheim Discovery Inn & Suites At The Park", lat: 33.802827, lon: -117.925313, near: "Disney California Adventure", km: 0.7 },
      { name: "Anaheim Express Inn Maingate", lat: 33.795648, lon: -117.916058, near: "Disney California Adventure", km: 1.3 },
      { name: "Anaheim Islander Inn and Suites", lat: 33.80291, lon: -117.913086, near: "Disney California Adventure", km: 0.8 },
      { name: "Anaheim Maingate Inn", lat: 33.817528, lon: -117.924574, near: "Disneyland", km: 0.7 },
      { name: "Anaheim Majestic Garden Hotel", lat: 33.819547, lon: -117.921548, near: "Disneyland", km: 0.8 },
      { name: "Anaheim Marriott", lat: 33.799045, lon: -117.918297, near: "Disney California Adventure", km: 0.9 },
      { name: "Anaheim Portofino Inn & Suites", lat: 33.802216, lon: -117.915996, near: "Disney California Adventure", km: 0.7 },
      { name: "Anaheim Resort Suites", lat: 33.804434, lon: -117.906085, near: "Disney California Adventure", km: 1.3 },
      { name: "Ayres Hotel Anaheim", lat: 33.805535, lon: -117.878043, near: "Angel Stadium", km: 0.7 },
      { name: "Best Western Courtesy Inn", lat: 33.817702, lon: -117.923583, near: "Disneyland", km: 0.7 },
      { name: "Best Western Plus", lat: 33.80244, lon: -117.924662, near: "Disney California Adventure", km: 0.7 },
      { name: "Best Western Plus Anaheim Inn", lat: 33.808295, lon: -117.914822, near: "Disney California Adventure", km: 0.4 },
      { name: "Best Western Plus Park Place Inn - Mini Suites", lat: 33.809568, lon: -117.91439, near: "Disney California Adventure", km: 0.5 },
      { name: "Best Western Plus Pavilions", lat: 33.802385, lon: -117.927688, near: "Disney California Adventure", km: 0.9 },
      { name: "Best Western Plus Raffles Inn & Suites", lat: 33.797544, lon: -117.914549, near: "Disney California Adventure", km: 1.2 },
      { name: "Budget Inn", lat: 33.817516, lon: -117.922818, near: "Disneyland", km: 0.6 },
      { name: "Camelot Inn & Suites in Anaheim", lat: 33.810588, lon: -117.914499, near: "Disneyland", km: 0.5 },
      { name: "Candlewood Suites Anaheim - Resort Area", lat: 33.805075, lon: -117.907496, near: "Disney California Adventure", km: 1.1 },
      { name: "Candy Cane Inn", lat: 33.804294, lon: -117.91647, near: "Disney California Adventure", km: 0.4 },
      { name: "Capri Suites", lat: 33.794669, lon: -117.915668, near: "Disney California Adventure", km: 1.5 },
      { name: "Castle Inn & Suites", lat: 33.804924, lon: -117.914404, near: "Disney California Adventure", km: 0.5 },
      { name: "Clarion Hotel Anaheim Resort", lat: 33.799086, lon: -117.916242, near: "Disney California Adventure", km: 1.0 },
      { name: "Clementine Hotel & Suites Anaheim", lat: 33.806135, lon: -117.908854, near: "Disney California Adventure", km: 1.0 },
      { name: "Comfort Inn Anaheim Resort", lat: 33.802767, lon: -117.904544, near: "Disney California Adventure", km: 1.5 },
      { name: "Cortona Inn and Suites Anaheim Resort", lat: 33.798289, lon: -117.916564, near: "Disney California Adventure", km: 1.0 },
      { name: "Courtyard Anaheim Resort/Convention Center", lat: 33.797536, lon: -117.916589, near: "Disney California Adventure", km: 1.1 },
      { name: "Courtyard Anaheim Theme Park Entrance", lat: 33.812186, lon: -117.91384, near: "Disneyland", km: 0.6 },
      { name: "Days Inn & Suites Anaheim at Disneyland Park", lat: 33.81897, lon: -117.915795, near: "Disneyland", km: 0.8 },
      { name: "Days Inn Anaheim West", lat: 33.817557, lon: -117.92258, near: "Disneyland", km: 0.6 },
      { name: "Del Sol Inn", lat: 33.808567, lon: -117.91382, near: "Disney California Adventure", km: 0.5 },
      { name: "Desert Palms Hotel and Suites", lat: 33.803685, lon: -117.916589, near: "Disney California Adventure", km: 0.5 },
      { name: "Disney's Grand Californian Hotel", lat: 33.807913, lon: -117.92216, near: "Disney California Adventure", km: 0.3 },
      { name: "Dolphin's Cove Resort", lat: 33.797046, lon: -117.913532, near: "Disney California Adventure", km: 1.3 },
      { name: "DoubleTree Suites Anaheim Resort/Convention Center", lat: 33.796614, lon: -117.915874, near: "Disney California Adventure", km: 1.2 },
      { name: "Eden Roc Inn & Suites", lat: 33.802287, lon: -117.92368, near: "Disney California Adventure", km: 0.7 },
      { name: "Element Anaheim Resort Convention Center", lat: 33.80884, lon: -117.909377, near: "Disney California Adventure", km: 0.9 },
      { name: "Extended Stay America", lat: 33.807322, lon: -117.872358, near: "Angel Stadium", km: 1.2 },
      { name: "Extended Stay America Orange County - Anaheim Convention Center", lat: 33.804825, lon: -117.90878, near: "Disney California Adventure", km: 1.0 },
      { name: "Fairfield Inn Anaheim Resort", lat: 33.811315, lon: -117.913899, near: "Disneyland", km: 0.6 },
      { name: "Four Points by Sheraton Anaheim", lat: 33.817458, lon: -117.91628, near: "Disneyland", km: 0.6 },
      { name: "Grand Legacy At The Park", lat: 33.807629, lon: -117.914768, near: "Disney California Adventure", km: 0.4 },
      { name: "Hampton Inn & Suites", lat: 33.792198, lon: -117.915997, near: "Disney California Adventure", km: 1.7 },
      { name: "Hilton Anaheim", lat: 33.800626, lon: -117.918718, near: "Disney California Adventure", km: 0.8 },
      { name: "Hilton Garden Inn Anaheim Resort", lat: 33.811427, lon: -117.912642, near: "Disneyland", km: 0.7 },
      { name: "Holiday Inn Express & Suites Anaheim Resort Area", lat: 33.812163, lon: -117.913016, near: "Disneyland", km: 0.6 },
      { name: "Holiday Inn Hotel and Suites", lat: 33.816597, lon: -117.927409, near: "Disneyland", km: 0.8 },
      { name: "Home2 Suites", lat: 33.811523, lon: -117.912818, near: "Disneyland", km: 0.7 },
      { name: "Homewood Suites Anaheim Resort/Convention Center", lat: 33.798352, lon: -117.914092, near: "Disney California Adventure", km: 1.1 },
      { name: "Hotel", lat: 33.817752, lon: -117.913447, near: "Disneyland", km: 0.8 },
      { name: "Hotel Indigo Anaheim", lat: 33.803831, lon: -117.913617, near: "Disney California Adventure", km: 0.7 },
      { name: "Hotel Lulu, BW Premier Collection", lat: 33.80187, lon: -117.914643, near: "Disney California Adventure", km: 0.8 },
      { name: "Howard Johnson Anaheim Hotel & Water Playground", lat: 33.812958, lon: -117.914134, near: "Disneyland", km: 0.5 },
      { name: "Hyatt House at Anaheim Resort/Convention Center", lat: 33.80283, lon: -117.914253, near: "Disney California Adventure", km: 0.7 },
      { name: "Hyatt Place at Anaheim Resort/Convention Center", lat: 33.798133, lon: -117.915847, near: "Disney California Adventure", km: 1.1 },
      { name: "JW Marriott, Anaheim Resort", lat: 33.804492, lon: -117.910625, near: "Disney California Adventure", km: 0.9 },
      { name: "Kings Inn Anaheim", lat: 33.804147, lon: -117.912921, near: "Disney California Adventure", km: 0.7 },
      { name: "Knott's Hotel", lat: 33.840348, lon: -117.99882, near: "Knott's Berry Farm", km: 0.4 },
      { name: "La Quinta Inn & Suites Anaheim", lat: 33.804468, lon: -117.909498, near: "Disney California Adventure", km: 1.0 },
      { name: "Magnolia Tree Hotel", lat: 33.793482, lon: -117.914477, near: "Disney California Adventure", km: 1.6 },
      { name: "Marriot TownePlace Suites", lat: 33.804829, lon: -117.88856, near: "Angel Stadium", km: 0.8 },
      { name: "Park Vue Inn", lat: 33.809031, lon: -117.914092, near: "Disney California Adventure", km: 0.5 },
      { name: "Peacock Suites", lat: 33.804633, lon: -117.907117, near: "Disney California Adventure", km: 1.2 },
      { name: "Pixar Place Hotel", lat: 33.806236, lon: -117.924501, near: "Disney California Adventure", km: 0.5 },
      { name: "Quality Inn & Suites Anaheim At The Park", lat: 33.802735, lon: -117.926538, near: "Disney California Adventure", km: 0.8 },
      { name: "Radisson", lat: 33.849965, lon: -117.996992, near: "Knott's Berry Farm", km: 0.8 },
      { name: "Ramada Anaheim Convention Center", lat: 33.796848, lon: -117.914573, near: "Disney California Adventure", km: 1.3 },
      { name: "Ramada, Anaheim Maingate North", lat: 33.82092, lon: -117.916047, near: "Disneyland", km: 1.0 },
      { name: "Residence Inn at Anaheim Resort/Convention Center", lat: 33.802716, lon: -117.917081, near: "Disney California Adventure", km: 0.6 },
      { name: "Sheraton Park Hotel at the Anaheim Resort", lat: 33.801162, lon: -117.916158, near: "Disney California Adventure", km: 0.8 },
      { name: "Signature", lat: 33.792732, lon: -117.914385, near: "Disney California Adventure", km: 1.7 },
      { name: "Sonesta ES Suites Anaheim", lat: 33.800926, lon: -117.90152, near: "Angel Stadium", km: 1.7 },
      { name: "SpringHill Suites", lat: 33.817498, lon: -117.926815, near: "Disneyland", km: 0.8 },
      { name: "SpringHill Suites at Anaheim Resort/Convention Center", lat: 33.802967, lon: -117.916221, near: "Disney California Adventure", km: 0.6 },
      { name: "Stanford Inn & Suites", lat: 33.793791, lon: -117.915634, near: "Disney California Adventure", km: 1.6 },
      { name: "Staybridge Suites Anaheim At The Park", lat: 33.817502, lon: -117.923377, near: "Disneyland", km: 0.6 },
      { name: "SunCoast Park Hotel Anaheim, CA", lat: 33.807662, lon: -117.908883, near: "Disney California Adventure", km: 1.0 },
      { name: "The Anaheim Hotel", lat: 33.806296, lon: -117.914508, near: "Disney California Adventure", km: 0.5 },
      { name: "The Disneyland Hotel", lat: 33.8085, lon: -117.927032, near: "Disney California Adventure", km: 0.7 },
      { name: "The Villas at Disney's Grand Californian Hotel", lat: 33.806916, lon: -117.922721, near: "Disney California Adventure", km: 0.3 },
      { name: "The Viv Hotel, Anaheim, a Tribute Portfolio Hotel", lat: 33.808601, lon: -117.906606, near: "Disney California Adventure", km: 1.2 },
      { name: "The Westin Anaheim Resort", lat: 33.80262, lon: -117.92288, near: "Disney California Adventure", km: 0.6 },
      { name: "Travelodge Anaheim Inn & Suite on Disneyland Drive", lat: 33.818721, lon: -117.923113, near: "Disneyland", km: 0.7 },
      { name: "Tropicana Inn & Suites in Anaheim", lat: 33.810001, lon: -117.914384, near: "Disney California Adventure", km: 0.5 },
      { name: "WorldMark Anaheim", lat: 33.803797, lon: -117.90855, near: "Disney California Adventure", km: 1.1 },
      { name: "WorldMark Dolphin's Cove", lat: 33.796361, lon: -117.91356, near: "Disney California Adventure", km: 1.3 },
      { name: "Wyndham Garden Anaheim", lat: 33.803755, lon: -117.914163, near: "Disney California Adventure", km: 0.6 },
    ],
  },
  races: [
    // Disneyland's five headline rides, in a loop around the berm.
    {
      id: 'e-ticket-loop', name: 'E-TICKET LOOP', color: '#4fd8ff', sponsor: null,
      points: [
        [33.812770, -117.918980], [33.813074, -117.917822], [33.810962, -117.917495],
        [33.812679, -117.920344], [33.814141, -117.923054], [33.812770, -117.918980],
      ],
    },
    // Resort to Knott's and back down to the stadiums — the whole lobe, corner to corner.
    {
      id: 'orange-county-run', name: 'ORANGE COUNTY RUN', color: '#ffe066', sponsor: null,
      points: [
        [33.812586, -117.919846], [33.843485, -117.999287],
        [33.800141, -117.882670], [33.807732, -117.876552],
      ],
    },
  ],
  tours: [],                             // TODO: guided tours
  // The parks' own lands, from OSM place=locality — flying into one announces it.
  districts: [
    { name: "Adventureland", lat: 33.810965, lon: -117.920282, r: 150 },
    { name: "Avengers Campus", lat: 33.806732, lon: -117.918026, r: 150 },
    { name: "Bayou Country", lat: 33.812348, lon: -117.922729, r: 150 },
    { name: "Boardwalk", lat: 33.84474, lon: -118.001507, r: 150 },
    { name: "Buena Vista Street", lat: 33.808115, lon: -117.919037, r: 150 },
    { name: "Camp Snoopy", lat: 33.845317, lon: -117.998851, r: 150 },
    { name: "Cars Land", lat: 33.80575, lon: -117.918935, r: 150 },
    { name: "Catalina", lat: 33.81052, lon: -117.919976, r: 150 },
    { name: "Downtown Disney", lat: 33.808993, lon: -117.92371, r: 150 },
    { name: "Fantasyland", lat: 33.813512, lon: -117.918517, r: 150 },
    { name: "Fiesta Village", lat: 33.845848, lon: -117.999465, r: 150 },
    { name: "Fort Wilderness", lat: 33.81296, lon: -117.922053, r: 150 },
    { name: "Frontierland", lat: 33.81261, lon: -117.920683, r: 150 },
    { name: "Ghost Town", lat: 33.843451, lon: -117.999832, r: 150 },
    { name: "Grizzly Peak Airfield", lat: 33.80769, lon: -117.920474, r: 150 },
    { name: "Hollywood Land", lat: 33.807788, lon: -117.917472, r: 150 },
    { name: "Le Court de Anges", lat: 33.810943, lon: -117.921474, r: 150 },
    { name: "Main Street U.S.A.", lat: 33.811314, lon: -117.918975, r: 150 },
    { name: "Manhattan", lat: 33.811028, lon: -117.920053, r: 150 },
    { name: "Mickey and Friends Parking Structures", lat: 33.815063, lon: -117.924794, r: 150 },
    { name: "Mickey's Toontown", lat: 33.815209, lon: -117.918768, r: 150 },
    { name: "New Orleans Square", lat: 33.811433, lon: -117.921531, r: 150 },
    { name: "Paradise Gardens Park", lat: 33.806045, lon: -117.922047, r: 150 },
    { name: "Paradise Pier", lat: 33.80577, lon: -117.921729, r: 150 },
    { name: "Performance Corridor", lat: 33.806636, lon: -117.919801, r: 150 },
    { name: "Pixar Pier", lat: 33.805014, lon: -117.921371, r: 150 },
    { name: "Princesses Fantasy Faire", lat: 33.81252, lon: -117.919401, r: 150 },
    { name: "Rainbow Ridge", lat: 33.812818, lon: -117.920084, r: 150 },
    { name: "San Fransokyo Square", lat: 33.805793, lon: -117.920063, r: 150 },
    { name: "Star Wars: Galaxy\u2019s Edge", lat: 33.814238, lon: -117.921718, r: 150 },
    { name: "Storybook Land", lat: 33.813786, lon: -117.918771, r: 150 },
    { name: "The Enchanted Tiki Garden", lat: 33.81177, lon: -117.919558, r: 150 },
    { name: "Tom Sawyer's Island", lat: 33.812697, lon: -117.921618, r: 150 },
    { name: "Tomorrowland", lat: 33.812568, lon: -117.917388, r: 150 },
    { name: "Tour Gardens", lat: 33.810031, lon: -117.919459, r: 150 },
  ],
  scenarios: [],                         // TODO: local events
  landmarks: [],                         // TODO: curated landmark signs
  shops: [],                             // TODO: storefront cards
  interiors: [],                       // TODO: enterable rooms
  ballparks: [],                       // TODO: home run derby fields
  fieldDecals: [],                       // TODO: stadium roundels
};
