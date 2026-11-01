import * as THREE from 'three';
import { activeCity } from './cities/index.js';

/**
 * Ground roundels laid flat on the two real stadium fields in the city.
 *
 * The art is ORIGINAL and drawn procedurally in the game's own neon/CRT sign
 * language (same palette and glow as makeSign() in osm.js) — a raccoon-mask
 * motif over the ballpark, a ball-and-trail motif over the soccer pitch. No
 * club marks, logos, wordmarks or team colors are used or reproduced. Venue
 * and club names appear as plain text: nominative reference to real places,
 * the same rule the STARBUCKS list in constants.js follows.
 *
 * Placement: each decal probes for ground under the field center and settles
 * onto the photogrammetry surface once tiles resolve, then fades in.
 *
 * Coordinates geocoded via OSM Nominatim (2026-08).
 */

const PANEL = 'rgba(4,10,14,0.86)';

/** '#rrggbb' -> 'rgba(r,g,b,a)' so motif fills track the decal's own color. */
const tint = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;


// ---------- canvas art ----------

const SZ = 1024, C = SZ / 2;

/** Text laid around a circular arc, centered on `midAngle`. */
function arcText(g, text, radius, midAngle, size, color, flip = false) {
  g.save();
  g.font = `bold ${size}px Menlo, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 18;
  // Canvas y is down, so angle increases clockwise: along the bottom of the
  // circle that runs right-to-left. Step backwards there to keep reading order.
  const dir = flip ? -1 : 1;
  const gap = size * 0.14;
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + (text.length - 1) * gap;
  let a = midAngle - dir * (total / radius) / 2;
  for (let i = 0; i < text.length; i++) {
    const w = widths[i];
    a += dir * (w / 2) / radius;
    g.save();
    g.translate(C + Math.cos(a) * radius, C + Math.sin(a) * radius);
    g.rotate(a + dir * Math.PI / 2);
    g.fillText(text[i], 0, 0);
    g.restore();
    a += dir * (w / 2 + gap) / radius;
  }
  g.restore();
}

/** Stylized raccoon mask — geometric line art, not any club's mascot. */
function drawRaccoon(g, color, accent) {
  g.save();
  g.translate(C, C - 10);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.strokeStyle = color;

  // ears — small and rounded, set wide (a raccoon's, not a cat's)
  g.lineWidth = 12;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 100, -92);
    g.bezierCurveTo(s * 128, -164, s * 186, -150, s * 178, -70);
    g.stroke();
  }

  // skull: broad across the eyes, tapering to a pointed muzzle
  g.lineWidth = 13;
  g.beginPath();
  g.moveTo(-180, -76);
  g.bezierCurveTo(-198, 16, -156, 70, -78, 100);
  g.bezierCurveTo(-44, 122, -28, 146, 0, 156);
  g.bezierCurveTo(28, 146, 44, 122, 78, 100);
  g.bezierCurveTo(156, 70, 198, 16, 180, -76);
  g.bezierCurveTo(108, -142, -108, -142, -180, -76);
  g.closePath();
  g.stroke();

  // bandit mask — the defining feature: one band, notched over the nose bridge
  g.beginPath();
  g.moveTo(-166, -60);
  g.bezierCurveTo(-118, -100, -46, -84, -20, -34);
  g.lineTo(0, -4);
  g.lineTo(20, -34);
  g.bezierCurveTo(46, -84, 118, -100, 166, -60);
  g.bezierCurveTo(146, 30, 58, 50, 18, 2);
  g.lineTo(0, -14);
  g.lineTo(-18, 2);
  g.bezierCurveTo(-58, 50, -146, 30, -166, -60);
  g.closePath();
  g.fillStyle = tint(color, 0.34);
  g.fill();
  g.lineWidth = 9;
  g.stroke();

  // eyes inside the mask
  g.shadowBlur = 28;
  g.fillStyle = accent;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 92, -26, 30, 25, s * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
  g.fillStyle = '#04100a';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * 92, -26, 11, 0, Math.PI * 2);
    g.fill();
  }

  // muzzle bridge + nose
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeStyle = color;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(0, 18);
  g.lineTo(0, 96);
  g.stroke();
  g.fillStyle = accent;
  g.beginPath();
  g.ellipse(0, 112, 24, 17, 0, 0, Math.PI * 2);
  g.fill();

  // whiskers
  g.lineWidth = 6;
  g.strokeStyle = accent;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(s * 44, 96 + i * 12);
      g.lineTo(s * 130, 74 + i * 26);
      g.stroke();
    }
  }
  g.restore();
}

/** Ball with a rising trail — generic sport motif, not any club's crest. */
function drawBall(g, color, accent) {
  g.save();
  g.translate(C, C + 10);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.shadowColor = color;
  g.shadowBlur = 26;

  // motion streaks fanned below-left, tucking in behind the ball
  g.strokeStyle = accent;
  g.shadowColor = accent;
  g.lineWidth = 11;
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * (0.72 + i * 0.09);   // swept left, clear of the bottom label
    const r0 = 266 - i * 18, r1 = 118;
    const rm = (r0 + r1) / 2;
    g.globalAlpha = 0.8 - i * 0.2;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.quadraticCurveTo(Math.cos(a - 0.07) * rm, Math.sin(a - 0.07) * rm, Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  g.globalAlpha = 1;

  // ball
  g.shadowColor = color;
  g.strokeStyle = color;
  g.lineWidth = 13;
  g.beginPath();
  g.arc(0, 0, 132, 0, Math.PI * 2);
  g.fillStyle = PANEL;            // opaque: hides the trail behind the ball
  g.fill();
  g.fillStyle = tint(color, 0.14);
  g.fill();
  g.stroke();

  // center pentagon
  const pent = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    pent.push([Math.cos(a) * 52, Math.sin(a) * 52]);
  }
  g.lineWidth = 10;
  g.beginPath();
  pent.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.stroke();

  // seams out to the rim
  g.lineWidth = 8;
  for (const [x, y] of pent) {
    const len = Math.hypot(x, y);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo((x / len) * 132, (y / len) * 132);
    g.stroke();
  }
  g.restore();
}

export function roundelCanvas(cfg) {
  const c = document.createElement('canvas');
  c.width = c.height = SZ;
  const g = c.getContext('2d');
  const R = 470;

  // disc
  g.fillStyle = PANEL;
  g.beginPath();
  g.arc(C, C, R, 0, Math.PI * 2);
  g.fill();

  // rings
  g.strokeStyle = cfg.color;
  g.shadowColor = cfg.color;
  g.shadowBlur = 24;
  g.lineWidth = 16;
  g.beginPath();
  g.arc(C, C, R - 10, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 5;
  g.beginPath();
  g.arc(C, C, R - 54, 0, Math.PI * 2);
  g.stroke();

  // radar ticks between the rings
  g.lineWidth = 5;
  g.strokeStyle = cfg.accent;
  g.shadowColor = cfg.accent;
  g.shadowBlur = 12;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * (R - 22), C + Math.sin(a) * (R - 22));
    g.lineTo(C + Math.cos(a) * (R - (long ? 50 : 36)), C + Math.sin(a) * (R - (long ? 50 : 36)));
    g.stroke();
  }
  g.shadowBlur = 0;

  if (cfg.motif === 'raccoon') drawRaccoon(g, cfg.color, cfg.accent);
  else drawBall(g, cfg.color, cfg.accent);

  arcText(g, cfg.top, R - 108, -Math.PI / 2, 62, cfg.color);
  arcText(g, cfg.bottom, R - 104, Math.PI / 2, 46, cfg.accent, true);
  return c;
}

function roundelTexture(cfg) {
  const tex = new THREE.CanvasTexture(roundelCanvas(cfg));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------- placement ----------

/** Stadium roundels belong to the active city. */
const cityFieldDecals = () => activeCity().fieldDecals || [];

export class FieldDecals {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this._tmp = new THREE.Vector3();
    this.decals = cityFieldDecals().map((cfg) => {
      const p = world.geoToScene(cfg.lat, cfg.lon, 0);
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(cfg.radius, 72),
        new THREE.MeshBasicMaterial({
          map: roundelTexture(cfg),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          fog: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = cfg.heading;
      mesh.position.set(p.x, 0, p.z);
      mesh.renderOrder = 4;
      mesh.visible = false;
      mesh.raycast = () => {};
      this.scene.add(mesh);
      return { cfg, mesh, x: p.x, z: p.z, placed: false, fade: 0, nextProbe: 0 };
    });
  }

  update(dt, now = performance.now()) {
    for (const d of this.decals) {
      // Re-probe on a slow cadence rather than latching the first hit. The first
      // successful probe lands on a coarse LOD tile, and the real surface can
      // move by 20m+ as detail streams in — enough to bury a ground decal or
      // leave it hanging in the air. Two raycasts every 1.5s is free, and it
      // also re-corrects when tiles swap LOD again on a later flyover.
      if (now >= d.nextProbe) {
        d.nextProbe = now + 1500;
        this._tmp.set(d.x, 500, d.z);
        const hit = this.world.groundBelow(this._tmp, 2000, true);
        if (hit) {
          d.mesh.position.y = hit.point.y + 0.6;
          if (!d.placed) { d.placed = true; d.mesh.visible = true; }
        }
      }
      if (!d.placed) continue;
      if (d.fade < 1) d.fade = Math.min(1, d.fade + dt / 0.8);
      d.mesh.material.opacity = d.fade * (0.9 + 0.1 * Math.sin(now / 900));
    }
  }

  dispose() {
    for (const d of this.decals) {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.map?.dispose();
      d.mesh.material.dispose();
    }
    this.decals.length = 0;
  }
}
