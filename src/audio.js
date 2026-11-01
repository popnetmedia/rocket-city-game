/**
 * Synthesized ambience — no audio files.
 *  - wind: filtered white noise, gain/brightness scale with airspeed
 *  - engine: detuned saw oscillators through a low-pass, pitch follows car speed
 * Starts on the first user gesture (browser autoplay policy). M toggles mute.
 */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
    this._targets = { wind: 0, engine: 0, rpm: 0 };
    // Any real user gesture starts the context (and resumes it if the browser suspended it).
    const gesture = () => { this.start(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, gesture, { passive: true }));
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.started = true;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(ctx.destination);

    // ---- wind ----
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 300; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.0;
    noise.connect(this.windFilter).connect(this.windGain).connect(this.master);
    noise.start();
    // slow LFO so the wind breathes
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(this.windFilter.frequency); lfo.start();

    // ---- engine ----
    this.engineOscs = [0, 7, -5].map((det) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55; o.detune.value = det; return o;
    });
    this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 400; this.engineFilter.Q.value = 2;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOscs.forEach((o) => { o.connect(this.engineFilter); o.start(); });
    this.engineFilter.connect(this.engineGain).connect(this.master);
    // sub thump
    this.sub = ctx.createOscillator(); this.sub.type = 'triangle'; this.sub.frequency.value = 27;
    this.sub.connect(this.engineGain); this.sub.start();
  }

  _tone(freq, t0, dur, type = 'square', gain = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  powerDown() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; this._tone(660, t, 0.14, 'sawtooth', 0.14); this._tone(440, t + 0.1, 0.16, 'sawtooth', 0.13); this._tone(220, t + 0.22, 0.28, 'sawtooth', 0.12); }
  ding(freq = 1040) { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; this._tone(freq, t, 0.12, 'triangle', 0.16); this._tone(freq * 1.5, t + 0.08, 0.18, 'triangle', 0.13); }
  blip(freq = 880) { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; this._tone(freq, t, 0.08); this._tone(freq * 1.5, t + 0.07, 0.12); }
  fanfare() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => this._tone(f, t + i * 0.12, 0.35, 'triangle', 0.16)); }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  /**
   * @param {object} s  { airspeed (m/s), driving (bool), carSpeed (m/s), throttle (-1..1), gliding (bool) }
   */
  update(s) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const fin = (v) => (Number.isFinite(v) ? v : 0);
    s = { airspeed: fin(s.airspeed), carSpeed: fin(s.carSpeed), throttle: fin(s.throttle), driving: !!s.driving, gliding: !!s.gliding };
    // wind: audible from ~4 m/s, loud at 30 m/s; gliding adds a bit
    const w = Math.min(1, Math.max(0, (s.airspeed - 3) / 27)) * (s.gliding ? 1.1 : 0.8);
    this.windGain.gain.setTargetAtTime(0.05 + w * 0.22, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(250 + w * 900, t, 0.2);

    // engine
    const rpm = s.driving ? 0.15 + Math.min(1, s.carSpeed / 35) * 0.85 + Math.max(0, s.throttle) * 0.1 : 0;
    const f = 45 + rpm * 160;
    this.engineOscs.forEach((o) => o.frequency.setTargetAtTime(f, t, 0.08));
    this.sub.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + rpm * 1400, t, 0.1);
    this.engineGain.gain.setTargetAtTime(s.driving ? 0.06 + rpm * 0.08 : 0, t, 0.12);
  }
}
