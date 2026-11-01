/**
 * Video screens standing in the world, at real coordinates.
 *
 * A YouTube embed CANNOT be a WebGL texture. The iframe is cross-origin so its
 * pixels are unreadable, and YouTube's terms separately require the player be
 * visible and unaltered. So the video is not painted onto a mesh; it is a real
 * iframe, transformed into the scene by CSS3DRenderer and composited over the
 * canvas.
 *
 * The cost of that is occlusion: DOM cannot be hidden by WebGL geometry, so a
 * screen would otherwise show through anything between it and the camera. Two
 * gates keep that honest -- a distance limit and a facing test -- and the one
 * screen this was built for sits in open ground at the Meadowlands with nothing
 * tall between it and an approaching player.
 *
 * The iframe is not created until a player is actually in range, so no YouTube
 * request is made for someone who never flies there.
 */
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

/** The element is authored at 720p and scaled to metres, so text stays crisp. */
const PX_W = 1280;
const PX_H = 720;

/** Cosine of the widest angle off the screen's normal that still counts as facing it. */
const FACING_DOT = 0.15;

function embedUrl(id, { muted }) {
  const p = new URLSearchParams({
    autoplay: '1', mute: muted ? '1' : '0', controls: '0', rel: '0',
    playsinline: '1', loop: '1', playlist: id, modestbranding: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
}

export class VideoScreens {
  constructor(scene, world, defs = []) {
    this.world = world;
    this.defs = defs;
    this.scene = new THREE.Scene();
    this.muted = true;
    this.near = null;                 // the screen currently live, if any

    this.renderer = new CSS3DRenderer();
    const el = this.renderer.domElement;
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    // Behind the HUD and deaf to input: pointer lock owns the mouse during play,
    // and an iframe that swallowed clicks would break mouse-look.
    el.style.zIndex = '1';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
    this.resize();

    this.screens = defs.map((def) => ({ def, obj: null, placed: false, pos: new THREE.Vector3() }));
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Build the iframe. Deferred until first approach so nothing loads unasked. */
  _build(s) {
    const wrap = document.createElement('div');
    wrap.style.width = `${PX_W}px`;
    wrap.style.height = `${PX_H}px`;
    wrap.style.background = '#000';
    wrap.style.overflow = 'hidden';
    const frame = document.createElement('iframe');
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.border = '0';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.src = embedUrl(s.def.youtube, { muted: this.muted });
    wrap.appendChild(frame);
    s.frame = frame;

    const obj = new CSS3DObject(wrap);
    // Metres per pixel. The plane's normal is +z, and a bearing of 0 means north,
    // which is -z in this scene, so the rotation that aims it is PI - bearing.
    const m = s.def.w / PX_W;
    obj.scale.set(m, m, m);
    obj.rotation.y = Math.PI - (s.def.facing * Math.PI) / 180;
    s.obj = obj;
    this.scene.add(obj);
  }

  /** Ground under the screen is only knowable once its tiles have streamed in. */
  _place(s) {
    const g = this.world.geoToScene(s.def.lat, s.def.lon, 0, new THREE.Vector3());
    const hit = this.world.groundBelow(new THREE.Vector3(g.x, g.y + 400, g.z), 3000, true);
    if (!hit) return false;
    s.pos.set(g.x, hit.point.y + s.def.agl, g.z);
    s.obj.position.copy(s.pos);
    s.placed = true;
    return true;
  }

  /** Sound needs a user gesture, so this is only ever called from a keypress. */
  toggleSound() {
    this.muted = !this.muted;
    for (const s of this.screens) {
      if (s.frame) s.frame.src = embedUrl(s.def.youtube, { muted: this.muted });
    }
    return !this.muted;
  }

  /**
   * Take every screen off the glass. update() only runs outdoors, and a DOM layer
   * holds its last frame forever unless told otherwise -- without this, stepping
   * into a room leaves a video hanging in the middle of it.
   */
  hide(camera) {
    if (!this.screens.length) return;
    this.near = null;
    for (const s of this.screens) if (s.obj) s.obj.visible = false;
    this.renderer.render(this.scene, camera);
  }

  update(camera, playerPos) {
    if (!this.screens.length) return;   // seven of eight cities have none
    this.near = null;
    for (const s of this.screens) {
      const d = s.placed
        ? s.pos.distanceTo(playerPos)
        : this.world.geoToScene(s.def.lat, s.def.lon, 0, new THREE.Vector3()).distanceTo(playerPos);
      const inRange = d < s.def.range;

      if (inRange && !s.obj) this._build(s);
      if (inRange && s.obj && !s.placed) this._place(s);

      let show = false;
      if (inRange && s.placed) {
        // Facing test: the screen's own normal against the direction from screen to
        // camera. Behind it there is nothing to see, and showing it there is how a
        // DOM layer ends up floating over a stadium you are on the far side of.
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(s.obj.quaternion);
        const toCam = new THREE.Vector3().subVectors(camera.position, s.pos).normalize();
        show = n.dot(toCam) > FACING_DOT;
      }
      if (s.obj) s.obj.visible = show;
      if (show) this.near = s;
    }
    this.renderer.render(this.scene, camera);
  }
}
