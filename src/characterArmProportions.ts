import * as THREE from 'three';

const restPositions = new WeakMap<THREE.Object3D, THREE.Vector3>();

/** Extend only as much as the current reaching target requires. */
export function extendArmForReach(fore: THREE.Object3D, hand: THREE.Object3D, a: number, b: number, distance: number, reaching: boolean) {
  const factor = reaching ? THREE.MathUtils.clamp((distance + .025) / (a + b), 1, 2.5) : 1;
  for (const bone of [fore, hand]) {
    if (!restPositions.has(bone)) restPositions.set(bone, bone.position.clone());
    bone.position.copy(restPositions.get(bone)!).multiplyScalar(factor);
  }
  return { a: a * factor, b: b * factor };
}
