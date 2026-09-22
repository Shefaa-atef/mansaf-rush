import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rimTop, sleeveRestHeight } from '../src/trayRim.ts';

test('the rim is only there over the tray wall', () => {
  assert.equal(rimTop(1.5), -Infinity, 'inside the bowl the food is the obstacle, not the metal');
  assert.equal(rimTop(2.4), -Infinity, 'beyond the wall there is nothing to hit from above');
  assert.ok(Math.abs(rimTop(2.22) - .603) < 1e-9, 'the rolled lip is the highest point');
  for (const r of [2.0, 2.1, 2.2, 2.24]) assert.ok(rimTop(r) < .603 + 1e-9);
});

test('a sleeve tube must ride up to the lip height plus its own radius', () => {
  const need = sleeveRestHeight(2.22, .12);
  assert.ok(Math.abs(need - (.603 + .12)) < 1e-9, `expected .723, got ${need}`);
  // Beside the lip the curved side still touches it, so some lift is needed there too.
  assert.ok(sleeveRestHeight(2.3, .12) > .603, 'a tube just outside the lip still has to clear it');
  assert.ok(sleeveRestHeight(2.3, .12) < need);
});

test('a sleeve well away from the wall needs no lift', () => {
  assert.equal(sleeveRestHeight(1.6, .15), -Infinity);
  assert.equal(sleeveRestHeight(2.6, .15), -Infinity);
});
