import { MPH_PER_MPS } from './constants.js';
import { activeCity, localizeQuery } from './cities/index.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor({ onTeleport, onMpToggle, onChatSend, onChatOpen }) {
    this.onMpToggle = onMpToggle; this.onChatSend = onChatSend; this.onChatOpen = onChatOpen;
    this.chatOpen = false;
    this.el = {
      status: $('city-status'), mode: $('mode'), glider: $('glider'), speed: $('speed'), lat: $('lat'), lon: $('lon'), alt: $('alt'),
      fps: $('fps'), tiles: $('tiles'), clock: $('session-clock'),
      loading: $('loading'), loadbar: $('loadbar'), loadtext: $('loadtext'),
      paused: $('paused'), sessionEnd: $('session-end'), banner: $('banner'), bannerTitle: $('banner-title'), bannerBody: $('banner-body'),
      weather: $('weather'), mpToggle: $('mp-toggle'), mpStatus: $('mp-status'), mpCount: $('mp-count'), mpCallsign: $('mp-callsign'),
      // (text chat removed — emoji quick-chat instead)
      missionTitle: $('mission-title'), missionProgress: $('mission-progress'), missionHint: $('mission-hint'), fuelBar: $('fuel-bar'), fuelText: $('fuel-text'), toast: $('toast'), prompt: $('prompt'), quality: $('quality'),
      logo: $('google-logo'), attrText: $('attribution-text'), touchNote: $('touch-note'),
    };
    this._fpsAcc = 0; this._fpsN = 0; this._fpsT = performance.now();
    this._attrT = 0;

    const presets = $('presets');
    activeCity().presets.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = p.name;
      b.addEventListener('click', () => { onTeleport(p.lat, p.lon, p.name, { spawn: p.spawn, alt: p.alt }); b.blur(); });
      presets.appendChild(b);
    });
    $('goform').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('goinput');
      const raw = input.value.trim();
      if (!raw) return;
      input.style.borderColor = '';
      // lat,lon path
      const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (m) {
        const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) { input.style.borderColor = '#ff4d5a'; return; }
        onTeleport(lat, lon);
        input.blur();
        return;
      }
      // address / place path — geocode via OpenStreetMap Nominatim, biased to the active city
      const btn = $('goform').querySelector('button');
      const prev = btn.textContent; btn.textContent = '…'; btn.disabled = true;
      try {
        const q = localizeQuery(raw);
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (data && data.length) {
          const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
          const label = (data[0].display_name || raw).split(',').slice(0, 2).join(',').trim();
          input.value = '';
          onTeleport(lat, lon, label);
          input.blur();
        } else {
          input.style.borderColor = '#ff4d5a';
          this.toast('ADDRESS NOT FOUND — try "street, city" or lat,lon', 2800);
        }
      } catch {
        input.style.borderColor = '#ff4d5a';
        this.toast('GEOCODER UNREACHABLE — try lat,lon instead', 2600);
      } finally {
        btn.textContent = prev; btn.disabled = false;
      }
    });
    $('reload-btn').addEventListener('click', () => location.reload());
    $('tile-error-retry').addEventListener('click', () => location.reload());
    $('menu-close').addEventListener('click', () => this.closeMenu());
    $('results-close').addEventListener('click', () => this.closeResults());
    $('shop-close').addEventListener('click', () => this.closeShop());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('shop-modal').classList.contains('hidden')) this.closeShop(); });
    $('results-share').addEventListener('click', () => this._onShare?.());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.menuOpen) this.closeMenu(); });

    // ---- multiplayer + chat ----
    this.el.mpToggle.addEventListener('click', () => { this.onMpToggle?.(); this.el.mpToggle.blur(); });
    // Emoji quick-chat: Enter toggles the bar; click or number keys 1-8 send.
    const bar = $('emoji-bar');
    const emojiButtons = [...bar.querySelectorAll('button')];
    emojiButtons.forEach((b) => b.addEventListener('click', () => { this.onChatSend?.(b.dataset.e); this.closeChat(); }));
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') { e.preventDefault(); this.chatOpen ? this.closeChat() : this.openChat(); return; }
      if (this.chatOpen) {
        if (e.key === 'Escape') { this.closeChat(); return; }
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= emojiButtons.length) { this.onChatSend?.(emojiButtons[n - 1].dataset.e); this.closeChat(); }
      }
    });
    this.el.logo.addEventListener('error', () => {
      // Fallback: text wordmark if the logo asset can't be fetched.
      this.el.logo.removeAttribute('src');
      this.el.attrText.textContent = 'Google · ' + this.el.attrText.textContent;
    });
  }

  fadeIn() { $('fade').classList.add('out'); }
  fadeOut() { $('fade').classList.remove('out'); }
  setMuted(m) { $('mute').textContent = m ? 'MUTED' : 'ON'; $('mute').style.color = m ? 'var(--red)' : ''; }

  openChat() {
    this.chatOpen = true;
    document.getElementById('emoji-bar').classList.remove('hidden');
    this.onChatOpen?.(true);
    document.exitPointerLock?.();
  }
  closeChat() {
    if (!this.chatOpen) return;
    this.chatOpen = false;
    document.getElementById('emoji-bar').classList.add('hidden');
    this.onChatOpen?.(false);
  }
  /** System notices now surface as toasts; player emoji float above meshes (see main). */
  addChat({ msg, sys }) { if (sys) this.toast(msg, 2600); }
  setMp({ enabled, status, count, callsign }) {
    this.el.mpToggle.textContent = enabled ? 'ON' : 'OFF';
    this.el.mpToggle.classList.toggle('on', enabled);
    const label = { off: 'OFF', connecting: 'CONNECTING…', online: 'ONLINE', offline: 'OFFLINE', full: 'CITY FULL', soon: 'COMING SOON' }[status] || status.toUpperCase();
    this.el.mpStatus.textContent = label;
    this.el.mpStatus.style.color = status === 'online' ? 'var(--green)' : (status === 'offline' || status === 'full') ? 'var(--red)' : status === 'soon' ? 'var(--amber)' : '';
    this.el.mpToggle.textContent = status === 'soon' ? 'SOON' : (enabled ? 'ON' : 'OFF');
    this.el.mpCount.textContent = String(count);
    this.el.mpCallsign.textContent = callsign || '--';
  }

  setMission({ title, progress, hint, fuel, unlocked, gamify }) {
    this.el.missionTitle.textContent = title;
    this.el.missionProgress.textContent = progress;
    this.el.missionHint.textContent = hint;
    const pct = Math.round(Math.max(0, Math.min(1, fuel)) * 100);
    const explorer = unlocked && !gamify;
    this.el.fuelBar.style.width = (explorer ? 100 : pct) + '%';
    this.el.fuelBar.style.background = explorer ? 'var(--green)' : pct < 20 ? 'var(--red)' : 'var(--amber)';
    this.el.fuelText.textContent = !unlocked ? `${pct}% · LOCKED` : explorer ? '∞ EXPLORER' : `${pct}%`;

  }
  setQuality(q) { this.el.quality.textContent = q; }
  setPrompt(text) { if (this.el.prompt.textContent !== text) { this.el.prompt.textContent = text; this.el.prompt.classList.toggle('hidden', !text); } }
  /** rows: [{ label, status, statusClass, button, buttonOn, onClick }] */
  renderMissions(rows) {
    const list = $('missions-list');
    const sig = JSON.stringify(rows.map((r) => [r.label, r.status, r.button, r.buttonOn]));
    if (sig === this._missionsSig) return;
    this._missionsSig = sig;
    list.innerHTML = '';
    for (const r of rows) {
      const row = document.createElement('div'); row.className = 'mrow';
      const name = document.createElement('span'); name.className = 'mname'; name.textContent = r.label;
      const right = document.createElement('span'); right.style.display = 'inline-flex'; right.style.gap = '8px'; right.style.alignItems = 'center';
      const stat = document.createElement('span'); stat.className = 'mstat ' + (r.statusClass || ''); stat.textContent = r.status;
      right.appendChild(stat);
      if (r.button) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = r.button;
        b.classList.toggle('on', !!r.buttonOn);
        b.addEventListener('click', (e) => { r.onClick?.(); e.currentTarget.blur(); });
        right.appendChild(b);
      }
      row.append(name, right);
      list.appendChild(row);
    }
  }

  /**
   * Optional per-city billboard slot (city.billboard). A city with no billboard simply
   * keeps the wordmark.
   */
  setBillboard(cfg) {
    const el = $('billboard');
    if (!el) return false;
    const img = el.querySelector('img');
    const house = $('billboard-house');
    const sold = !!(cfg && cfg.enabled && cfg.image);
    // No booked creative: the slot stays hidden and the wordmark keeps its place.
    if (!sold) return false;
    el.classList.remove('hidden');
    document.body.classList.add('billboard-on');
    if (img) img.hidden = false;
    if (house) house.hidden = true;
    el.target = '_blank';
    el.rel = 'noopener sponsored';
    img.src = cfg.image;
    img.alt = cfg.alt || '';
    if (cfg.w && cfg.h) {
      img.width = cfg.w; img.height = cfg.h;
      el.style.width = `min(${cfg.w}px, calc(100vw - 32px))`;
      el.style.aspectRatio = `${cfg.w} / ${cfg.h}`;   // holds the box before the image loads
    }
    // Everything stacked below (the minimap, and the status panel under it) shifts down by
    // the slot's real rendered height — creative sizes differ, so this cannot be a constant.
    const setH = () => document.documentElement.style
      .setProperty('--billboard-h', `${Math.round(el.getBoundingClientRect().height) + 12}px`);
    setH();
    img.addEventListener('load', setH, { once: true });
    addEventListener('resize', setH);
    if (cfg.url) { el.href = cfg.url; el.style.pointerEvents = 'auto'; }
    else { el.removeAttribute('href'); el.style.pointerEvents = 'none'; }
    return true;
  }

  setSponsor({ enabled, text, url }) {
    const el = $('sponsor');
    if (!enabled || !text) { el.classList.add('hidden'); return; }
    el.textContent = text;
    el.classList.remove('hidden');
    if (url) el.href = url; else { el.removeAttribute('href'); el.style.pointerEvents = 'none'; }
  }

  openShop(shop, onBuy) {
    this.menuOpen = true;
    $('shop-name').textContent = shop.name;
    $('shop-blurb').textContent = shop.blurb || '';
    // Broadway venues carry a `star` instead of a coupon — same highlighted slot.
    // Hotels have no coupon, and an empty bordered box reads as a broken slot.
    const offerEl = $('shop-offer');
    const offerText = shop.star ? `★ ${shop.star.toUpperCase()}` : (shop.offer || '');
    offerEl.textContent = offerText;
    offerEl.hidden = !offerText;
    const note = $('shop-note');
    if (note) note.textContent = shop.kind === 'hotel'
      ? 'Opens the booking site in a new tab. Rates and availability are shown there.'
      : 'Opens the store in a new tab.';
    // Not every venue has a website in the source data, and an unlabelled button that
    // opened about:blank is worse than no button.
    const buy = $('shop-buy');
    buy.hidden = !shop.url;
    // A card with a url gets a link button; hotels and link-less shops show the blurb only.
    buy.textContent = shop.cta || (shop.star || shop.blurb ? 'VISIT SITE →' : 'SHOP NOW →');
    buy.onclick = () => { if (shop.url) onBuy?.(); };
    $('shop-modal').classList.remove('hidden');
    this.onChatOpen?.(true); document.exitPointerLock?.();
  }
  closeShop() { this.menuOpen = false; $('shop-modal').classList.add('hidden'); this.onChatOpen?.(false); }

  /** Award unlock screen with confetti. `info` = { runs, isNew }. */
  showAward(award, info = {}) {
    this.menuOpen = true;
    const runs = info.runs || 1;
    document.documentElement.style.setProperty('--award-color', award.color || '#39ff88');
    const rib = document.querySelector('.award-ribbon');
    if (rib) rib.textContent = runs > 1 ? `★ RUN ×${runs} COMPLETE ★` : '★ AWARD UNLOCKED ★';
    $('award-badge').textContent = award.emoji || '★';
    $('award-title').textContent = award.name;
    $('award-blurb').textContent = (runs > 1 ? `Run #${runs}. ` : '') + (award.blurb || '');
    // re-trigger the badge pop animation
    const b = $('award-badge'); if (b) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
    $('award-modal').classList.remove('hidden');
    this.onChatOpen?.(true); document.exitPointerLock?.();
    this._confetti();
  }
  closeAward() { this.menuOpen = false; this._confettiStop = true; $('award-modal').classList.add('hidden'); this.onChatOpen?.(false); }

  /** list: [{id,name,emoji,color,blurb,earned,at}]; onRun(id) launches that mode. */
  openBriefcase(list, onRun) {
    this.menuOpen = true;
    this._bcList = list; this._bcRun = onRun;
    this._bcRender();
    $('briefcase-modal').classList.remove('hidden');
    this.onChatOpen?.(true); document.exitPointerLock?.();
  }
  _bcRender() {
    const grid = $('briefcase-grid'); grid.innerHTML = '';
    for (const a of this._bcList) {
      const d = document.createElement('button'); d.type = 'button';
      d.className = 'bc-item' + (a.earned ? ' earned' : '');
      if (a.color) d.style.setProperty('--award-color', a.color);
      const em = document.createElement('div'); em.className = 'bc-em'; em.textContent = a.emoji || '★';
      const nm = document.createElement('div'); nm.className = 'bc-name'; nm.textContent = a.earned ? a.name : (a.name || 'LOCKED');
      d.append(em, nm);
      if (a.earned && a.runs > 1) { const x = document.createElement('span'); x.className = 'bc-x'; x.textContent = '×' + a.runs; d.append(x); }
      const sub = document.createElement('div'); sub.className = 'bc-date';
      if (a.earned && a.at) { try { sub.textContent = new Date(a.at).toLocaleDateString(); } catch { sub.textContent = 'EARNED'; } }
      else sub.textContent = '🔒 CLICK TO PLAY';
      d.append(sub);
      d.addEventListener('click', () => this._bcDetail(a));
      grid.appendChild(d);
    }
  }
  /** Badge detail: spins if earned, offers run / run-again either way. */
  _bcDetail(a) {
    const grid = $('briefcase-grid'); grid.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'bc-detail';
    if (a.color) wrap.style.setProperty('--award-color', a.color);
    const badge = document.createElement('div');
    badge.className = 'bc-big' + (a.earned ? ' spin' : ' locked');
    badge.textContent = a.emoji || '★';
    const nm = document.createElement('div'); nm.className = 'bc-big-name'; nm.textContent = a.name;
    const bl = document.createElement('div'); bl.className = 'bc-big-blurb';
    bl.textContent = a.earned ? (a.blurb || '') : 'Not earned yet — fly it to unlock this badge.';
    const st = document.createElement('div'); st.className = 'bc-big-status';
    st.textContent = a.earned
      ? (a.runs > 1 ? `★ COMPLETED ×${a.runs}` : '★ EARNED') + (a.at ? ' · ' + new Date(a.at).toLocaleDateString() : '')
      : '🔒 LOCKED';
    const acts = document.createElement('div'); acts.className = 'menu-actions';
    const run = document.createElement('button'); run.type = 'button'; run.className = 'bc-run';
    run.textContent = a.earned ? `↻ RUN IT AGAIN (×${(a.runs || 1) + 1})` : '▶ UNLOCK — RUN IT';
    run.addEventListener('click', () => { this.closeBriefcase(); this._bcRun?.(a.id); });
    const back = document.createElement('button'); back.type = 'button'; back.textContent = '← BACK';
    back.addEventListener('click', () => this._bcRender());
    acts.append(run, back);
    wrap.append(badge, nm, st, bl, acts);
    grid.appendChild(wrap);
  }
  closeBriefcase() { this.menuOpen = false; $('briefcase-modal').classList.add('hidden'); this.onChatOpen?.(false); }

  /** Cheap canvas confetti burst (~3.4s), independent of the game loop. */
  _confetti() {
    const canvas = $('confetti'); if (!canvas) return;
    const g = canvas.getContext('2d');
    const W = canvas.width = window.innerWidth, H = canvas.height = window.innerHeight;
    const colors = ['#39ff88', '#ffb347', '#00b371', '#ff5fa2', '#ffffff', '#4fd8ff'];
    const parts = Array.from({ length: 170 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.35, y: H * 0.34,
      vx: (Math.random() - 0.5) * 13, vy: Math.random() * -15 - 4, g: 0.38 + Math.random() * 0.3,
      r: 3 + Math.random() * 5, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    }));
    this._confettiStop = false;
    const t0 = performance.now();
    const tick = () => {
      if (this._confettiStop) { g.clearRect(0, 0, W, H); return; }
      const el = performance.now() - t0;
      g.clearRect(0, 0, W, H);
      for (const p of parts) { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vx *= 0.99;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.max(0, 1 - el / 3400); g.fillStyle = p.c; g.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); g.restore(); }
      if (el < 3400) requestAnimationFrame(tick); else g.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(tick);
  }

  openMenu(stop, { collected, coupon, footer } = {}) {
    this.menuOpen = true;
    $('menu-name').textContent = stop.name.toUpperCase();
    $('menu-blurb').textContent = stop.blurb || '';
    $('menu-note').textContent = stop.note || '';
    $('menu-note').classList.toggle('hidden', !stop.note);
    $('menu-footer').textContent = footer || '';
    const items = $('menu-items'); items.innerHTML = '';
    for (const [item, price] of stop.menu || []) {
      const row = document.createElement('div'); row.className = 'mi';
      const a = document.createElement('span'); a.textContent = item;
      const b = document.createElement('span'); b.textContent = price;
      row.append(a, b); items.appendChild(row);
    }
    const cp = $('menu-coupon');
    if (collected && coupon) { cp.textContent = `COUPON: ${coupon}`; cp.classList.remove('hidden'); }
    else cp.classList.add('hidden');
    const link = $('menu-link');
    if (stop.url) { link.href = stop.url; link.classList.remove('hidden'); } else link.classList.add('hidden');
    $('menu-modal').classList.remove('hidden');
    document.exitPointerLock?.();
    this.onChatOpen?.(true); // reuse the key-block guard
  }

  closeMenu() {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    $('menu-modal').classList.add('hidden');
    this.onChatOpen?.(false);
  }

  showResults({ title, time, board, tag, onShare }) {
    this.menuOpen = true;
    $('results-title').textContent = title;
    $('results-time').textContent = time;
    const el = $('results-board'); el.innerHTML = '';
    if (board && board.length) {
      const head = document.createElement('div'); head.className = 'head'; head.textContent = 'GLOBAL TOP ' + board.length; el.appendChild(head);
      board.forEach((e, i) => {
        const row = document.createElement('div'); row.className = 'lb' + (e.me ? ' me' : '');
        const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = '#' + (i + 1);
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.name;
        const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = e.t;
        row.append(rk, nm, tm); el.appendChild(row);
      });
    } else {
      const d = document.createElement('div'); d.className = 'head'; d.textContent = 'LOCAL RUN (no leaderboard server)'; el.appendChild(d);
    }
    this._onShare = onShare;
    $('results-share').classList.toggle('hidden', !onShare);
    $('results-modal').classList.remove('hidden');
    this.onChatOpen?.(true);
    document.exitPointerLock?.();
  }
  closeResults() { this.menuOpen = false; $('results-modal').classList.add('hidden'); this.onChatOpen?.(false); }

  setRaceTimer(text) { const el = $('race-timer'); if (!text) el.classList.add('hidden'); else { el.textContent = text; el.classList.remove('hidden'); } }
  popCollect(colorHex, text) {
    const el = document.createElement('div');
    el.className = 'collect-pop';
    el.textContent = text;
    el.style.color = typeof colorHex === 'number' ? '#' + colorHex.toString(16).padStart(6, '0') : colorHex;
    document.getElementById('hud').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
  setHunts(rows) {
    const box = document.getElementById('hunt-counters');
    const sig = JSON.stringify(rows);
    if (sig === this._huntSig) return; this._huntSig = sig;
    box.innerHTML = '';
    for (const r of rows) {
      const d = document.createElement('div'); d.className = 'hunt-row';
      const k = document.createElement('span'); k.textContent = r.label; k.style.color = r.color;
      const v = document.createElement('span'); v.className = 'v'; v.textContent = r.value;
      d.append(k, v); box.appendChild(d);
    }
  }
  setGolf(s) {
    const el = document.getElementById('golf-card');
    if (!el) return;
    if (!s) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = '';

    const club = document.createElement('div');
    club.className = 'club';
    club.textContent = s.club || '—';
    el.appendChild(club);

    const row1 = document.createElement('div');
    row1.className = 'row';
    const hole = Number(s.hole);
    const par = Number(s.par);
    row1.innerHTML = `<span>HOLE ${isFinite(hole) ? hole : '—'}</span><b>PAR ${isFinite(par) ? par : '—'}</b>`;
    el.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'row';
    const strokes = Number(s.strokes);
    row2.innerHTML = `<span>STROKES</span><b>${isFinite(strokes) ? strokes : '—'}</b>`;
    el.appendChild(row2);

    const row3 = document.createElement('div');
    row3.className = 'row';
    const toPin = Number(s.toPin);
    // Golf is played in yards. toPin arrives in metres (scene units).
    row3.innerHTML = `<span>TO PIN</span><b>${isFinite(toPin) ? Math.round(toPin / 0.9144) : '—'} YDS</b>`;
    el.appendChild(row3);
  }
  /**
   * Mirrors setGolf: rebuild the rows each frame, guard every number, and hide
   * the card entirely on null so exit() can tear it down in one call.
   */
  setDerby(s) {
    const el = $('derby-card');
    if (!el) return;
    if (!s) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = '';
    const row = (k, v) => {
      const d = document.createElement('div');
      d.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`;
      el.appendChild(d);
    };
    row('FIELD', s.park || '—');
    row('OUTS', Number.isFinite(s.outs) ? s.outs : '—');
    row('HOME RUNS', Number.isFinite(s.homeRuns) ? s.homeRuns : '—');
    // Arrives already in feet from derby.js, which owns the conversion.
    row('LONGEST', Number.isFinite(s.longest) && s.longest > 0 ? `${s.longest} FT` : '—');
  }
  setZone(name) {
    const z = $('zone'); z.textContent = `— ${name} —`;
    z.classList.add('show');
    clearTimeout(this._zoneT); this._zoneT = setTimeout(() => z.classList.remove('show'), 3500);
  }
  toast(msg, ms = 2500) {
    const t = this.el.toast; t.textContent = msg; t.classList.remove('hidden'); t.classList.add('show');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  showWatermark(text) { const w = $('watermark'); w.textContent = text; w.classList.remove('hidden'); }

  showTouchNote() {
    this.el.touchNote.classList.remove('hidden');
    $('touch-note-close').addEventListener('click', () => this.el.touchNote.classList.add('hidden'));
  }

  setStatus(text) { this.el.status.textContent = text; }
  setCityLabel(name) {
    const label = String(name).toUpperCase();
    const el = document.getElementById('city-name'); if (el) el.textContent = label;
    // Name the menu for the city you are actually flying over.
    const head = document.querySelector('#missions-menu .legend-head');
    if (head) head.textContent = `${label} · MISSIONS`;
  }

  /** Hide the mission panel entirely for a city with no curated missions. */
  setMissionPanelVisible(on) {
    const el = document.getElementById('mission');
    if (el) el.classList.toggle('hidden', !on);
  }
  setOnline(n) { const el = document.getElementById('online-now'); if (el) el.textContent = String(n); }
  setWeather(text) { if (this.el.weather) this.el.weather.textContent = text; }

  setLoading(progress, text) {
    this.el.loadbar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    if (text) { this.el.loadtext.textContent = text; return; }
    // rotate themed flavor lines when no explicit status is given
    const LINES = ['SPOOLING UP THE SATURN V', 'CLEARING THE LAUNCH PAD', 'CONTACTING MISSION CONTROL',
      'STREAMING THE ROCKET CITY', 'FOG LIFTING OVER MONTE SANO', 'ALIGNING THE GANTRY', 'FUELING STAGE ONE'];
    const now = performance.now();
    if (!this._loadLineT || now - this._loadLineT > 1600) {
      this._loadLineT = now; this._loadLine = (this._loadLine ?? -1) + 1;
      this.el.loadtext.textContent = LINES[this._loadLine % LINES.length];
    }
  }
  showTileError(err, url) {
    const box = document.getElementById('tile-error');
    document.getElementById('tile-error-detail').textContent = (err && (err.message || String(err)) || 'no signal') + (url ? ` · ${url.slice(0, 48)}` : '');
    box.classList.remove('hidden');
  }
  hideLoading() { this.el.loading.classList.add('hidden'); }

  showPaused(v) { this.el.paused.classList.toggle('hidden', !v); }
  showSessionEnd() { this.el.sessionEnd.classList.remove('hidden'); this.el.loading.classList.add('hidden'); this.el.paused.classList.add('hidden'); }

  showBanner(title, html) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerBody.innerHTML = html;
    this.el.banner.classList.remove('hidden');
    document.documentElement.style.setProperty('--banner-h', `${this.el.banner.offsetHeight}px`);
  }

  update({ mode, glider, speedMps, geo, tilesStats, activeMs, attributions, osmActive, alprActive }) {
    this._osmActive = osmActive;
    this._alprActive = alprActive;
    this.el.mode.textContent = mode;
    if (glider !== undefined) { this.el.glider.textContent = glider; this.el.glider.style.color = glider === 'DEPLOYED' ? 'var(--amber)' : ''; }
    this.el.speed.textContent = `${Math.round(speedMps * MPH_PER_MPS)} MPH`;
    if (geo) {
      this.el.lat.textContent = geo.lat.toFixed(5);
      this.el.lon.textContent = geo.lon.toFixed(5);
      this.el.alt.textContent = `${Math.round(geo.height)} M`;
    }
    if (tilesStats) this.el.tiles.textContent = `${tilesStats.visible ?? 0} VIS / ${tilesStats.downloading ?? 0} DL`;

    const now = performance.now();
    this._fpsN++;
    if (now - this._fpsT > 500) {
      this.el.fps.textContent = String(Math.round((this._fpsN * 1000) / (now - this._fpsT)));
      this._fpsN = 0; this._fpsT = now;
    }
    const s = Math.floor(activeMs / 1000);
    this.el.clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    if (attributions && now - this._attrT > 1000) {
      this._attrT = now;
      const parts = [];
      for (const a of attributions) {
        if (a.type === 'image' && a.value) {
          if (this.el.logo.getAttribute('src') !== a.value && !this.el.logo.dataset.failed) this.el.logo.src = a.value;
        } else if (a.type === 'string' && a.value && !parts.includes(a.value)) parts.push(a.value);
      }
      const text = parts.join(' · ');
      let full = !text ? 'Google' : /^google\b/i.test(text) ? text : `Google · ${text}`;
      if (this._osmActive) full += ' · Buildings © OpenStreetMap contributors';
      if (this._alprActive) full += ' · ALPR data © OSM contributors via DeFlock.me';
      if (this.el.attrText.textContent !== full) this.el.attrText.textContent = full;
    }
  }
}

export function keyMissingBannerHTML() {
  return `Set <code>VITE_GOOGLE_TILES_KEY</code> to load Photorealistic 3D Tiles.
  <ol>
    <li>Cloud Console → APIs &amp; Services → Library → enable <b>Map Tiles API</b>.</li>
    <li>APIs &amp; Services → Credentials → Create credentials → API key.</li>
    <li>Restrict the key: HTTP referrers (your domain + <code>http://localhost:5173/*</code>) and API restriction = Map Tiles API only.</li>
    <li>Locally: copy <code>.env.example</code> → <code>.env</code> and paste the key. On Vercel: Project → Settings → Environment Variables.</li>
    <li>Restart the dev server / redeploy.</li>
  </ol>`;
}

export function tileErrorBannerHTML(err, url) {
  const msg = (err && (err.message || String(err))) || 'unknown error';
  return `Google returned an error for <code>${url || 'root.json'}</code>: <code>${msg}</code>.
  <ol>
    <li>Is the <b>Map Tiles API</b> enabled on the key's project?</li>
    <li>Does the key's HTTP-referrer restriction include <code>${location.origin}/*</code>?</li>
    <li>Is billing enabled on the project? (Map Tiles API requires a billing account.)</li>
    <li>Check the browser Network tab for the exact status (403 = key/referrer/API restriction, 429 = quota cap hit).</li>
  </ol>`;
}
