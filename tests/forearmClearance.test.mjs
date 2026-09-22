import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { forearmLift, SLEEVE_CUFF_RADIUS, SLEEVE_ELBOW_RADIUS, SLEEVE_FOOD_MARGIN } from '../src/forearmClearance.ts';
import { sleeveRestHeight } from '../src/trayRim.ts';

const flat = height => () => height;

test('a forearm already above the food needs no lift', () => {
  assert.equal(forearmLift(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-.4, 1, -.2), flat(.6)), 0);
});

test('a wrist resting on the food is lifted by the cuff radius plus the margin', () => {
  const lift = forearmLift(new THREE.Vector3(0, .9, 0), new THREE.Vector3(-.3, 1.4, 0), flat(.9));
  assert.ok(Math.abs(lift - (SLEEVE_CUFF_RADIUS + SLEEVE_FOOD_MARGIN)) < 1e-9, `lift ${lift}`);
});

test('the thicker sleeve near the elbow decides the lift when the elbow is the lowest point', () => {
  const lift = forearmLift(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(-.4, .9, 0), flat(.9));
  assert.ok(Math.abs(lift - (SLEEVE_ELBOW_RADIUS + SLEEVE_FOOD_MARGIN)) < 1e-9, `lift ${lift}`);
});

test('a forearm that dips into a dome between the wrist and the elbow is lifted for the worst sample', () => {
  const dome = (x, z) => .9 - Math.hypot(x + .2, z) * 2;
  const wrist = new THREE.Vector3(0, .8, 0), elbow = new THREE.Vector3(-.4, .8, 0);
  const lift = forearmLift(wrist, elbow, dome, 9);
  assert.ok(lift > .1 && lift < .3, `lift ${lift}`);
  const raised = forearmLift(wrist.clone().setY(.8 + lift), elbow.clone().setY(.8 + lift), dome, 9);
  assert.ok(Math.abs(raised) < 1e-9, 'lifting both ends by the reported amount clears every sample');
});

test('outside the tray there is no food and nothing to lift over', () => {
  assert.equal(forearmLift(new THREE.Vector3(3, .2, 0), new THREE.Vector3(3.4, .1, 0), () => -Infinity), 0);
});

test('over the tray lip the sleeve rests on the metal, not on the rice height below it', () => {
  const wrist = new THREE.Vector3(2.2, .5, 0), elbow = new THREE.Vector3(2.7, .5, 0);
  const lift = forearmLift(wrist, elbow, () => 5);
  const lip = sleeveRestHeight(2.2, SLEEVE_CUFF_RADIUS) + SLEEVE_FOOD_MARGIN - .5;
  assert.ok(lift < 1, 'the food callback must not be consulted past the edge of the rice');
  assert.ok(lift >= lip - 1e-9, 'the cuff still has to ride over the lip');
});

test('rice that steps up beside the sleeve lifts it, even though the centre line is over low ground', () => {
  const step = (x, z) => z > .05 ? 1.2 : .5;
  const wrist = new THREE.Vector3(0, 1, 0), elbow = new THREE.Vector3(-.4, 1, 0);
  const lift = forearmLift(wrist, elbow, step);
  assert.ok(lift > .25, `lift ${lift}`);
  assert.equal(forearmLift(wrist, elbow, () => .5), 0, 'the same forearm over flat low ground is left alone');
});

test('a slope across the sleeve needs more lift than the height under its centre line', () => {
  const wrist = new THREE.Vector3(0, 1, 0), elbow = new THREE.Vector3(0, 1, -.4);
  const tilted = forearmLift(wrist, elbow, x => 1 + .5 * x), flatAtCentre = forearmLift(wrist, elbow, () => 1);
  assert.ok(tilted - flatAtCentre > .01, `tilted ${tilted} flat ${flatAtCentre}`);
});


test('the sleeve end cap just past the wrist is checked too', () => {
  // The rice climbs on the fingers' side of the wrist only; the forearm behind the wrist is over low ground.
  const wrist = new THREE.Vector3(1, 1, 0), elbow = new THREE.Vector3(1.6, 1, 0);
  const towardFingers = x => x < .97 ? 1.3 : .5;
  assert.ok(forearmLift(wrist, elbow, towardFingers) > .3);
  assert.equal(forearmLift(wrist, elbow, () => .5), 0);
});
