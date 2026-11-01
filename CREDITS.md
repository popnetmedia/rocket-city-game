# Credits and data sources

The code in this repository is MIT licensed. The data and third-party files below are not
covered by that license; each keeps its own terms.

## Streamed at runtime (nothing stored in this repo)

| Source | Used for | Terms |
| --- | --- | --- |
| Google Photorealistic 3D Tiles (Map Tiles API) | the 3D city | [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms), [Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies). Streamed only; never cached, captured or redistributed. |
| OpenStreetMap via the Overpass API | buildings, roads and trees for cells that are not baked | © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright) |
| National Weather Service (api.weather.gov) | live weather readout | US government data, public domain |
| Ticketmaster Discovery API | "what's on" events, only when a key is configured | [Ticketmaster API terms](https://developer.ticketmaster.com/support/terms-of-use/) |

## Included in this repo

| Path | What it is | Source and license |
| --- | --- | --- |
| `public/osm/` | baked OpenStreetMap cells per city (`npm run bake:osm`) | © OpenStreetMap contributors, ODbL |
| `public/alpr.json`, `public/alpr/` | ALPR camera locations per city | [DeFlock](https://deflock.me), derived from OpenStreetMap, ODbL |
| `public/draco/` | Draco mesh decoder (Google 3D Tiles are Draco-compressed) | Google Draco, Apache License 2.0, as distributed with three.js |
| `public/interiors/` | enterable room layouts | authored for this project, MIT |
| favicons, app icons, `site.webmanifest` | the rocket icon | designed for this project, MIT |

Place names, coordinates and addresses in `src/cities/*.js` cite their sources in comments next
to each list (mostly OpenStreetMap, official venue and event sites, and public directories).

## Libraries

three.js (MIT), 3d-tiles-renderer (Apache-2.0), three-mesh-bvh (MIT), @vercel/analytics (MIT)
and their dependencies, installed through npm. See `package-lock.json`.

## Adding to this file

Any image, model, texture, sound or dataset you add must be yours or openly licensed. Add a row
with the path, what it is, where it came from and its license.
