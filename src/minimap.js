import { activeCity } from './cities/index.js';

/**
 * North-up radar minimap drawn on a 2D canvas.
 * Scene axes: +x = east, -z = north. 1 px = `scale` metres.
 */
export class Minimap {
  constructor({ canvas, world, landmarks }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.scale = 2;                 // metres per px
    const ls = landmarks ?? activeCity().presets;
    this.landmarks = ls.map((l) => ({ name: l.name, pos: world.geoToScene(l.lat, l.lon, 0) }));
    this.footprints = [];           // dev-world boxes: { x, z, w, d, rot, h }
    this.roadSource = null;         // set to the OSMBuildings instance to draw the street grid
    this.nofly = [];                // restricted zones: { cx, cz, r, name }
    this._last = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth || 200;
    canvas.width = size * this.dpr; canvas.height = size * this.dpr;
    this.size = size;
  }

  /** Register dev-world boxes so they show as building footprints. */
  setFootprints(group) {
    this.footprints = [];
    group.traverse((o) => {
      const p = o.geometry?.parameters;
      if (o.isMesh && o.geometry?.type === 'BoxGeometry' && p.width < 200) {
        this.footprints.push({ x: o.position.x, z: o.position.z, w: p.width, d: p.depth, rot: o.rotation.y, ramp: Math.abs(o.rotation.x) > 0.01 });
      }
    });
  }

  /**
   * Draw the real street grid from the OSM road centrelines the tile loader
   * already keeps for AI traffic (`osm.roadLines`). One path for every visible
   * line, so downtown reads as an actual grid instead of an abstract mesh.
   * Lines are culled by a cached bounding box; the array is pruned per cell on
   * unload, so this stays bounded to what's loaded around the player.
   */
  _drawRoads(ctx, toPx, pos, size, scale) {
    const src = this.roadSource?.roadLines;
    if (!src || !src.length) return;
    const reach = (size / 2) * scale * 1.5 + 60;   // metres, generous of the circle
    ctx.strokeStyle = 'rgba(126,214,170,0.34)';
    ctx.lineWidth = Math.max(0.6, Math.min(3, 7 / scale));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const line of src) {
      let bb = line._bb;
      if (!bb) {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const q of line) {
          if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
          if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1];
        }
        bb = line._bb = [x0, z0, x1, z1];
      }
      if (bb[2] < pos.x - reach || bb[0] > pos.x + reach
       || bb[3] < pos.z - reach || bb[1] > pos.z + reach) continue;
      for (let i = 0; i < line.length; i++) {
        const [px, py] = toPx(line[i][0], line[i][1]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }

  zoom(dir) { this.scale = Math.min(32, Math.max(0.5, this.scale * (dir > 0 ? 1.5 : 1 / 1.5))); }

  /**
   * True when the next update() would actually redraw. update() throttles itself to ~15fps,
   * so without this callers spend every frame assembling a marker list it throws away — in
   * Miami that was 1.9ms and ~900 allocations per frame for nothing.
   */
  due(now = performance.now()) { return now - this._last >= 66; }

  update({ pos, yaw, remotes, driving, markers = [] }) {
    const now = performance.now();
    if (now - this._last < 66) return;   // ~15 fps is plenty
    this._last = now;
    const { ctx, size, dpr, scale } = this;
    const c = size / 2;
    const toPx = (x, z) => [c + (x - pos.x) / scale, c + (z - pos.z) / scale];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // clip to circle
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(4,10,14,0.85)'; ctx.fillRect(0, 0, size, size);

    // grid (100 m)
    const g = 100 / scale;
    ctx.strokeStyle = 'rgba(57,255,136,0.07)'; ctx.lineWidth = 1;
    const ox = ((-pos.x / scale) % g + g) % g, oz = ((-pos.z / scale) % g + g) % g;
    ctx.beginPath();
    for (let x = ox; x < size; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, size); }
    for (let y = oz; y < size; y += g) { ctx.moveTo(0, y); ctx.lineTo(size, y); }
    ctx.stroke();

    // real streets, under everything else
    this._drawRoads(ctx, toPx, pos, size, scale);

    // footprints
    for (const f of this.footprints) {
      const [x, y] = toPx(f.x, f.z);
      if (x < -50 || y < -50 || x > size + 50 || y > size + 50) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-f.rot);
      ctx.fillStyle = f.ramp ? 'rgba(179,84,30,0.8)' : 'rgba(120,130,140,0.7)';
      ctx.fillRect(-f.w / 2 / scale, -f.d / 2 / scale, f.w / scale, f.d / scale);
      ctx.restore();
    }

    // restricted zones (Redstone Arsenal) — dashed amber ring + label, so the
    // boundary is readable before you fly into it
    if (this.nofly.length) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(255,179,71,0.75)';
      ctx.lineWidth = 1.5;
      for (const z of this.nofly) {
        const [zx, zy] = toPx(z.cx, z.cz);
        const r = z.r / scale;
        if (zx + r < 0 || zy + r < 0 || zx - r > size || zy - r > size) continue;
        ctx.beginPath(); ctx.arc(zx, zy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.save();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,179,71,0.10)';
        ctx.fill();
        ctx.restore();
        if (r > 22 && zx > 0 && zx < size && zy > 0 && zy < size) {
          ctx.save(); ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,179,71,0.9)';
          ctx.font = 'bold 8px Menlo, monospace'; ctx.textAlign = 'center';
          ctx.fillText('RESTRICTED', zx, zy);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // range rings
    ctx.strokeStyle = 'rgba(57,255,136,0.25)';
    for (const r of [c / 2, c - 1]) { ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke(); }

    // landmarks
    ctx.font = '9px Menlo, monospace'; ctx.textAlign = 'center';
    for (const l of this.landmarks) {
      let [x, y] = toPx(l.pos.x, l.pos.z);
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      const onEdge = d > c - 8;
      if (onEdge) { x = c + dx / d * (c - 8); y = c + dy / d * (c - 8); }
      ctx.fillStyle = onEdge ? 'rgba(255,179,71,0.6)' : '#ffb347';
      ctx.beginPath(); ctx.arc(x, y, onEdge ? 2.5 : 3.5, 0, Math.PI * 2); ctx.fill();
      if (!onEdge) { ctx.fillStyle = '#ffb347'; ctx.fillText(l.name.toUpperCase(), x, y - 6); }
    }

    // mission markers
    for (const m of markers) {
      let [x, y] = toPx(m.x, m.z);
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      const edge = d > c - 7;
      // cameras are ambient, not destinations — hide when off-radar instead of ringing the rim
      if (edge && (m.kind === 'cam' || m.kind === 'shop')) continue;
      if (edge) { x = c + dx / d * (c - 7); y = c + dy / d * (c - 7); }
      ctx.save(); ctx.translate(x, y);
      if (m.kind === 'shop') { ctx.fillStyle='#ffcc33'; ctx.fillRect(-3,-3,6,6); ctx.strokeStyle='#7a5a00'; ctx.strokeRect(-3,-3,6,6); }
      else if (m.kind === 'cam') { ctx.fillStyle = m.alpr ? '#ff4d5a' : 'rgba(255,77,90,0.55)'; ctx.beginPath(); ctx.moveTo(0,-3.5); ctx.lineTo(3,2.5); ctx.lineTo(-3,2.5); ctx.closePath(); ctx.fill(); }
      else if (m.kind === 'stop') { ctx.fillStyle = m.done ? 'rgba(255,95,162,0.4)' : '#ff5fa2'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); }
      else if (m.kind === 'car') { ctx.fillStyle = m.ai ? '#9fd8ff' : '#dddddd'; ctx.fillRect(-2.5, -2, 5, 4); }
      else if (m.kind === 'cell') { ctx.rotate(Math.PI / 4); ctx.fillStyle = edge ? 'rgba(255,138,31,0.6)' : '#ff8a1f'; ctx.fillRect(-3, -3, 6, 6); }
      else if (m.kind === 'coin') { ctx.fillStyle = m.color || '#00b371'; ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e7f3ea'; ctx.lineWidth = 1; ctx.stroke(); }
      else if (m.kind === 'race') {
        const col = m.color || '#4fd8ff';
        if (m.dim) { ctx.strokeStyle = 'rgba(79,216,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke(); }
        else { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, edge ? 5 : 6.5, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill(); }
      }
      else { ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }

    // remote players
    for (const r of remotes) {
      let [x, y] = toPx(r.pos.x, r.pos.z);
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      if (d > c - 6) { x = c + dx / d * (c - 6); y = c + dy / d * (c - 6); }
      ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // player arrow (forward = (-sin yaw, -cos yaw) in x,z)
    ctx.save(); ctx.translate(c, c); ctx.rotate(-yaw);
    ctx.fillStyle = driving ? '#ff3b1f' : '#39ff88';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();

    // rim + north
    ctx.strokeStyle = '#1d8a4c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#39ff88'; ctx.font = 'bold 10px Menlo, monospace'; ctx.textAlign = 'center';
    ctx.fillText('N', c, 11);
    ctx.font = '9px Menlo, monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#1d8a4c';
    ctx.fillText(`${Math.round(c * scale)} M`, size - 6, size - 6);
  }
}
