/**
 * Playable characters: the parts contract, and Liberty's torch.
 *
 * Player and remotes reach straight into userData.parts — player.js toggles
 * parts.wing on every glide, golf.js drives parts.armL — so a character missing a
 * part throws at runtime, in one city, on one action, which is the worst way to
 * find out. This checks the shape up front.
 *
 * Several builds draw CanvasTextures and need a DOM; those are skipped rather than
 * faked, because a fake canvas would only test the fake. The contract is shared, so
 * the ones that do build here exercise it.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CHARACTERS, CHARACTER_KEYS } from '../src/characters.js';

const REQUIRED = ['flame', 'f1', 'f2', 'wing', 'visor'];

const built = [];
const skipped = [];
for (const [key, def] of Object.entries(CHARACTERS)) {
  try { built.push([key, def.build()]); } catch (e) {
    if (/document is not defined/.test(e.message)) { skipped.push(key); continue; }
    throw new Error(`${key} failed to build: ${e.message}`);
  }
}
assert.ok(built.length >= 6, `only ${built.length} characters built headless; the skip guard is too broad`);

for (const [key, g] of built) {
  const p = g.userData.parts;
  assert.ok(p, `${key}: no userData.parts — player.js reads this unconditionally`);
  for (const k of REQUIRED) assert.ok(p[k], `${key}: parts.${k} is missing`);

  // Both start stowed. A character shipping with its flame lit burns on the ground.
  assert.equal(p.flame.visible, false, `${key}: flame must start hidden`);
  assert.equal(p.wing.visible, false, `${key}: wing must start hidden`);

  // Sanity on scale: the contract says roughly 2.2 m, and these share one world.
  p.wing.removeFromParent();
  p.flame.removeFromParent();
  const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  assert.ok(size.y > 0.2 && size.y < 3.2, `${key}: ${size.y.toFixed(2)} m tall is outside the playable range`);
  assert.ok(Math.max(size.x, size.z) < 4, `${key}: ${Math.max(size.x, size.z).toFixed(2)} m across is wider than the glider wing`);
}

// Liberty's whole point: the torch is the thruster, not a rocket bolted underneath.
// makeFlame builds its cones pointing DOWN, so the flip is the load-bearing line. If
// it is ever lost the flame hangs under her raised hand like a dropped match.
{
  const g = CHARACTERS.liberty.build();
  const p = g.userData.parts;
  const at = p.flame.position.clone();
  const box = new THREE.Box3().setFromObject(p.flame);

  assert.ok(at.y > 2.0, `flame sits at y=${at.y.toFixed(2)}, not up at the torch`);
  assert.ok(at.x > 0.2, 'flame should be out at the raised hand, not on the centreline');
  assert.ok(box.max.y - at.y > 0.2, 'flame must extend UPWARD out of the bowl');
  assert.ok(at.y - box.min.y < 0.1, 'flame must not hang below the torch bowl');

  // Torch and fire keep their colours when a remote player is tinted.
  let tinted = 0;
  p.flame.traverse((o) => { if (o.isMesh && !o.userData.noTint) tinted++; });
  assert.equal(tinted, 0, 'flame meshes must be noTint or remotes recolour the fire');
}

console.log(`characters: ${built.length} built and checked, ${skipped.length} skipped (need a DOM: ${skipped.join(', ')})`);
console.log(`characters: ${CHARACTER_KEYS.length} registered`);
