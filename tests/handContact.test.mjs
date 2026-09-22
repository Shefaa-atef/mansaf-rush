import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { contactLift } from '../src/handContact.ts';

function handMesh(relative) {
  let seed = 5; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const count = 900, geometry = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3).map(() => (rnd() - .5) * .5);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  const morphs = [0, 1, 2].map(() => {
    const target = new Float32Array(count * 3).map((_, i) => relative ? (rnd() - .5) * .2 : position[i] + (rnd() - .5) * .2);
    return new THREE.BufferAttribute(target, 3);
  });
  geometry.morphAttributes.position = morphs;
  geometry.morphTargetsRelative = relative;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.morphTargetInfluences = [.35, 0, .6];
  mesh.position.set(.4, 1.1, -.3); mesh.rotation.set(.7, -1.1, .3); mesh.scale.set(.82, .82, -.82);
  mesh.updateMatrixWorld(true);
  return mesh;
}
// What the game did before: three.js's own per-vertex pose and transform.
function reference(mesh, list, offset, heightAt) {
  const v = new THREE.Vector3(); let lift = 0;
  for (const i of list) { mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld); lift = Math.max(lift, heightAt(v.x, v.z) + offset - v.y); }
  return lift;
}
const heightAt = (x, z) => Math.hypot(x, z) > 2.4 ? -Infinity : 1.0 + .15 * Math.sin(x * 4) + .1 * Math.cos(z * 3);
const stride = (mesh, n) => Array.from({ length: Math.ceil(mesh.geometry.attributes.position.count / n) }, (_, k) => k * n);

for (const relative of [true, false]) {
  test(`the fast sampler matches three.js vertex by vertex (${relative ? 'relative' : 'absolute'} morph targets)`, () => {
    const mesh = handMesh(relative);
    const list = stride(mesh, 7);
    const expected = reference(mesh, list, .015, heightAt);
    assert.ok(expected > 0, 'the test hand must actually dip into the food');
    assert.ok(Math.abs(contactLift(mesh, 7, .015, heightAt) - expected) < 1e-5, 'by stride');
    assert.ok(Math.abs(contactLift(mesh, list, .015, heightAt) - expected) < 1e-5, 'by explicit list');
  });
}

test('a ceiling above the food skips vertices without changing the answer', () => {
  const mesh = handMesh(true);
  mesh.scale.multiplyScalar(2.5); mesh.updateMatrixWorld(true);   // big enough to dip into the food and to reach well above it
  const exact = contactLift(mesh, 7, .015, heightAt);
  assert.ok(exact > 0);
  let lookups = 0;
  const counting = (x, z) => { lookups++; return heightAt(x, z); };
  const ceiling = (x, z) => heightAt(x, z) + .3;      // never below the food, like foodTopBound
  const withCeiling = contactLift(mesh, 7, .015, counting, ceiling);
  assert.ok(Math.abs(withCeiling - exact) < 1e-9);
  assert.ok(lookups < mesh.geometry.attributes.position.count / 7, 'vertices well above the food are not looked up');
});

test('the pose blend follows the influences as they change', () => {
  const mesh = handMesh(true), list = stride(mesh, 11);
  for (const weights of [[0, 0, 0], [1, 0, 0], [.2, .5, .3]]) {
    mesh.morphTargetInfluences = weights;
    assert.ok(Math.abs(contactLift(mesh, 11, .02, heightAt) - reference(mesh, list, .02, heightAt)) < 1e-5, JSON.stringify(weights));
  }
});

test('a mesh skinned to bones takes the plain path and still gives the plain answer', () => {
  const geometry = new THREE.BoxGeometry(.3, .1, .3, 4, 2, 4);
  const n = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const bone = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
  mesh.position.set(0, .95, 0); mesh.updateMatrixWorld(true);
  const list = stride(mesh, 5);
  assert.ok(Math.abs(contactLift(mesh, 5, .01, heightAt) - reference(mesh, list, .01, heightAt)) < 1e-6);
});
