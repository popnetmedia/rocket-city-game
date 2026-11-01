/**
 * Multiplayer client: thin WebSocket wrapper around the relay protocol (see server/room.js).
 * Never blocks the game: any failure -> status 'offline', retry every RETRY_MS while enabled.
 */
const SEND_HZ = 10;
const RETRY_MS = 30000;

export class MultiplayerClient {
  constructor({ url, onChat, onStatus, onState }) {
    this.url = url;
    this.onChat = onChat;
    this.onStatus = onStatus;
    this.onState = onState;
    this.enabled = false;
    this.status = 'off';        // off | connecting | online | offline | full
    this.id = null;
    this.callsign = null;
    this.playerCount = 0;
    this.ws = null;
    this._retryTimer = null;
    this._sendAcc = 0;
    this._suspended = false;    // set by cost guard; no reconnects while true
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.connect(); else this.disconnect('off');
  }

  /** Cost-guard hooks: drop the socket and don't reconnect until resumed. */
  suspend() { this._suspended = true; this._closeSocket(); this._clearRetry(); if (this.enabled) this._setStatus('offline'); }
  resume() { this._suspended = false; if (this.enabled) this.connect(); }

  connect() {
    if (!this.enabled || this._suspended || this.ws) return;
    this._clearRetry();
    this._setStatus('connecting');
    let ws;
    try { ws = new WebSocket(this.url); } catch { this._fail(); return; }
    this.ws = ws;
    const timeout = setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) { try { ws.close(); } catch {} } }, 5000);
    ws.onopen = () => { clearTimeout(timeout); };
    ws.onmessage = (e) => this._onMessage(e.data);
    ws.onerror = () => { /* onclose follows */ };
    ws.onclose = (e) => {
      clearTimeout(timeout);
      if (this.ws !== ws) return;
      this.ws = null; this.id = null; this.playerCount = 0;
      this.onState?.([]);
      if (e.code === 4001) { this._setStatus('full'); this._scheduleRetry(); return; }
      if (this.enabled && !this._suspended) this._fail();
      else if (!this.enabled) this._setStatus('off');
    };
  }

  disconnect(status = 'off') {
    this._clearRetry();
    this._closeSocket();
    this.id = null; this.playerCount = 0;
    this.onState?.([]);
    this._setStatus(status);
  }

  /** Call every frame; sends the local state at SEND_HZ while online. */
  update(dt, local) {
    if (this.status !== 'online' || !this.ws) return;
    this._sendAcc += dt;
    if (this._sendAcc < 1 / SEND_HZ) return;
    this._sendAcc = 0;
    this._send({ t: 'pos', pos: local.pos, rot: local.rot, state: local.state, char: local.char });
  }

  sendChat(msg) {
    if (this.status !== 'online') return false;
    this._send({ t: 'chat', msg: String(msg).slice(0, 140) });
    return true;
  }

  _onMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'welcome':
        this.id = m.id; this.callsign = m.callsign;
        this.playerCount = (m.players?.length ?? 0) + 1;
        this._setStatus('online');
        this.onState?.(m.players ?? []);
        break;
      case 'state':
        this.playerCount = m.players?.length ?? 0;
        this.onState?.((m.players ?? []).filter((p) => p.id !== this.id));
        break;
      case 'chat': this.onChat?.(m); break;
      case 'full': this._setStatus('full'); break;
      default: break;
    }
  }

  _send(obj) { try { this.ws?.send(JSON.stringify(obj)); } catch { /* drop */ } }
  _closeSocket() { const ws = this.ws; this.ws = null; if (ws) { try { ws.onclose = null; ws.close(); } catch {} } }
  _fail() { this._setStatus('offline'); this._scheduleRetry(); }
  _scheduleRetry() { this._clearRetry(); this._retryTimer = setTimeout(() => { this._retryTimer = null; this.connect(); }, RETRY_MS); }
  _clearRetry() { if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; } }
  _setStatus(s) { if (this.status !== s) { this.status = s; this.onStatus?.(s); } }
}
