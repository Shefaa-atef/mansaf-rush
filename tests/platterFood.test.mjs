import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BREAD_PER_PATCH, botSeats, createPlatterFood, foodPatches } from '../src/platterFood.ts';

test('each bot starts nearby and progressively reaches farther into the platter', () => {
  for (const seat of botSeats) {
    const food = createPlatterFood();
    let previousDistance = 0;
    for (let i = 0; i < foodPatches.length; i++) {
      const target = food.target(...seat);
      assert.ok(target);
      const distance = Math.hypot(target.x - seat[0], target.z - seat[1]);
      assert.ok(distance >= previousDistance - 1e-8);
      const closest = Math.min(...foodPatches.filter((_, j) => food.amounts[j] > 1e-8)
        .map(p => Math.hypot(p.x - seat[0], p.z - seat[1])));
      assert.ok(Math.abs(distance - closest) < 1e-8);
      food.consume(...seat, 100 / foodPatches.length);
      previousDistance = distance;
    }
    assert.equal(food.target(...seat), undefined);
  }
});

test('shared bites conserve food, skip empty areas, and replay restores all cells', () => {
  const food = createPlatterFood();
  for (const seat of botSeats) assert.ok(Math.abs(food.consume(...seat, 7) - 7) < 1e-8);
  assert.ok(Math.abs(food.amounts.reduce((a, b) => a + b, 0) - 79) < 1e-8);
  assert.ok(Math.abs(food.consume(0, 1.8, 100) - 79) < 1e-8);
  assert.equal(food.target(0, 0), undefined);
  food.reset();
  assert.ok(Math.abs(food.amounts.reduce((a, b) => a + b, 0) - 100) < 1e-8);
  assert.ok(food.amounts.every(amount => amount > 0));
});

test('rice exposes edible bread, and eating the bread empties that patch', () => {
  const food = createPlatterFood(), patch = foodPatches[0];
  const rice = 100 / foodPatches.length - BREAD_PER_PATCH;
  food.consume(patch.x, patch.z, rice);
  assert.equal(food.riceAvailable(0), false);
  assert.equal(food.breadAvailable(0), true);
  assert.ok(Math.abs(food.amounts[0] - BREAD_PER_PATCH) < 1e-8);
  food.consume(patch.x, patch.z, BREAD_PER_PATCH);
  assert.equal(food.breadAvailable(0), false);
  food.reset();
  assert.equal(food.riceAvailable(0), true);
  assert.equal(food.breadAvailable(0), true);
});

test('a piece of lamb or an almond can only be taken once, and the replay puts them back', () => {
  const food = createPlatterFood();
  assert.equal(food.isMeatTaken(4), false);
  assert.equal(food.takeMeat(4), true);
  assert.equal(food.isMeatTaken(4), true);
  assert.equal(food.takeMeat(4), false, 'the same piece cannot go into two lokmas');
  assert.equal(food.isMeatTaken(5), false, 'other pieces stay on the tray');
  assert.equal(food.takeAlmond(12), true);
  assert.equal(food.takeAlmond(12), false);
  food.reset();
  assert.equal(food.isMeatTaken(4), false);
  assert.equal(food.isAlmondTaken(12), false);
});

test('the scene is told when a piece leaves the tray, and can stop listening', () => {
  const food = createPlatterFood();
  let heard = 0;
  const before = food.trayVersion;
  const stop = food.subscribeTray(() => { heard++; });
  food.takeMeat(1);
  food.takeMeat(1);
  assert.equal(heard, 1, 'a piece that was already taken changes nothing');
  assert.equal(food.trayVersion, before + 1);
  stop();
  food.takeAlmond(2);
  assert.equal(heard, 1);
});

test('a tray that holds only rounding dust counts as finished, so the round can end', () => {
  const food = createPlatterFood();
  food.amounts.fill(0);
  food.amounts[3] = 2e-13;
  assert.ok(food.total > 0);
  assert.equal(food.empty, true);
  assert.equal(food.finished(3e-15), true, 'dust in the running tally must not keep the round alive');
  assert.equal(food.finished(0), true);
  food.amounts[3] = 0.5;
  assert.equal(food.finished(0.5), false);
  food.drain();
  assert.equal(food.total, 0);
});

test('no simulated round is left hanging on an empty tray', () => {
  // Bots and the player scoop in odd sizes until the tray is bare. Before the fix, about one round
  // in five ended with every cell empty but a running tally like 3e-15, so nothing ever ended it.
  let seed = 4242;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let round = 0; round < 1500; round++) {
    const food = createPlatterFood();
    let remaining = 100, steps = 0;
    while (!food.finished(remaining) && steps++ < 20000) {
      const who = Math.floor(random() * 4);
      const seat = who === 0 ? foodPatches[Math.floor(random() * foodPatches.length)] : { x: botSeats[who - 1][0], z: botSeats[who - 1][1] };
      const want = Math.min(remaining, who === 0 ? .02 + random() * .08 : 2 + Math.floor(random() * 4));
      const got = food.consume(seat.x, seat.z, want);
      assert.ok(got > 0 || food.finished(remaining), `round ${round} stalled with ${remaining} left and nothing to eat`);
      remaining = Math.max(0, remaining - got);
    }
    assert.ok(food.finished(remaining), `round ${round} never finished`);
  }
});

test('the scooper hears when a patch loses its rice, so the lamb and almonds on it can go with the scoop', () => {
  const food = createPlatterFood(), patch = foodPatches[0];
  const rice = 100 / foodPatches.length - BREAD_PER_PATCH;
  const gone = [];
  food.consume(patch.x, patch.z, rice / 2, i => gone.push(i));
  assert.deepEqual(gone, [], 'half the rice is still there');
  food.consume(patch.x, patch.z, rice / 2, i => gone.push(i));
  assert.deepEqual(gone, [0], 'the last of the rice went: reported once');
  food.consume(patch.x, patch.z, BREAD_PER_PATCH, i => gone.push(i));
  assert.deepEqual(gone, [0], 'eating the bread underneath is not reported again');

  const big = createPlatterFood(), seen = [];
  big.consume(0, 0, 6, i => seen.push(i));
  assert.ok(seen.length >= 3, 'a six unit scoop finishes the rice of several patches');
  assert.equal(new Set(seen).size, seen.length, 'each patch is reported once');
});
