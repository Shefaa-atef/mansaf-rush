import * as THREE from 'three';

/**
 * How far a posed hand reaches down into the food, or 0 when it is clear.
 *
 * Every hand in the game (yours and the three bots') is one dense skin mesh, blended between
 * finger poses by morph targets and fixed to its wrist. Checking it against the food means testing
 * a couple of thousand of its vertices, several times a frame, so the way each vertex is posed and
 * placed matters:
 *
 * - The vertex positions and their pose offsets are copied out once into flat arrays, and the pose
 *   blend and the world transform are done in one tight loop, instead of three.js's per-vertex
 *   getVertexPosition and localToWorld. The latter re-walks the whole parent chain for every vertex.
 * - A vertex above `topAt` cannot touch the food (that is a cheap ceiling on the food's height), so
 *   the exact height is only worked out for vertices near it.
 *
 * The answer is the same as the straightforward version: the largest of
 * `heightAt(x, z) + offset - y` over the tested vertices, and never below 0.
 * The caller must have brought the mesh's matrixWorld up to date.
 */
type Samples = { geometry: THREE.BufferGeometry; count: number; base: Float32Array; deltas: Float32Array[] };

const byList = new WeakMap<object, Samples>();
const byStride = new WeakMap<THREE.BufferGeometry, Map<number, Samples>>();
const activeWeights: number[] = [], activeDeltas: Float32Array[] = [];
const point = new THREE.Vector3();

function copyOut(geometry: THREE.BufferGeometry, indices: ArrayLike<number>): Samples {
  const position = geometry.attributes.position, morphs = geometry.morphAttributes.position ?? [];
  const relative = geometry.morphTargetsRelative, count = indices.length;
  const base = new Float32Array(count * 3), deltas = morphs.map(() => new Float32Array(count * 3));
  for (let s = 0; s < count; s++) {
    const i = indices[s], bx = position.getX(i), by = position.getY(i), bz = position.getZ(i);
    base[s * 3] = bx; base[s * 3 + 1] = by; base[s * 3 + 2] = bz;
    for (let k = 0; k < morphs.length; k++) {
      const morph = morphs[k], d = deltas[k];
      d[s * 3] = relative ? morph.getX(i) : morph.getX(i) - bx;
      d[s * 3 + 1] = relative ? morph.getY(i) : morph.getY(i) - by;
      d[s * 3 + 2] = relative ? morph.getZ(i) : morph.getZ(i) - bz;
    }
  }
  return { geometry, count, base, deltas };
}

function strideIndices(geometry: THREE.BufferGeometry, stride: number) {
  const indices: number[] = [];
  for (let i = 0; i < geometry.attributes.position.count; i += stride) indices.push(i);
  return indices;
}

/** The plain, slow way. Only used for a mesh that is skinned to bones, which the fast path does not pose. */
function slowLift(mesh: THREE.Mesh, indices: ArrayLike<number> | number, offset: number, heightAt: (x: number, z: number) => number) {
  const list = typeof indices === 'number' ? strideIndices(mesh.geometry, indices) : indices;
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) (mesh as THREE.SkinnedMesh).skeleton.update();
  mesh.updateWorldMatrix(true, false);
  let lift = 0;
  for (let k = 0; k < list.length; k++) {
    mesh.getVertexPosition(list[k], point).applyMatrix4(mesh.matrixWorld);
    lift = Math.max(lift, heightAt(point.x, point.z) + offset - point.y);
  }
  return lift;
}

/**
 * @param indices  either a stride (test every n-th vertex) or an explicit list of vertex numbers
 * @param offset   air kept between the skin and the food
 * @param heightAt exact height of whatever the hand must stay above at (x, z)
 * @param topAt    optional cheap ceiling on heightAt (never lower than it); vertices above it are skipped
 */
export function contactLift(
  mesh: THREE.Mesh,
  indices: ArrayLike<number> | number,
  offset: number,
  heightAt: (x: number, z: number) => number,
  topAt?: (x: number, z: number) => number,
): number {
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) return slowLift(mesh, indices, offset, heightAt);
  const geometry = mesh.geometry as THREE.BufferGeometry;
  let samples: Samples | undefined;
  if (typeof indices === 'number') {
    let strides = byStride.get(geometry);
    if (!strides) byStride.set(geometry, strides = new Map());
    samples = strides.get(indices);
    if (!samples) strides.set(indices, samples = copyOut(geometry, strideIndices(geometry, indices)));
  } else {
    samples = byList.get(indices as object);
    if (!samples || samples.geometry !== geometry) byList.set(indices as object, samples = copyOut(geometry, indices));
  }

  // Only the poses that are actually blended in cost anything.
  const influences = mesh.morphTargetInfluences;
  let active = 0;
  if (influences) for (let k = 0; k < samples.deltas.length; k++) {
    const weight = influences[k];
    if (weight) { activeWeights[active] = weight; activeDeltas[active] = samples.deltas[k]; active++; }
  }
  const e = mesh.matrixWorld.elements, { base, count } = samples;
  let lift = 0;
  for (let s = 0, j = 0; s < count; s++, j += 3) {
    let x = base[j], y = base[j + 1], z = base[j + 2];
    for (let a = 0; a < active; a++) {
      const delta = activeDeltas[a], weight = activeWeights[a];
      x += weight * delta[j]; y += weight * delta[j + 1]; z += weight * delta[j + 2];
    }
    const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
    const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
    if (topAt !== undefined && wy > topAt(wx, wz) + offset) continue;
    const need = heightAt(wx, wz) + offset - wy;
    if (need > lift) lift = need;
  }
  return lift;
}
