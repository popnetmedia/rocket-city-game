# Contributing

Thanks for helping. The best contribution is a city: your town, built from places you can
source, with games that only make sense there. Bug fixes, new game modes and new characters
are welcome too.

## Set up

```bash
npm install
npm run dev     # http://localhost:5173, works without a Google key (dev world)
npm test        # run before every pull request
```

A Google Map Tiles key (see the README) lets you see the real city. You can build most of a
city without one, but you will want one to check that beacons sit where you think they do.

## Add your city

### 1. Scaffold it

```bash
npm run cities:new -- --id boise --name Boise --region Idaho --region-code ID \
  --lat 43.6150 --lon -116.2023 [--radius 16000]
```

`--lat`/`--lon` is the downtown origin. `--radius` is the playable radius in metres (default
16 km). The scaffolder:

- writes `src/cities/<id>.js` and registers it in `src/cities/index.js`
- looks up the nearest National Weather Service station for the live weather readout
- fetches the real ALPR camera locations inside the radius from DeFlock into
  `public/alpr/<id>.json` (a city with none simply has no camera hunt)
- adds the play page and landing page to `vite.config.js`, `public/sitemap.xml` and the home
  page nav, then renders the pages and runs the data validator

Then do one manual step: add your city id to `CITY_IDS` in `server/do.js`. The multiplayer
relay uses that list as its allowlist, and `npm test` (`scripts/rooms.test.mjs`) fails until
it matches the registry.

The city now boots and flies at `/play/<id>`. Every content list is empty on purpose.

### 2. Fill in the module

A city module is one default-exported object. `src/cities/huntsville.js` is the fullest
example; `src/cities/chattanooga.js` and the others are good smaller ones.

| Key | What it is |
| --- | --- |
| `meta` | `id`, `name`, `region`, `regionCode`, a short `tagline`, the `character` the city flies (see `src/characters.js`), and optional `hiddenModes` |
| `origin` | the scene origin, `{ lat, lon, name }` |
| `spawn` | where the player starts: a point to `look` at, a point to come `from`, and an `alt` |
| `weather` | `{ station }`, the NWS station id |
| `alpr` | path to the city's camera file, or `null` |
| `border` | the playable area as one or more circles (`lobes`), plus `nofly` zones. Shape the lobes to the real city; the scaffolded single circle is a placeholder |
| `presets` | teleport landmarks for the GO ANYWHERE menu |
| `pois` | lists of real places that power the hunts: `starbucks`, `breweries`, `bowling`, `pickleball`, `hospitals`, `golfCourses`, and others defined in `src/huntdefs.js` |
| `races` | ring races: `{ id, name, color, points: [[lat, lon], ...] }` |
| `tours` | guided flights |
| `districts` | named neighbourhoods; entering one shows its name |
| `scenarios` | stop-by-stop local events |
| `landmarks` | always-on signs: `{ name, lat, lon, range, height? }` |
| `shops` | storefront cards: `{ name, lat, lon, blurb, url?, offer? }` |
| `interiors`, `ballparks`, `fieldDecals` | enterable rooms, home run derby fields, stadium roundels |
| `billboard` | an optional image slot; leave `enabled: false` |

Menus only show what a city has data for. An empty list costs nothing. An invented one ships
an objective nobody can reach.

### 3. Make it yours

- **A local flyer.** Huntsville flies a Saturn V, Knoxville the Sunsphere, Nashville a guitar.
  Add a character in `src/characters.js` and set `meta.character`.
- **Hunts.** Fill a `pois` list. Each hunt in `src/huntdefs.js` maps to a list through
  `HUNT_POI`; to add a new kind of hunt, add an entry to both.
- **Races.** A race is a list of gates. Real routes make the best ones: a riverfront, a
  greenway, a power-line cut through the hills.
- **Landmarks and districts** make the city readable from the air.

### 4. Bake the OpenStreetMap cells (optional, recommended)

```bash
CITY=boise MILES=3 npm run bake:osm -- --center-only   # quick: the cells around downtown
CITY=boise MILES=3 npm run bake:osm                    # the full radius, resumable
```

Baked cells land in `public/osm/<id>/` and are served as static files, so players do not hit
the free Overpass API. Keep the radius modest: 3 miles is about 200 cells and 18 MB, and the
count grows with the square of the radius. Unbaked cells fall back to live Overpass.

### 5. Regenerate pages and test

```bash
npm run cities:sync    # re-render the landing, play and home pages from the templates
npm test
```

`scripts/validate-data.mjs` checks every coin, hunt target and race gate against your city's
own border, so an unreachable objective fails the build instead of shipping.

## Data rules

These keep the game honest and keep the project out of trouble.

1. **Every real-world point needs a source.** OpenStreetMap, an official site, or a public
   dataset. Put the source in a comment next to the list, the way `huntsville.js` does. If you
   cannot source a place, leave it out.
2. **No invented business details.** No made-up offers, coupons, hours, prices or ratings.
   Leave `offer` empty unless the business published it.
3. **Respect the licenses.** OpenStreetMap and DeFlock data are ODbL: keep the attribution
   that is already in the HUD and footers. Google 3D Tiles may be streamed but never saved:
   **do not commit screenshots, captures or models made from Google tiles**, and do not use
   Street View or Google imagery as a texture or reference model.
4. **Use place names nominatively.** Naming a real place is fine. Logos and brand artwork are
   not.
5. **Images and models you add must be yours or openly licensed**, with the source and license
   recorded in `CREDITS.md`.

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Generated pages are up to date (`npm run cities:sync`)
- [ ] Every new real-world point has a source comment
- [ ] No Google tile captures, no unlicensed images, no secrets in `VITE_*` variables
- [ ] New city id added to `CITY_IDS` in `server/do.js`
- [ ] New third-party assets listed in `CREDITS.md`

Keep pull requests focused: one city or one feature at a time is easiest to review.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
