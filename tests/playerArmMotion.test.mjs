import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playerArmMotion } from '../src/playerArmMotion.ts';
import { freshLokma } from '../src/lokma.ts';

test('gathering performs one controlled scoop and holds the rice', () => {
  const l = { ...freshLokma(), gathering: true, since: 1000 };
  const frames = [0, 240, 480, 960, 1800].map(t => playerArmMotion(l, 1000 + t));
  assert.ok(frames[1].sway < -.02);
  assert.ok(frames[3].weights.SCOOP_CLOSE > .99);
  assert.deepEqual(frames[3], frames[4]);
  assert.ok(frames.every(f => f.side === 0 && Math.abs(f.roll - 2.88) <= .181));
});

test('each roll alternates fingers and the final roll still animates', () => {
  const l = { ...freshLokma(), shaping: true, rolls: 1, rollAt: 2000, since: 1000, last: 'left' };
  const a = playerArmMotion(l, 2120), b = playerArmMotion(l, 2360);
  assert.ok(a.weights.KNEAD_A > a.weights.KNEAD_B);
  assert.ok(b.weights.KNEAD_B > b.weights.KNEAD_A);
  assert.ok(b.weights.KNEAD_A + b.weights.KNEAD_B > .95);
  l.shaping = false; l.readyToEat = true;
  assert.deepEqual(playerArmMotion(l, 2120), a);
});

test('eating keeps a supported grip until swallowing, then relaxes', () => {
  const l = { ...freshLokma(), eating: 3000, readyToEat: true };
  assert.ok(playerArmMotion(l, 3770).weights.HOLD_LOKMA > .8);
  assert.ok(!('EAT_PINCH' in playerArmMotion(l, 3770).weights));
  l.swallowed = true;
  assert.ok(playerArmMotion(l, 4580).weights.REACH > .99);
  assert.ok(playerArmMotion(l, 4720).weights.REACH > .99);
});

test('all gesture blends remain bounded and continuous through pose transitions', () => {
  for (const state of [{ gathering: true }, { shaping: true, rolls: 1, last: 'right' }, { eating: 1000 }]) {
    const l = { ...freshLokma(), since: 1000, rollAt: 1000, ...state };
    let previous;
    for (let time = 1000; time <= 2300; time += 5) {
      const frame = playerArmMotion(l, time), weights = Object.values(frame.weights);
      assert.ok(weights.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
      assert.ok(weights.reduce((a, b) => a + b, 0) <= 1.000001);
      if (previous && !state.shaping) {
        for (const name of new Set([...Object.keys(frame.weights), ...Object.keys(previous.weights)]))
          assert.ok(Math.abs((frame.weights[name] ?? 0) - (previous.weights[name] ?? 0)) < .15);
      }
      previous = frame;
    }
  }
});
