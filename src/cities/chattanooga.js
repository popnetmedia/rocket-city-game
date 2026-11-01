/**
 * Chattanooga, Tennessee — a coverage check. Boots the world at Downtown Chattanooga
 * so the project owner can see whether Google photorealistic 3D tiles cover the city.
 *
 * Curated data so far: the DeFlock ALPR camera set (real, sourced). Every poi list is
 * still empty and there are no teleport presets yet.
 * Do not invent coordinates here — add real, sourced data the same way Huntsville's
 * was added (see src/cities/huntsville.js) when this city gets its own content pass.
 */
export default {
  meta: {
    id: 'chattanooga',
    name: 'Chattanooga',
    region: 'Tennessee',
    regionCode: 'TN',                    // postal abbreviation, used in captions and geocoding
    character: 'choochoo',               // default avatar; the player can still switch
    // SEO copy for this city's play page; scripts/sync-city-pages.mjs renders it.
    seo: {
      description: 'Play Rocket City CC in your browser. Fly a rocket over photoreal 3D Chattanooga, Tennessee. Free, no install.',
      ogDescription: 'Fly over Chattanooga, Tennessee in a rocket. Free in your browser.',
      twitterDescription: 'Fly over Chattanooga, Tennessee in a rocket. Free in your browser.',
      imageAlt: 'A rocket flying over a photorealistic 3D city.',
    },
    tagline: 'Scenic City',
    origin: false,
  },
  origin: { lat: 35.0456, lon: -85.3097, name: 'Downtown' },
  spawn: { look: [35.0456, -85.3097], from: [35.0416, -85.3077], alt: 210 },
  // Nearest NWS observation station — drives the live weather readout (keyless API).
  weather: { station: 'KCHA' },
  // 84 real DeFlock ALPR cameras inside the playable lobe, pulled from the same
  // OSM-derived (ODbL) DeFlock region feed Huntsville's set came from. Not invented.
  alpr: '/alpr/chattanooga.json',
  // Playable area: a single lobe around downtown. No restricted airspace mapped yet.
  // Permanent ad slot, top-left on desktop, replacing the wordmark when enabled.
  // Standard horizontal creative — 320x50 by default; a larger size scales to the column
  // and keeps its aspect. Drop the file in public/ads/ and point `image` at it.
  billboard: { enabled: false, image: '', url: '', alt: '', w: 320, h: 50 },
  border: {
    lobes: [
      { lat: 35.0456, lon: -85.3097, r: 16000 },
    ],
    nofly: [],
  },
  presets: [],
  pois: {
    starbucks: [],
    breweries: [],
    bowling: [],
    pickleball: [],
    hospitals: [],
    golfCourses: [],
  },
  interiors: [],                       // TODO: enterable rooms
  ballparks: [],                       // TODO: home run derby fields
};
