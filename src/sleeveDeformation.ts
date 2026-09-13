import * as THREE from 'three';

/** A straight sleeve from the cuff to the camera's bottom-center anchor. */
export function createSleeveDeformer(rest: Float32Array) {
  const grouped = new Map<number, { t: number; indices: number[]; radius: number }>();
  for (let i = 0; i < rest.length / 3; i++) {
    const z = rest[i * 3 + 2], key = Math.round(z * 100000);
    const ring = grouped.get(key) ?? { t: THREE.MathUtils.clamp((z - .425) / 1.825, 0, 1), indices: [], radius: 0 };
    ring.indices.push(i);
    ring.radius = Math.max(ring.radius, Math.hypot(rest[i * 3], rest[i * 3 + 1]));
    grouped.set(key, ring);
  }
  const rings = [...grouped.values()].sort((a, b) => a.t - b.t);
  const wrist = new THREE.Vector3();
  const center = new THREE.Vector3(), tangent = new THREE.Vector3(), previous = new THREE.Vector3();
  const side = new THREE.Vector3(), normal = new THREE.Vector3(), vertex = new THREE.Vector3();
  const rotation = new THREE.Quaternion(), transport = new THREE.Quaternion(), scale = new THREE.Vector3();
  const frame = new THREE.Quaternion();
  return (geometry: THREE.BufferGeometry, hand: THREE.Object3D, _elbow: THREE.Vector3, shoulder: THREE.Vector3, _heightAt: (x: number, z: number) => number) => {
    hand.updateWorldMatrix(true, false);
    hand.getWorldQuaternion(rotation); hand.getWorldScale(scale);
    wrist.set(0, 0, .425).applyMatrix4(hand.matrixWorld);
    previous.set(0, 0, 1).applyQuaternion(rotation);
    side.set(1, 0, 0).applyQuaternion(rotation);
    tangent.subVectors(shoulder, wrist).normalize();
    transport.setFromUnitVectors(previous, tangent);
    const positions = geometry.attributes.position;
    for (const ring of rings) {
      const t = ring.t;
      center.lerpVectors(wrist, shoulder, t);
      frame.identity().slerp(transport, THREE.MathUtils.smoothstep(t, 0, .20));
      side.set(1, 0, 0).applyQuaternion(rotation).applyQuaternion(frame);
      normal.set(0, 1, 0).applyQuaternion(rotation).applyQuaternion(frame);
      const width = THREE.MathUtils.lerp(scale.x, 1.1, THREE.MathUtils.smoothstep(t, 0, .85));
      for (const i of ring.indices) {
        vertex.copy(center).addScaledVector(side, rest[i * 3] * width).addScaledVector(normal, rest[i * 3 + 1] * width);
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  };
}
