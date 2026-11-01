import * as THREE from 'three';
import { activeCity } from './cities/index.js';
import { BASE_FOG_DENSITY } from './constants.js';

/**
 * Live sky: the active city's local time drives the sun position, sky/fog color, and
 * lighting; real weather (NWS, keyless) tints it (clear/cloud/rain/fog) and feeds a
 * HUD readout. Deliberately cheap — per-frame work is a few color lerps; the only
 * network call is one throttled NWS fetch. No particle systems (would be bloat).
 *
 * The origin and weather station are read from activeCity() lazily (inside update()/
 * _fetch()), not captured here at module load, so a second city gets its own sun
 * angle and its own station rather than Huntsville's.
 */
const REFRESH_MS = 10 * 60 * 1000;

// palettes keyed by sun elevation (radians)
// Tiles are unlit daytime imagery, so night is conveyed by a deep-blue sky + a
// dim DOM tint overlay. Kept intentionally moody-but-legible (a "city at dusk")
// rather than near-black, so an evening visitor never sees a dark, broken scene.
const SKY = [
  { el: -0.3, sky: 0x0b1a33, fog: 0x0e1c34, sun: 0x2a3a55, sunI: 0.25, hemiI: 0.45, tint: 0.30 },  // night (deep evening blue)
  { el: -0.08, sky: 0x33385a, fog: 0x40405e, sun: 0xff9a6a, sunI: 0.8, hemiI: 0.7, tint: 0.20 },    // twilight
  { el: 0.05, sky: 0x8fb0d8, fog: 0xd7c7b0, sun: 0xffd9a0, sunI: 1.3, hemiI: 1.1, tint: 0.08 },     // golden
  { el: 0.5, sky: 0x8fb8d8, fog: 0xcfe0ee, sun: 0xfff2dd, sunI: 1.5, hemiI: 1.6, tint: 0.0 },       // day
];

function asColors(stop) {
  return { sky: new THREE.Color(stop.sky), fog: new THREE.Color(stop.fog), sun: new THREE.Color(stop.sun),
    sunI: stop.sunI, hemiI: stop.hemiI, tint: stop.tint };
}
function lerpStops(el) {
  if (el <= SKY[0].el) return asColors(SKY[0]);
  if (el >= SKY[SKY.length - 1].el) return asColors(SKY[SKY.length - 1]);
  let a = SKY[0], b = SKY[1];
  for (let i = 0; i < SKY.length - 1; i++) if (el >= SKY[i].el && el <= SKY[i + 1].el) { a = SKY[i]; b = SKY[i + 1]; break; }
  const t = (el - a.el) / (b.el - a.el || 1);
  const c = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return { sky: c(a.sky, b.sky), fog: c(a.fog, b.fog), sun: c(a.sun, b.sun),
    sunI: a.sunI + (b.sunI - a.sunI) * t, hemiI: a.hemiI + (b.hemiI - a.hemiI) * t, tint: a.tint + (b.tint - a.tint) * t };
}

// compact NOAA solar position -> {elevation, azimuth} radians
function sunPosition(date, lat, lon) {
  const rad = Math.PI / 180;
  const day = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const decl = 23.44 * rad * Math.sin(2 * Math.PI * (day - 81) / 365);
  const ha = ((hour - 12) * 15 + lon) * rad; // hour angle
  const la = lat * rad;
  const el = Math.asin(Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(decl) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { el, az };
}

export class Sky {
  constructor({ scene, sun, hemi, renderer }) {
    this.scene = scene; this.sun = sun; this.hemi = hemi; this.renderer = renderer;
    this.weather = { condition: 'clear', tempF: null, text: '' };
    this.nightOverride = false;   // 'After Dark' — see update()
    this._tint = document.getElementById('night-tint');
    this._nextFetch = 0;
    this._cur = { sky: new THREE.Color(0x8fb8d8), fog: new THREE.Color(0xcfe0ee) };
  }

  async _fetch() {
    try {
      const station = activeCity().weather.station;
      // NWS is US-only, so a city outside it has no station. Without this the URL
      // interpolates to /stations/null/ and asks weather.gov the same meaningless
      // question every refresh forever; the 404 happens to leave the constructor's
      // 'clear' in place, which is the right answer reached the wrong way.
      if (!station) return;
      const url = `https://api.weather.gov/stations/${station}/observations/latest`;
      const r = await fetch(url, { headers: { accept: 'application/geo+json' } });
      if (!r.ok) return;
      const j = await r.json(); const p = j.properties || {};
      const c = (p.temperature?.value != null) ? Math.round(p.temperature.value * 9 / 5 + 32) : null;
      const text = (p.textDescription || '').trim();
      const t = text.toLowerCase();
      let cond = 'clear';
      if (/(rain|shower|drizzle|thunder)/.test(t)) cond = 'rain';
      else if (/(fog|mist|haze)/.test(t)) cond = 'fog';
      else if (/(snow|sleet|ice)/.test(t)) cond = 'snow';
      else if (/(cloud|overcast)/.test(t)) cond = 'cloud';
      this.weather = { condition: cond, tempF: c, text: text || 'Clear' };
    } catch { /* offline: time-of-day still works */ }
  }

  /** Force night regardless of local time. Returns the new state. */
  setNight(on) { this.nightOverride = !!on; return this.nightOverride; }

  update(dt) {
    const now = performance.now();
    if (now >= this._nextFetch) { this._nextFetch = now + REFRESH_MS; this._fetch(); }

    const origin = activeCity().origin;
    const real = sunPosition(new Date(), origin.lat, origin.lon);
    // After Dark forces the sun below the horizon whatever the local time is. The Google
    // tiles are daytime photography and cannot actually be relit, so this is a stylised
    // dusk — the tint overlay darkens them and the city's own signage carries the light.
    const el = this.nightOverride ? -0.18 : real.el;
    const az = real.az;
    const s = lerpStops(el);
    const w = this.weather.condition;
    // weather modifiers
    // Haze is now a multiplier on BASE_FOG_DENSITY rather than a pair of distances,
    // so weather, time of day and the quality tier all compose instead of fighting.
    let fogMul = 1, tint = s.tint, hemiI = s.hemiI, sunI = s.sunI;
    if (w === 'cloud') { fogMul = 1.3; sunI *= 0.7; hemiI *= 0.9; }
    else if (w === 'rain') { fogMul = 2.2; sunI *= 0.4; hemiI *= 0.7; tint += 0.12; }
    else if (w === 'fog') { fogMul = 5.5; sunI *= 0.5; }
    else if (w === 'snow') { fogMul = 2.0; sunI *= 0.8; }

    const k = Math.min(1, dt * 1.5);
    this._cur.sky.lerp(s.sky, k); this._cur.fog.lerp(s.fog, k);
    if (this.scene.background?.isColor) this.scene.background.copy(this._cur.sky);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this._cur.fog);
      const target = BASE_FOG_DENSITY * fogMul * (this.scene.userData.fogScale ?? 1);
      this.scene.fog.density += (target - this.scene.fog.density) * k;
    }
    // sun direction from az/el (scene is Y-up ENU-ish; good enough for lighting)
    const r = 500, ce = Math.max(0.02, Math.cos(el));
    this.sun.position.set(Math.sin(az) * ce * r, Math.max(30, Math.sin(el) * r + 40), Math.cos(az) * ce * r);
    this.sun.color.lerp(s.sun, k); this.sun.intensity += (sunI - this.sun.intensity) * k;
    if (this.hemi) this.hemi.intensity += (hemiI - this.hemi.intensity) * k;
    // night/weather tint overlay (cheap DOM, darkens the daytime-baked tiles)
    const tintCap = this.nightOverride ? 0.62 : 0.42;
    if (this._tint) this._tint.style.opacity = String(Math.max(0, Math.min(tintCap, tint)));
  }

  status() {
    const t = this.weather.tempF != null ? `${this.weather.tempF}°F · ` : '';
    return (t + (this.weather.text || 'CLEAR')).toUpperCase();
  }
}
