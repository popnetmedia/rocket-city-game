/**
 * Interior areas: walk through a door on the street into a small hand-dressed
 * room, and walk back out.
 *
 * One scene, never two. grade.render() drives an EffectComposer that captured
 * the scene when it was constructed (src/grade.js:67), so assigning a new
 * THREE.Scene would silently keep rendering the old one. The room is a group in
 * the existing scene, built at the door's ground point, with the streamed tiles
 * hidden while inside.
 *
 * Doors belong to the active city (city.interiors) and default to an empty
 * list. Data presence is the only gate: a city with no interiors has no doors,
 * no markers and no prompts. There is deliberately no boolean to get wrong.
 */
import * as THREE from 'three';
import { activeCity, isModeHidden } from './cities/index.js';
import { makeSign } from './osm.js';
import { buildRoom } from './interior/kit.js';
import { clampInterior, clampToRoom, doorAnchor, doorInset } from './interior/clamp.js';
import { analytics } from './analytics.js';

// How close to be prompted. A shop card opens at 50 m; a door should want you
// actually standing at it, but 6 m was unfindable in a photoreal street — you had
// to be on top of an unlabelled tube before the game admitted it was there.
const DOOR_RADIUS = 14;
const LABEL_NEAR = 70, LABEL_FAR = 220;   // the name fades in across this band
// How close to the door mat you must return to leave. 1.6 m was a spot you had
// to find by accident; there is no marker on the inside of the door.
const EXIT_RADIUS = 3.0;
const DOOR_COLOR = 0xff9ad5;

const cityInteriors = () => (isModeHidden('interior') ? [] : activeCity().interiors || []);

export class Interior {
  /**
   * `hideWhileInside` returns the scene groups that must not be drawn while the
   * player is in a room. It is a callback rather than a list because main.js
   * builds several of those modules after this one, and because the set is read
   * fresh on every entry. Interiors are the only place in the project where two
   * worlds occupy the same coordinates: the room is built at the door's real
   * ground point, so anything standing on that street is standing in the room.
   */
  constructor({ scene, world, hud, player, hideWhileInside = () => [] }) {
    this.scene = scene; this.world = world; this.hud = hud; this.player = player;
    this._hideWhileInside = hideWhileInside;
    this._hidden = [];
    this.active = false;
    this.canExit = false;
    this.nearDoor = null;
    this.room = null;
    this._entering = false;
    this._leftDoorZone = false;
    this._layouts = new Map();
    this._entryPos = new THREE.Vector3();
    this._entryYaw = 0;
    this._doorInside = new THREE.Vector3();
    this._probe = new THREE.Vector3();

    this.group = new THREE.Group();
    scene.add(this.group);

    // Door markers, projected once. Ground snapping happens lazily in
    // updateDoors, the way shops.js does it, because the terrain under a door
    // may not be loaded when the session starts.
    this.doors = cityInteriors().map((def) => {
      const p = world.geoToScene(def.lat, def.lon, 0);
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      // Built to match a shop marker, because the design says a door stands where a
      // shop pillar would. A pillar alone was not enough: at half a shop's height,
      // thinner, with no solid tag and no name, it was invisible against photoreal
      // Huntsville and the first person to try it could not find the door at all.
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.5, 120, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: DOOR_COLOR, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }),
      );
      post.position.y = 60; post.raycast = () => {};

      // A solid dot so the door reads from across the square, exactly as a shop does.
      const tag = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.6),
        new THREE.MeshBasicMaterial({ color: DOOR_COLOR, fog: false }),
      );
      tag.position.y = 14; tag.raycast = () => {};

      const sign = makeSign(def.name.toUpperCase(), { color: '#ff9ad5', big: false });
      sign.position.y = 21;
      sign.scale.multiplyScalar(0.8);
      sign.material.opacity = 0;

      g.add(post, tag, sign);
      this.group.add(g);
      return { def, grp: g, sign, x: p.x, z: p.z, y: 0, snapped: false };
    });
  }

  /** Lazy ground snap plus the nearest-door search. Cheap; runs every frame outdoors. */
  updateDoors(player) {
    let near = null, nd = Infinity;
    for (const d of this.doors) {
      if (!d.snapped) {
        this._probe.set(d.x, 400, d.z);
        const hit = this.world.groundBelow(this._probe, 2000, true);
        if (hit) { d.grp.position.y = hit.point.y; d.y = hit.point.y; d.snapped = true; }
      }
      const dist = Math.hypot(player.position.x - d.x, player.position.z - d.z);

      // Fade the name in as you approach, the way a storefront label does. Without
      // it the marker is a coloured tube with nothing to say what it is.
      if (d.sign) {
        const target = dist < LABEL_NEAR ? 1
          : dist < LABEL_FAR ? (LABEL_FAR - dist) / (LABEL_FAR - LABEL_NEAR) : 0;
        d.sign.material.opacity += (target - d.sign.material.opacity) * 0.15;
        d.sign.visible = d.sign.material.opacity > 0.03;
      }

      if (dist < DOOR_RADIUS && dist < nd) { nd = dist; near = d; }
    }
    this.nearDoor = near;
    return near;
  }

  /**
   * Hide the outdoors, remembering what was already hidden.
   *
   * Restoring the stashed value rather than forcing `true` matters: the B key
   * toggles the OSM overlay off (src/osm.js:170), and a mission cell that has
   * been collected is hidden too. Coming back out must not switch those on.
   */
  _hideOutdoors() {
    this._hidden = [];
    // this.group is the door markers — including this door's own 60 m pink
    // cylinder, which otherwise stands in the middle of the room the door opens.
    for (const o of [this.group, this.world.tiles?.group, ...(this._hideWhileInside() || [])]) {
      if (!o || typeof o.visible !== 'boolean') continue;
      this._hidden.push([o, o.visible]);
      o.visible = false;
    }
  }

  /** Idempotent, so a half-entered room unwinding through exit() is safe. */
  _restoreOutdoors() {
    for (const [o, was] of this._hidden) o.visible = was;
    this._hidden = [];
  }

  async _layout(def) {
    const cityId = activeCity().meta.id;
    const url = `/interiors/${cityId}/${def.layout}.json`;
    if (this._layouts.has(url)) return this._layouts.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const json = await res.json();
    this._layouts.set(url, json);
    return json;
  }

  /**
   * Returns false and toasts on any failure, leaving nothing half-built.
   *
   * The _entering guard matters: this is async, but it is called from the
   * synchronous frame loop, so without it a second E press during the layout
   * fetch would build and add a second room.
   */
  async enter(def) {
    if (this.active || this._entering) return false;
    this._entering = true;
    try {
      // Validate before touching anything, so the documented false-on-failure
      // contract actually holds. Task 9's validator guarantees these fields on
      // shipped data; this covers a hand-edited layout or a future caller.
      if (!def?.name || !def?.layout) {
        this.hud.toast('THIS DOOR IS LOCKED', 2600);
        console.warn('[interior] malformed interior definition', def);
        return false;
      }

      let layout;
      try {
        layout = await this._layout(def);
      } catch (e) {
        this.hud.toast('THIS DOOR IS LOCKED', 2600);
        console.warn('[interior] layout load failed', e);
        return false;
      }

      let built;
      try {
        built = buildRoom(layout, `/interiors/${activeCity().meta.id}/${def.layout}/`);
      } catch (e) {
        this.hud.toast('THIS DOOR IS LOCKED', 2600);
        console.warn('[interior] room build failed', e);
        return false;
      }

      const door = this.doors.find((d) => d.def.id === def.id);
      const groundY = door?.snapped ? door.y : this.player.position.y;
      const ox = door ? door.x : this.player.position.x;
      const oz = door ? door.z : this.player.position.z;

      // Captured BEFORE any mutation, so the catch below can put the player back.
      this._entryPos.copy(this.player.position);
      this._entryYaw = this.player.yaw;

      // Everything past here changes the world. exit() is deliberately written to
      // tolerate a half-entered state, so a throw unwinds through it rather than
      // stranding the player in a room that was never finished.
      try {
        this.room = { ...built, def, layout };
        built.group.position.set(ox, groundY, oz);
        this.scene.add(built.group);

        this.world.pauseFor('interior');
        this._hideOutdoors();
        this.world.pushCollision(built.group);

        // ORDER MATTERS: pushCollision above must run before placeAt. placeAt does
        // not force a ground hit, it only clears the frozen/hover path, so the
        // lost-ground respawn at player.js:328 needs the raycast already pointing
        // at the room floor. Do not reorder these.
        //
        // doorAnchor lives in interior/clamp.js because its sign convention is easy
        // to get wrong and that file is node-testable. See its tests.
        //
        // The inset is measured along the FACING axis, not against the smaller of
        // the two extents: a door on the east wall of a 12 x 9 room is 6 m from
        // the centre, and measuring it against the depth would drop the player
        // 2.5 m inside instead of the intended 1 m. The clampToRoom afterwards
        // keeps a non-cardinal facing from anchoring inside a side wall.
        const inset = doorInset(def.facing, built.size.w, built.size.d, 1.0);
        const { dx, dz, yaw: inYaw } = doorAnchor(def.facing, inset);
        const anchor = { x: dx, z: dz };
        clampToRoom(anchor, built.size.w, built.size.d);
        this._doorInside.set(ox + anchor.x, groundY + 0.1, oz + anchor.z);
        this.player.placeAt(this._doorInside, { yaw: inYaw });

        this.active = true;
        this.canExit = false;
        this._leftDoorZone = false;
        this.hud.setZone(def.name.toUpperCase());
        // What the prompt actually says once you are back on the mat is
        // "E — STEP BACK OUTSIDE" (src/main.js). Walking to the door only arms
        // the exit; the key press is what takes it, so say so.
        this.hud.toast(`${def.name.toUpperCase()}\nRETURN TO THE DOOR AND PRESS E TO LEAVE`, 3200);
        // `name`, not `id`: every other analytics.track call in the project sends
        // `name`, and that is the property the dashboard groups on.
        analytics.track('interior_enter', { name: def.name });
        return true;
      } catch (e) {
        this.hud.toast('THIS DOOR IS LOCKED', 2600);
        console.warn('[interior] entry failed after the room was built', e);
        this.exit();          // tolerates the half-entered state by design
        return false;
      }
    } finally {
      this._entering = false;
    }
  }

  /** Idempotent: main.js calls this from the key handler and from reconciliation. */
  exit() {
    if (!this.active && !this.room) return;
    const room = this.room;
    this.active = false;
    this.canExit = false;
    this._leftDoorZone = false;
    this.room = null;

    this.world.popCollision();
    this._restoreOutdoors();
    this.world.resumeFor('interior');

    if (room) {
      this.scene.remove(room.group);
      room.group.traverse((o) => {
        if (!o.isMesh) return;
        // Drop the BVH before the geometry, the way the tile disposer does at
        // src/world.js:117. pushCollision() called computeBoundsTree on every
        // mesh in this room, so every one of them is carrying an acceleration
        // structure that dispose() alone does not know about.
        o.geometry?.disposeBoundsTree?.();
        o.geometry?.dispose?.();
        // Textures are cached and shared across entries; only the materials go.
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose?.();
      });
    }

    // Deliberately NOT hud.setZone(null): setZone has no null handling and would
    // render the literal string "— null —" (src/hud.js:455). The zone banner is a
    // transient that hides itself after 3.5 s, so there is nothing to clear here.
    this.player.placeAt(this._entryPos, { yaw: this._entryYaw });
  }

  /**
   * Inside: clamp to the room, and track whether the player may leave.
   * The player must step off the mat before the exit is offered, or entering
   * would immediately offer to leave again.
   */
  update(dt, input) {
    if (!this.active || !this.room) return;
    const origin = this.room.group.position;
    const local = { x: this.player.position.x - origin.x, z: this.player.position.z - origin.z };
    if (clampInterior(local, this.room.size, this.room.boxes)) {
      this.player.position.x = origin.x + local.x;
      this.player.position.z = origin.z + local.z;
    }

    const d = Math.hypot(
      this.player.position.x - this._doorInside.x,
      this.player.position.z - this._doorInside.z,
    );
    if (d >= EXIT_RADIUS) this._leftDoorZone = true;
    this.canExit = this._leftDoorZone && d < EXIT_RADIUS;
  }

  markers() {
    return this.doors.map((d) => ({ x: d.x, z: d.z, kind: 'interior' }));
  }
}
