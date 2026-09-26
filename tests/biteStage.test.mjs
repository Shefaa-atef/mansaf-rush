import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_SCOOP, MIN_SCOOP, biteStage, biteStep, freshLokma, lockScoop, performRoll, updateScoop } from '../src/lokma.ts';

test('a fresh lokma starts at the move stage, step one', () => {
  const l = freshLokma();
  assert.equal(biteStage(l), 'move');
  assert.equal(biteStep(biteStage(l)), 0);
});

test('holding Scoop walks scooping, enough, full as the palm fills', () => {
  const l = freshLokma();
  l.gathering = true;
  assert.equal(biteStage(l), 'scooping');
  l.amount = MIN_SCOOP - 0.01;
  assert.equal(biteStage(l), 'scooping', 'just short of enough is still scooping');
  l.amount = MIN_SCOOP;
  assert.equal(biteStage(l), 'enough', 'the moment there is enough rice');
  l.amount = MAX_SCOOP - 0.01;
  assert.equal(biteStage(l), 'enough');
  l.amount = MAX_SCOOP;
  assert.equal(biteStage(l), 'full');
  assert.equal(biteStep('enough'), 0, 'gathering is all step one');
});

test('letting go with enough rice ends the gathering and starts the roll', () => {
  const l = freshLokma();
  l.gathering = true;
  updateScoop(l, 1, 1000); // 2.6 rice
  assert.equal(biteStage(l), 'enough');
  lockScoop(l);
  assert.equal(biteStage(l), 'rolling');
  assert.equal(biteStep('rolling'), 1);
});

test('letting go too early keeps the rice in the palm and asks for more', () => {
  const l = freshLokma();
  l.gathering = true;
  l.amount = MIN_SCOOP - 0.5;
  lockScoop(l);
  assert.equal(biteStage(l), 'topup');
  assert.equal(biteStep('topup'), 0, 'still step one');
  l.gathering = true;
  assert.equal(biteStage(l), 'scooping', 'holding again is scooping again');
});

test('rolling to a circle reaches ready, and eating is the last step', () => {
  const l = freshLokma();
  l.gathering = true;
  l.amount = 2;
  lockScoop(l);
  for (let i = 0; i < l.targetRolls; i++) assert.ok(performRoll(l, i % 2 ? 'right' : 'left', 100 + i * 1000));
  assert.equal(biteStage(l), 'ready');
  assert.equal(biteStep('ready'), 2);
  l.eating = 5000;
  assert.equal(biteStage(l), 'eating');
  assert.equal(biteStep('eating'), 2);
});
