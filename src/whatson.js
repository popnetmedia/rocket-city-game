import { activeCity } from './cities/index.js';

/**
 * "What's on" for the active city, from /api/whats-on (Ticketmaster Discovery behind a
 * serverless proxy — the key never reaches the browser).
 *
 * Decoration, never a dependency: it is fetched after the world is up, it never blocks
 * anything, and any failure leaves `events` empty so the menu simply omits the row. That
 * is the same rule the rest of the game already follows — a city without data has no such
 * mode rather than a dead button.
 *
 * IMPORTANT: this covers TICKETED rooms only. Lower Broadway's honky-tonks are free and
 * unticketed, so they are not in the inventory and never will be. Copy must name the
 * venue, never imply a Broadway line-up.
 */
const REFRESH_MS = 30 * 60 * 1000;

export class WhatsOn {
  constructor({ onChange } = {}) {
    this.events = [];
    this.loaded = false;
    this.onChange = onChange;
    this._next = 0;
  }

  get count() { return this.events.length; }

  /** Events starting inside the next `hours`, soonest first. */
  soon(hours = 24) {
    const now = Date.now(), until = now + hours * 3600e3;
    return this.events.filter((e) => {
      const t = Date.parse(e.starts);
      return Number.isFinite(t) && t >= now && t <= until;
    });
  }

  /** The next event at a named venue, for putting a line on a landmark sign. */
  nextAt(venueName) {
    if (!venueName) return null;
    const want = String(venueName).toLowerCase();
    return this.events.find((e) => e.venue && want.includes(e.venue.toLowerCase())) || null;
  }

  /** Poll on a long interval; safe to call every frame. */
  update(now = Date.now()) {
    if (now < this._next) return;
    this._next = now + REFRESH_MS;
    this._fetch();
  }

  async _fetch() {
    try {
      const r = await fetch(`/api/whats-on?city=${encodeURIComponent(activeCity().meta.id)}`);
      if (!r.ok) return;
      const json = await r.json();
      this.events = Array.isArray(json?.events) ? json.events : [];
      this.loaded = true;
      this.onChange?.(this.events);
    } catch {
      /* offline, or the endpoint is not deployed yet — stay empty and stay quiet */
    }
  }
}

/** "8:00 PM · Ryman Auditorium" */
export function formatEvent(e) {
  const t = Date.parse(e.starts);
  const when = Number.isFinite(t)
    ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  return [when, e.venue].filter(Boolean).join(' · ');
}
