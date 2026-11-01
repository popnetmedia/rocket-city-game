/**
 * Home run derby. Stand in at the plate, aim with the mouse, swing on time.
 *
 * Modelled on src/golf.js: enter() returns false with a toast when the data is
 * missing, exit() is idempotent because main.js calls it from two places, and
 * the whole ball flight is simulated on the contact frame then replayed by
 * indexing the point array, which is what lets the trail be one buffer write.
 *
 * Unlike golf this never takes the pointer. Golf must drop pointer lock to read
 * a drag gesture; a timing swing only needs to know WHEN the key went down, so
 * mouse-look stays live and the player aims with it while the pitch is in the
 * air.
 */
import * as THREE from 'three';
import { activeCity, isModeHidden } from './cities/index.js';
import { makeFlightGround, makeSmoothGround } from './minigame/terrain.js';
import { simulate, BASEBALL } from './golf/flight.js';
import { contactFrom, launchFromContact, SWING_WINDOW } from './minigame/contact.js';
import { callIt, sprayLabel } from './minigame/fence.js';
import { makeSign } from './osm.js';
import { analytics } from './analytics.js';

const PLATE_RADIUS = 10;        // how close to the plate the prompt appears, on foot
// Flying over is a legitimate way to start a round, and a 10 m band is a couple of
// frames at flight speed. shops.js hit this first and widened hotels to 130 m for
// exactly the same reason: approached in the air rather than walked past.
const PLATE_FLY_RADIUS = 200;
// Only snap the marker to the ground when close enough that the tiles under it are
// real. shops.js learned this first: terrain far from the player is coarse or not
// loaded at all, and a snap taken from across the city latches a wrong height for
// the session. Toyota Field is 13.7 km from the spawn, so this is not theoretical.
const SNAP_RADIUS = 1800;
const GROUND_PROBE_INTERVAL = 0.6;   // s — re-probe cadence while a round is running
const PITCH_FLIGHT = 0.62;      // seconds from release to the plate, before jitter
const PITCH_JITTER = 0.08;      // +/- fraction of PITCH_FLIGHT, so timing can't be memorised
const PITCH_GAP = 2.2;          // seconds between pitches
const MOUND = 18.44;            // metres, the real distance
const BALL_R = 0.5;             // oversized so it reads at distance, as golf's is
const PLATE_COLOR = 0xffb347;
// Baseball is called in feet. The simulation is metric throughout, like golf's, and
// converts only where a number reaches the player — golf does the same for yards.
const M_TO_FT = 1 / 0.3048;
const feet = (m) => Math.round(m * M_TO_FT);

const cityParks = () => (isModeHidden('derby') ? [] : activeCity().ballparks || []);

export class Derby {
  constructor({ scene, world, hud, player }) {
    this.scene = scene; this.world = world; this.hud = hud; this.player = player;
    this.active = false;
    this.park = null;
    this.nearPlate = null;
    this.outs = 0;
    this.homeRuns = 0;
    this.longest = 0;
    this.onRoundEnd = null;

    this.state = 'idle';        // idle | wind | pitch | flight
    this._t = 0;
    this._flight = null;
    this._flightT = 0;
    this._pitchFlight = PITCH_FLIGHT;   // this pitch's actual flight time, jittered per pitch
    this._groundT = 0;                  // seconds since the plate's height was last re-probed
    this._activePlate = null;           // the plate marker hidden for the current round, if any
    this._tmp = new THREE.Vector3();

    this._flightGround = makeFlightGround(world);
    this._smoothGround = makeSmoothGround(world);

    this.group = new THREE.Group();
    scene.add(this.group);

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }),
    );
    this.ball.visible = false;
    this.ball.raycast = () => {};
    this.group.add(this.ball);

    this.trail = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.5, fog: false }),
    );
    this.trail.visible = false;
    this.trail.raycast = () => {};
    this.group.add(this.trail);

    // Plate markers, projected once. Ground snapping is lazy because the terrain
    // under a plate may not be loaded when the session starts, the same reason
    // shops.js and interior.js snap lazily.
    this.plates = cityParks().map((def) => {
      const p = world.geoToScene(def.lat, def.lon, 0);
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.5, 120, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: PLATE_COLOR, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }),
      );
      post.position.y = 60; post.raycast = () => {};
      const tag = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.6),
        new THREE.MeshBasicMaterial({ color: PLATE_COLOR, fog: false }),
      );
      tag.position.y = 14; tag.raycast = () => {};
      const sign = makeSign(def.name.toUpperCase(), { color: '#ffb347', big: false });
      sign.position.y = 21; sign.scale.multiplyScalar(0.8); sign.material.opacity = 0;
      g.add(post, tag, sign);
      this.group.add(g);
      return { def, grp: g, sign, x: p.x, z: p.z, y: 0, snapped: false };
    });
  }

  /** Lazy ground snap, label fade and the nearest-plate search. Runs outdoors. */
  updatePlates(player) {
    let near = null, nd = Infinity;
    for (const p of this.plates) {
      const d = Math.hypot(player.position.x - p.x, player.position.z - p.z);
      if (!p.snapped && d < SNAP_RADIUS) {
        const hit = this.world.groundBelow(this._tmp.set(p.x, 400, p.z), 2000, true);
        if (hit) { p.grp.position.y = hit.point.y; p.y = hit.point.y; p.snapped = true; }
      }
      const target = d < 70 ? 1 : d < 220 ? (220 - d) / 150 : 0;
      p.sign.material.opacity += (target - p.sign.material.opacity) * 0.15;
      p.sign.visible = p.sign.material.opacity > 0.03;
      // Horizontal distance only, so altitude never blocks the prompt: you are
      // over the park whether you are 5 m up or 300.
      const reach = player.flying ? PLATE_FLY_RADIUS : PLATE_RADIUS;
      if (d < reach && d < nd) { nd = d; near = p; }
    }
    this.nearPlate = near;
    return near;
  }

  /** The bearing, in flight.js's convention, that the player is aiming down. */
  _aimHeading() { return -this.player.yaw; }

  /** Current aim in degrees off centre field, signed left-negative, matching
   *  the convention callIt and sprayLabel already use for where a ball landed. */
  aimOffCentre() {
    if (!this.park) return 0;
    let off = (this._aimHeading() * 180) / Math.PI - this.park.def.centerField;
    while (off > 180) off -= 360;
    while (off < -180) off += 360;
    return off;
  }

  /**
   * What the player is aiming at, for the prompt at the plate.
   *
   * Turning to face the gap is the ONLY way to reach a corner. Spray from
   * mistiming caps at SPRAY_SPREAD, and buying the full 34 degrees of it costs a
   * swing 90% of the way to the edge of the window, which drops the launch angle
   * to 6 degrees and the exit speed to 24 m/s: a 66 ft dribbler where an aimed,
   * well-timed ball to the same spot goes 416. So a player pulling for left field
   * gets grounders forever and nothing explains why. This is that explanation.
   */
  aimText() {
    if (!this.park) return '';
    const off = this.aimOffCentre();
    const foul = Math.abs(off) > this.park.def.fence.foulAngle;
    return `AIM ${sprayLabel(off)}${foul ? ' \u2014 FOUL GROUND' : ''}`;
  }

  enter(def) {
    if (this.active) return false;
    if (!def?.name || !Number.isFinite(def.centerField) || !def.fence) {
      this.hud.toast('NO FIELD DATA HERE', 2600);
      return false;
    }
    const plate = this.plates.find((p) => p.def.id === def.id);
    // Probe fresh rather than trusting the marker's snap. The marker may have
    // latched its height from far away at a coarse level of detail, and the
    // player standing here is the one thing we know is on the real surface.
    // makeSmoothGround returns 0 when every ray misses, which would put the
    // batter hundreds of metres under the world, so a hit has to be confirmed
    // before its height is believed.
    const px = plate ? plate.x : this.player.position.x;
    const pz = plate ? plate.z : this.player.position.z;
    // The player's own y is only a ground height when they are standing on it.
    // Entering from the air, it is their altitude, which would hang the plate
    // hundreds of metres up: the underground batter bug, upside down. Fall back
    // to the marker's own snapped height instead, and refuse the round outright
    // rather than build a strike zone in the sky.
    const probe = this.world.groundBelow(this._tmp.set(px, 600, pz), 2000, true);
    let groundY;
    if (probe) groundY = this._smoothGround(px, pz);
    else if (plate?.snapped) groundY = plate.y;
    else if (!this.player.flying) groundY = this.player.position.y;
    else {
      this.hud.toast('FIELD NOT LOADED YET — FLY LOWER', 2600);
      return false;
    }
    this.park = { def, x: px, z: pz, y: groundY };
    this._groundT = 0;

    // The 120 m post and its label are only useful for finding the plate from a
    // distance. Once a round is running they'd sit frozen between the camera and
    // every incoming pitch, so hide the marker for the active park until exit().
    this._activePlate = plate || null;
    if (plate) plate.grp.visible = false;

    this.outs = def.outs ?? 5;
    this.homeRuns = 0;
    this.longest = 0;
    this.active = true;
    this.state = 'wind';
    this._t = 0;

    // Face centre field. Player yaw is the mirror of the flight bearing.
    this.player.placeAt(this._tmp.set(this.park.x, groundY + 0.1, this.park.z), {
      yaw: -((def.centerField * Math.PI) / 180),
    });

    this.hud.toast(`${def.name.toUpperCase()}\n${this.outs} OUTS — SWING ON TIME`, 3600);
    analytics.track('derby_enter', { name: def.name });
    return true;
  }

  exit() {
    if (!this.active && !this.park) return;
    this.active = false;
    this.park = null;
    this.state = 'idle';
    this._flight = null;
    this.ball.visible = false;
    this.trail.visible = false;
    if (this._activePlate) { this._activePlate.grp.visible = true; this._activePlate = null; }
    this.hud.setDerby(null);
  }

  update(dt, input) {
    if (!this.active || !this.park) return;
    this._t += dt;

    this.hud.setDerby({
      park: this.park.def.name,
      outs: this.outs,
      homeRuns: this.homeRuns,
      longest: this.longest,
    });

    // Re-probe the plate while the round runs. Google's tiles keep refining under
    // your feet, so a height taken once at entry drifts: golf re-probes its ball
    // and pin on the same cadence and for the same reason. Correct the player too,
    // since placeAt asserts they are grounded rather than verifying it, so nothing
    // else will notice the surface has moved.
    this._groundT += dt;
    if (this._groundT >= GROUND_PROBE_INTERVAL) {
      this._groundT = 0;
      const hit = this.world.groundBelow(this._tmp.set(this.park.x, 600, this.park.z), 2000, true);
      if (hit) {
        const g = this._smoothGround(this.park.x, this.park.z);
        if (Math.abs(g - this.park.y) > 0.05) {
          this.park.y = g;
          this.player.position.y = g;
              }
      }
    }

    if (this.state === 'wind') {
      if (this._t >= PITCH_GAP) {
        this.state = 'pitch';
        this._t = 0;
        // A small random variation in speed so the timing window cannot be
        // memorised as a metronome. Stored once per pitch: the swing's timing
        // error and the no-swing timeout below both have to read the same
        // value the ball's own position used, or the window won't match the ball.
        this._pitchFlight = PITCH_FLIGHT * (1 + (Math.random() * 2 - 1) * PITCH_JITTER);
      }
      return;
    }

    if (this.state === 'pitch') {
      // The pitch is scripted, not simulated: the player only needs to read its
      // timing, and a simulated pitch would buy nothing but jitter beyond the
      // per-pitch speed variation already folded into this._pitchFlight.
      const flight = this._pitchFlight;
      const k = Math.min(1, this._t / flight);
      const h = (this.park.def.centerField * Math.PI) / 180;
      const fromX = this.park.x + Math.sin(h) * MOUND;
      const fromZ = this.park.z - Math.cos(h) * MOUND;
      this.ball.visible = true;
      this.ball.position.set(
        fromX + (this.park.x - fromX) * k,
        this.park.y + 1.8 - 0.9 * k * k,
        fromZ + (this.park.z - fromZ) * k,
      );

      if (input.justPressed('Space')) {
        this._swing(this._t - flight);
        return;
      }
      if (this._t > flight + SWING_WINDOW) {
        this.hud.toast('STRIKE — NO SWING', 1600);
        this._out();
      }
      return;
    }

    if (this.state === 'flight') {
      this._flightT += dt;
      const pts = this._flight.points;
      const i = Math.min(pts.length - 1, Math.floor(this._flightT * 120));
      const p = pts[i];
      this.ball.position.set(p.x, p.y + BALL_R, p.z);
      if (i >= pts.length - 1) this._settle();
    }
  }

  _swing(errorSec) {
    const c = contactFrom(errorSec);
    if (c.missed) {
      this.hud.toast('SWING AND A MISS', 1600);
      this._out();
      return;
    }

    const heading = this._aimHeading();
    const { vel, spin } = launchFromContact(c, heading);
    const origin = { x: this.park.x, y: this._smoothGround(this.park.x, this.park.z) + 1.1, z: this.park.z };
    this._flightGround.seed(origin.x, origin.z, origin.y);
    this._flight = simulate(origin, vel, spin, (x, z, y) => this._flightGround(x, z, y), BASEBALL);
    this._flightT = 0;
    this.state = 'flight';

    const pts = this._flight.points;
    const arr = new Float32Array(pts.length * 3);
    pts.forEach((q, i) => { arr[i * 3] = q.x; arr[i * 3 + 1] = q.y + BALL_R; arr[i * 3 + 2] = q.z; });
    this.trail.geometry.dispose();
    this.trail.geometry = new THREE.BufferGeometry();
    this.trail.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.trail.visible = true;
  }

  _settle() {
    const def = this.park.def;
    // Spray angle relative to centre field, in degrees, signed. Measured at
    // first bounce (`land`), not the post-roll rest spot — roll can drift the
    // ball sideways well after the carry that decided fair/foul/home-run was
    // set, which would point the bearing somewhere the ball never actually flew.
    // land can be null only if simulate() never found ground within MAX_T,
    // which a derby swing's real trajectories never do; rest is the fallback.
    const land = this._flight.land ?? this._flight.rest;
    const dx = land.x - this.park.x;
    const dz = land.z - this.park.z;
    const bearing = Math.atan2(dx, -dz) * 180 / Math.PI;
    let off = bearing - def.centerField;
    while (off > 180) off -= 360;
    while (off < -180) off += 360;

    const call = callIt(this._flight.carry, off, def.fence);
    const ft = feet(this._flight.carry);
    const where = sprayLabel(off);

    if (call === 'HOME RUN') {
      this.homeRuns++;
      this.longest = Math.max(this.longest, ft);
      this.hud.toast(`HOME RUN — ${ft} FT, ${where}`, 2600);
      this._next();
      return;
    }
    if (call === 'FOUL') {
      // A foul costs nothing, as in a real derby. It also means a player can
      // stall down the line, which is a deliberate trade for not punishing a
      // near miss.
      this.hud.toast(`FOUL — ${ft} FT, ${where}`, 1800);
      this._next();
      return;
    }
    this.hud.toast(`IN PLAY — ${ft} FT, ${where}`, 1800);
    this._out();
  }

  _out() {
    this.outs--;
    if (this.outs <= 0) { this._finish(); return; }
    this._next();
  }

  _next() {
    this.ball.visible = false;
    this.trail.visible = false;
    this.state = 'wind';
    this._t = 0;
  }

  _finish() {
    const hr = this.homeRuns, longest = this.longest, name = this.park.def.name;
    this.exit();
    this.onRoundEnd?.({ name, homeRuns: hr, longest });
  }

  markers() {
    return this.plates.map((p) => ({ x: p.x, z: p.z, kind: 'derby' }));
  }
}
