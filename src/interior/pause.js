/**
 * Why tile streaming is paused, as a set of reasons rather than a boolean.
 *
 * World.setPaused was a boolean with an early return, so the cost guard's
 * onResume un-paused streaming while an interior still needed it stopped, which
 * is the whole point of an interior pausing it. A reason set means streaming
 * resumes only when the last holder lets go.
 *
 * Free of three.js so it unit-tests in node, the way src/golf/clubs.js sits
 * beside src/golf.js.
 */
export class PauseReasons {
  constructor() { this._set = new Set(); }
  add(reason) { this._set.add(reason); return this.paused; }
  delete(reason) { this._set.delete(reason); return this.paused; }
  get paused() { return this._set.size > 0; }
}
