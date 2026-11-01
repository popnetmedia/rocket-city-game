import * as THREE from 'three';
import { CHARACTERS } from './characters.js';
import { buildCar } from './vehicle.js';

const BUFFER_MS = 150;     // render this far in the past so we always have two samples to lerp
const MAX_SAMPLES = 12;

function tintFor(id) {
  const hue = (id * 137.508) % 360; // golden-angle spread
  return new THREE.Color().setHSL(hue / 360, 0.75, 0.55);
}

function makeLabel(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(4,10,14,0.7)'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#' + color.getHexString(); g.lineWidth = 3; g.strokeRect(2, 2, 252, 60);
  g.font = 'bold 30px Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#' + color.getHexString(); g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1);
  return s;
}

function tintMeshes(root, color) {
  root.traverse((o) => {
    if (o.isMesh && o.material && o.material.color && !o.userData.noTint) {
      o.material = o.material.clone();
      o.material.color.lerp(color, 0.75);
    }
  });
}

class RemotePlayer {
  constructor(parent, info) {
    this.scene = parent;   // RemotePlayers hands us its container group, not the scene
    this.id = info.id;
    this.callsign = info.callsign;
    this.color = tintFor(info.id);
    this.samples = [];         // { t, pos: Vector3, rot }
    this.state = info.state || 'walk';

    this.group = new THREE.Group();
    this.charKey = CHARACTERS[info.char] ? info.char : 'saturn';
    this.astro = CHARACTERS[this.charKey].build();
    this.car = buildCar();

    tintMeshes(this.astro, this.color);
    tintMeshes(this.car, this.color);
    this.label = makeLabel(this.callsign, this.color);
    this.group.add(this.astro, this.car, this.label);
    parent.add(this.group);
    this._pos = new THREE.Vector3();
    this.push(info, performance.now());
    this._applyState();
  }

  push(info, now) {
    if (info.char && CHARACTERS[info.char] && info.char !== this.charKey) {
      // character swap: rebuild the walking mesh
      this.group.remove(this.astro);
      this.astro.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      this.charKey = info.char;
      this.astro = CHARACTERS[this.charKey].build();
      tintMeshes(this.astro, this.color);
      this.group.add(this.astro);
      this._applyState();
    }
    if (!Array.isArray(info.pos)) return;
    this.samples.push({ t: now, pos: new THREE.Vector3(info.pos[0], info.pos[1], info.pos[2]), rot: info.rot || 0 });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    if (info.state && info.state !== this.state) { this.state = info.state; this._applyState(); }
  }

  _applyState() {
    const car = this.state === 'car';
    this.car.visible = car;
    this.astro.visible = !car;
    this.astro.userData.parts.wing.visible = this.state === 'glider';
    this.astro.userData.parts.flame.visible = this.state === 'glider' || this.state === 'fly';
    this.label.position.y = car ? 2.2 : 2.3;
  }

  showEmoji(emoji) {
    // a sprite that rises above this remote player, then fades
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128;
    const g = cvs.getContext('2d'); g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 64, 72);
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(2, 2, 1); spr.position.set(0, 2.8, 0);
    this.group.add(spr);
    spr.userData.born = performance.now();
    (this._emojis ||= []).push(spr);
  }

  update(now) {
    if (this._emojis) for (let i = this._emojis.length - 1; i >= 0; i--) {
      const e = this._emojis[i], age = (now - e.userData.born) / 2000;
      if (age >= 1) { this.group.remove(e); e.material.map.dispose(); e.material.dispose(); this._emojis.splice(i, 1); continue; }
      e.position.y = 2.8 + age * 1.6; e.material.opacity = 1 - age;
    }
    const s = this.samples;
    if (s.length === 0) return;
    const t = now - BUFFER_MS;
    let a = s[0], b = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i].t <= t && s[i + 1].t >= t) { a = s[i]; b = s[i + 1]; break; }
    }
    if (t >= b.t) { a = b; }            // we're ahead of the newest sample: hold it
    const span = b.t - a.t;
    const k = span > 0 ? THREE.MathUtils.clamp((t - a.t) / span, 0, 1) : 1;
    this._pos.lerpVectors(a.pos, b.pos, k);
    this.group.position.copy(this._pos);
    // shortest-path yaw lerp
    let d = b.rot - a.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y = a.rot + d * k;
    // drop samples older than needed
    while (s.length > 2 && s[1].t < t) s.shift();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  }
}

export class RemotePlayers {
  /**
   * One container group, not one scene child per player. Interiors need a single
   * handle to hide every remote avatar while the local player is in a room —
   * the room is built at the door's real-world position, so avatars standing on
   * that street would otherwise be drawn walking through the furniture — and a
   * container also means a player who joins mid-visit inherits the hidden state
   * instead of popping into the room. RemotePlayer only ever calls .add and
   * .remove on what it is handed, so a Group substitutes for the scene.
   */
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'RemotePlayers';
    scene.add(this.group);
    this.players = new Map();
  }

  /** Apply a full state snapshot from the server (list of remote players). */
  apply(list) {
    const now = performance.now();
    const seen = new Set();
    for (const info of list) {
      seen.add(info.id);
      let rp = this.players.get(info.id);
      if (!rp) { rp = new RemotePlayer(this.group, info); this.players.set(info.id, rp); }
      else rp.push(info, now);
    }
    for (const [id, rp] of this.players) if (!seen.has(id)) { rp.dispose(); this.players.delete(id); }
  }

  update() { const now = performance.now(); for (const rp of this.players.values()) rp.update(now); }
  get count() { return this.players.size; }
  callsign(id) { return this.players.get(id)?.callsign; }
  get(id) { return this.players.get(id); }
}
