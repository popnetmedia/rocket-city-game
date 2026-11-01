/**
 * Ground height against streamed photogrammetry, for anything that puts an
 * object on the world's surface.
 *
 * Both of these were written for golf and neither is about golf: they exist
 * because this world's terrain arrives progressively and shifts under you as
 * tile level-of-detail changes. Any minigame that flies a ball or stands a prop
 * on the ground needs exactly these two shapes.
 *
 * Factories, not shared functions: the flight probe holds a one-entry cache, and
 * two modes sharing one cache would poison each other's readings.
 */
import * as THREE from 'three';

// While the object is this far above the last known surface it cannot be
// touching it, so the probe is reused rather than re-cast — but only until it
// has travelled FLIGHT_PROBE_STEP metres, which bounds how far the terrain can
// have risen behind our back. To be missed, ground would have to climb 10 m
// within 4 m horizontally (a 68 degree face); a golf ball's whole apex is only
// ~20-35 m, which is why the clearance is this tight.
//
// These values were derived against a golf ball's flight. A caller whose
// trajectory is a different shape — flatter, faster, longer-ranged — should
// re-check the 68 degree assumption rather than assume it carries over.
export const FLIGHT_PROBE_HIGH = 10;   // m of clearance that licenses reusing a probe
export const FLIGHT_PROBE_STEP = 4;    // m of travel before re-probing anyway

/**
 * One ray, cached. For use inside a flight integrator, which asks thousands of
 * times on a single frame.
 *
 * The probe is skipped while the object is far above the last known surface,
 * capped by horizontal travel so a rising hillside is still seen. Measured on a
 * rolling test terrain with a 25 m ridge: a golf driver went 4365 raycasts to
 * 422 and a lob wedge 2905 to 128, with the resting position identical to the
 * millimetre.
 */
export function makeFlightGround(world) {
  const tmp = new THREE.Vector3();
  const c = { x: 0, z: 0, y: 0, has: false };
  const ground = (x, z, y) => {
    if (c.has && y !== undefined && y - c.y > FLIGHT_PROBE_HIGH
        && Math.hypot(x - c.x, z - c.z) < FLIGHT_PROBE_STEP) return c.y;
    const hit = world.groundBelow(tmp.set(x, 600, z), 2000, true);
    c.x = x; c.z = z; c.has = true;
    if (hit) c.y = hit.point.y;
    return c.y;
  };
  /** Prime the cache position at a launch point without trusting its height. */
  ground.seed = (x, z, y) => { c.x = x; c.z = z; c.y = y; c.has = false; };
  return ground;
}

/**
 * Five rays in a plus pattern, averaged. For placing things where accuracy
 * matters and the call rate is low: a resting ball, a tee, a home plate.
 * Photogrammetry is noisy at the centimetre scale and a single ray under a
 * stationary object visibly jitters.
 */
export function makeSmoothGround(world) {
  const tmp = new THREE.Vector3();
  return (x, z) => {
    let sum = 0, n = 0;
    for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
      const hit = world.groundBelow(tmp.set(x + dx, 600, z + dz), 2000, true);
      if (hit) { sum += hit.point.y; n++; }
    }
    return n ? sum / n : 0;
  };
}
