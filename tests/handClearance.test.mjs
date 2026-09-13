import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { keepHandAboveFood } from '../src/handClearance.ts';

test('sampled skin ignores an empty bounding-box corner over a food obstacle', () => {
  const hand = new THREE.Group(), anatomy = new THREE.Group();
  anatomy.name = 'hand-anatomy'; hand.add(anatomy);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.2, 1, 0, .2, 1, 0, 0, 1, -.2], 3));
  const skin = new THREE.Mesh(geometry); skin.userData.contactVertices = [0, 1, 2]; anatomy.add(skin);
  const lift = keepHandAboveFood(hand, (x, z) => x > .1 && z < -.1 ? 2 : .5);
  assert.equal(lift, 0, 'an obstacle below empty space must not make the hand jump');
  geometry.dispose();
});

test('palm, thumb and curled fingertips clear food for both hand orientations', () => {
  for (const flip of [0, -.20, .22, Math.PI]) {
    const character = new THREE.Group();
    character.position.y = .02;
    character.rotation.y = .85;
    const hand = new THREE.Group();
    hand.rotation.set(.15, .2, flip);
    hand.scale.setScalar(1.25);
    character.add(hand);
    const anatomy = new THREE.Group();
    anatomy.name = 'hand-anatomy';
    hand.add(anatomy);
    for (const [x, y, z] of [[0, 0, 0], [.25, .1, -.06], [0, .3, -.25]]) {
      const skin = new THREE.Mesh(new THREE.BoxGeometry(.14, .12, .25));
      skin.position.set(x, y, z);
      anatomy.add(skin);
    }
    assert.ok(keepHandAboveFood(hand, () => 1.2) > 0);
    anatomy.traverse(node => {
      if (node instanceof THREE.Mesh) {
        const bounds = new THREE.Box3().setFromObject(node);
        assert.ok(bounds.min.y >= 1.225 - 1e-7);
        node.geometry.dispose();
      }
    });
    assert.ok(keepHandAboveFood(hand, () => 1.2) < 1e-7, 'stationary hands must not drift upward');
  }
});

test('food carried in the palm does not affect skin clearance', () => {
  const hand = new THREE.Group(), anatomy = new THREE.Group();
  anatomy.name = 'hand-anatomy'; hand.add(anatomy);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(.3, .1, .4));
  anatomy.add(palm);
  const food = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1));
  hand.add(food);
  keepHandAboveFood(hand, () => 1);
  assert.ok(hand.position.y < 1.1);
  palm.geometry.dispose(); food.geometry.dispose();
});
