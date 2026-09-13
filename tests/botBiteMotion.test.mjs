import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { botBiteWrist, BOT_FOOD_OFFSET } from '../src/botBiteMotion.ts';

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
