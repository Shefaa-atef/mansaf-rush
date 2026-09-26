import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROLL_PUSH, ROLL_RELEASE, STICK_DEAD_ZONE, rollFromMove, rollSide, setTouchSteer, steerFromStick, stickFromOffset, touchSteer,
} from '../src/joystick.ts';

const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, `${message}: ${a} vs ${b}`);

test('a thumb inside the stick is passed through, and one outside is held on the rim', () => {
  assert.deepEqual(stickFromOffset(0, 0, 50), { x: 0, y: 0 });
  const inside = stickFromOffset(25, 0, 50);
  near(inside.x, 0.5, 'half way right'); near(inside.y, 0, 'no vertical');
  const rim = stickFromOffset(300, 400, 50);
  near(Math.hypot(rim.x, rim.y), 1, 'clamped to the unit circle');
  near(rim.x / rim.y, 0.75, 'keeps the direction of the push');
});

test('an unusable radius never divides by zero', () => {
  assert.deepEqual(stickFromOffset(10, 10, 0), { x: 0, y: 0 });
});

test('the dead zone holds the hand still, and full push is full speed', () => {
  assert.deepEqual(steerFromStick({ x: STICK_DEAD_ZONE * 0.9, y: 0 }), { x: 0, y: 0 });
  const full = steerFromStick({ x: 0, y: -1 });
  near(full.x, 0, 'x'); near(full.y, -1, 'full push forward');
});

test('steering grows smoothly with the push and keeps its direction', () => {
  let last = 0;
  for (const push of [0.25, 0.4, 0.6, 0.8, 1]) {
    const s = steerFromStick({ x: push * 0.6, y: push * 0.8 });
    const length = Math.hypot(s.x, s.y);
    assert.ok(length > last, `steering ${length} should exceed ${last} at push ${push}`);
    near(s.x / length, 0.6, 'direction x'); near(s.y / length, 0.8, 'direction y');
    last = length;
  }
  assert.ok(last <= 1 + 1e-9, 'never faster than full speed');
});

test('the shared steering store is written and read back', () => {
  setTouchSteer(0.3, -0.7);
  assert.deepEqual({ x: touchSteer.x, y: touchSteer.y }, { x: 0.3, y: -0.7 });
  setTouchSteer(0, 0);
  assert.deepEqual({ x: touchSteer.x, y: touchSteer.y }, { x: 0, y: 0 });
});

test('rolling: a flick to a side rolls once and holding it does not roll again', () => {
  let side = '';
  const rolls = [];
  for (const x of [0, 0.3, 0.6, 0.9, 1, 1, 0.9]) {
    const next = rollSide(x, side);
    const roll = rollFromMove(side, next);
    if (roll) rolls.push(roll);
    side = next;
  }
  assert.deepEqual(rolls, ['right']);
});

test('rolling: swinging from one side to the other rolls each way without stopping in the middle', () => {
  let side = '';
  const rolls = [];
  for (const x of [0, 0.8, 0.2, -0.8, 0.8, -0.8]) {
    const next = rollSide(x, side);
    const roll = rollFromMove(side, next);
    if (roll) rolls.push(roll);
    side = next;
  }
  assert.deepEqual(rolls, ['right', 'left', 'right', 'left']);
});

test('rolling: a wobble around the threshold cannot chatter into extra rolls', () => {
  let side = 'right';
  const rolls = [];
  // Hovering between the release and push thresholds keeps the side we were on.
  for (const x of [ROLL_PUSH + 0.02, ROLL_PUSH - 0.05, ROLL_RELEASE + 0.05, ROLL_PUSH - 0.02, ROLL_PUSH + 0.02]) {
    const next = rollSide(x, side);
    const roll = rollFromMove(side, next);
    if (roll) rolls.push(roll);
    side = next;
  }
  assert.deepEqual(rolls, []);
  assert.equal(rollSide(ROLL_RELEASE - 0.05, 'right'), '', 'coming back to the middle clears the side');
});
