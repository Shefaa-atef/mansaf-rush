import * as THREE from 'three';

/** A restrained adjustment to the original hair, preserving its skin weights. */
export function refineSamiHair(mesh: THREE.Mesh) {
  if (!/Sami.?sculpted.?curls/i.test(mesh.name) ||
      new URLSearchParams(location.search).get('hair') === 'before') return;
  const previous = new URLSearchParams(location.search).get('hair') === 'tidy';
  const original = mesh.geometry;
  const geometry = original.clone();
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const upper = THREE.MathUtils.smoothstep(y, 2.02, 2.42);
    const fringe = THREE.MathUtils.smoothstep(z, .25, .48) *
      (1 - THREE.MathUtils.smoothstep(y, 2.06, 2.28));
    const back = previous ? 0 : THREE.MathUtils.smoothstep(-z, .12, .46) *
      (1 - THREE.MathUtils.smoothstep(y, 2.18, 2.50));
    const lowerBack = 1 - THREE.MathUtils.smoothstep(y, 1.88, 2.28);
    // Extend the existing rear clumps slightly down and out for fuller coverage.
    positions.setXYZ(i, x * (1 - .018 * upper),
      y + .012 * fringe - .055 * back * lowerBack,
      z - .040 * back);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry = geometry;
  original.dispose();
}
