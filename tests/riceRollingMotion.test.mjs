import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshLokma, performRoll } from '../src/lokma.ts';
import { riceRollingMotion } from '../src/riceRollingMotion.ts';

test('rice compresses and turns under finger pressure, then keeps its orientation', () => {
  const l = { ...freshLokma(), shaping: true, space: true };
  performRoll(l, 'left', 1000);
  const start = riceRollingMotion(l, 1000), middle = riceRollingMotion(l, 1320), end = riceRollingMotion(l, 1640);
  assert.equal(start.compression, 0);
  assert.ok(middle.compression > .08 && middle.x < 0);
  assert.ok(middle.angle < 0 && middle.angle > end.angle);
  assert.equal(end.compression, 0);
  assert.ok(Math.abs(end.x) < 1e-8);
  assert.equal(riceRollingMotion(l, 3000).angle, end.angle);
  assert.ok(start.formation < middle.formation && middle.formation < end.formation);
});

test('reversing midway starts from the current rice angle instead of snapping', () => {
  const l = { ...freshLokma(), shaping: true, space: true };
  performRoll(l, 'left', 1000);
  const before = riceRollingMotion(l, 1220).angle;
  performRoll(l, 'right', 1220);
  assert.equal(riceRollingMotion(l, 1220).angle, before);
  assert.ok(riceRollingMotion(l, 1860).angle > before);
});

test('final roll finishes shaping before the rice stops moving', () => {
  const l = { ...freshLokma(), shaping: true, space: true };
  performRoll(l, 'left', 1000); performRoll(l, 'right', 1700); performRoll(l, 'left', 2400);
  assert.equal(l.readyToEat, true);
  assert.equal(riceRollingMotion(l, 2700).active, true);
  assert.equal(riceRollingMotion(l, 3040).formation, 1);
  assert.equal(riceRollingMotion(l, 3040).active, false);
});
