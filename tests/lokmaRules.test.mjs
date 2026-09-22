import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshLokma, updateScoop, lockScoop, performRoll, beginEating, lokmaScore, lokmaScoreParts,
  pressEat, serveQueuedEat, nextRollSquashes,
  rollsToRound, maxRolls, zoneForRolls, meterForRolls, squashAmount,
  MIN_SCOOP, MAX_SCOOP, SCOOP_PER_SECOND, GREEN_ROLLS, GREEN_FROM, RED_FROM,
} from '../src/lokma.ts';

/** A lokma whose scoop is done and whose roll is about to start, with SPACE held. */
function readyToRoll(amount = 4) {
  const l = { ...freshLokma(), gathering: true, space: true, amount, since: 1000 };
  lockScoop(l);
  return l;
}

/** Roll a lokma round with quick taps. Returns the time of the last tap. */
function rollRound(l, start = 1000, gap = 100) {
  let at = start;
  for (let i = 0; i < l.targetRolls; i++, at += gap) performRoll(l, i % 2 ? 'right' : 'left', at);
  return at - gap;
}

test('scooping fills the palm with no gauge, at the same speed at every frame rate', () => {
  for (const fps of [15, 30, 60, 120]) {
    const l = { ...freshLokma(), gathering: true, space: true };
    for (let i = 0; i < fps * 1.2; i++) updateScoop(l, 1 / fps, 1000 + i * 1000 / fps);
    assert.ok(Math.abs(l.amount - 1.2 * SCOOP_PER_SECOND) < .001, `amount at ${fps} fps`);
    assert.equal(l.meter, 0, 'the scoop must not move the gauge');
    assert.equal(l.meterZone, 'loose');
  }
});

test('a full palm takes no more rice', () => {
  const l = { ...freshLokma(), gathering: true, space: true };
  updateScoop(l, 60, 1000);
  assert.equal(l.amount, MAX_SCOOP);
});

test('too little rice stays in the palm, and holding SPACE again adds to it', () => {
  const l = { ...freshLokma(), gathering: true, space: true };
  updateScoop(l, .3, 1000);
  assert.ok(l.amount < MIN_SCOOP);
  lockScoop(l);
  assert.equal(l.gathering, false);
  assert.equal(l.shaping, false, 'a tiny scoop must not start the roll');
  l.gathering = true;
  updateScoop(l, .5, 1500);
  lockScoop(l);
  assert.equal(l.shaping, true);
  assert.equal(l.rolls, 0);
});

test('the circle takes real work: at least six rolls, and more for a bigger scoop', () => {
  assert.equal(rollsToRound(MIN_SCOOP), 6, 'the smallest scoop that can be rolled');
  assert.equal(rollsToRound(4), 8);
  assert.equal(rollsToRound(MAX_SCOOP), 11, 'a full palm');
  let previous = 0;
  for (let amount = MIN_SCOOP; amount <= MAX_SCOOP; amount += .25) {
    const rolls = rollsToRound(amount);
    assert.ok(rolls >= previous, `${amount} rice must not need fewer rolls than less rice`);
    previous = rolls;
  }
  // Three taps used to make a circle. They no longer do, whatever the scoop.
  const l = readyToRoll(MIN_SCOOP);
  for (let i = 0; i < 3; i++) performRoll(l, 'left', 2000 + i * 100);
  assert.equal(l.readyToEat, false);
  assert.equal(l.meterZone, 'loose');
});

test('locking a scoop sets how many rolls it needs from how much rice is in the palm', () => {
  for (const amount of [MIN_SCOOP, 3, 5, MAX_SCOOP]) {
    assert.equal(readyToRoll(amount).targetRolls, rollsToRound(amount), `${amount} rice`);
  }
});

test('the gauge belongs to the roll: a round circle after the rolls the scoop needs, then it squashes', () => {
  const l = readyToRoll(4);
  assert.equal(l.targetRolls, 8);
  assert.equal(l.shaping, true);
  assert.equal(l.meter, 0);
  assert.equal(l.meterZone, 'loose');

  const zones = [], ready = [];
  for (let i = 0; i < maxRolls(l.targetRolls); i++) {
    assert.equal(performRoll(l, i % 2 ? 'right' : 'left', 2000 + i * 100), true);
    zones.push(l.meterZone);
    ready.push(l.readyToEat);
  }
  assert.equal(zones.length, 14);
  assert.deepEqual(zones, [
    ...Array(7).fill('loose'),       // rolls 1 to 7
    ...Array(4).fill('round'),       // rolls 8 to 11
    ...Array(3).fill('squashed'),    // rolls 12 to 14
  ]);
  assert.deepEqual(ready, [...Array(7).fill(false), ...Array(7).fill(true)]);
  assert.equal(l.meter, 100);
  assert.equal(performRoll(l, 'left', 9000), false, 'the roll has a limit');
  assert.equal(l.rolls, maxRolls(l.targetRolls));
});

test('the green zone is a window of a few rolls, and the next one squashes', () => {
  for (const target of [6, 8, 11]) {
    assert.equal(zoneForRolls(0, target), 'loose');
    assert.equal(zoneForRolls(target - 1, target), 'loose');
    for (let rolls = target; rolls < target + GREEN_ROLLS; rolls++) assert.equal(zoneForRolls(rolls, target), 'round', `${rolls} of ${target}`);
    assert.equal(zoneForRolls(target + GREEN_ROLLS, target), 'squashed');
    assert.ok(maxRolls(target) >= target + GREEN_ROLLS, 'the red zone must be reachable');
  }
});

test('the needle only moves right, and sits inside the colour of its zone', () => {
  for (const target of [6, 8, 11]) {
    assert.equal(meterForRolls(0, target), 0);
    assert.equal(meterForRolls(target, target), GREEN_FROM, 'the circle is where green starts');
    assert.equal(meterForRolls(maxRolls(target), target), 100);
    let previous = -1;
    for (let rolls = 0; rolls <= maxRolls(target); rolls++) {
      const meter = meterForRolls(rolls, target), zone = zoneForRolls(rolls, target);
      assert.ok(meter > previous, `roll ${rolls} of ${target} must move the needle`);
      previous = meter;
      if (zone === 'loose') assert.ok(meter < GREEN_FROM, `${rolls}/${target} loose`);
      if (zone === 'round') assert.ok(meter >= GREEN_FROM && meter < RED_FROM, `${rolls}/${target} round`);
      if (zone === 'squashed') assert.ok(meter > RED_FROM, `${rolls}/${target} squashed`);
    }
  }
});

test('the warning comes on the last green roll, before the lokma is squashed', () => {
  const l = readyToRoll(4);
  const warnedAfter = [];
  for (let i = 0; i < l.targetRolls + GREEN_ROLLS; i++) {
    performRoll(l, i % 2 ? 'right' : 'left', 2000 + i * 100);
    if (nextRollSquashes(l)) warnedAfter.push(l.rolls);
  }
  assert.deepEqual(warnedAfter, [l.targetRolls + GREEN_ROLLS - 1]);   // the last round roll only
});

test('the ball is drawn flatter as it heads for red, and fully flat once squashed', () => {
  const target = 8, at = rolls => squashAmount({ rolls, targetRolls: target });
  assert.equal(at(0), 0);
  assert.equal(at(target), 0, 'a fresh circle is not flattened');
  assert.equal(at(target + 1), 0);
  assert.ok(at(target + 2) > 0 && at(target + 2) < at(target + 3) && at(target + 3) < 1, 'it flattens gradually');
  assert.equal(at(target + GREEN_ROLLS), 1);
  assert.equal(at(maxRolls(target)), 1);
});

test('an eat press while the last roll is still turning is remembered and served when it stops', () => {
  const l = readyToRoll();
  const last = rollRound(l, 1000, 100);
  assert.equal(l.readyToEat, true);
  assert.equal(pressEat(l, last + 100), 'queued');
  assert.equal(l.eatQueued, true);
  assert.equal(l.eating, 0, 'it must not start mid-roll');
  assert.equal(serveQueuedEat(l, last + 300), false, 'the roll is still turning');
  assert.equal(serveQueuedEat(l, last + 700), true, 'the roll has stopped');
  assert.ok(l.eating > 0);
  assert.equal(l.eatQueued, false);
  assert.equal(serveQueuedEat(l, last + 800), false, 'served only once');
});

test('an eat press once the roll has stopped starts at once, and one on a loose lokma does nothing', () => {
  const l = readyToRoll();
  performRoll(l, 'left', 1000);
  assert.equal(pressEat(l, 1100), 'not-round-yet');
  assert.equal(l.eatQueued, false);
  let at = 1200;
  for (let i = 1; i < l.targetRolls; i++, at += 100) performRoll(l, i % 2 ? 'right' : 'left', at);
  assert.equal(l.readyToEat, true);
  assert.equal(pressEat(l, at + 1300), 'eating');
  assert.ok(l.eating > 0);
});

test('rolling needs SPACE held and a scoop to roll', () => {
  const l = readyToRoll();
  l.space = false;
  assert.equal(performRoll(l, 'left', 2000), false);
  assert.equal(l.rolls, 0);

  const gathering = { ...freshLokma(), gathering: true, space: true, amount: 4 };
  assert.equal(performRoll(gathering, 'left', 2000), false, 'still scooping: the arrows steer instead');
  assert.equal(gathering.rolls, 0);
});

test('only a formed circle can be eaten, and not while the last roll is still turning', () => {
  const l = readyToRoll();
  const rolls = l.targetRolls;
  for (let i = 0; i < rolls - 1; i++) performRoll(l, i % 2 ? 'right' : 'left', 1200 + i * 700);
  const lastButOne = 1200 + (rolls - 2) * 700;
  assert.equal(beginEating(l, lastButOne + 700), false, 'one roll short is still loose');
  const last = lastButOne + 700;
  performRoll(l, 'left', last);
  assert.equal(l.readyToEat, true);
  assert.equal(beginEating(l, last + 100), false, 'the last roll is still animating');
  assert.equal(beginEating(l, last + 700), true);
  assert.equal(l.failed, false);
});

test('a round lokma is worth far more than a squashed one', () => {
  const round = { ...freshLokma(), amount: 4, meterZone: 'round', since: 1000 };
  const squashed = { ...round, meterZone: 'squashed' };
  assert.ok(lokmaScore(round, 9000) >= lokmaScore(squashed, 9000) + 3);
});

test('rice with lamb or almonds is worth more than rice alone, in every zone', () => {
  for (const meterZone of ['round', 'squashed']) {
    const rice = { ...freshLokma(), amount: 4, meterZone, since: 1000 };
    const base = lokmaScore(rice, 9000);
    const withMeat = lokmaScore({ ...rice, meat: true }, 9000);
    const withAlmond = lokmaScore({ ...rice, almond: true }, 9000);
    const withBoth = lokmaScore({ ...rice, meat: true, almond: true }, 9000);
    assert.ok(withMeat > base, `${meterZone}: lamb must add points`);
    assert.ok(withAlmond > base, `${meterZone}: almonds must add points`);
    assert.equal(withBoth, base + (withMeat - base) + (withAlmond - base), 'the bonuses add up');
    assert.ok(withMeat - base > withAlmond - base, 'lamb is worth more than one almond');
  }
});

test('the score report says where the points came from', () => {
  const l = { ...freshLokma(), amount: 4, meterZone: 'round', since: 1000, meat: true, almond: true };
  const parts = lokmaScoreParts(l, 2000);
  assert.ok(parts.meat > 0 && parts.almond > 0 && parts.quick > 0);
  assert.equal(parts.total, parts.base + parts.quick + parts.meat + parts.almond);
  const plain = lokmaScoreParts({ ...l, meat: false, almond: false }, 2000);
  assert.equal(plain.meat, 0);
  assert.equal(plain.almond, 0);
});

test('a bigger scoop is worth more points, and a quick bite earns a bonus', () => {
  const small = { ...freshLokma(), amount: 3, meterZone: 'round', since: 1000 };
  const big = { ...small, amount: 6 };
  assert.ok(lokmaScore(big, 9000) > lokmaScore(small, 9000));
  assert.ok(lokmaScore(small, 2000) > lokmaScore(small, 9000), 'finishing fast pays');
});

test('a new lokma starts with no lamb, no almonds and nothing rolled', () => {
  const fresh = freshLokma();
  assert.equal(fresh.meat, false);
  assert.equal(fresh.almond, false);
  assert.equal(fresh.amount, 0);
  assert.equal(fresh.rolls, 0);
  assert.equal(fresh.meter, 0);
  assert.equal(fresh.meterZone, 'loose');
});
