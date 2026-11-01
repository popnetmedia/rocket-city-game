/**
 * Contact shadow fade. Only the pure curve is exercised here: src/shadows.js
 * builds its blob on a canvas, so it needs a DOM and cannot load under node.
 * Same split as the derby and interiors suites.
 */
import assert from 'node:assert/strict';
import { shadowFor, FADE_HEIGHT, SPREAD } from '../src/render/shadow.js';

// On the ground: full strength, footprint untouched.
{
  const g = shadowFor(0, 3);
  assert.equal(g.strength, 1, 'a resting object casts a full-strength shadow');
  assert.equal(g.radius, 3, 'and one exactly its own footprint');
}

// Gone by the fade height, and stays gone above it.
{
  assert.equal(shadowFor(FADE_HEIGHT, 1).strength, 0, 'faded out at FADE_HEIGHT');
  assert.equal(shadowFor(FADE_HEIGHT * 9, 1).strength, 0, 'and does not come back');
  assert.equal(shadowFor(FADE_HEIGHT * 9, 1).radius, 1 + SPREAD, 'radius clamps too');
}

// Both halves of the effect must move, and in opposite directions: weakening
// without spreading reads as a light switching off rather than as height.
{
  let prevS = Infinity, prevR = -Infinity;
  for (let h = 0; h <= FADE_HEIGHT; h += FADE_HEIGHT / 40) {
    const g = shadowFor(h, 2);
    assert.ok(g.strength <= prevS, `strength must not rise (h=${h})`);
    assert.ok(g.radius >= prevR, `radius must not shrink (h=${h})`);
    assert.ok(g.strength >= 0 && g.strength <= 1, `strength in range (h=${h})`);
    prevS = g.strength; prevR = g.radius;
  }
  assert.ok(shadowFor(FADE_HEIGHT / 2, 2).radius > 2, 'it really does spread');
}

// Junk height must not produce a shadow pinned under a player at scene origin,
// which is hundreds of metres underground in most of these cities.
{
  for (const bad of [NaN, Infinity, undefined, null]) {
    assert.equal(shadowFor(bad, 1).strength, 0, `${bad} must fade out, not default to solid`);
  }
  assert.equal(shadowFor(-5, 1).strength, 1, 'slightly below ground still rests on it');
}

console.log('shadows: all assertions passed');
