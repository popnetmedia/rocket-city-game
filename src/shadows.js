/**
 * Contact shadows for everything that is not tiles.
 *
 * Nothing in this scene cast a shadow, which is the classic photogrammetry tell:
 * cars and people sit ON a photograph rather than IN a city. Real shadow maps are
 * the wrong fix here, because Google's tiles already have shadows baked into their
 * textures and a second set would double up and fight the imagery. A soft blob laid
 * on the ground under each object grounds it for a fraction of the cost and cannot
 * disagree with the baked lighting, because it adds no light of its own.
 *
 * Usage is per-frame and order-free:
 *
 *     shadows.begin();
 *     shadows.add(x, groundY, z, halfWidth, halfDepth, heightAboveGround, headingY);
 *     shadows.end();
 *
 * The pool is reused between frames, so nothing allocates once it is warm.
 */
import * as THREE from 'three';
import { shadowFor } from './render/shadow.js';

/**
 * Metres to lift the quad off the ground. Photogrammetry ground is not flat, so
 * this trades a hair of float on a slope against z-fighting on every flat road,
 * which is far more visible.
 */
const LIFT = 0.08;

/** Below this the blob is invisible anyway, so skip it and keep the slot free. */
const MIN_STRENGTH = 0.015;

/** One soft radial blob, drawn once and shared by every shadow in the scene. */
function blobTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  // A plain linear ramp reads as a dark ring with a hole; weighting the centre
  // keeps the core solid and lets only the rim feather out.
  grd.addColorStop(0.0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.78)');
  grd.addColorStop(0.75, 'rgba(0,0,0,0.28)');
  grd.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

export class ContactShadows {
  constructor(scene, { max = 96, opacity = 0.42 } = {}) {
    this.max = max;
    this.opacity = opacity;
    this.group = new THREE.Group();
    this.group.name = 'contact-shadows';
    scene.add(this.group);

    this.texture = blobTexture();
    // Baked flat once rather than rotating every mesh: after this the quad lies
    // in XZ, so scale.x is its width and scale.z its depth.
    this.geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this._proto = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      // Depth-TESTED but not depth-WRITTEN: a shadow must be hidden by a building
      // in front of it, but must never occlude whatever draws after it.
      depthWrite: false,
      // fog stays on (the default) so distant shadows haze out with everything else.
    });
    this.pool = [];
    this._i = 0;
  }

  /** Call once per frame before any add(). */
  begin() { this._i = 0; }

  /**
   * `halfW`/`halfD` are the caster's footprint half-extents in metres, `height`
   * is its distance above `groundY`, and `rotY` orients the blob (a car's shadow
   * is not a circle). Silently drops once the pool is full: a missing shadow on
   * the 97th car is invisible, a per-frame allocation is not.
   */
  add(x, groundY, z, halfW, halfD, height = 0, rotY = 0) {
    if (!Number.isFinite(groundY)) return;
    const f = shadowFor(height, 1);
    if (f.strength < MIN_STRENGTH) return;
    if (this._i >= this.max) return;

    let m = this.pool[this._i];
    if (!m) {
      m = new THREE.Mesh(this.geometry, this._proto.clone());
      m.renderOrder = 2;
      this.group.add(m);
      this.pool[this._i] = m;
    }
    this._i++;

    m.visible = true;
    m.position.set(x, groundY + LIFT, z);
    m.rotation.y = rotY;
    m.scale.set(halfW * 2 * f.radius, 1, halfD * 2 * f.radius);
    m.material.opacity = this.opacity * f.strength;
  }

  /** Call once per frame after the last add(). */
  end() {
    for (let i = this._i; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  /** Hide every shadow — used when a mode owns the whole view, such as interiors. */
  clear() { this.begin(); this.end(); }

  dispose() {
    for (const m of this.pool) m.material.dispose();
    this.geometry.dispose();
    this.texture.dispose();
    this._proto.dispose();
    this.group.removeFromParent();
    this.pool.length = 0;
  }
}
