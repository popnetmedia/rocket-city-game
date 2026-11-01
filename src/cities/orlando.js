/**
 * Orlando, Florida.
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
    id: 'orlando',
    name: 'Orlando',
    region: 'Florida',
    regionCode: 'FL',
    // Names the areas the border actually covers, which the generated default cannot know.
    seo: {
      description: 'Fly the Orlando attractions corridor in photoreal 3D - Walt Disney World, Universal, Volcano Bay and SeaWorld. Free in your browser, no install.',
      ogDescription: 'Fly Walt Disney World, Universal, Volcano Bay and SeaWorld in photoreal 3D. Free in your browser.',
      twitterDescription: 'Fly Walt Disney World, Universal, Volcano Bay and SeaWorld in photoreal 3D. Free in your browser.',
    },
    tagline: 'Theme Park Capital',
    origin: false,
    // Every city flies something of its own. 'saturn' is Huntsville's — leaving it here
    // would hand this city the origin city's rocket. Build one in src/characters.js.
    character: 'broomstick',
    // Google's photogrammetry already carries the parks in full detail, and OSM has a
    // real height for under 5% of Orlando's buildings — so extruded footprints here are
    // low outlines on the ground rather than a skyline. Roads, labels and trees stay.
    // B still toggles the whole city-detail layer at runtime.
    osmBuildings: false,
  },
  origin: { lat: 28.4300, lon: -81.5150, name: 'Attractions Corridor' },
  // Opens over Universal rather than downtown: it is the densest, best-covered part of
  // the corridor, and it sets the tone for what this city actually is.
  spawn: { look: [28.475728, -81.468563], from: [28.46700, -81.46200], alt: 300 },  // under the 320 m ceiling; above it the arrival is clamped
  weather: { station: 'KMCO' },
  // 854 real DeFlock ALPR cameras (OSM-derived, ODbL) inside the playable lobe.
  alpr: '/alpr/orlando.json',
  // Permanent ad slot, top-left on desktop. Set enabled + image to sell it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  // Two lobes, both entertainment: the Universal / I-Drive / SeaWorld corridor and the
  // Walt Disney World resort. Downtown Orlando is deliberately NOT included — this city
  // is the attractions area, which is what people mean when they say they're going to
  // Orlando. Keeping downtown in would have padded the map with places nobody flies to.
  border: {
    lobes: [
      { lat: 28.4450, lon: -81.4650, r: 9000 },    // Universal, Volcano Bay, I-Drive, SeaWorld
      { lat: 28.3900, lon: -81.5600, r: 15000 },   // Walt Disney World: four parks + Disney Springs
    ],
    nofly: [],                           // TODO: restricted airspace, if any
  },
  // Quick-jump destinations, every coordinate from OpenStreetMap. Attractions only —
  // the downtown landmarks went out with the downtown lobe.
  presets: [
    { name: 'Magic Kingdom', lat: 28.419524, lon: -81.581175, spawn: [28.41500, -81.58100], alt: 240 },
    { name: 'Space Mountain', lat: 28.419171, lon: -81.577227, spawn: [28.41650, -81.57700], alt: 180 },
    { name: 'EPCOT', lat: 28.375271, lon: -81.549392, spawn: [28.37150, -81.54900], alt: 240 },
    { name: 'Hollywood Studios', lat: 28.357608, lon: -81.559195, spawn: [28.35400, -81.55900], alt: 240 },
    { name: 'Tower of Terror', lat: 28.360020, lon: -81.559910, spawn: [28.35750, -81.55980], alt: 170 },
    { name: 'Animal Kingdom', lat: 28.357924, lon: -81.590615, spawn: [28.35450, -81.59050], alt: 240 },
    { name: 'Expedition Everest', lat: 28.358620, lon: -81.587244, spawn: [28.35560, -81.58720], alt: 180 },
    { name: 'Disney Springs', lat: 28.370597, lon: -81.517687, spawn: [28.36740, -81.51760], alt: 200 },
    { name: 'Universal Studios', lat: 28.475728, lon: -81.468563, spawn: [28.47250, -81.46850], alt: 220 },
    { name: 'Islands of Adventure', lat: 28.471876, lon: -81.469706, spawn: [28.46880, -81.46970], alt: 200 },
    { name: 'Hogsmeade', lat: 28.474056, lon: -81.472674, spawn: [28.47120, -81.47260], alt: 170 },
    { name: 'CityWalk', lat: 28.473661, lon: -81.466638, spawn: [28.47060, -81.46660], alt: 170 },
    { name: 'Epic Universe', lat: 28.442516, lon: -81.448433, spawn: [28.43950, -81.44840], alt: 230 },
    { name: 'Volcano Bay', lat: 28.461814, lon: -81.472943, spawn: [28.45880, -81.47280], alt: 190 },
    { name: 'SeaWorld', lat: 28.411159, lon: -81.462361, spawn: [28.40800, -81.46230], alt: 210 },
    { name: 'Aquatica', lat: 28.415434, lon: -81.456531, spawn: [28.41240, -81.45640], alt: 180 },
  ],
  // Sky beacons: the resort is 15 km across and the tile imagery gives you no way to
  // tell one park from another at altitude. Each park gets an oversized sign at a
  // shared ceiling with a light column to the ground, lit from far out and faded once
  // you arrive. Coordinates are the same OSM park centroids the presets teleport to.
  // Universal and Islands of Adventure sit 450 m apart, so their beacons are staggered
  // in altitude — at distance they would otherwise print on top of each other.
  skyBeacons: [
    { name: 'Magic Kingdom', lat: 28.419524, lon: -81.581175, color: '#ff8fd0', alt: 900, range: 22000 },
    { name: 'EPCOT', lat: 28.375271, lon: -81.549392, color: '#7fe7ff', alt: 860, range: 22000 },
    { name: 'Hollywood Studios', lat: 28.357608, lon: -81.559195, color: '#ffc857', alt: 860, range: 22000 },
    { name: 'Animal Kingdom', lat: 28.357924, lon: -81.590615, color: '#8fe388', alt: 880, range: 22000 },
    { name: 'Universal Studios', lat: 28.475728, lon: -81.468563, color: '#ff9e4f', alt: 900, range: 22000 },
    { name: 'Islands of Adventure', lat: 28.471876, lon: -81.469706, color: '#5fe3c0', alt: 700, range: 18000 },
    { name: 'Epic Universe', lat: 28.442516, lon: -81.448433, color: '#c77dff', alt: 840, range: 20000 },
    { name: 'Volcano Bay', lat: 28.461814, lon: -81.472943, color: '#ff6b5f', alt: 780, range: 15000 },
    { name: 'SeaWorld', lat: 28.411159, lon: -81.462361, color: '#6fb8ff', alt: 820, range: 18000 },
    { name: 'Disney Springs', lat: 28.370597, lon: -81.517687, color: '#c9a7ff', alt: 760, range: 15000 },
  ],
  pois: {
    starbucks: [], breweries: [], bowling: [], pickleball: [], hospitals: [], golfCourses: [],
    // Every coaster OSM tags attraction=roller_coaster inside the two lobes, plus Expedition
    // Everest (tagged on its show building, so the generic pass misses it). Spread across four
    // parks on purpose: the run cannot be completed without leaving the park you start in.
    coasters: [
      // Every OSM attraction=roller_coaster inside the two lobes, INCLUDING relations.
      // The first pass only read ways and nodes, so it missed 10 of these — VelociCoaster,
      // Everest's real geometry and all of Epic Universe are multipolygon relations.
      // "White Lightning" appears twice at Fun Spot under near-identical names 125 m apart;
      // the richer geometry wins and the duplicate is dropped.
      { name: 'Space Mountain', lat: 28.419171, lon: -81.577227 },
      { name: 'TRON Lightcycle / Run', lat: 28.420385, lon: -81.576734 },
      { name: 'Big Thunder Mountain Railroad', lat: 28.420264, lon: -81.584672 },
      { name: 'Seven Dwarfs Mine Train', lat: 28.420596, lon: -81.580059 },
      { name: 'The Barnstormer', lat: 28.420585, lon: -81.578452 },
      { name: 'Guardians of the Galaxy: Cosmic Rewind', lat: 28.375116, lon: -81.547611 },
      { name: 'Rock \u2019n\u2019 Roller Coaster', lat: 28.359520, lon: -81.561113 },
      { name: 'Slinky Dog Dash', lat: 28.356408, lon: -81.563118 },
      { name: 'Expedition Everest', lat: 28.358620, lon: -81.587244 },
      { name: 'The Incredible Hulk Coaster', lat: 28.471502, lon: -81.468776 },
      { name: 'Jurassic World VelociCoaster', lat: 28.471248, lon: -81.472419 },
      { name: 'Hagrid\u2019s Magical Creatures Motorbike Adventure', lat: 28.473436, lon: -81.473509 },
      { name: 'Flight of the Hippogriff', lat: 28.472478, lon: -81.473784 },
      { name: 'Stardust Racers', lat: 28.441496, lon: -81.446613 },
      { name: 'Mine-Cart Madness', lat: 28.438043, lon: -81.448730 },
      { name: 'Hiccup\u2019s Wing Gliders', lat: 28.441255, lon: -81.444527 },
      { name: 'Curse of the Werewolf', lat: 28.439698, lon: -81.449683 },
      { name: 'Mario Kart: Bowser\u2019s Challenge', lat: 28.438247, lon: -81.447904 },
      { name: 'White Lightning', lat: 28.465685, lon: -81.456255 },
      { name: 'Freedom Flyer', lat: 28.466168, lon: -81.455973 },
      { name: "Super Grover's Box Car Derby", lat: 28.407070, lon: -81.463104 },
    ],
    // Hotels, OSM tourism=hotel|resort inside the two lobes. OSM splits some resorts
    // across per-building objects; those are collapsed to one entry per property.
    // `near`/`km` are computed from the park coordinates above, not asserted.
    // Shown as hotel points of interest (src/shops.js).
    hotels: [
    { name: "AC Hotel by Marriott Orlando Lake Buena Vista", lat: 28.380012, lon: -81.503841, near: "Disney Springs", km: 1.6 },
    { name: "Aloft Orlando Lake Buena Vista", lat: 28.392885, lon: -81.494937, near: "Disney Springs", km: 3.2 },
    { name: "Animal Kingdom Lodge", lat: 28.352739, lon: -81.602585, near: "Animal Kingdom", km: 1.2 },
    { name: "Avanti Palms Resort and Conference Center", lat: 28.458747, lon: -81.470877, near: "Volcano Bay", km: 0.4 },
    { name: "Baymont", lat: 28.452654, lon: -81.467405, near: "Volcano Bay", km: 1.1 },
    { name: "Best Western International Drive - Orlando", lat: 28.447456, lon: -81.471806, near: "Volcano Bay", km: 1.6 },
    { name: "Best Western Orlando Gateway Hotel", lat: 28.45796, lon: -81.46344, near: "Volcano Bay", km: 1.0 },
    { name: "Best Western Plus Orlando Convention Center Hotel", lat: 28.419302, lon: -81.464445, near: "SeaWorld", km: 0.9 },
    { name: "Bluegreen Fountains Resort", lat: 28.389621, lon: -81.478824, near: "SeaWorld", km: 2.8 },
    { name: "Bluegreen Vacations Fountains, Ascend Resort Collection", lat: 28.387935, lon: -81.479338, near: "SeaWorld", km: 3.0 },
    { name: "Candlewood Suites Orlando - Lake Buena Vista", lat: 28.386637, lon: -81.508812, near: "Disney Springs", km: 2.0 },
    { name: "Castle Hotel, Autograph Collection", lat: 28.440216, lon: -81.469202, near: "Volcano Bay", km: 2.4 },
    { name: "Clarion Inn International Drive", lat: 28.442722, lon: -81.472295, near: "Volcano Bay", km: 2.1 },
    { name: "Coco Key Hotel and Water Park Resort", lat: 28.454482, lon: -81.47225, near: "Volcano Bay", km: 0.8 },
    { name: "Comfort Inn & Suites Universal-Convention Center", lat: 28.453292, lon: -81.467684, near: "Volcano Bay", km: 1.1 },
    { name: "Comfort Inn International", lat: 28.447938, lon: -81.472992, near: "Volcano Bay", km: 1.5 },
    { name: "Comfort Suites Orlando Lake Buena Vista", lat: 28.392661, lon: -81.498593, near: "Disney Springs", km: 3.0 },
    { name: "Courtyard Orlando International Drive/Convention Center", lat: 28.441357, lon: -81.473201, near: "Volcano Bay", km: 2.3 },
    { name: "Courtyard Orlando Lake Buena Vista at Vista Centre", lat: 28.386959, lon: -81.502117, near: "Disney Springs", km: 2.3 },
    { name: "Courtyard Orlando Lake Buena Vista in the Marriott Village", lat: 28.376679, lon: -81.501663, near: "Disney Springs", km: 1.6 },
    { name: "Crowne Plaza Orlando - Lake Buena Vista", lat: 28.384676, lon: -81.502766, near: "Disney Springs", km: 2.1 },
    { name: "Cypress Pointe Resort", lat: 28.390553, lon: -81.503127, near: "Disney Springs", km: 2.6 },
    { name: "DASKK Orlando Hotel near Universal Blvd, Ascend Hotel Collection", lat: 28.454251, lon: -81.469122, near: "Volcano Bay", km: 0.9 },
    { name: "Days Inn Orlando Convention Center/International Drive", lat: 28.422344, lon: -81.461237, near: "SeaWorld", km: 1.2 },
    { name: "Delta Hotels by Marriott Orlando Lake Buena Vista", lat: 28.384266, lon: -81.506717, near: "Disney Springs", km: 1.8 },
    { name: "Disney's All-Star Movies Resort", lat: 28.335997, lon: -81.57219, near: "Hollywood Studios", km: 2.7 },
    { name: "Disney's All-Star Music Resort", lat: 28.339684, lon: -81.572798, near: "Hollywood Studios", km: 2.4 },
    { name: "Disney's All-Star Sports Resort", lat: 28.343699, lon: -81.575301, near: "Animal Kingdom", km: 2.1 },
    { name: "Disney's Art of Animation Resort", lat: 28.35122, lon: -81.546953, near: "Hollywood Studios", km: 1.3 },
    { name: "Disney's Beach Club Resort", lat: 28.371006, lon: -81.556151, near: "EPCOT", km: 0.8 },
    { name: "Disney's Beach Club Villas", lat: 28.371815, lon: -81.555299, near: "EPCOT", km: 0.7 },
    { name: "Disney's BoardWalk Inn", lat: 28.367206, lon: -81.555294, near: "EPCOT", km: 1.0 },
    { name: "Disney's BoardWalk Villas", lat: 28.366368, lon: -81.556995, near: "Hollywood Studios", km: 1.0 },
    { name: "Disney's Caribbean Beach Resort", lat: 28.361296, lon: -81.544085, near: "Hollywood Studios", km: 1.4 },
    { name: "Disney's Coronado Springs Resort", lat: 28.362818, lon: -81.5729, near: "Hollywood Studios", km: 1.4 },
    { name: "Disney's Old Key West Resort", lat: 28.373319, lon: -81.533581, near: "EPCOT", km: 1.5 },
    { name: "Disney's Pop Century Resort", lat: 28.351417, lon: -81.544851, near: "Hollywood Studios", km: 1.5 },
    { name: "Disney's Riviera Resort", lat: 28.365775, lon: -81.542298, near: "EPCOT", km: 1.2 },
    { name: "Disney's Saratoga Springs Resort & Spa", lat: 28.377163, lon: -81.523934, near: "Disney Springs", km: 0.9 },
    { name: "Disney's Wilderness Lodge", lat: 28.409403, lon: -81.572507, near: "Magic Kingdom", km: 1.4 },
    { name: "Disney's Yacht Club Resort", lat: 28.370291, lon: -81.558739, near: "EPCOT", km: 1.0 },
    { name: "DoubleTree Suites by Hilton Hotel Orlando - Lake Buena Vista", lat: 28.379102, lon: -81.506138, near: "Disney Springs", km: 1.4 },
    { name: "DoubleTree by Hilton Orlando Theme Park Resort", lat: 28.41777, lon: -81.462751, near: "SeaWorld", km: 0.7 },
    { name: "Drury Inn & Suites", lat: 28.451273, lon: -81.47713, near: "Volcano Bay", km: 1.2 },
    { name: "Drury Plaza Hotel Orlando \u2013 Disney Springs Area", lat: 28.378494, lon: -81.508762, near: "Disney Springs", km: 1.2 },
    { name: "Element Orlando International Drive", lat: 28.405623, lon: -81.454386, near: "SeaWorld", km: 1.0 },
    { name: "Element Orlando Universal Blvd.", lat: 28.444865, lon: -81.467451, near: "Volcano Bay", km: 2.0 },
    { name: "Embassy Suites by Hilton Orlando - International Drive / Convention Center", lat: 28.438211, lon: -81.473017, near: "Volcano Bay", km: 2.6 },
    { name: "Embassy Suites by Hilton Orlando International Drive ICON Park", lat: 28.44712, lon: -81.473197, near: "Volcano Bay", km: 1.6 },
    { name: "Embassy Suites by Hilton Orlando Lake Buena Vista Resort", lat: 28.390642, lon: -81.494525, near: "Disney Springs", km: 3.1 },
    { name: "Extended Stay America - Orlando - Convention Center - Universal Blvd", lat: 28.439074, lon: -81.469026, near: "Volcano Bay", km: 2.6 },
    { name: "Extended Stay America - Orlando - Lake Buena Vista", lat: 28.390867, lon: -81.49612, near: "Disney Springs", km: 3.0 },
    { name: "Fairfield Inn & Suites", lat: 28.445457, lon: -81.467305, near: "Volcano Bay", km: 1.9 },
    { name: "Fairfield Inn & Suites Orlando Lake Buena Vista", lat: 28.387786, lon: -81.504936, near: "Disney Springs", km: 2.2 },
    { name: "Fairfield Inn & Suites Orlando Lake Buena Vista in the Marriott Village", lat: 28.376785, lon: -81.502792, near: "Disney Springs", km: 1.5 },
    { name: "Fairfield Inn & Suites Orlando at SeaWorld\u00ae", lat: 28.407989, lon: -81.454438, near: "SeaWorld", km: 0.8 },
    { name: "Floridays Orlando Resort", lat: 28.389104, lon: -81.481962, near: "SeaWorld", km: 3.0 },
    { name: "Four Points by Sheraton Orlando Convention Center", lat: 28.419618, lon: -81.465677, near: "SeaWorld", km: 1.0 },
    { name: "Four Points by Sheraton Orlando International Drive", lat: 28.463082, lon: -81.461422, near: "Volcano Bay", km: 1.1 },
    { name: "Four Star Hotel Kissimmee", lat: 28.389227, lon: -81.487871, near: "SeaWorld", km: 3.4 },
    { name: "Galleria Palms", lat: 28.335546, lon: -81.589318, near: "Animal Kingdom", km: 2.5 },
    { name: "Grand Hotel Universal", lat: 28.451241, lon: -81.464575, near: "Volcano Bay", km: 1.4 },
    { name: "Grande Villas Resort", lat: 28.389791, lon: -81.500745, near: "Disney Springs", km: 2.6 },
    { name: "Hampton Inn & Suites", lat: 28.453085, lon: -81.473481, near: "Volcano Bay", km: 1.0 },
    { name: "Hampton Inn & Suites Orlando at SeaWorld", lat: 28.40735, lon: -81.470997, near: "SeaWorld", km: 0.9 },
    { name: "Hampton Inn Orlando International Drive/Convention Center", lat: 28.436593, lon: -81.469013, near: "Volcano Bay", km: 2.8 },
    { name: "Hampton Inn Orlando Near Universal Blv/International Dr", lat: 28.459322, lon: -81.459433, near: "Volcano Bay", km: 1.3 },
    { name: "Hampton Inn Orlando/Lake Buena Vista", lat: 28.390033, lon: -81.496221, near: "Disney Springs", km: 2.9 },
    { name: "Hard Rock Hotel", lat: 28.476892, lon: -81.464625, near: "Universal", km: 0.4 },
    { name: "Hawthon Suites by Wyndham - Kissimmee Gateway", lat: 28.33628, lon: -81.584065, near: "Animal Kingdom", km: 2.5 },
    { name: "Hawthorn Suites by Wyndham Lake Buena Vista, Orlando", lat: 28.389139, lon: -81.49842, near: "Disney Springs", km: 2.7 },
    { name: "Hilton Garden Inn Lake Buena Vista/Orlando", lat: 28.393134, lon: -81.492606, near: "Disney Springs", km: 3.4 },
    { name: "Hilton Garden Inn Orlando International Drive North", lat: 28.465741, lon: -81.461066, near: "Islands of Adventure", km: 1.0 },
    { name: "Hilton Garden Inn Orlando at SeaWorld", lat: 28.409882, lon: -81.470536, near: "SeaWorld", km: 0.8 },
    { name: "Hilton Grand Vacations at Tuscany Village", lat: 28.38574, lon: -81.488799, near: "Disney Springs", km: 3.1 },
    { name: "Hilton Orlando", lat: 28.424687, lon: -81.458699, near: "SeaWorld", km: 1.5 },
    { name: "Hilton Orlando Buena Vista Palace Disney Springs Area", lat: 28.376803, lon: -81.514662, near: "Disney Springs", km: 0.7 },
    { name: "Hilton Orlando Lake Buena Vista - Disney Springs Area", lat: 28.372602, lon: -81.510876, near: "Disney Springs", km: 0.7 },
    { name: "Holiday Inn", lat: 28.443728, lon: -81.472488, near: "Volcano Bay", km: 2.0 },
    { name: "Holiday Inn & Suites Orlando I-Drive - Theme Parks", lat: 28.390837, lon: -81.486486, near: "SeaWorld", km: 3.2 },
    { name: "Holiday Inn Express & Suites Orlando - International Drive", lat: 28.455594, lon: -81.473226, near: "Volcano Bay", km: 0.7 },
    { name: "Holiday Inn Express & Suites Orlando - Lake Buena Vista", lat: 28.393105, lon: -81.494042, near: "Disney Springs", km: 3.3 },
    { name: "Holiday Inn Express & Suites Orlando at Seaworld", lat: 28.409872, lon: -81.454481, near: "SeaWorld", km: 0.7 },
    { name: "Holiday Inn Orlando-Disney Springs\u00ae Area", lat: 28.375149, lon: -81.50824, near: "Disney Springs", km: 1.0 },
    { name: "Holiday Inn Resort Orlando-Lake Buena Vista", lat: 28.372149, lon: -81.502225, near: "Disney Springs", km: 1.4 },
    { name: "Home2 Suites By Hilton Orlando Near Universal", lat: 28.464028, lon: -81.462126, near: "Volcano Bay", km: 1.0 },
    { name: "Home2 Suites by Hilton Orlando/International Drive South", lat: 28.389698, lon: -81.486715, near: "SeaWorld", km: 3.3 },
    { name: "Homewood Suites", lat: 28.407502, lon: -81.471906, near: "SeaWorld", km: 1.0 },
    { name: "Homewood Suites Orlando", lat: 28.465581, lon: -81.462004, near: "Islands of Adventure", km: 0.9 },
    { name: "Homewood Suites Orlando/International Drive/Convention Center", lat: 28.437326, lon: -81.469893, near: "Volcano Bay", km: 2.7 },
    { name: "Homewood Suites by Hilton Lake Buena Vista - Orlando", lat: 28.392669, lon: -81.492338, near: "Disney Springs", km: 3.4 },
    { name: "Hotel Landy Orlando Universal Blvd., A Tribute Portfolio Hotel", lat: 28.451808, lon: -81.466063, near: "Volcano Bay", km: 1.3 },
    { name: "Hyatt Place Orlando/Convention Center", lat: 28.438351, lon: -81.469275, near: "Volcano Bay", km: 2.6 },
    { name: "Hyatt Place Orlando/Lake Buena Vista", lat: 28.384866, lon: -81.503834, near: "Disney Springs", km: 2.0 },
    { name: "Hyatt Regency Grand Cypress", lat: 28.381736, lon: -81.510772, near: "Disney Springs", km: 1.4 },
    { name: "JW Marriott Orlando Bonnet Creek Resort & Spa", lat: 28.35817, lon: -81.526342, near: "Disney Springs", km: 1.6 },
    { name: "La Quinta Inn & Suites Orlando Convention Center", lat: 28.441326, lon: -81.468694, near: "Volcano Bay", km: 2.3 },
    { name: "La Quinta Orlando International Drive North", lat: 28.463267, lon: -81.459598, near: "Volcano Bay", km: 1.2 },
    { name: "Las Palmeras by Hilton Grand Vacations", lat: 28.433972, lon: -81.459433, near: "SeaWorld", km: 2.6 },
    { name: "Legacy Vacation Resort Lake Buena Vista", lat: 28.3871, lon: -81.50007, near: "Disney Springs", km: 2.4 },
    { name: "M @ 6603 I Drive", lat: 28.457604, lon: -81.471915, near: "Volcano Bay", km: 0.5 },
    { name: "Marriott", lat: 28.403301, lon: -81.469122, near: "SeaWorld", km: 1.1 },
    { name: "Marriott's Cypress Harbour", lat: 28.401625, lon: -81.471218, near: "SeaWorld", km: 1.3 },
    { name: "Marriott's Harbour Lake", lat: 28.403499, lon: -81.477003, near: "SeaWorld", km: 1.6 },
    { name: "Marriott's Sabal Palms", lat: 28.363841, lon: -81.512676, near: "Disney Springs", km: 0.9 },
    { name: "Monumental MovieLand", lat: 28.462099, lon: -81.46728, near: "Volcano Bay", km: 0.5 },
    { name: "Orlando Continental Plaza Hotel", lat: 28.462862, lon: -81.466409, near: "Volcano Bay", km: 0.6 },
    { name: "Orlando World Center Marriott", lat: 28.361019, lon: -81.509427, near: "Disney Springs", km: 1.3 },
    { name: "Quality Suites Lake Buena Vista", lat: 28.389072, lon: -81.496578, near: "Disney Springs", km: 2.8 },
    { name: "Quality Suites Universal South", lat: 28.430901, lon: -81.476156, near: "SeaWorld", km: 2.5 },
    { name: "Ramada Kissimmee Gateway", lat: 28.331115, lon: -81.586194, near: "Animal Kingdom", km: 3.0 },
    { name: "Ramada Plaza Resort and Suites Orlando International Drive", lat: 28.457702, lon: -81.468506, near: "Volcano Bay", km: 0.6 },
    { name: "Red Lion Hotel Orlando - Kissimmee Maingate", lat: 28.331353, lon: -81.584559, near: "Animal Kingdom", km: 3.0 },
    { name: "Renaissance Orlando Resort \u2013 Disney Springs\u00ae Area", lat: 28.376799, lon: -81.506796, near: "Disney Springs", km: 1.2 },
    { name: "Renaissance Orlando at SeaWorld\u00ae", lat: 28.411887, lon: -81.469497, near: "SeaWorld", km: 0.7 },
    { name: "Residence Inn Orlando Convention Center", lat: 28.437632, lon: -81.468893, near: "Volcano Bay", km: 2.7 },
    { name: "Residence Inn Orlando Lake Buena Vista", lat: 28.392148, lon: -81.493322, near: "Disney Springs", km: 3.3 },
    { name: "Rosen Centre Hotel", lat: 28.423596, lon: -81.464564, near: "SeaWorld", km: 1.4 },
    { name: "Rosen Inn International", lat: 28.451565, lon: -81.472244, near: "Volcano Bay", km: 1.1 },
    { name: "Rosen Inn Lake Buena Vista", lat: 28.387304, lon: -81.497747, near: "Disney Springs", km: 2.6 },
    { name: "Rosen Inn at Pointe Orlando", lat: 28.432903, lon: -81.472742, near: "SeaWorld", km: 2.6 },
    { name: "Rosen Plaza Hotel", lat: 28.429767, lon: -81.472028, near: "SeaWorld", km: 2.3 },
    { name: "Sheraton Orlando Lake Buena Vista Resort", lat: 28.387399, lon: -81.505249, near: "Disney Springs", km: 2.2 },
    { name: "Sheraton Vistana Resort Villas, Lake Buena Vista/Orlando", lat: 28.367679, lon: -81.504379, near: "Disney Springs", km: 1.3 },
    { name: "Sheraton Vistana Villages - International Drive", lat: 28.384485, lon: -81.477147, near: "SeaWorld", km: 3.3 },
    { name: "Silver Lake Resort", lat: 28.344291, lon: -81.593489, near: "Animal Kingdom", km: 1.5 },
    { name: "Sonesta ES Suites Lake Buena Vista", lat: 28.390655, lon: -81.505099, near: "Disney Springs", km: 2.5 },
    { name: "Spark Orlando", lat: 28.452469, lon: -81.464217, near: "Volcano Bay", km: 1.3 },
    { name: "SpringHill Suites Orlando Convention Center/International Drive Area", lat: 28.437192, lon: -81.468849, near: "Volcano Bay", km: 2.8 },
    { name: "SpringHill Suites Orlando Lake Buena Vista in Marriott Village", lat: 28.377981, lon: -81.50198, near: "Disney Springs", km: 1.7 },
    { name: "SpringHill Suites Orlando Theme Parks/Lake Buena Vista", lat: 28.392394, lon: -81.495921, near: "Disney Springs", km: 3.1 },
    { name: "SpringHill Suites Orlando at SeaWorld\u00ae", lat: 28.409022, lon: -81.454348, near: "SeaWorld", km: 0.8 },
    { name: "StaySky Suites I-Drive Orlando", lat: 28.452003, lon: -81.467527, near: "Volcano Bay", km: 1.2 },
    { name: "Staybridge Suites Orlando at Seaworld", lat: 28.407231, lon: -81.470346, near: "SeaWorld", km: 0.9 },
    { name: "Suburban Studios International Drive", lat: 28.45633, lon: -81.473038, near: "Volcano Bay", km: 0.6 },
    { name: "The Enclave Suites", lat: 28.45691, lon: -81.468201, near: "Volcano Bay", km: 0.7 },
    { name: "The Point Hotel & Suites", lat: 28.456783, lon: -81.463029, near: "Volcano Bay", km: 1.1 },
    { name: "The Point Orlando Resort", lat: 28.457795, lon: -81.459769, near: "Volcano Bay", km: 1.3 },
    { name: "The Villas at Disney's Grand Floridian Resort & Spa", lat: 28.409128, lon: -81.587402, near: "Magic Kingdom", km: 1.3 },
    { name: "The Villas at Disney's Wilderness Lodge", lat: 28.408328, lon: -81.571448, near: "Magic Kingdom", km: 1.5 },
    { name: "TownePlace Suites", lat: 28.410738, lon: -81.454555, near: "SeaWorld", km: 0.7 },
    { name: "Travelodge", lat: 28.45633, lon: -81.471566, near: "Volcano Bay", km: 0.6 },
    { name: "Tru", lat: 28.419638, lon: -81.469199, near: "SeaWorld", km: 1.1 },
    { name: "Universal Stella Nova Resort", lat: 28.433262, lon: -81.449759, near: "SeaWorld", km: 2.7 },
    { name: "Universal Terra Luna Resort", lat: 28.433852, lon: -81.452405, near: "SeaWorld", km: 2.7 },
    { name: "Universal's Aventura Hotel", lat: 28.465158, lon: -81.471201, near: "Volcano Bay", km: 0.4 },
    { name: "Universal's Endless Summer Resort \u2013 Dockside Inn & Suites", lat: 28.460056, lon: -81.462182, near: "Volcano Bay", km: 1.0 },
    { name: "Universal's Endless Summer Resort \u2013 Surfside Inn and Suites", lat: 28.460965, lon: -81.464977, near: "Volcano Bay", km: 0.7 },
    { name: "Waldorf Astoria Orlando - An Official Walt Disney World\u00aeHotel", lat: 28.353061, lon: -81.533622, near: "Hollywood Studios", km: 2.4 },
    { name: "Walt Disney World Dolphin Resort", lat: 28.367302, lon: -81.56046, near: "Hollywood Studios", km: 1.1 },
    { name: "Walt Disney World Swan Reserve", lat: 28.364577, lon: -81.562011, near: "Hollywood Studios", km: 0.8 },
    { name: "Walt Disney World Swan Resort", lat: 28.3656, lon: -81.559155, near: "Hollywood Studios", km: 0.9 },
    { name: "Westgate Lakes Resort & Spa", lat: 28.427106, lon: -81.475694, near: "SeaWorld", km: 2.2 },
    { name: "Wyndham Garden", lat: 28.464322, lon: -81.459844, near: "Islands of Adventure", km: 1.1 },
    { name: "Wyndham Lake Buena Vista Disney Springs Resort Area", lat: 28.375157, lon: -81.511842, near: "Disney Springs", km: 0.7 },
    { name: "Wyndham Orlando Resort International Drive", lat: 28.448555, lon: -81.467679, near: "Volcano Bay", km: 1.6 },
    ],
    // Animal Kingdom's named exhibits (OSM animal=*). SeaWorld's are deliberately excluded —
    // they are 15 km east and would make a "safari" mean flying up I-4.
    animals: [
      { name: 'Elephants', lat: 28.365427, lon: -81.595043 },
      { name: 'Flamingos', lat: 28.364625, lon: -81.592991 },
      { name: 'Lions', lat: 28.363218, lon: -81.592071 },
      { name: 'Wild Dogs', lat: 28.362154, lon: -81.595381 },
      { name: 'Nile Crocodiles', lat: 28.361462, lon: -81.595172 },
      { name: 'Hippos', lat: 28.361093, lon: -81.594158 },
      { name: 'Gorillas', lat: 28.360573, lon: -81.592406 },
      { name: 'Aviary', lat: 28.360477, lon: -81.593340 },
      { name: 'Colobus Monkeys', lat: 28.359918, lon: -81.592515 },
      { name: 'Okapi', lat: 28.359839, lon: -81.593248 },
      { name: 'Black Rhinoceros', lat: 28.359768, lon: -81.594246 },
      { name: 'Bongo', lat: 28.359461, lon: -81.593492 },
    ],
  },
  races: [
    // A real circuit, which almost nothing else in this game is: the eleven World Showcase
    // pavilions ring EPCOT's lagoon, so flying them in OSM's own geographic order is one
    // continuous lap rather than a zigzag.
    {
      id: 'world-showcase-lap', name: 'WORLD SHOWCASE LAP', color: '#4fd8ff', sponsor: null,
      points: [
        [28.371360, -81.547580], [28.370610, -81.546740], [28.369940, -81.546440],
        [28.368210, -81.547050], [28.367670, -81.548210], [28.367280, -81.549300],
        [28.367780, -81.550500], [28.368160, -81.551770], [28.368990, -81.552730],
        [28.370500, -81.551870], [28.371690, -81.551350], [28.371360, -81.547580],
      ],
    },
    // The four park icons, one gate each. Deliberately built from the biggest structures on
    // property: these read clearly from the air even where the tile imagery goes soft.
    {
      id: 'park-hopper', name: 'PARK HOPPER', color: '#ffe066', sponsor: null,
      points: [
        [28.419524, -81.581175], [28.375271, -81.549392],
        [28.360020, -81.559910], [28.358822, -81.586678], [28.370597, -81.517687],
      ],
    },
    // Disney's "mountains" plus the mine train — the four peaks, two parks, one run.
    {
      id: 'mountain-run', name: 'MOUNTAIN RUN', color: '#7fffd4', sponsor: null,
      points: [
        [28.419171, -81.577227], [28.420596, -81.580059],
        [28.420264, -81.584672], [28.358822, -81.586678],
      ],
    },
  ],
  tours: [],                             // TODO: guided tours
  districts: [
    // The parks' own lands, from OSM place=locality. Flying into one announces it, so the
    // map narrates itself. Two OSM names are misspelled at source ("Grand Avenure",
    // "Commissionary Lane"); corrected here since the label is player-facing.
    // Magic Kingdom
    { name: 'Main Street, U.S.A.', lat: 28.417742, lon: -81.581153, r: 150 },
    { name: 'Adventureland', lat: 28.418080, lon: -81.583394, r: 150 },
    { name: 'Frontierland', lat: 28.420026, lon: -81.583856, r: 150 },
    { name: 'Liberty Square', lat: 28.419522, lon: -81.582474, r: 150 },
    { name: 'Fantasyland', lat: 28.420519, lon: -81.580564, r: 150 },
    { name: 'Storybook Circus', lat: 28.420826, lon: -81.578785, r: 150 },
    { name: 'Tomorrowland', lat: 28.418908, lon: -81.578838, r: 150 },
    // EPCOT
    { name: 'Future World', lat: 28.373519, lon: -81.549036, r: 260 },
    { name: 'World Showcase', lat: 28.369447, lon: -81.550388, r: 300 },
    // Hollywood Studios
    { name: 'Hollywood Boulevard', lat: 28.357405, lon: -81.559817, r: 150 },
    { name: 'Sunset Boulevard', lat: 28.359720, lon: -81.559693, r: 150 },
    { name: 'Echo Lake', lat: 28.356564, lon: -81.559080, r: 150 },
    { name: 'Grand Avenue', lat: 28.355227, lon: -81.559486, r: 150 },
    { name: 'Animation Courtyard', lat: 28.357373, lon: -81.561010, r: 150 },
    { name: 'Pixar Place', lat: 28.356336, lon: -81.560951, r: 150 },
    { name: 'Commissary Lane', lat: 28.356099, lon: -81.559862, r: 150 },
    { name: 'Toy Story Land', lat: 28.355871, lon: -81.562198, r: 150 },
    { name: 'Star Wars: Galaxy\u2019s Edge', lat: 28.354517, lon: -81.561920, r: 180 },
    // Animal Kingdom
    { name: 'Oasis', lat: 28.355621, lon: -81.590338, r: 150 },
    { name: 'Pandora: The World of Avatar', lat: 28.355937, lon: -81.592263, r: 180 },
    { name: 'Africa', lat: 28.360544, lon: -81.592615, r: 220 },
    { name: 'Asia', lat: 28.358808, lon: -81.588314, r: 200 },
    // Universal Orlando
    { name: 'Hollywood', lat: 28.476790, lon: -81.467400, r: 150 },
    { name: 'Minion Land', lat: 28.475754, lon: -81.468333, r: 150 },
    { name: 'New York', lat: 28.476295, lon: -81.469141, r: 150 },
    { name: 'San Francisco', lat: 28.478551, lon: -81.469338, r: 150 },
    { name: 'Springfield', lat: 28.479134, lon: -81.467928, r: 150 },
    { name: 'Wizarding World - Diagon Alley', lat: 28.479589, lon: -81.469639, r: 160 },
    { name: 'World Expo', lat: 28.480269, lon: -81.468180, r: 150 },
    { name: 'DreamWorks Land', lat: 28.478533, lon: -81.466457, r: 150 },
  ],
  scenarios: [],                         // TODO: local events
  landmarks: [],                         // TODO: curated landmark signs
  shops: [],                             // TODO: storefront cards
  interiors: [],                       // TODO: enterable rooms
  ballparks: [],                       // TODO: home run derby fields
  fieldDecals: [],                       // TODO: stadium roundels
};
