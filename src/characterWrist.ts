import * as THREE from 'three';

/** Limit flexion without removing the palm's rotation around the forearm. */
export function limitWristBend(rotation: THREE.Quaternion, elbow: THREE.Vector3, wrist: THREE.Vector3, maxBend = Math.PI / 4) {
  const forearm = new THREE.Vector3().subVectors(wrist, elbow);
  if (forearm.lengthSq() < 1e-10) return rotation;
  forearm.normalize();
  const fingers = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
  const bend = fingers.angleTo(forearm);
  if (bend > maxBend) {
    const correction = new THREE.Quaternion().setFromUnitVectors(fingers, forearm);
    correction.slerp(new THREE.Quaternion(), maxBend / bend);
    rotation.premultiply(correction).normalize();
  }
  return rotation;
}
