import * as THREE from 'three';

/** Round the clothing in bind space without moving the rig or hand targets. */
export function refineCharacterBody(mesh: THREE.Mesh) {
  const torso = /Soft.?tailored.?chibi.?thobe|Pelvis.?underneath.?thobe/i.test(mesh.name);
  const detail = /^Button/i.test(mesh.name);
  if (!torso && !detail) return;

  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    // A round belly and broad lower body taper smoothly into the collar.
    // Apply the same profile to the buttons so they stay on the fabric.
    const collar = 1 - THREE.MathUtils.smoothstep(y, 1.12, 1.45);
    const belly = Math.exp(-(((y - .88) / .40) ** 2));
    const width = 1 + collar * (.19 + .15 * belly);
    const depth = 1 + collar * (.22 + .30 * belly);
    positions.setXYZ(i, x * width, y, z * depth);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
