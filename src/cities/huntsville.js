/**
 * Huntsville, Alabama — the origin city. "Rocket City" is the game's name; this is
 * the place it is named after.
 *
 * Every coordinate here was moved verbatim out of src/constants.js. Sourcing notes
 * for the POI lists (OSM tags, the licensed-in-store Starbucks problem, why Publix
 * is absent) travel with the arrays — do not drop them.
 */

/**
 * Storefront layer. Each shop floats a beacon over its real storefront; fly to it and
 * click (or press E) to open a card with a short blurb and, when `url` is set, a link to
 * the store's own site in a new tab. `offer` is an optional highlighted line on the card
 * (leave it empty unless the business has actually published the offer).
 */
const DOWNTOWN_SHOPS = [
  {
    name: 'Harrison Brothers Hardware', lat: 34.72982, lon: -86.58436,
    blurb: "Alabama's oldest hardware store, on the square since 1897.",
    offer: '',
    url: 'https://harrisonbrothershardware.com',
  },
  {
    name: 'The Moon Bakeshop', lat: 34.73286, lon: -86.58813,
    blurb: 'Downtown pastries, cakes, and coffee.',
    offer: '',
    url: '',
  },
  {
    name: "Pizzelle's Confections", lat: 34.72213, lon: -86.60480,
    blurb: 'Handmade chocolates and sweets at Lowe Mill.',
    offer: '',
    url: '',
  },
];

// Bridge Street Town Centre — Huntsville's outdoor lifestyle center (365 The
// Bridge St NW). Coordinates are REAL storefront positions from OpenStreetMap
// so each beacon sits on the actual shop. `offer` is empty (no invented discounts);
// `url` points at each brand's official site. Add/adjust tenants as
// [name, lat, lon, url, offer, blurb].
const BS_TENANTS = [
  ['Apple', 34.7155127, -86.6728597, 'https://www.apple.com/', '', 'Genius Bar, iPhone, Mac & more.'],
  ['Anthropologie', 34.7173543, -86.6737335, 'https://www.anthropologie.com/', '', 'Apparel, home & gifts.'],
  ["Altar'd State", 34.7161631, -86.6734593, 'https://www.altardstate.com/', '', 'Boutique womenswear that gives back.'],
  ['Barnes & Noble', 34.7152132, -86.6723785, 'https://www.barnesandnoble.com/', '', 'Books, café & gifts.'],
  ['Bath & Body Works', 34.71653, -86.6731727, 'https://www.bathandbodyworks.com/', '', 'Candles, soaps & fragrance.'],
  ['Belk', 34.7170624, -86.6751307, 'https://www.belk.com/', '', 'Department store anchor.'],
  ['DSW', 34.715398, -86.674323, 'https://www.dsw.com/', '', 'Designer shoe warehouse.'],
  ["Francesca's", 34.7177127, -86.6732534, 'https://www.francescas.com/', '', 'Trendy apparel & accessories.'],
  ['H&M', 34.7173381, -86.6732661, 'https://www2.hm.com/', '', 'Fashion for the whole family.'],
  ['Sephora', 34.7165859, -86.6735846, 'https://www.sephora.com/', '', 'Beauty, skincare & fragrance.'],
  ["Victoria's Secret", 34.7163805, -86.6735503, 'https://www.victoriassecret.com/', '', 'Lingerie, beauty & PINK.'],
  ['Mountain High Outfitters', 34.7160177, -86.6738513, 'https://mountainhighoutfitters.com/', '', 'Outdoor gear & apparel.'],
  ["P.F. Chang's", 34.7153122, -86.6733163, 'https://www.pfchangs.com/', '', 'Asian bistro & cocktails.'],
  ["BJ's Restaurant & Brewhouse", 34.7153341, -86.6748035, 'https://www.bjsrestaurants.com/', '', 'Craft beer & deep-dish.'],
  ['Ulta Beauty', 34.7152998, -86.6740831, 'https://www.ulta.com/', '', 'Cosmetics, skincare & salon.'],
  ['Old Navy', 34.7152979, -86.673971, 'https://oldnavy.gap.com/', '', 'Everyday family fashion.'],
  ['Athleta', 34.7158022, -86.6728514, 'https://athleta.gap.com/', '', 'Performance & lifestyle apparel.'],
  ['Lululemon', 34.7167942, -86.6732709, 'https://shop.lululemon.com/', '', 'Technical athletic apparel.'],
  ['LEGO Store', 34.7163232, -86.673156, 'https://www.lego.com/', '', 'Bricks, sets & play.'],
  ['Warby Parker', 34.7154198, -86.6728719, 'https://www.warbyparker.com/', '', 'Eyewear & eye exams.'],
  ['Kendra Scott', 34.7160152, -86.6733061, 'https://www.kendrascott.com/', '', 'Jewelry & Color Bar.'],
  ['Panera Bread', 34.7154994, -86.676855, 'https://www.panerabread.com/', '', 'Bakery-café & coffee.'],
  ['Vans', 34.7167113, -86.6732433, 'https://www.vans.com/', '', 'Skate shoes & apparel.'],
  ['LOFT', 34.7175334, -86.6732579, 'https://www.loft.com/', '', "Women's apparel & accessories."],
];

const BRIDGE_STREET_SHOPS = BS_TENANTS.map(([name, lat, lon, url, offer, blurb]) => ({ name, lat, lon, url, offer, blurb, mall: 'Bridge Street' }));

export const SHOPS = [...DOWNTOWN_SHOPS, ...BRIDGE_STREET_SHOPS];

const HRW_URL = 'https://www.huntsville.org/culinary-month-restaurant-week/menus-and-events/';
const HRW_FOOTER = '2026 HUNTSVILLE RESTAURANT WEEK · AUG 14\u201323 · HUNTSVILLE.ORG';
const hrwStop = (name, district, lat, lon) => ({
  name, lat, lon,
  blurb: `${district} \u2014 2026 Huntsville Restaurant Week participant.`,
  note: 'Restaurant Week menus ran Aug 14\u201323 \u2014 tap VISIT WEBSITE for the official menu listings.',
  url: HRW_URL,
});


const SCENARIOS = [
  {
    id: 'hrw-2026',
    name: 'RESTAURANT WEEK 2026',
    // window: { start: '2027-08-13', end: '2027-08-22' },  // set to auto-activate during the event
    color: '#ff5fa2',
    badge: 'RESTAURANT WEEK 2026 TOUR BADGE',
    footer: HRW_FOOTER,
    stops: [
      hrwStop('Cotton Row', 'Downtown \u2014 South Side Square', 34.729449, -86.585043),
      hrwStop('Commerce Kitchen', 'Downtown \u2014 Franklin St', 34.729866, -86.584245),
      hrwStop('Pane e Vino', 'Downtown \u2014 Big Spring Park', 34.727444, -86.587334),
      hrwStop('The Moon Bakeshop', 'Downtown \u2014 Jefferson St', 34.732864, -86.588129),
      hrwStop("Pizzelle's Confections", 'Lowe Mill', 34.722134, -86.604799),
      hrwStop("Ale's Kitchen at Straight to Ale", 'Campus 805', 34.720948, -86.607094),
      hrwStop('Blue Oak BBQ', 'MidCity District', 34.737814, -86.666223),
      hrwStop('Sage Grille at the Westin', 'Bridge Street', 34.718535, -86.672663),
      hrwStop('The Chop House', 'Madison', 34.672025, -86.748348),
    ],
  },
  {
    id: 'animal-shelters',
    name: 'ANIMAL SHELTER RUN',
    color: '#ff9e5e',
    badge: 'ANIMAL ALLY BADGE',
    footer: 'ADOPT · FOSTER · VOLUNTEER — HUNTSVILLE & MADISON',
    stops: [
      { name: 'Huntsville Animal Services', lat: 34.68009, lon: -86.60939, blurb: "Madison County's municipal shelter — adoptable dogs & cats, microchips, and licensing.", note: 'Fly here to visit. Adopt-a-pet listings on the city site.', url: 'https://www.huntsvilleal.gov/' },
      { name: 'Greater Huntsville Humane Society', lat: 34.69146, lon: -86.60057, blurb: 'Nonprofit adoptions and a low-cost spay/neuter clinic serving the valley.', note: 'One of the oldest animal welfare groups in the area.', url: '' },
      { name: 'A New Leash on Life — Huntsville', lat: 34.74359, lon: -86.57712, blurb: 'No-kill rescue. This is the thrift store & boutique whose sales fund the animals.', note: 'Shop to support, or ask about adoptions.', url: 'https://anewleash.org/' },
      { name: 'A New Leash on Life — Madison', lat: 34.73450, lon: -86.70994, blurb: 'No-kill rescue adoption center on the Madison side.', note: 'Meet adoptable pets here.', url: 'https://anewleash.org/' },
      { name: 'A New Leash on Life — East', lat: 34.68893, lon: -86.50589, blurb: 'No-kill rescue — the east Huntsville location toward Hampton Cove.', note: 'Adopt, foster, or donate.', url: 'https://anewleash.org/' },
      { name: 'Notorious D.O.G. Rescue', lat: 34.72448, lon: -86.60437, blurb: 'Volunteer-run dog rescue & foster network placing dogs in forever homes.', note: 'Fosters and adopters always needed.', url: '' },
    ],
  },
];

// Decal palette, kept with the decals that use it.
const GREEN = '#39ff88';
const AMBER = '#ffb347';

export default {
  meta: {
    id: 'huntsville',
    name: 'Huntsville',
    region: 'Alabama',
    regionCode: 'AL',                    // postal abbreviation, used in captions and geocoding
    character: 'saturn',                 // default avatar; the player can still switch
    // Modes hidden from the menus. The data below is untouched and still validated —
    // deleting an id here brings the mode straight back.
    hiddenModes: ['bowling', 'pickleball', 'er', 'animal-shelters', 'stovehouse-sprint'],
    // The only city with the hand-authored Fuel Run / Grand Tour missions: the fuel cell
    // offsets are laid out around Courthouse Square and the copy names it.
    missions: true,
    // SEO copy for this city's play page; scripts/sync-city-pages.mjs renders it.
    seo: {
      description: 'Play Rocket City CC in your browser. Fly a rocket over a photoreal 3D Huntsville and Madison, Alabama — races, hunts, coin runs and tours. Free, no install.',
      ogDescription: 'Fly over Huntsville & Madison in a rocket. Play local games, hunt Flock cameras, race the city. Free in your browser.',
      twitterDescription: 'Fly over Huntsville & Madison in a rocket. Free in your browser.',
      imageAlt: 'A rocket flying over a photorealistic 3D Huntsville, Alabama.',
    },
    tagline: 'The Rocket City',
    origin: true,                       // the city the game is named after
  },
  origin: { lat: 34.7304, lon: -86.5861, name: 'Courthouse Square' },
  // Opening shot: a high establishing view SSE of downtown looking NNW.
  spawn: { look: [34.730257, -86.585058], from: [34.72640, -86.58380], alt: 210 },
  // Nearest NWS observation station — drives the live weather readout (keyless API).
  weather: { station: 'KHSV' },
  // DeFlock ALPR camera set (OSM-derived, ODbL) baked at build time.
  alpr: '/alpr.json',
  // Playable-area border: a circle covering greater Huntsville (downtown, Monte Sano,
  // Hampton Cove, Research Park, Madison/Toyota Field). Player and cars are pushed
  // back at the wall; a translucent wall fades in as you approach.
  // Playable area = union of circles. Main lobe covers greater Huntsville;
  // the eastern lobe opens the Hampton Cove valley out to Gurley.
  // Optional billboard slot, top-left on desktop, replacing the wordmark when enabled.
  // Standard horizontal creative — 320x50 by default; a larger size scales to the column
  // and keeps its aspect. Drop the file in public/ads/ and point `image` at it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  border: {
    lobes: [
      { lat: 34.705, lon: -86.63, r: 16000 },
      { lat: 34.695, lon: -86.475, r: 12000 },  // Hampton Cove / Big Cove
      { lat: 34.70, lon: -86.38, r: 8000 },     // Gurley
    ],
    // Restricted airspace: Redstone Arsenal / Marshall Space Flight Center (active military
    // installation). We turn players back — the imagery is public Google data, but we don't
    // feature or route to the base.
    nofly: [{ lat: 34.635, lon: -86.665, r: 6500, name: 'REDSTONE ARSENAL' }],
  },
  // Teleport destinations. lat/lon = the landmark itself (beacons, minimap).
  // spawn = where the player appears (airborne at `alt` m AGL once flight is
  // unlocked), facing the landmark so every arrival opens on the scenic view.
  // Coordinates geocoded via OSM Nominatim (2026-08).
  presets: [
    { name: 'Courthouse Square', lat: 34.730257, lon: -86.585058, spawn: [34.73030, -86.58260], alt: 65 },
    { name: 'Saturn V', lat: 34.7100, lon: -86.6556, spawn: [34.71240, -86.65340], alt: 75 },
    { name: 'Bridge Street', lat: 34.716323, lon: -86.673156, spawn: [34.71800, -86.67100], alt: 60 },
    { name: 'Big Spring Park', lat: 34.729000, lon: -86.589200, spawn: [34.72640, -86.58520], alt: 90 },
    { name: 'Orion Amphitheater', lat: 34.73405, lon: -86.66840, spawn: [34.73180, -86.66600], alt: 70 },
    { name: 'MidCity', lat: 34.7378, lon: -86.6662, spawn: [34.73550, -86.66350], alt: 70 },
    { name: 'Stovehouse', lat: 34.72109, lon: -86.61279, spawn: [34.71960, -86.61050], alt: 60 },
    { name: 'Campus 805', lat: 34.72095, lon: -86.60709, spawn: [34.71940, -86.60500], alt: 60, addr: "2610 West Clinton Avenue" },
    { name: 'Five Points', lat: 34.7387, lon: -86.57694, spawn: [34.73700, -86.57450], alt: 60 },
    { name: 'Hampton Cove', lat: 34.672, lon: -86.47, spawn: [34.6760, -86.4660], alt: 90 },
    { name: 'Toyota Field', lat: 34.684126, lon: -86.724604, spawn: [34.68200, -86.72280], alt: 75 },
    { name: 'Wicks Family Field', lat: 34.699818, lon: -86.588739, spawn: [34.69790, -86.58650], alt: 70 },
    { name: 'Madison Main St', lat: 34.6993, lon: -86.7483, spawn: [34.69750, -86.74600], alt: 60 },
    { name: 'Clift Farm', lat: 34.75336, lon: -86.75918, spawn: [34.75150, -86.75700], alt: 65 },
    { name: 'Village of Providence', lat: 34.75398, lon: -86.69278, spawn: [34.75220, -86.69060], alt: 60 },
  ],
  pois: {
    // Real Starbucks locations across Huntsville/Madison for the STARBUCKS RUN hunt
    // + tour. Nominative reference to real places — no logo used.
    //
    // Sources (2026-08): standalone cafes from OpenStreetMap (amenity=cafe,
    // name=Starbucks). Licensed in-store counters are NOT in OSM and were each
    // confirmed against the host brand's own listings before being added —
    // Target's Alabama Starbucks-capability directory, Starbucks' own store pages
    // for the two Krogers (stores 19357 and 1015848), and Food City's published
    // store spec, which puts a Starbucks kiosk in every Huntsville store.
    // Publix is deliberately absent: it runs its own coffee bars, not Starbucks.
    // The Winchester Road NE store (2191 Winchester Rd) is real but sits ~1.8 km outside
    // the playable border in src/border.js, so it is omitted — a coin nobody can reach
    // makes the run uncompletable. scripts/validate-data.mjs enforces this.
    //
    // `addr` (this list and the other coin/hunt lists below): street addresses from
    // OSM addr:* tags where the POI carries them, otherwise Nominatim reverse
    // geocode (2026-08). Only addresses that resolved to a house number are kept —
    // a bare road name is the case where reverse geocoding fell back to the nearest
    // street, which was wrong often enough not to trust. Entries without a verified
    // address simply have no `addr`; the claim toast falls back to the name.
    starbucks: [
      // standalone cafes
      { name: 'Highway 72 West', lat: 34.75359, lon: -86.74014, addr: "7779 Highway 72 West" },
      { name: 'Madison · Hwy 72', lat: 34.75030, lon: -86.76347 },
      { name: 'MidCity', lat: 34.73979, lon: -86.66650 },
      { name: 'Downtown · Monroe St', lat: 34.72806, lon: -86.58926, addr: "707 Monroe Street Southwest" },
      { name: 'Sivley Road', lat: 34.71977, lon: -86.57863, addr: "101 Sivley Road" },
      { name: 'Airport Road', lat: 34.69148, lon: -86.57460, addr: "800 Airport Road" },
      { name: 'Town Madison', lat: 34.68463, lon: -86.71656, addr: "102 Outfield Drive" },
      { name: 'Madison · Hughes Rd', lat: 34.67121, lon: -86.74981 },
      { name: 'US-431 · Hampton Cove', lat: 34.65719, lon: -86.48140, addr: "6735 US 431" },
      { name: 'South Parkway', lat: 34.64869, lon: -86.56737 },
      { name: 'Memorial Pkwy S', lat: 34.61681, lon: -86.56659, addr: "11709 Memorial Parkway Southwest" },
      { name: 'Village of Providence', lat: 34.75327, lon: -86.69340, addr: "20 Town Center Drive Northwest" },
      // licensed counters inside a host store
      { name: 'Target · University Dr', lat: 34.74110, lon: -86.68210, addr: "6275 University Drive Northwest" },
      { name: 'Target · Carl T Jones', lat: 34.67350, lon: -86.54222, addr: "2750 Carl T Jones Drive Southeast" },
      { name: 'Target · Madison', lat: 34.74882, lon: -86.75636, addr: "8207 US Highway 72 West" },
      { name: 'Kroger · University Dr', lat: 34.75701, lon: -86.71187, addr: "7090 University Drive Northwest" },
      { name: 'Kroger · Wall Triana', lat: 34.70792, lon: -86.74821, addr: "4579 Wall Triana Highway" },
      { name: 'Food City · Governors Dr', lat: 34.72074, lon: -86.61585 },
      { name: 'Food City · Old Gurley Rd', lat: 34.77037, lon: -86.53589, addr: "150 Old Gurley Road Northeast" },
    ],
    // Craft breweries + taprooms across Huntsville/Madison (coordinates verified via
    // OSM Nominatim). Powers the CRAFT BEER RUN. Real places, nominative reference only.
    breweries: [
      { name: 'Straight to Ale', lat: 34.72095, lon: -86.60709, addr: "2610 West Clinton Avenue" },        // Campus 805
      { name: 'Yellowhammer Brewery', lat: 34.72200, lon: -86.60569, addr: "2600 West Clinton Avenue" },   // Campus 805
      { name: 'Innerspace Brewing', lat: 34.72261, lon: -86.60414, addr: "2414 Hicks Avenue Northwest" },
      { name: 'The Brewers Cooperative', lat: 34.72109, lon: -86.61232, addr: "3414 Governors Drive Southwest" },// Stovehouse
      { name: 'Green Bus Brewing', lat: 34.73015, lon: -86.58393, addr: "206 Eustis Avenue Southeast" },      // Downtown
      { name: 'Back Forty Beer Co.', lat: 34.68989, lon: -86.59380, addr: "3254 Leeman Ferry Road Southwest" },    // Leeman Ferry
      { name: 'Old Black Bear Brewing', lat: 34.69332, lon: -86.74847, addr: "210 Main Street" }, // Madison Main St
      { name: 'Rocket Republic Brewery', lat: 34.67280, lon: -86.77402, addr: "289 Production Avenue" },// Madison
    ],
    // Bowling alleys, pickleball courts, and hospitals (OSM) — the BOWLING RUN,
    // PICKLEBALL RUN, and ER RUN hunts. Real locations; nominative reference only.
    bowling: [
      { name: 'AMF Pin Palace Lanes', lat: 34.74557, lon: -86.60354, addr: "2006 Country Club Avenue Northwest" },
      { name: 'Stars and Strikes', lat: 34.73781, lon: -86.66123, addr: "930 Old Monrovia Road Northwest" },
      { name: 'Madison Bowling Center', lat: 34.74671, lon: -86.77607, addr: "8661 US 72" },
    ],
    pickleball: [
      { name: 'The Picklr', lat: 34.74147, lon: -86.67355, addr: "6123 University Drive Northwest" },
      { name: 'Town Madison Courts', lat: 34.67043, lon: -86.74566 },
      { name: 'Town Madison Wellness', lat: 34.67132, lon: -86.74591, addr: "190 Graphics Drive" },
    ],
    // Major + minor hospitals across Huntsville/Madison (the ER RUN).
    hospitals: [
      { name: 'Huntsville Hospital', lat: 34.72058, lon: -86.58184, addr: "101 Sivley Road Southwest" },
      { name: 'Huntsville Hospital for Women & Children', lat: 34.72064, lon: -86.57462, addr: "245 Governors Drive Southeast" },
      { name: 'Crestwood Medical Center', lat: 34.69411, lon: -86.57250, addr: "1 Hospital Drive Southwest" },
      { name: 'Madison Hospital', lat: 34.74756, lon: -86.76462, addr: "8375 US 72" },
      { name: 'Unity Psychiatric Care', lat: 34.75331, lon: -86.66528, addr: "5315 Millennium Drive Northwest" },
    ],
    // Golf courses (OSM Nominatim geocode, 2026-08). Used by the 'Find the Golf' mode.
    // `id` keys into public/golf/holes.json for GOLF mode. Only the course whose id
    // has an entry there is playable; the rest are still hunt/tour targets, and golf
    // mode says so rather than warping the player to a different course.
    golfCourses: [
      { id: 'huntsville-cc', name: 'Huntsville Country Club', lat: 34.74602, lon: -86.61606, addr: "2601 Golf Club Lane Northwest" },
      { id: 'the-ledges', name: 'The Ledges', lat: 34.67177, lon: -86.51997, addr: "35 Castle Down Drive" },
      { id: 'valley-hill-cc', name: 'Valley Hill Country Club', lat: 34.65712, lon: -86.54341, addr: "8300 Willowbrook Drive Southeast" },
      { id: 'sunset-landing', name: 'Sunset Landing', lat: 34.65647, lon: -86.77657 },
      { id: 'rtj-hampton-cove', name: 'RTJ Hampton Cove', lat: 34.66500, lon: -86.47500, addr: "2523 Audubon Lane" },
    ],
  },
  /**
   * Sponsored time-trial ring races. Fly/drive/run from the start beacon through
   * each checkpoint ring. Local best times persist; every finish is an analytics
   * event a sponsor can be shown. Add races (and a `sponsor` line) below.
   */
  races: [
    {
      id: 'stovehouse-sprint', name: 'STOVEHOUSE SPRINT', color: '#4fd8ff', sponsor: null,
      points: [[34.730257, -86.585058], [34.727363, -86.587907], [34.720948, -86.607094], [34.721089, -86.612785]],
    },
    {
      id: 'rocket-run', name: 'ROCKET RUN', color: '#ffe066', sponsor: null,
      points: [[34.730257, -86.585058], [34.723, -86.615], [34.7166, -86.6353], [34.711362, -86.654611]],
    },
    // ---- Trench runs: real transmission corridors cut through the mountains
    // (routes from OSM power=line, trimmed to the play area). Each is named for the
    // area it starts in, ~12 gates. Fly the cut: wall gates to weave, timed.
    {
      id: 'trench-chapman', name: 'CHAPMAN MOUNTAIN TRENCH RUN', color: '#4fd8ff', sponsor: null, trench: true,
      points: [
        [34.79476, -86.52264], [34.78226, -86.51651], [34.76983, -86.50639], [34.75997, -86.49847],
        [34.74915, -86.48917], [34.73619, -86.48756], [34.72124, -86.49268], [34.70829, -86.49335],
        [34.69339, -86.49468], [34.67772, -86.49773], [34.66411, -86.49893], [34.64239, -86.51334],
      ],
    },
    {
      id: 'trench-hampton', name: 'HAMPTON COVE TRENCH RUN', color: '#7fffd4', sponsor: null, trench: true,
      points: [
        [34.65673, -86.48241], [34.66038, -86.47148], [34.66254, -86.45319], [34.67338, -86.44379],
        [34.68470, -86.43533], [34.69341, -86.42633], [34.69655, -86.40911], [34.70265, -86.39527],
        [34.71641, -86.40749], [34.72956, -86.42113], [34.73974, -86.43826], [34.74996, -86.45862],
      ],
    },
    {
      id: 'trench-maysville', name: 'MAYSVILLE TRENCH RUN', color: '#9d8cff', sponsor: null, trench: true,
      points: [
        [34.72232, -86.30569], [34.71896, -86.32189], [34.71523, -86.33988], [34.71143, -86.35800],
        [34.70743, -86.37552], [34.70486, -86.38719], [34.70459, -86.40193], [34.70396, -86.41694],
        [34.70311, -86.43475], [34.70257, -86.45317], [34.70202, -86.47269], [34.70113, -86.49405],
      ],
    },
    {
      id: 'trench-jones', name: 'JONES VALLEY TRENCH RUN', color: '#ff9e5e', sponsor: null, trench: true,
      points: [
        [34.72253, -86.59135], [34.71322, -86.58774], [34.69904, -86.58273], [34.68993, -86.58078],
        [34.67764, -86.57659], [34.67271, -86.58650], [34.66936, -86.60313], [34.68815, -86.60979],
        [34.69760, -86.60944], [34.70707, -86.60731], [34.71464, -86.60284], [34.72258, -86.59150],
      ],
    },
    // ---- Rail run: the Norfolk Southern "Memphis District East End" main line — the real
    // active freight track east of the city. Geometry from OSM railway=rail: 7 contiguous
    // ways chained into one 14.2 km corridor, resampled to 12 evenly spaced gates. Same
    // gate treatment as the power-line trenches above.
    {
      id: 'rail-memphis', name: 'MEMPHIS DISTRICT RAIL RUN', color: '#ffd166', sponsor: null, trench: true,
      points: [
        [34.71182, -86.40175], [34.72076, -86.41072], [34.7297, -86.4197], [34.73866, -86.42865],
        [34.74703, -86.4383], [34.7534, -86.45007], [34.7598, -86.46183], [34.76619, -86.47359],
        [34.77258, -86.48535], [34.7749, -86.49862], [34.7739, -86.51267], [34.777, -86.52524],
      ],
    },
  ],
  /**
   * Named districts/neighbourhoods. Entering one shows the zone caption and logs
   * an analytics event. Centers geocoded via OSM Nominatim; radius in metres.
   */
  districts: [
    { name: 'Downtown Huntsville', lat: 34.7304, lon: -86.5861, r: 700 },
    { name: 'Five Points', lat: 34.7387, lon: -86.57694, r: 700 },
    { name: 'Twickenham Historic District', lat: 34.72925, lon: -86.57898, r: 500 },
    { name: 'Old Town', lat: 34.73576, lon: -86.58051, r: 450 },
    { name: 'Blossomwood', lat: 34.72446, lon: -86.56691, r: 800 },
    { name: 'Monte Sano', lat: 34.73117, lon: -86.5149, r: 2800 },
    { name: 'Hampton Cove', lat: 34.68753, lon: -86.47989, r: 3000 },
    { name: 'Jones Valley', lat: 34.61781, lon: -86.54077, r: 1800 },
    { name: 'South Huntsville', lat: 34.64234, lon: -86.5764, r: 3000 },
    { name: 'Lowe Mill / West Huntsville', lat: 34.71533, lon: -86.59704, r: 900 },
    { name: 'Campus 805', lat: 34.72095, lon: -86.60709, r: 500 },
    { name: 'Stovehouse District', lat: 34.72109, lon: -86.61279, r: 400 },
    { name: 'MidCity District', lat: 34.7378, lon: -86.6662, r: 1000 },
    { name: 'Cummings Research Park', lat: 34.72583, lon: -86.68355, r: 2200 },
    { name: 'Bridge Street', lat: 34.7163, lon: -86.6732, r: 800 },
    { name: 'Village of Providence', lat: 34.7541, lon: -86.6931, r: 900 },
    { name: 'US Space & Rocket Center', lat: 34.7114, lon: -86.6546, r: 800 },
    { name: 'Madison', lat: 34.6993, lon: -86.7483, r: 4000 },
    { name: 'Toyota Field / Town Madison', lat: 34.6841, lon: -86.7246, r: 1200 },
  ],
  // Toyota Field had a roundel too (raccoon motif, 'TOYOTA FIELD / TOWN MADISON')
  // and it read as a coin sitting on the outfield, so it came out (2026-09-06).
  fieldDecals: [
    {
      id: 'wicks-family-field',
      lat: 34.6998184, lon: -86.5887388,
      radius: 22, heading: -0.15,
      color: AMBER, accent: GREEN, motif: 'ball',
      top: 'WICKS FAMILY FIELD', bottom: 'JOE DAVIS STADIUM',
    },
  ],
  /**
   * Named guided tours. Each is a list of stops (lat/lon + name). Points are
   * resolved to scene space at run time. Add tours by appending here.
   */
  tours: [
    { id: 'landmarks', name: 'GRAND TOUR', stops: [
      ['Courthouse Square', 34.730257, -86.585058],
      ['Big Spring Park', 34.729, -86.5892],
      ['Von Braun Center', 34.726905, -86.59102],
      ['Orion Amphitheater', 34.73405, -86.6684],
      ['US Space & Rocket Center', 34.7100, -86.6556],
      ['Bridge Street', 34.716323, -86.673156],
      ['Toyota Field', 34.684126, -86.724604],
    ]},
    { id: 'space', name: 'SPACE & ROCKETS', stops: [
      ['US Space & Rocket Center', 34.7100, -86.6556],
      ['Saturn V', 34.7100, -86.6556],
      ['Von Braun Center', 34.726905, -86.59102],
      ['Courthouse Square', 34.730257, -86.585058],
    ]},
    { id: 'downtown', name: 'DOWNTOWN', stops: [
      ['Courthouse Square', 34.730257, -86.585058],
      ['Big Spring Park', 34.729, -86.5892],
      ['Twickenham', 34.72925, -86.57898],
      ['Five Points', 34.7387, -86.57694],
      ['Von Braun Center', 34.726905, -86.59102],
    ]},
    { id: 'entertainment', name: 'EAT & PLAY', stops: [
      ['MidCity / Orion', 34.73405, -86.6684],
      ['Campus 805', 34.72095, -86.60709],
      ['Stovehouse', 34.72109, -86.61279],
      ['Bridge Street', 34.716323, -86.673156],
      ['Toyota Field', 34.684126, -86.724604],
    ]},
    { id: 'nature', name: 'SCENIC', stops: [
      ['Big Spring Park', 34.729, -86.5892],
      ['Monte Sano', 34.73117, -86.5149],
      ['Hampton Cove Entrance', 34.672, -86.47],
      ['Toyota Field', 34.684126, -86.724604],
    ]},
  ],
  // Storefront cards: downtown independents plus the Bridge Street tenants.
  shops: SHOPS,
  interiors: [
    {
      id: 'clinton-row',
      name: 'Clinton Row',
      lat: 34.7307, lon: -86.5860,
      facing: 180,                       // door's outward normal; the player enters facing north
      layout: 'clinton-row',
      blurb: 'Shipping-container shops off Clinton Avenue.',
    },
  ],
  ballparks: [
    {
      id: 'toyota-field',
      name: 'Toyota Field',
      lat: 34.68406, lon: -86.72518,   // home plate
      // Compass bearing from the plate to centre field. INTERIM: 120, triangulated
      // from two play reports, not surveyed. Pin it properly before tuning anything
      // that depends on where balls land.
      //
      // Two earlier values were wrong, both from guessing:
      //   82  derived from the roundel in fieldDecals, assuming a painted roundel
      //       sits on the plate-to-centre line. It does not. Reported in play as
      //       putting the pitch on the third-base line, which is 45 left of centre,
      //       so centre was about 124.
      //   135 taken from "SE". Reported in play as putting the pitch at the second
      //       baseman, who plays about 20 right of centre, so centre was about 115.
      // 120 is the midpoint of those two. It is closer than either but it is still
      // an eyeball estimate.
      //
      // To settle it exactly: stand on the pitcher's mound visible in the tiles and
      // read LAT and LON off the status panel. The bearing from the plate
      // (34.68406, -86.72518) to that point IS this number.
      centerField: 120,
      fence: { line: 100, gap: 112, center: 122, foulAngle: 45 },
      outs: 5,
    },
  ],
  // Local events (Restaurant Week, the shelter run).
  scenarios: SCENARIOS,
  // Curated landmark signs — floating labels over real places, with a camera range.
  landmarks: [
    { name: 'MADISON COUNTY COURTHOUSE', lat: 34.730257, lon: -86.585058, range: 130 },
    { name: 'VON BRAUN CENTER', lat: 34.726905, lon: -86.591020, range: 220 },
    { name: 'WHNT NEWS 19', lat: 34.731529, lon: -86.589828, range: 120 }, // 200 Holmes Ave NW
    { name: 'BIG SPRING PARK', lat: 34.727363, lon: -86.587907, range: 170, height: 30 },
    { name: 'US SPACE & ROCKET CENTER', lat: 34.711362, lon: -86.654611, range: 320, height: 60 },
    { name: 'TOYOTA FIELD — TRASH PANDAS', lat: 34.684126, lon: -86.724604, range: 260, height: 50 },
    { name: 'WICKS FAMILY FIELD — ROCKET CITY FC', lat: 34.6998184, lon: -86.5887388, range: 240, height: 46 },
    { name: 'BRIDGE STREET TOWN CENTRE', lat: 34.716323, lon: -86.673156, range: 260 },
  ],
  // Stealth run: sneak past the ALPR cameras from Big Spring to Old Town.
  ghost: {
    start: [34.72760, -86.58620],   // south end of Big Spring / museum
    target: [34.73540, -86.58120],  // Old Town, north of downtown
  },
};
