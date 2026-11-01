/**
 * Nashville, Tennessee.
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
    id: 'nashville',
    name: 'Nashville',
    region: 'Tennessee',
    regionCode: 'TN',
    tagline: 'Music City',
    origin: false,
    // Every city flies something of its own. 'saturn' is Huntsville's — leaving it here
    // would hand this city the origin city's rocket. Build one in src/characters.js.
    character: 'guitar',                 // Music City
  },
  origin: { lat: 36.1627, lon: -86.7816, name: 'Downtown' },
  spawn: { look: [36.1627, -86.7816], from: [36.1587, -86.7796], alt: 210 },
  weather: { station: 'KBNA' },
  // 207 real DeFlock ALPR cameras (OSM-derived, ODbL) inside the playable lobe.
  alpr: '/alpr/nashville.json',
  // Playable area. TODO: shape these lobes to the real city; one circle is a placeholder.
  // Permanent ad slot, top-left on desktop, replacing the wordmark when enabled.
  // Standard horizontal creative — 320x50 by default; a larger size scales to the column
  // and keeps its aspect. Drop the file in public/ads/ and point `image` at it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  border: {
    lobes: [
      { lat: 36.1627, lon: -86.7816, r: 16000 },
    ],
    nofly: [],                           // TODO: restricted airspace, if any
  },
  // Teleports, all real Broadway/downtown coordinates from OpenStreetMap.
  presets: [
    { name: 'Lower Broadway', lat: 36.160968, lon: -86.778329, spawn: [36.16050, -86.77790], alt: 90 },
    { name: 'Ryman Auditorium', lat: 36.161286, lon: -86.778476, spawn: [36.16080, -86.77880], alt: 80 },
    { name: "Tootsie's", lat: 36.160968, lon: -86.778329, spawn: [36.16060, -86.77800], alt: 60 },
    { name: 'Acme Feed & Seed', lat: 36.161959, lon: -86.774487, spawn: [36.16160, -86.77410], alt: 70 },
    { name: 'Broadway & 5th', lat: 36.160903, lon: -86.778459, spawn: [36.16055, -86.77815], alt: 70 },
  ],
  pois: {
    starbucks: [], breweries: [], bowling: [], pickleball: [], hospitals: [], golfCourses: [],
    // Every honky-tonk on the strip, for the Broadway crawl.
    honkytonks: [
      { name: "The Silver Dollar Saloon", lat: 36.162354, lon: -86.775304 },
      { name: "Bootleggers Inn", lat: 36.161541, lon: -86.775329 },
      { name: "Kid Rock’s Big Honky Tonk and Rock n’ Roll Steakhouse", lat: 36.161325, lon: -86.775598 },
      { name: "Redneck Riviera", lat: 36.161842, lon: -86.775712 },
      { name: "LUKE's 32 Bridge Food + Drink", lat: 36.161317, lon: -86.775963 },
      { name: "Wanna B's Karaoke Bar", lat: 36.161246, lon: -86.77608 },
      { name: "Whisky Bent Saloon", lat: 36.161624, lon: -86.776491 },
      { name: "Broadway Brew House", lat: 36.160969, lon: -86.776527 },
      { name: "Miranda Lambert's Casa Rosa", lat: 36.16155, lon: -86.77666 },
      { name: "The Valentine", lat: 36.161488, lon: -86.776776 },
      { name: "Honky Tonk Central", lat: 36.160871, lon: -86.776789 },
      { name: "Tin Roof", lat: 36.161566, lon: -86.776914 },
      { name: "Friends In Low Places Bar & Honky-Tonk", lat: 36.160493, lon: -86.777444 },
      { name: "Bailey's", lat: 36.161155, lon: -86.77774 },
      { name: "Nashville Crossroads", lat: 36.160498, lon: -86.77778 },
      { name: "AJ's Good Time Bar", lat: 36.160424, lon: -86.777859 },
      { name: "The Stage on Broadway", lat: 36.161084, lon: -86.777919 },
      { name: "Pub 5", lat: 36.160232, lon: -86.778093 },
      { name: "Robert's Western World", lat: 36.161031, lon: -86.778094 },
      { name: "Layla's Honky Tonk", lat: 36.161025, lon: -86.778179 },
      { name: "Second Fiddle", lat: 36.160953, lon: -86.778216 },
      { name: "Tootsies Orchid Lounge", lat: 36.160968, lon: -86.778329 },
      { name: "Legends Corner", lat: 36.160903, lon: -86.778459 },
    ],
  },
  // The route Opry performers actually walked: out the Ryman's back door, down the alley
  // OpenStreetMap still calls "Ryman Alley", and in through Tootsie's back door for a
  // drink between sets. Every point below is a real mapped location.
  races: [
    {
      id: 'ryman-alley', name: 'RYMAN ALLEY RUN', color: '#c77dff', sponsor: null,
      points: [
        [36.161286, -86.778476],   // Ryman Auditorium — stage door side
        [36.161213, -86.778119],   // Ryman Alley
        [36.161031, -86.778094],   // Robert's Western World
        [36.160968, -86.778329],   // Tootsie's Orchid Lounge — back door
      ],
    },
    {
      id: 'broadway-strip', name: 'THE HONKY-TONK HIGHWAY', color: '#ffb347', sponsor: null,
      points: [
        [36.161959, -86.774487],   // Acme Feed & Seed, river end
        [36.161804, -86.774844],
        [36.161400, -86.776200],
        [36.161100, -86.777300],
        [36.160903, -86.778459],   // Legends Corner, 5th Avenue end
      ],
    },
  ],
  tours: [],                             // TODO: guided tours
  districts: [],                         // TODO: named neighbourhoods
  scenarios: [],                         // TODO: local events
  // Curated signs over the places worth naming from the air.
  landmarks: [
    { name: 'RYMAN AUDITORIUM — MOTHER CHURCH OF COUNTRY MUSIC', lat: 36.161286, lon: -86.778476, range: 220, height: 46 },
    { name: "TOOTSIE'S ORCHID LOUNGE", lat: 36.160968, lon: -86.778329, range: 150, height: 34 },
    { name: "ROBERT'S WESTERN WORLD", lat: 36.161031, lon: -86.778094, range: 140, height: 32 },
    { name: 'LOWER BROADWAY — THE HONKY-TONK HIGHWAY', lat: 36.161200, lon: -86.776500, range: 320, height: 60 },
    { name: 'ACME FEED & SEED', lat: 36.161959, lon: -86.774487, range: 150, height: 34 },
  ],
  // ---- Lower Broadway ------------------------------------------------------------
  // The honky-tonk strip, pulled from OpenStreetMap and filtered to venues within 55 m
  // of Broadway's own centreline, so this is the row itself and not the surrounding
  // blocks. 39 venues; 11 of them carry a country star's name.
  //
  // `star` is set only where the venue name says so outright or the association is
  // uncontested and widely reported. Ownership on Broadway is genuinely tangled — many
  // of these are licensed brands run by hospitality groups — so this claims branding,
  // not title, and anything uncertain is simply left off.
  shops: [
    { name: "Acme Feed and Seed", lat: 36.161959, lon: -86.774487, blurb: "A century-old farm-supply building at the river end of the strip.", url: "https://www.acmefeedandseed.com/" },
    { name: "Rock Bottom Brewery", lat: 36.161804, lon: -86.774844, blurb: "On Lower Broadway." },
    { name: "Hard Rock Cafe", lat: 36.162354, lon: -86.774958, blurb: "On Lower Broadway.", url: "https://cafe.hardrock.com/nashville/" },
    { name: "The Silver Dollar Saloon", lat: 36.162354, lon: -86.775304, blurb: "Honky-tonk on Lower Broadway." },
    { name: "Bootleggers Inn", lat: 36.161541, lon: -86.775329, blurb: "Honky-tonk on Lower Broadway." },
    { name: "Big Jimmy's", lat: 36.162195, lon: -86.775539, blurb: "On Lower Broadway.", url: "https://www.bigjimmysburgers.com/" },
    { name: "Kid Rock’s Big Honky Tonk and Rock n’ Roll Steakhouse", lat: 36.161325, lon: -86.775598, blurb: "Kid Rock's room on Lower Broadway.", star: "Kid Rock" },
    { name: "Redneck Riviera", lat: 36.161842, lon: -86.775712, blurb: "John Rich's room on Lower Broadway.", star: "John Rich", url: "https://redneckrivieranashville.com/" },
    { name: "Raising Cane's", lat: 36.161768, lon: -86.775943, blurb: "On Lower Broadway.", url: "https://locations.raisingcanes.com/tn/nashville/212-broadway" },
    { name: "LUKE's 32 Bridge Food + Drink", lat: 36.161317, lon: -86.775963, blurb: "Luke Bryan's room on Lower Broadway.", star: "Luke Bryan", url: "https://lukes32bridge.com/" },
    { name: "Jason Aldean’s Kitchen & Rooftop Bar", lat: 36.161128, lon: -86.776026, blurb: "Jason Aldean's room on Lower Broadway.", star: "Jason Aldean", url: "https://jasonaldeansbar.com/nashville/" },
    { name: "Wanna B's Karaoke Bar", lat: 36.161246, lon: -86.77608, blurb: "Honky-tonk on Lower Broadway." },
    { name: "Ole Red", lat: 36.161777, lon: -86.776292, blurb: "Blake Shelton's room on Lower Broadway.", star: "Blake Shelton", url: "https://www.olered.com/nashville" },
    { name: "Whisky Bent Saloon", lat: 36.161624, lon: -86.776491, blurb: "Honky-tonk on Lower Broadway.", url: "https://whiskeybentnash.com/" },
    { name: "Broadway Brew House", lat: 36.160969, lon: -86.776527, blurb: "Honky-tonk on Lower Broadway.", url: "https://www.broadwaybrewhousedowntown.com/" },
    { name: "Miranda Lambert's Casa Rosa", lat: 36.16155, lon: -86.77666, blurb: "Miranda Lambert's room on Lower Broadway.", star: "Miranda Lambert", url: "https://casarosanashville.com/" },
    { name: "The Valentine", lat: 36.161488, lon: -86.776776, blurb: "Honky-tonk on Lower Broadway.", url: "https://thevalentinenashville.com/" },
    { name: "Honky Tonk Central", lat: 36.160871, lon: -86.776789, blurb: "Three floors, three bands, all going at once.", url: "https://www.honkytonkcentral.com/" },
    { name: "Tin Roof", lat: 36.161566, lon: -86.776914, blurb: "Honky-tonk on Lower Broadway.", url: "https://tinroofbroadway.com/" },
    { name: "Merchants Restaurant", lat: 36.160723, lon: -86.777206, blurb: "On Lower Broadway.", url: "https://www.merchantsrestaurant.com/" },
    { name: "Jimmy Buffett Margaritaville", lat: 36.161464, lon: -86.777231, blurb: "Jimmy Buffett's room on Lower Broadway.", star: "Jimmy Buffett", url: "https://www.margaritavillenashville.com" },
    { name: "Friends In Low Places Bar & Honky-Tonk", lat: 36.160493, lon: -86.777444, blurb: "Garth Brooks's room on Lower Broadway.", star: "Garth Brooks", url: "https://www.friendsbarnashville.com" },
    { name: "Dierks Bentley's Whiskey Row - Nashville", lat: 36.161214, lon: -86.777507, blurb: "Dierks Bentley's room on Lower Broadway.", star: "Dierks Bentley", url: "https://dierkswhiskeyrow.com/nashville-tn/" },
    { name: "Bailey's", lat: 36.161155, lon: -86.77774, blurb: "Honky-tonk on Lower Broadway." },
    { name: "Nashville Crossroads", lat: 36.160498, lon: -86.77778, blurb: "Right in the middle of the row, open to the street." },
    { name: "AJ's Good Time Bar", lat: 36.160424, lon: -86.777859, blurb: "Alan Jackson's room on Lower Broadway.", star: "Alan Jackson", url: "https://www.ajsgoodtimebar.com/" },
    { name: "The Stage on Broadway", lat: 36.161084, lon: -86.777919, blurb: "A wide dance floor and a stage that has launched a lot of careers.", url: "https://www.thestageonbroadway.com/" },
    { name: "Jack's", lat: 36.161018, lon: -86.778008, blurb: "On Lower Broadway." },
    { name: "Pub 5", lat: 36.160232, lon: -86.778093, blurb: "Honky-tonk on Lower Broadway." },
    { name: "Robert's Western World", lat: 36.161031, lon: -86.778094, blurb: "Boots on the wall, a recession special, and traditional country all day.", url: "https://www.robertswesternworld.com/" },
    { name: "Rippy's Honky Tonk", lat: 36.160365, lon: -86.778175, blurb: "Ribs downstairs, balcony over Broadway upstairs.", url: "https://www.rippyshonkytonk.com/" },
    { name: "Layla's Honky Tonk", lat: 36.161025, lon: -86.778179, blurb: "Narrow, loud, and one of the last of the old guard.", url: "http://www.laylasnashville.com/" },
    { name: "Second Fiddle", lat: 36.160953, lon: -86.778216, blurb: "Small room, big steel guitar, no cover." },
    { name: "Tootsies Orchid Lounge", lat: 36.160968, lon: -86.778329, blurb: "The purple room behind the Ryman. Opry players slipped out the back door between sets.", url: "https://www.tootsies.net/" },
    { name: "Legends Corner", lat: 36.160903, lon: -86.778459, blurb: "Corner of 5th and Broadway, walls papered in album covers.", url: "https://www.legendscorner.com/" },
    { name: "The Twelve Thirty Club", lat: 36.160506, lon: -86.779044, blurb: "Justin Timberlake's room on Lower Broadway.", star: "Justin Timberlake", url: "https://thetwelvethirtyclub.com/" },
    { name: "Hattie B’s Hot Chicken", lat: 36.160336, lon: -86.779361, blurb: "On Lower Broadway." },
    { name: "Eddie V's Prime Seafood", lat: 36.160135, lon: -86.779698, blurb: "On Lower Broadway.", url: "https://www.eddiev.com/locations/tn/nashville/nashville/8529" },
    { name: "Slim and Husky's", lat: 36.160411, lon: -86.779725, blurb: "On Lower Broadway.", url: "https://slimandhuskys.com/" },
  ],
  interiors: [],                       // TODO: enterable rooms
  ballparks: [],                       // TODO: home run derby fields
  fieldDecals: [],                       // TODO: stadium roundels
};
