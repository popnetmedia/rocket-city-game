/**
 * Golf ball flight. Pure maths — no THREE, no DOM, no randomness.
 *
 * Drag plus Magnus lift from backspin is what makes a golf ball climb, hang and
 * drop steeply; a plain parabola never reads as golf. Sidespin curves it.
 * Ground height comes in as a callback so this module stays testable in node.
 */
// The ball is a parameter. These are the defaults, and they are the golf ball
// this module was originally written for, so a caller passing no opts gets
// exactly the behaviour it always had.
const MASS = 0.0459;          // kg
const RADIUS = 0.02135;       // m
const ROLL_DECEL = 6;         // m/s^2 on fairway
const CD0 = 0.21;             // base drag coefficient — a dimpled ball
const CL_MAX = 0.28;          // lift asymptote at high spin ratio

/** Ready-made option sets. Spread them and override what you need. */
export const GOLF_BALL = { mass: MASS, radius: RADIUS, rollDecel: ROLL_DECEL, cd0: CD0, clMax: CL_MAX };

/**
 * A baseball is not a golf ball with different numbers on the mass and radius.
 * Their ballistic coefficients (area over mass) are within 7% of each other, so
 * those two alone change the carry by under 2 m. What actually separates them is
 * the surface: a golf ball's dimples cut drag and raise lift, which is what the
 * 0.21 and 0.28 defaults encode. A baseball's seams do far less.
 *
 * Calibrated against the real thing: 45 m/s at 28 degrees with 2000 rpm carries
 * 117 m here, against roughly 118 m measured. With the golf coefficients the same
 * strike flew 143 m, which would have made every swing a home run.
 */
export const BASEBALL = { mass: 0.145, radius: 0.0366, rollDecel: 9, cd0: 0.32, clMax: 0.21 };

const RHO = 1.225;            // kg/m^3
const G = 9.81;
const DT = 1 / 120;           // fixed substep — deterministic, frame-rate independent
const MAX_T = 20;             // hard stop, so a bad input can never hang the loop
const RPM_TO_RAD = Math.PI / 30;

export const BALL_SPEED_MAX = 72;   // m/s, driver at full power and clean tempo
export const SIDESPIN_COEFF = 22;   // rpm per (m/s * degree)

const deg = (d) => (d * Math.PI) / 180;

/** Swing + club -> launch velocity and spin. heading is radians, 0 = -z (north). */
export function launchFrom(club, swing, heading) {
  const t = swing.tempo ?? 1;
  const fat = Math.max(0, Math.min(1, 1 - t));
  const thin = Math.max(0, Math.min(1, t - 1));
  const strikeAdjust = 3 * fat - 4 * thin;              // degrees
  const spinAdjust = 1 + 0.15 * fat - 0.35 * thin;

  const speed = BALL_SPEED_MAX * club.speedFactor * swing.power * (0.6 + 0.4 * swing.quality);
  const launch = deg(club.loft + strikeAdjust);
  const horiz = speed * Math.cos(launch);

  return {
    vel: {
      x: horiz * Math.sin(heading),
      y: speed * Math.sin(launch),
      z: -horiz * Math.cos(heading),
    },
    spin: {
      back: club.spin * spinAdjust,
      side: swing.faceAngle * speed * SIDESPIN_COEFF,
    },
  };
}

/**
 * Integrate to rest. `groundAt(x, z, y)` returns terrain height in metres; `y` is
 * the ball's current height, passed so a caller doing real raycasts can skip the
 * probe while the ball is far above the surface (see src/minigame/terrain.js#makeFlightGround).
 * Callers may ignore it — the physics never depends on the extra argument.
 * Returns sampled points, resting position, carry (to first bounce), the
 * landing point at that first bounce (`land`, null if the ball never lands
 * within MAX_T), and apex.
 */
export function simulate(origin, vel, spin, groundAt, opts = {}) {
  const restSpeed = opts.restSpeed ?? 0.6;
  const mass = opts.mass ?? MASS;
  const radius = opts.radius ?? RADIUS;
  const rollDecel = opts.rollDecel ?? ROLL_DECEL;
  const cd0 = opts.cd0 ?? CD0;
  const clMax = opts.clMax ?? CL_MAX;
  const area = Math.PI * radius * radius;
  const p = { ...origin };
  const v = { ...vel };
  const points = [{ ...p }];
  let back = spin.back * RPM_TO_RAD;
  let side = spin.side * RPM_TO_RAD;
  let t = 0, apex = p.y, carry = 0, land = null, landed = false, rolling = false;

  while (t < MAX_T) {
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp < 1e-4) break;

    if (rolling) {
      // ROLLING: no airborne physics, only friction deceleration on flat ground.
      const g = groundAt(p.x, p.z, p.y);
      p.y = g;
      v.y = 0;
      const s2 = Math.hypot(v.x, v.z);
      if (s2 > 0) {
        const dec = Math.max(0, s2 - rollDecel * DT) / s2;
        v.x *= dec; v.z *= dec;
        if (Math.hypot(v.x, v.z) < restSpeed) { v.x = 0; v.z = 0; break; }
      }
      p.x += v.x * DT; p.z += v.z * DT;
    } else {
      // AIRBORNE: full drag and Magnus lift
      const ux = v.x / sp, uy = v.y / sp, uz = v.z / sp;

      // spin ratio drives both coefficients
      const omega = Math.hypot(back, side);
      const S = (omega * radius) / Math.max(sp, 1e-3);
      const Cl = (clMax * S) / (0.08 + S);
      const Cd = cd0 + 0.18 * S;

      const q = 0.5 * RHO * sp * sp * area;
      const drag = (q * Cd) / mass;

      // Magnus direction: spin axis x velocity. Backspin axis is horizontal and
      // perpendicular to travel; sidespin axis is vertical.
      const ax = { x: -uz * back, y: -side, z: ux * back };
      const mx = ax.y * uz - ax.z * uy;
      const my = ax.z * ux - ax.x * uz;
      const mz = ax.x * uy - ax.y * ux;
      const ml = Math.hypot(mx, my, mz) || 1;
      const lift = (q * Cl) / mass;

      v.x += (-drag * ux + (lift * mx) / ml) * DT;
      v.y += (-drag * uy + (lift * my) / ml - G) * DT;
      v.z += (-drag * uz + (lift * mz) / ml) * DT;

      p.x += v.x * DT; p.y += v.y * DT; p.z += v.z * DT;
      if (p.y > apex) apex = p.y;

      // Check ground contact AFTER position update
      const g = groundAt(p.x, p.z, p.y);
      if (p.y <= g) {
        // LANDING: first ground contact only. Apply descent/spin decay once.
        p.y = g;
        landed = true;
        rolling = true;
        carry = Math.hypot(p.x - origin.x, p.z - origin.z);
        land = { x: p.x, y: p.y, z: p.z };

        // steep descent and heavy backspin both kill roll
        const desc = Math.abs(v.y) / Math.max(Math.hypot(v.x, v.z), 1e-3);
        const keep = Math.max(0, 0.62 - 0.22 * Math.min(desc, 2) - 0.12 * Math.min(back / 600, 1));
        v.x *= keep; v.z *= keep; v.y = 0;
        back *= 0.25; side *= 0.25;

        if (Math.hypot(v.x, v.z) < restSpeed) { v.x = 0; v.z = 0; points.push({ ...p }); break; }
      }
    }

    t += DT;
    if (points.length < 4000) points.push({ ...p });
  }

  if (!landed) carry = Math.hypot(p.x - origin.x, p.z - origin.z);
  return { points, rest: { ...p }, carry, land, apex: apex - origin.y, flightTime: t };
}
