import * as THREE from 'three';

/** Sculpt the existing skinned nose, retaining its head-bone attachment. */
export function refineCharacterNose(mesh: THREE.Mesh, id: number) {
  if (new URLSearchParams(location.search).get('noses') === 'before') return;
  const tallPreview = new URLSearchParams(location.search).get('noses') === 'tall';
  mesh.geometry = mesh.geometry.clone();
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  const half = geometry.boundingBox!.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const width = id === 2 ? 1.05 : id === 3 ? .94 : 1;
  for (let i = 0; i < positions.count; i++) {
    const x = (positions.getX(i) - center.x) / half.x;
    const y = (positions.getY(i) - center.y) / half.y;
    const z = (positions.getZ(i) - center.z) / half.z;
    const upper = THREE.MathUtils.smoothstep(y, -.1, 1);
    const front = THREE.MathUtils.smoothstep(z, -.3, .8);
    // Keep the bridge low and the tip close to the face; the lower tip
    // projects gently forward, with soft wings instead of a spherical button.
    const tip = Math.exp(-x * x * 3 - (y + .2) ** 2 * 4);
    positions.setXYZ(i,
      center.x + x * half.x * width * (tallPreview ? 1 : .94) * (1 - upper * (tallPreview ? .42 : .28)),
      center.y + y * half.y * (y > 0 ? (tallPreview ? 1.62 : 1.02) : (tallPreview ? .9 : .86)) + (tallPreview ? .006 : .001),
      center.z + z * half.z * (tallPreview ? 1 : .72) - upper * .022 + tip * front * (tallPreview ? .016 : .004) - (tallPreview ? 0 : .006));
    const crease = Math.exp(-((Math.abs(x) - .48) ** 2) / .035 - ((y + .55) ** 2) / .055) * front;
    const underside = THREE.MathUtils.smoothstep(-y, .25, 1) * front;
    colors.set([1 - crease * .25 - underside * .045,
      1 - crease * .32 - underside * .075,
      1 - crease * .34 - underside * .09], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  positions.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const finish = (source: THREE.Material) => {
    const material = source.clone();
    if (material instanceof THREE.MeshStandardMaterial) {
      material.vertexColors = true;
      material.roughness = .76;
    }
    return material;
  };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(finish) : finish(mesh.material);
}
