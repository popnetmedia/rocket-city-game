import { analytics } from './analytics.js';
import { activeCity } from './cities/index.js';


/** Named districts belong to the active city; a city with none never announces a zone. */
const cityDistricts = () => activeCity().districts || [];

export class Districts {
  constructor(world, onEnter) {
    this.onEnter = onEnter;
    this.current = null;
    this.list = cityDistricts().map((d) => {
      const p = world.geoToScene(d.lat, d.lon, 0);
      return { ...d, x: p.x, z: p.z };
    });
    this._cooldown = new Map();
  }

  update(pos, now = performance.now()) {
    // smallest matching district wins (Five Points inside greater Downtown etc.)
    let best = null;
    for (const d of this.list) {
      const dist = Math.hypot(pos.x - d.x, pos.z - d.z);
      if (dist < d.r && (!best || d.r < best.r)) best = d;
    }
    const name = best ? best.name : null;
    if (name && name !== this.current) {
      const last = this._cooldown.get(name) || -1e9;
      if (now - last > 30000) {
        this._cooldown.set(name, now);
        this.onEnter?.(name);
        analytics.once('district_visited', name);
      }
    }
    this.current = name;
    return name;
  }
}
