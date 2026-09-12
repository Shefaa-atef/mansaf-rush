import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createHandGeometry, updateHandGeometry } from '../src/handGeometry.ts';
import { copyHandPose, HAND_POSES, interpolateHandPose } from '../src/handPoses.ts';
import { keepHandAboveFood } from '../src/handClearance.ts';

const dispose = hand => [hand.palm, ...hand.digits].forEach(g => g.dispose());
function ringCenter(geometry, ring) {
  const center = new THREE.Vector3(), positions = geometry.attributes.position;
  for (let i = 0; i < 12; i++) center.add(new THREE.Vector3().fromBufferAttribute(positions, ring * 12 + i));
  return center.multiplyScalar(1 / 12);
}

test('one low-poly hand has five tapered digits and an anchored lower-palm thumb', () => {
  const hand = createHandGeometry();
  updateHandGeometry(hand, HAND_POSES.OPEN);
  assert.equal(hand.digits.length, 5);
  assert.ok([hand.palm, ...hand.digits].reduce((sum, g) => sum + g.index.count / 3, 0) < 2500);
  const thumbRoot = ringCenter(hand.digits[4], 0);
  assert.ok(thumbRoot.z > .08 && thumbRoot.x > .06);
  for (const digit of hand.digits) {
    const base = ringCenter(digit, 2), nearTip = ringCenter(digit, 13);
    const positions = digit.attributes.position;
    const baseRadius = new THREE.Vector3().fromBufferAttribute(positions, 24).distanceTo(base);
    const tipRadius = new THREE.Vector3().fromBufferAttribute(positions, 156).distanceTo(nearTip);
    assert.ok(tipRadius < baseRadius * .85, 'digit must taper before its rounded tip');
  }
  const lengths = hand.digits.map(digit => {
    let length = 0;
    for (let i = 1; i <= 16; i++) length += ringCenter(digit, i).distanceTo(ringCenter(digit, i - 1));
    return length;
  });
  assert.ok(lengths[2] > lengths[1] && lengths[2] > lengths[3]);
  assert.ok(lengths[0] < lengths[1] * .8 && lengths[4] < lengths[2] * .75);
  for (const pose of Object.values(HAND_POSES)) {
    updateHandGeometry(hand, pose);
    const root = ringCenter(hand.digits[4], 0);
    assert.ok(Math.abs(root.x - thumbRoot.x) < 1e-6 && Math.abs(root.z - thumbRoot.z) < 1e-6);
    const point = new THREE.Vector3(), candidate = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      point.fromBufferAttribute(hand.digits[4].attributes.position, i);
      let closest = Infinity;
      for (let j = 0; j < hand.palm.attributes.position.count; j++) {
        candidate.fromBufferAttribute(hand.palm.attributes.position, j);
        closest = Math.min(closest, point.distanceTo(candidate));
      }
      assert.ok(closest < 1e-6, 'thumb root must share the palm boundary without gaps in every pose');
    }
  }
  dispose(hand);
});

test('every interpolated pose stays finite and clears food using the actual hand geometry', () => {
  const geometry = createHandGeometry(), pose = copyHandPose(HAND_POSES.OPEN);
  const hand = new THREE.Group(), anatomy = new THREE.Group(); anatomy.name = 'hand-anatomy';
  hand.add(anatomy); hand.scale.setScalar(1.25);
  [geometry.palm, ...geometry.digits].forEach(g => anatomy.add(new THREE.Mesh(g)));
  for (const target of Object.values(HAND_POSES)) {
    for (let i = 0; i < 8; i++) {
      interpolateHandPose(pose, target, .35); updateHandGeometry(geometry, pose);
      for (const g of [geometry.palm, ...geometry.digits]) {
        assert.ok(g.attributes.position.array.every(Number.isFinite));
        assert.ok(g.attributes.normal.array.every(Number.isFinite));
      }
      hand.position.y = 0; hand.rotation.z = pose.flip;
      keepHandAboveFood(hand, () => .9);
      assert.ok(new THREE.Box3().setFromObject(anatomy).min.y >= .925 - 1e-6);
    }
  }
  dispose(geometry);
});
