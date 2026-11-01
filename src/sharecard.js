/**
 * Generates a shareable score card (canvas PNG) and offers it via the Web Share
 * API (mobile) or a download + copied link (desktop). No external services.
 */
import { activeCity, cityPlaceLabel } from './cities/index.js';
/** Share a Flock camera: composite the live game view with camera info + branding. */
export async function shareFlockCam({ renderer, lat, lon, count }) {
  const src = renderer.domElement;
  const W = 1200, H = Math.round((src.height / src.width) * W) || 675;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  try { g.drawImage(src, 0, 0, W, H); } catch { /* tainted? unlikely for our own canvas */ }
  // darken lower third for text
  const grad = g.createLinearGradient(0, H * 0.6, 0, H);
  grad.addColorStop(0, 'rgba(5,7,10,0)'); grad.addColorStop(1, 'rgba(5,7,10,0.9)');
  g.fillStyle = grad; g.fillRect(0, H * 0.6, W, H * 0.4);
  // red alert bar
  g.fillStyle = 'rgba(255,40,60,0.92)'; g.fillRect(0, 0, W, 52);
  g.fillStyle = '#fff'; g.font = 'bold 30px "Chakra Petch", Menlo, monospace'; g.textAlign = 'left';
  g.fillText('📸 FLOCK ALPR CAMERA', 24, 37);
  g.textAlign = 'right'; g.font = '20px Menlo, monospace';
  g.fillText(`${count} mapped in the region`, W - 24, 34);
  // location + branding
  g.textAlign = 'left';
  g.fillStyle = '#ff5566'; g.font = 'bold 40px "Chakra Petch", Menlo, monospace';
  g.fillText(`${lat.toFixed(5)}, ${lon.toFixed(5)}`, 30, H - 70);
  g.fillStyle = '#cfe9d8'; g.font = '24px Menlo, monospace';
  g.fillText('License-plate reader · data via DeFlock.me', 30, H - 38);
  g.fillStyle = '#39ff88'; g.font = 'bold 22px Menlo, monospace';
  g.fillText('Find them all — ' + location.host, 30, H - 10);

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'flock-camera.png', { type: 'image/png' });
  const text = `Spotted a Flock ALPR camera at ${lat.toFixed(5)}, ${lon.toFixed(5)} — one of ${count} mapped across the ${activeCity().meta.name} region. See them all: ${location.origin}`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, title: 'Flock camera — Rocket City CC' }); return 'shared'; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'flock-camera.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  try { await navigator.clipboard.writeText(text); } catch {}
  return 'downloaded';
}

/**
 * Grab the live game view and wrap it in a branded card so a shared screenshot
 * always reads as "from Rocket City." caption = big label (place), sub = smaller
 * line (coords / weather). Shares via Web Share API (mobile) or downloads + copies
 * the link (desktop).
 */
export async function sharePhoto({ renderer, caption = cityPlaceLabel(), sub = '' }) {
  const src = renderer.domElement;
  const W = 1280;
  const shotH = Math.round((src.height / src.width) * W) || 720;
  const barH = 150;
  const H = shotH + barH;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
  try { g.drawImage(src, 0, 0, W, shotH); } catch { /* our own canvas */ }
  // fade the bottom of the shot into the brand bar
  const grad = g.createLinearGradient(0, shotH - 90, 0, shotH);
  grad.addColorStop(0, 'rgba(5,7,10,0)'); grad.addColorStop(1, 'rgba(5,7,10,0.95)');
  g.fillStyle = grad; g.fillRect(0, shotH - 90, W, 90);
  // brand bar
  g.fillStyle = '#070f0b'; g.fillRect(0, shotH, W, barH);
  g.strokeStyle = '#123526'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, shotH + 1); g.lineTo(W, shotH + 1); g.stroke();
  // wordmark + tagline (left)
  g.textAlign = 'left';
  g.fillStyle = '#39ff88'; g.font = 'bold 50px "Chakra Petch", Menlo, monospace';
  g.shadowColor = 'rgba(57,255,136,0.6)'; g.shadowBlur = 18;
  g.fillText('ROCKET CITY CC', 44, shotH + 66); g.shadowBlur = 0;
  g.fillStyle = '#7da58c'; g.font = '22px Menlo, monospace';
  g.fillText(`Fly the real ${activeCity().meta.name} in 3D`, 46, shotH + 100);
  g.fillStyle = '#39ff88'; g.font = 'bold 26px Menlo, monospace';
  g.fillText('▶ ' + location.host, 46, shotH + 134);
  // caption + sub (right)
  g.textAlign = 'right';
  g.fillStyle = '#ffb347'; g.font = 'bold 34px "Chakra Petch", Menlo, monospace';
  g.fillText(String(caption).toUpperCase().slice(0, 34), W - 44, shotH + 66);
  if (sub) { g.fillStyle = '#cfe9d8'; g.font = '22px Menlo, monospace'; g.fillText(String(sub), W - 44, shotH + 102); }
  g.fillStyle = '#7da58c'; g.font = '18px Menlo, monospace';
  g.fillText('🚀 rocketcity.cc', W - 44, shotH + 134);
  // targeting frame + corner ticks around the whole card
  g.strokeStyle = 'rgba(57,255,136,0.9)'; g.lineWidth = 4; g.strokeRect(10, 10, W - 20, H - 20);
  g.lineWidth = 5; const T = 34;
  for (const [x, y, dx, dy] of [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]]) {
    g.beginPath(); g.moveTo(x, y + dy * T); g.lineTo(x, y); g.lineTo(x + dx * T, y); g.stroke();
  }

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'rocket-city.png', { type: 'image/png' });
  const text = `Flying the real ${activeCity().meta.name} in 3D on Rocket City CC. ${location.origin}`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, title: 'Rocket City CC' }); return 'shared'; } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'rocket-city.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ }
  return 'downloaded';
}

export async function shareRun({ title, time, tag, rank, hero }) {
  const W = 1200, H = 630;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // background
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1f16'); bg.addColorStop(1, '#05070a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  if (hero) { try { g.globalAlpha = 0.28; g.drawImage(hero, 0, 0, W, H); g.globalAlpha = 1; } catch {} }
  // scanlines
  g.fillStyle = 'rgba(255,255,255,0.02)';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  // frame
  g.strokeStyle = '#1f7a4a'; g.lineWidth = 4; g.strokeRect(20, 20, W - 40, H - 40);
  g.textAlign = 'center';
  g.fillStyle = '#7da58c'; g.font = 'bold 26px Menlo, monospace';
  g.fillText('ROCKET CITY CC — THE GAME', W / 2, 90);
  g.fillStyle = '#39ff88'; g.font = 'bold 60px "Chakra Petch", Menlo, monospace';
  g.shadowColor = 'rgba(57,255,136,0.7)'; g.shadowBlur = 24;
  g.fillText(title, W / 2, 190); g.shadowBlur = 0;
  // time
  g.fillStyle = '#ffb347'; g.font = 'bold 150px "Chakra Petch", Menlo, monospace';
  g.fillText(time, W / 2, 380);
  g.fillStyle = '#cfe9d8'; g.font = '30px Menlo, monospace';
  g.fillText(rank ? `${tag}  ·  RANK #${rank}` : tag, W / 2, 450);
  g.fillStyle = '#7da58c'; g.font = '24px Menlo, monospace';
  g.fillText(`Fly the real ${activeCity().meta.name} — ` + location.host, W / 2, 560);

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'rocket-city-run.png', { type: 'image/png' });
  const text = `I flew ${title} in ${time} on Rocket City CC — a playable 3D ${activeCity().meta.name}. ${location.origin}`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, title: 'Rocket City CC' }); return 'shared'; } catch { /* fall through */ }
  }
  // desktop fallback: download the PNG + copy the link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'rocket-city-run.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  try { await navigator.clipboard.writeText(text); } catch {}
  return 'downloaded';
}
