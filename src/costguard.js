import { IDLE_TIMEOUT_MS, SESSION_CAP_MS } from './constants.js';

/**
 * Caps tile streaming cost:
 *  - idle timeout   -> pause (any input resumes)
 *  - tab hidden     -> pause (visible resumes)
 *  - session cap    -> hard stop (reload starts fresh)
 */
export class CostGuard {
  constructor({ input, onPause, onResume, onSessionEnd, idleMs = IDLE_TIMEOUT_MS, capMs = SESSION_CAP_MS }) {
    this.input = input;
    this.onPause = onPause;
    this.onResume = onResume;
    this.onSessionEnd = onSessionEnd;
    this.idleMs = idleMs;
    this.capMs = capMs;

    this.activeMs = 0;       // cumulative active play time
    this.idlePaused = false;
    this.hiddenPaused = false;
    this.ended = false;
    this._last = performance.now();

    input.onActivity = () => { if (this.idlePaused) this._resumeIdle(); };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.hiddenPaused = true; this._emit(); }
      else { this.hiddenPaused = false; this._last = performance.now(); this._emit(); }
    });
    document.getElementById('paused')?.addEventListener('click', () => this._resumeIdle());
  }

  get paused() { return this.idlePaused || this.hiddenPaused || this.ended; }

  _resumeIdle() {
    if (this.ended) return;
    this.idlePaused = false;
    this.input.lastActivity = performance.now();
    this._last = performance.now();
    this._emit();
  }

  _emit() {
    if (this.ended) return;
    if (this.paused) this.onPause?.(this.idlePaused ? 'idle' : 'hidden');
    else this.onResume?.();
  }

  /** Call once per frame. Returns true if the game should run this frame. */
  tick() {
    if (this.ended) return false;
    const now = performance.now();
    if (!this.paused) {
      this.activeMs += now - this._last;
      if (now - this.input.lastActivity > this.idleMs) {
        this.idlePaused = true;
        this.input.releaseLock();
        this._emit();
      }
      if (this.activeMs >= this.capMs) {
        this.ended = true;
        this.input.releaseLock();
        this.onSessionEnd?.();
        return false;
      }
    }
    this._last = now;
    return !this.paused;
  }
}
