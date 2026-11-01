/**
 * Bat meets ball. Pure maths — no THREE, no DOM, no randomness.
 *
 * One input: how early or late the swing fired, in seconds, signed, with
 * negative meaning early. Everything else about the batted ball comes out of
 * that number, because a derby swing has no other degree of freedom. Aim is
 * separate and comes from where the player is looking.
 *
 * The feel of the entire game is these constants. They are exported so a test
 * can pin the shape of the curve without hard-coding the values it happens to
 * produce today.
 */

/** Seconds either side of the pitch's arrival that still make contact. */
export const SWING_WINDOW = 0.12;

/** Exit speed for a perfectly timed swing, m/s. About 108 mph. */
export const IDEAL_EXIT = 48;

/** Exit speed at the very edge of the window, m/s. A weak, late roller. */
export const EDGE_EXIT = 21;

/** Launch angle for perfect contact, degrees. The real-world barrel is near 28. */
export const IDEAL_LAUNCH = 28;

/** How far the launch angle swings from early to late, degrees either side. */
export const LAUNCH_SPREAD = 24;

/** How far off the aim line a fully early or late swing sprays, degrees. */
export const SPRAY_SPREAD = 34;

/**
 * `errorSec` negative = early, positive = late.
 * Returns degrees for both angles; `sprayOffset` is added to the aim bearing,
 * negative to the left.
 */
export function contactFrom(errorSec) {
  const window = SWING_WINDOW;
  const e = Number.isFinite(errorSec) ? errorSec : window * 2;
  const t = Math.abs(e) / window;                    // 0 = perfect, 1 = edge
  if (t > 1) return { missed: true, exitSpeed: 0, launchAngle: 0, sprayOffset: 0 };

  // Falls off faster than linearly, so the middle of the window still rewards
  // and the edges are clearly punished.
  const quality = 1 - Math.pow(t, 1.4);
  const signed = e / window;                          // -1 early .. +1 late

  return {
    missed: false,
    exitSpeed: EDGE_EXIT + (IDEAL_EXIT - EDGE_EXIT) * quality,
    launchAngle: IDEAL_LAUNCH + signed * LAUNCH_SPREAD,
    sprayOffset: signed * SPRAY_SPREAD,
  };
}

/**
 * Contact plus an aim bearing -> the launch `simulate()` wants.
 *
 * `headingRad` follows flight.js: 0 = -z, forward is (sin a, -cos a). This is
 * the mirror of player yaw; convert with -yaw, exactly as golf does.
 *
 * Backspin comes from how well it was struck rather than being fixed, because
 * backspin is most of why a well-hit ball carries. Sidespin comes from the spray
 * offset, which is what bends a pulled ball foul.
 */
export function launchFromContact(contact, headingRad) {
  const a = (contact.launchAngle * Math.PI) / 180;
  const h = headingRad + (contact.sprayOffset * Math.PI) / 180;
  const flat = contact.exitSpeed * Math.cos(a);
  return {
    vel: {
      x: Math.sin(h) * flat,
      y: contact.exitSpeed * Math.sin(a),
      z: -Math.cos(h) * flat,
    },
    spin: {
      back: 900 + contact.exitSpeed * 26,
      side: contact.sprayOffset * 34,
    },
  };
}
