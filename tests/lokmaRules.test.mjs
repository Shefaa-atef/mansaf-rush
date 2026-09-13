import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshLokma, updateMeter, lockMeter, performRoll, beginEating, lokmaScore } from '../src/lokma.ts';

test('gather, hold Space to roll, finish the ball, then eat', () => {
  const l = freshLokma();
  l.space = true;
  l.gathering = true;
  updateMeter(l, 1.2, 1000);
  lockMeter(l, 1000);
  assert.equal(l.meterZone, 'perfect');
  assert.equal(l.gathering, false);
  assert.equal(beginEating(l, 1000), false);
  l.space = false;
  assert.equal(performRoll(l, 'left', 1100), false);
  assert.equal(l.rolls, 0);
  l.space = true;
  assert.equal(performRoll(l, 'left', 1200), true);
  performRoll(l, 'right', 1900);
  performRoll(l, 'left', 2600);
  assert.equal(beginEating(l, 2700), false);
  assert.equal(beginEating(l, 3300), true);
});

test('releasing Space cannot reset shaping progress or trap an empty scoop', () => {
  const l = { ...freshLokma(), gathering: true };
  lockMeter(l, 1000);
  assert.equal(l.gathering, false);
  Object.assign(l, { meter: 60, gathering: true, space: true });
  lockMeter(l, 1100);
  performRoll(l, 'left', 1200);
  lockMeter(l, 1300);
  assert.equal(l.rolls, 1);
});

test('lamb and almond bonuses stack on a successfully eaten bite', () => {
  for (const meterZone of ['perfect', 'overfilled']) {
    const l = { ...freshLokma(), meterZone, since: 1000 };
    const base = lokmaScore(l, 6000);
    l.meat = true;
    assert.equal(lokmaScore(l, 6000), base + 2);
    l.almond = true;
    assert.equal(lokmaScore(l, 6000), base + 3);
  }
});

test('meter enters green at the same elapsed time across frame rates', () => {
  for (const fps of [15, 30, 60, 120]) {
    const l = { ...freshLokma(), gathering: true };
    for (let i = 0; i < fps * 1.2; i++) updateMeter(l, 1 / fps, 1000 + i * 1000 / fps);
    assert.ok(Math.abs(l.meter - 60) < .001);
    assert.equal(l.meterZone, 'perfect');
    lockMeter(l, 2200);
    updateMeter(l, 1, 3200);
    assert.ok(Math.abs(l.meter - 60) < .001);
  }
});

test('releasing below green allows gathering to resume instead of a doomed bite', () => {
  const l = { ...freshLokma(), gathering: true };
  updateMeter(l, .6, 1000);
  lockMeter(l, 1600);
  assert.equal(l.shaping, false);
  l.gathering = true;
  updateMeter(l, .6, 2200);
  lockMeter(l, 2200);
  assert.equal(l.shaping, true);
  assert.equal(l.meterZone, 'perfect');
});
