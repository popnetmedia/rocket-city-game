/**
 * Where the outfield wall is, and what a batted ball was. Pure maths.
 *
 * The wall is not reconstructed geometry. It is a distance that varies with the
 * angle off centre field: deepest to centre, shortest down the lines, with the
 * power alleys between. Four numbers instead of a ballpark, and every one of
 * them is adjustable by feel.
 */

/**
 * Fence distance in metres at `angleDeg` off centre field. Symmetric, so the
 * sign of the angle does not matter.
 *
 * Interpolates centre -> gap over the first half of fair territory and gap ->
 * line over the second, which is close enough to a real outfield arc and is
 * obvious to tune.
 */
export function fenceAt(angleDeg, fence) {
  const a = Math.min(Math.abs(angleDeg), fence.foulAngle);
  const half = fence.foulAngle / 2;
  if (a <= half) {
    const t = a / half;
    return fence.center + (fence.gap - fence.center) * t;
  }
  const t = (a - half) / (fence.foulAngle - half);
  return fence.gap + (fence.line - fence.gap) * t;
}

/**
 * `carry` is the distance to first bounce, which is what clears a wall — total
 * distance including roll is not.
 */
export function callIt(carry, angleDeg, fence) {
  if (Math.abs(angleDeg) > fence.foulAngle) return 'FOUL';
  return carry >= fenceAt(angleDeg, fence) ? 'HOME RUN' : 'IN PLAY';
}

/**
 * Where a ball went, for the outcome toast: how far off centre field and which
 * way. Negative is left, matching `callIt`'s angle convention.
 *
 * This is a readout, not a rule. It exists because centre field is a single
 * surveyed bearing per park, and a wrong one rotates the whole fair wedge
 * against the stadium the player can actually see -- balls hit at the visible
 * left-field pole get called foul, with nothing on screen to say why. Printing
 * the angle turns that from a mystery into one swing's worth of measurement.
 */
export function sprayLabel(angleDeg) {
  const d = Math.round(Math.abs(angleDeg));
  if (d <= 3) return 'DEAD CENTRE';
  return `${d}\u00b0 ${angleDeg < 0 ? 'LEFT' : 'RIGHT'}`;
}
