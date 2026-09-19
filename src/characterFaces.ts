import * as THREE from 'three';

/** Reshape the jaw and smile in bind space, including every eating morph. */
export function refineCharacterFace(mesh: THREE.Mesh, id: number) {
  if (new URLSearchParams(location.search).get('faces') === 'before') return;
  const head = /Rounded.?head/i.test(mesh.name);
  const mouth = /Mouth.?cavity|Tongue/i.test(mesh.name);
  const beard = /Sculpted.?beard|Moustache/i.test(mesh.name);
  if (!head && !mouth && !beard) return;
  mesh.geometry = mesh.geometry.clone();
  const geometry = mesh.geometry, positions = geometry.getAttribute('position');
  const original = positions.clone();
  const shape = (x: number, y: number, z: number) => {
    const jaw = 1 - THREE.MathUtils.smoothstep(y, 1.43, 1.98);
    const taper = id === 2 ? .11 : id === 3 ? .14 : .16;
    let nx = x * (1 - taper * jaw);
    let ny = y + .025 * (1 - THREE.MathUtils.smoothstep(y, 1.43, 1.72));
    let nz = z;
    if (beard) {
      const lower = 1 - THREE.MathUtils.smoothstep(y, 1.48, 1.78);
      const side = THREE.MathUtils.smoothstep(Math.abs(x), .12, .40);
      // Keep the beard close to the jaw and taper its lower edge so it reads
      // as a shaped short beard instead of a dark circular patch.
      nx *= 1 - .18 * lower * side;
      ny += .018 * lower;
      nz -= .012 * lower;
    }
    if (mouth) {
      nx *= id === 3 ? 1.24 : 1.16;
      // Lift the corners into a small smile, retaining the opening height.
      ny += .020 * Math.min(1, (x / .088) ** 2);
    }
    return new THREE.Vector3(nx, ny, nz);
  };
  for (let i = 0; i < positions.count; i++) {
    const base = new THREE.Vector3().fromBufferAttribute(original, i);
    const next = shape(base.x, base.y, base.z);
    positions.setXYZ(i, next.x, next.y, next.z);
    for (const target of geometry.morphAttributes.position ?? []) {
      const point = new THREE.Vector3().fromBufferAttribute(target, i);
      if (geometry.morphTargetsRelative) point.add(base);
      const transformed = shape(point.x, point.y, point.z);
      if (geometry.morphTargetsRelative) transformed.sub(next);
      target.setXYZ(i, transformed.x, transformed.y, transformed.z);
    }
  }
  positions.needsUpdate = true;
  for (const target of geometry.morphAttributes.position ?? []) target.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  if (/Mouth.?cavity/i.test(mesh.name) && mesh.material instanceof THREE.MeshStandardMaterial) {
    const material = mesh.material.clone();
    material.color.set('#542d25');
    material.roughness = .92;
    mesh.material = material;
  }
  if (beard && mesh.material instanceof THREE.MeshStandardMaterial) {
    const material = mesh.material.clone();
    material.color.set(mesh.name.toLowerCase().includes('moustache') ? '#241713' : '#302019');
    material.roughness = .88;
    material.vertexColors = false;
    mesh.material = material;
  }
}
