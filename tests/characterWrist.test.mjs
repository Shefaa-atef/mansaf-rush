import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { limitWristBend } from '../src/characterWrist.ts';
import { botBiteWrist, BOT_FOOD_OFFSET } from '../src/botBiteMotion.ts';

test('wrist flex stays bounded throughout a full palm roll', () => {
  const elbow = new THREE.Vector3(-.4, .8, 0), wrist = new THREE.Vector3(0, .9, .3);
  const axis = wrist.clone().sub(elbow).normalize();
  for (let i = 0; i <= 120; i++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, i / 120 * Math.PI * 2, 0));
    limitWristBend(q, elbow, wrist);
    assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(q).angleTo(axis) <= Math.PI / 4 + 1e-7);
    assert.ok(Math.abs(q.length() - 1) < 1e-7);
  }
});

test('an aligned wrist retains forearm twist and a valid pose stays unchanged', () => {
  const elbow = new THREE.Vector3(), wrist = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, 1.2, 0));
  const before = q.clone();
  limitWristBend(q, elbow, wrist);
  assert.ok(q.angleTo(before) < 1e-7);
});

test('a collapsed arm cannot generate an invalid rotation', () => {
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  limitWristBend(q, p, p);
  assert.deepEqual(q.toArray(), [0, 0, 0, 1]);
});

test('re-solving after a wrist correction preserves the pickup and mouth sockets', () => {
  const bite = new THREE.Vector3(.2, .7, .4), mouth = new THREE.Vector3(0, 1.7, .4);
  const idle = new THREE.Vector3(-.4, 1, .3);
  for (const t of [.28, .50, .90]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 2.3, 0));
    const goal = botBiteWrist(t, bite, mouth, idle, q, new THREE.Vector3());
    limitWristBend(q, new THREE.Vector3(-.4, 1, .1), goal);
    botBiteWrist(t, bite, mouth, idle, q, goal);
    const contact = goal.add(BOT_FOOD_OFFSET.clone().multiplyScalar(.98).applyQuaternion(q));
    assert.ok(contact.distanceTo(t < .58 ? bite : mouth) < 1e-7);
  }
});
