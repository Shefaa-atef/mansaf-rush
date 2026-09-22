import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { botBiteWrist, BOT_FOOD_OFFSET, BOT_BITE_HOVER, BOT_SCOOP_SINK } from '../src/botBiteMotion.ts';

test('rice socket stays at pickup during wrist turning, then reaches the mouth', () => {
  const bite = new THREE.Vector3(.4, .9, -.8), mouth = new THREE.Vector3(.2, 1.4, -1.5), idle = new THREE.Vector3(0, 1, -1);
  for (const t of [.2, .4, .57, .88, .93]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, t * 3, .2));
    const wrist = botBiteWrist(t, bite, mouth, idle, q, new THREE.Vector3());
    const rice = wrist.add(BOT_FOOD_OFFSET.clone().multiplyScalar(.98).applyQuaternion(q));
    assert.ok(rice.distanceTo(t < .58 ? bite : mouth) < 1e-8);
  }
});

test('reach and return join the contact and feeding poses continuously', () => {
  const bite = new THREE.Vector3(.4, .9, -.8), mouth = new THREE.Vector3(.2, 1.4, -1.5), idle = new THREE.Vector3(0, 1, -1), q = new THREE.Quaternion();
  for (const t of [.2, .58, .88, .94]) {
    const before = botBiteWrist(t - 1e-6, bite, mouth, idle, q, new THREE.Vector3());
    const after = botBiteWrist(t + 1e-6, bite, mouth, idle, q, new THREE.Vector3());
    assert.ok(before.distanceTo(after) < .00001);
  }
});

test('sinking the pickup presses the palm socket below the bite target, then carries it up to the mouth', () => {
  const bite = new THREE.Vector3(.4, .9, -.8), mouth = new THREE.Vector3(.2, 1.4, -1.5), idle = new THREE.Vector3(0, 1, -1), sink = .16;
  const socket = (t, q) => botBiteWrist(t, bite, mouth, idle, q, new THREE.Vector3(), sink).add(BOT_FOOD_OFFSET.clone().multiplyScalar(.98).applyQuaternion(q));
  for (const t of [.2, .4, .57]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, t * 3, .2));
    assert.ok(socket(t, q).distanceTo(bite.clone().setY(bite.y - sink)) < 1e-8, `the socket sits ${sink} under the bite at t=${t}`);
  }
  for (const t of [.88, .93]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, t * 3, .2));
    assert.ok(socket(t, q).distanceTo(mouth) < 1e-8, 'feeding still ends exactly at the mouth');
  }
});

test('with a sunk pickup the carry starts from the rice and every phase still joins continuously', () => {
  const bite = new THREE.Vector3(.4, .9, -.8), mouth = new THREE.Vector3(.2, 1.4, -1.5), idle = new THREE.Vector3(0, 1, -1), q = new THREE.Quaternion();
  for (const t of [.2, .58, .88, .94]) {
    const before = botBiteWrist(t - 1e-6, bite, mouth, idle, q, new THREE.Vector3(), BOT_SCOOP_SINK);
    const after = botBiteWrist(t + 1e-6, bite, mouth, idle, q, new THREE.Vector3(), BOT_SCOOP_SINK);
    assert.ok(before.distanceTo(after) < .00001, `no jump at t=${t}`);
  }
  const start = botBiteWrist(.58, bite, mouth, idle, q, new THREE.Vector3(), BOT_SCOOP_SINK).add(BOT_FOOD_OFFSET.clone().multiplyScalar(.98));
  assert.ok(Math.abs(start.y - (bite.y - BOT_SCOOP_SINK)) < 1e-8, 'the lift-off begins where the palm pressed the rice');
});

test('the scoop presses at least as far as the bites hover above the rice', () => {
  assert.ok(BOT_BITE_HOVER > 0);
  assert.ok(BOT_SCOOP_SINK >= BOT_BITE_HOVER, 'a palm that stops at the hover height scoops from the air');
});
