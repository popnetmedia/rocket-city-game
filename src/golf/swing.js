/**
 * Mouse/touch pull-back swing gesture. Pure maths — no DOM, no THREE.
 *
 * Drag back to load, flick forward through the start point to strike.
 * All thresholds scale with viewport height so feel is DPI-independent.
 */
export const BACK_FULL_FRAC = 0.28;   // px of backswing for full power
export const FACE_FULL_FRAC = 0.10;   // px of lateral drift for max curve
export const FACE_MAX = 12;           // degrees at full drift
// px/s of *average* forward-stroke speed scoring tempo 1.0, as a fraction of
// viewport height. Calibrated to a real gesture rather than to a sampling
// artefact: a full backswing is BACK_FULL_FRAC (0.28) of the viewport, and
// returning that in a brisk wrist flick — 50 ms, three samples at 60 fps, two to
// three cm of mouse travel at typical sensitivity — averages 0.28 / 0.05 = 5.6
// viewport heights per second. Snapping it through faster reads thin; a slow,
// pushed stroke reads fat. The old 1.6 was ~1600 px/s, a speed no hand produces
// on a flick, so every swing scored tempo >> 1 and quality 0.
export const TEMPO_REF_FRAC = 5.6;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createSwing(viewportH) {
  const backFull = BACK_FULL_FRAC * viewportH;
  const faceFull = FACE_FULL_FRAC * viewportH;
  const tempoRef = TEMPO_REF_FRAC * viewportH;

  let x0 = 0, y0 = 0, maxBack = 0;
  let lastY = 0, lastT = 0;
  // Start of the forward stroke: the last sample at which the pointer was not yet
  // travelling forward. Tempo is measured across the whole stroke from here, not
  // between the final two samples — golf.js feeds one sample per animation frame,
  // so a frame-pair measures instantaneous flick speed (tens of thousands of px/s)
  // and scored every real swing as a wild mishit. Anchoring on the *last* non-
  // forward sample rather than the deepest point also means dwelling at the top
  // of the backswing costs nothing: the anchor keeps moving while the pointer is
  // parked, so only the flick itself is timed.
  let fwdY = 0, fwdT = 0;
  let active = false;

  const s = {
    result: null,
    backFull,                 // px of drag for full power — golf.js poses against this, never a literal
    down(x, y, t) { x0 = x; y0 = y; lastY = y; lastT = t; fwdY = y; fwdT = t; maxBack = 0; active = true; s.result = null; },
    move(x, y, t) {
      if (!active) return;
      const back = y - y0;
      if (back > maxBack) maxBack = back;
      // Not moving forward yet (still pulling back, or parked): the forward
      // stroke, if there is one, starts here.
      if (y >= lastY) { fwdY = y; fwdT = t; }
      // strike: moving forward (-y) and crossing back through the origin line
      if (maxBack > 8 && y <= y0 && lastY > y0) {
        const dt = Math.max(1, t - fwdT) / 1000;
        const speed = (fwdY - y) / dt;                    // px/s forward, whole stroke
        const tempo = speed / tempoRef;
        s.result = {
          power: clamp(maxBack / backFull, 0, 1),
          faceAngle: clamp((x - x0) / faceFull, -1, 1) * FACE_MAX,
          tempo,
          quality: clamp(1 - Math.abs(tempo - 1), 0, 1),
        };
        active = false;
      }
      lastY = y; lastT = t;
    },
    up() { active = false; },
  };
  return s;
}
