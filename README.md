# Rocket City

A playable 3D city in the browser. You walk, drive, glide and fly a rocket over real streets
at their real coordinates, streamed live from Google Photorealistic 3D Tiles, with
OpenStreetMap buildings, roads and trees layered on top.

It started as Huntsville, Alabama (the "Rocket City") and now has eight cities: Huntsville,
Chattanooga, Knoxville, Nashville, Orlando, Miami, Anaheim and New York City. Each city is one
module with its own landmarks, races, scavenger hunts and missions. **The main way to
contribute is to add your city.** See [CONTRIBUTING.md](CONTRIBUTING.md).

Stack: Vite and vanilla JavaScript, three.js `0.185.1`, `3d-tiles-renderer` `0.5.2` (NASA-AMMOS)
with `GoogleCloudAuthPlugin`. Static site; the optional multiplayer and leaderboard relay is a
Cloudflare Worker.

## Quickstart

```bash
npm install
npm run dev          # http://localhost:5173
```

No key is needed to start. Without one the game boots a **dev world**: a flat plane, about 36
grey box buildings and a ramp, with a DEV WORLD watermark. Movement, collision,
driving and gliding all run through the same ground raycast as the real tiles, so most gameplay
work can be done offline.

To see the real city, add a Map Tiles key:

```bash
cp .env.example .env     # then set VITE_GOOGLE_TILES_KEY
npm run dev
```

Open `/play` for Huntsville or `/play/<city>` for another city, for example `/play/nashville`.

```bash
npm test             # protocol, data, page and leak checks
npm run build        # production build to dist/
npm run preview      # serve the build
```

## Controls

| Key | Action |
| --- | --- |
| Click canvas | Lock mouse (look). `Esc` releases |
| `W A S D` | Move / drive |
| `Shift` | Sprint |
| `Space` | Jump (handbrake in a car) |
| `C` | Camera: third person, first person, drone |
| `V` | Take or leave the nearest car |
| `H` | Glider (airborne only, jump first) |
| `F` | Fly: fly where you look, `Space` climb, `Shift` boost |
| `E` | Menus and race starts |
| `P` | Cycle character |
| `M` | Mute |
| `Tab` | Hide the HUD (attribution stays) |
| `B` / `K` | City detail (OSM) / camera map layer |
| `G` / `R` | Tile quality / return to the surface |
| `O` | Photo |

## Getting a Google Map Tiles key

### 1. Enable the API and create a key

1. Open [console.cloud.google.com](https://console.cloud.google.com) and pick or create a
   project. **Billing must be enabled** (Map Tiles is a paid API with a monthly free tier).
2. **APIs & Services → Library** → search **Map Tiles API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**. Copy it.

### 2. Restrict the key before you deploy

In **Credentials**, open the key and edit it.

**Application restrictions → Websites (HTTP referrers):**

```
http://localhost:5173/*
http://localhost:4173/*
https://your-domain.com/*
https://*.your-domain.com/*
https://your-project-*.vercel.app/*    # optional: preview deployments
```

**API restrictions → Restrict key** → tick **Map Tiles API** only. Save.

A Map Tiles key is visible in client-side JavaScript by design. The referrer and API
restrictions are what stop it being used elsewhere.

### 3. Set a budget alert and a quota cap

- **Budget alert:** Billing → Budgets & alerts → Create budget, scoped to your project (or to
  Map Tiles API). Pick an amount and email thresholds at 50%, 90% and 100%.
- **Hard cap:** APIs & Services → Enabled APIs → Map Tiles API → Quotas & System Limits. Edit
  requests per day (and per minute) for the 3D Tiles root tileset to a level you are
  comfortable paying for. When the cap is hit Google returns `429` and the game shows a
  *TILE LOAD FAILED* banner instead of a black screen.

Each fresh page load makes one root-tileset request, which is the billed unit for 3D Tiles.

### Built-in cost guard

Three guards are always on (`src/costguard.js`, defaults in `src/constants.js`):

| Guard | Behaviour |
| --- | --- |
| Idle 5 min | No input: tile fetches and the render loop stop, the screen dims. Any input resumes. |
| Session cap 45 min | Cumulative active play ends the session. Reload starts a fresh one. |
| Tab hidden | Fetches and the render loop pause until the tab is visible again. |

Test the idle guard quickly with `VITE_IDLE_MS=5000 npm run dev`.

## Google attribution and terms

Using Photorealistic 3D Tiles requires the **Google logo** on screen while tiles are visible
and the **data-provider attribution** returned with the tiles. The game renders both in the
bottom-left (`#attribution`), fed live from `tiles.getAttributions()`. Do not obscure the logo,
and do not cache or store tile content beyond the session. See the
[Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms) and the
[Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies).

That last rule matters for contributors: **do not commit screenshots, captures or baked models
of Google tiles.** That is why the repo ships no screenshots.

## Features

- **Cars:** parked and AI traffic cars you can take and leave (`src/cars.js`).
- **City detail:** OpenStreetMap footprints become walkable building walls, trees and road
  ribbons near the player, fetched in 600 m cells (`src/osm.js`). `npm run bake:osm` snapshots
  cells to `public/osm/<city>/` so players do not hit the Overpass API.
- **Races:** time-trial ring races with local best times and an optional global leaderboard
  (`src/races.js`).
- **Hunts:** collect every real place of one kind in a city (coffee shops, breweries, bowling
  alleys, hospitals and more), with a counter and leaderboard (`src/collect.js`,
  `src/huntdefs.js`).
- **Scenarios and tours:** stop-by-stop local events and guided flights (`src/scenarios.js`,
  `src/tours.js`).
- **Camera map and Ghost Run:** the DeFlock map of ALPR camera locations, and a stealth run
  across downtown without entering any camera's view cone (`src/alpr.js`, `src/ghostrun.js`).
- **Golf, home run derby, enterable interiors, video screens and per-city characters.**
- **What's on:** ticketed events near the active city from the Ticketmaster Discovery API,
  behind a serverless proxy so the key stays on the server (`api/whats-on.js`). Without a key
  the menu row simply does not appear.
- **Emoji quick chat** in multiplayer. There is no free-text chat to moderate.

## Multiplayer and leaderboards (optional)

Multiplayer is off by default (HUD toggle). It is a position relay only: no accounts, no
persistence, server-assigned callsigns.

| What | Where |
| --- | --- |
| Protocol and room rules (cap 30, 10 Hz, 15 s silent drop) | `server/room.js` |
| Local relay, plain Node `ws` | `server/local.js` → `npm run relay` (ws://localhost:8787) |
| Production relay: Cloudflare Worker + Durable Objects | `server/do.js`, `wrangler.toml` |
| Leaderboards (top 10 per board) | `server/scores.js` |
| Client socket and remote players | `src/net.js`, `src/remotes.js` |

Local two-window test:

```bash
npm run relay          # terminal 1
npm run dev            # terminal 2
```

Open two windows side by side (a background tab is paused by the cost guard) and switch
multiplayer on in both.

Deploy the relay:

```bash
npx wrangler login
npm run relay:deploy   # -> https://rocket-city-relay.<your-subdomain>.workers.dev
```

Then set `VITE_MP_SERVER=wss://rocket-city-relay.<your-subdomain>.workers.dev` in `.env` and in
your host's environment, and rebuild (Vite inlines it). `GET /health` on the worker returns
the room counts.

## Deploying the site

Any static host works. On Vercel:

```bash
vercel link
vercel env add VITE_GOOGLE_TILES_KEY production
vercel env add VITE_MP_SERVER production      # only if you deployed the relay
vercel --prod
```

`vercel.json` sets the build and long-lived caching for `/assets`. The `api/` folder holds the
one serverless function (what's on); set `TICKETMASTER_API_KEY` as a server-side variable if
you want it.

## Project layout

```
index.html, play.html, <city>.html, play/<city>.html
                    home, play pages and city landing pages (generated, see below)
src/main.js         renderer, scene, main loop, camera, modes
src/world.js        TilesRenderer + plugins, local frame, geo <-> scene, ground raycast
src/cities/         one module per city, plus the registry (index.js)
src/player.js       character physics and ground collision
src/vehicle.js      arcade car
src/cars.js         parked and AI traffic cars
src/osm.js          OpenStreetMap buildings, roads, trees, signs
src/races.js, collect.js, huntdefs.js, scenarios.js, tours.js, missions.js
                    game modes
src/costguard.js    idle, hidden-tab and session-cap logic
src/hud.js          HUD, menus, banners, attribution
src/devworld.js     the no-key stand-in world
server/             multiplayer relay and leaderboards (local and Cloudflare)
api/whats-on.js     Ticketmaster proxy (serverless)
scripts/            tests, city scaffolder, page generator, OSM bake, data validator
scripts/templates/  templates for the generated pages
public/osm/         baked OpenStreetMap cells per city
public/alpr/        DeFlock camera locations per city
public/draco/       Draco decoder (Google tiles are Draco-compressed)
```

The city landing pages, the per-city play pages and the home page are generated from
`scripts/templates/` by `npm run cities:sync`. Edit the templates, not the output.
`npm test` fails if the generated pages are out of date.

## License

Code is MIT licensed (see [LICENSE](LICENSE)). Map data and imagery are not covered by that
license: Google 3D Tiles are under Google's terms, OpenStreetMap data is © OpenStreetMap
contributors under the ODbL, and the camera locations come from DeFlock (OSM-derived, ODbL).
See [CREDITS.md](CREDITS.md).
