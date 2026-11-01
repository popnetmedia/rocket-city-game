/**
 * How a contact shadow reacts to its object leaving the ground. Pure maths — no
 * THREE, no DOM — so the curve can be pinned in node.
 *
 * Real contact shadows do two things at once as the caster rises: they spread
 * out and they weaken. Doing only the second makes a jumping player's shadow
 * look like a light being switched off; doing only the first makes it look like
 * a stain that follows them. Both together read as height.
 */

/** Metres above the ground at which a shadow has faded out entirely. */
export const FADE_HEIGHT = 14;

/** How much wider the blob grows over that climb, as a fraction of its footprint. */
export const SPREAD = 0.9;

/**
 * `height` is metres above the ground beneath the object; `baseRadius` scales
 * its footprint. Returns the multiplier to apply to that footprint and an
 * opacity multiplier in 0..1.
 *
 * The falloff is faster than linear so a shadow is gone by the time a player is
 * clearly airborne, rather than trailing a faint smudge across half the flight
 * ceiling.
 */
export function shadowFor(height, baseRadius = 1) {
  const h = Number.isFinite(height) ? Math.max(0, height) : FADE_HEIGHT;
  const t = Math.min(1, h / FADE_HEIGHT);
  return {
    radius: baseRadius * (1 + t * SPREAD),
    strength: Math.pow(1 - t, 1.5),
  };
}
