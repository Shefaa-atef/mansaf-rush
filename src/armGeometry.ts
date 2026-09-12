import * as THREE from 'three';

const RINGS = 24, SIDES = 14;
export function createArmGeometry() {
  const geometry = new THREE.BufferGeometry(), indices: number[] = [];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((RINGS + 1) * SIDES * 3), 3));
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < SIDES; i++) {
    const a = j * SIDES + i, b = j * SIDES + (i + 1) % SIDES;
    indices.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
  }
  geometry.setIndex(indices);
  const sleeveEnd = 16 * SIDES * 6;
  geometry.addGroup(0, sleeveEnd, 0);
  geometry.addGroup(sleeveEnd, indices.length - sleeveEnd, 1);
  return geometry;
}

const curve = new THREE.CubicBezierCurve3();
const tangent = new THREE.Vector3(), side = new THREE.Vector3(), normal = new THREE.Vector3();
const center = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

export function updateArmGeometry(geometry: THREE.BufferGeometry, shoulder: THREE.Vector3, elbow: THREE.Vector3, wrist: THREE.Vector3, wristDirection: THREE.Vector3, minimumHeight: (x: number, z: number) => number) {
  curve.v0.copy(shoulder);
  curve.v1.copy(elbow);
  curve.v2.copy(wrist).addScaledVector(wristDirection, .18);
  curve.v3.copy(wrist);
  const positions = geometry.attributes.position;
  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS;
    curve.getPoint(t, center); curve.getTangent(t, tangent);
    side.crossVectors(tangent, up);
    if (side.lengthSq() < .001) side.set(1, 0, 0); else side.normalize();
    normal.crossVectors(side, tangent).normalize();
    const radius = THREE.MathUtils.lerp(.17, .096, t) + (j <= 16 ? .015 : 0);
    center.y = Math.max(center.y, minimumHeight(center.x, center.z) + radius + .025);
    for (let i = 0; i < SIDES; i++) {
      const angle = i / SIDES * Math.PI * 2;
      positions.setXYZ(j * SIDES + i,
        center.x + radius * (side.x * Math.cos(angle) + normal.x * Math.sin(angle)),
        center.y + radius * (side.y * Math.cos(angle) + normal.y * Math.sin(angle)),
        center.z + radius * (side.z * Math.cos(angle) + normal.z * Math.sin(angle)));
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}
