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
