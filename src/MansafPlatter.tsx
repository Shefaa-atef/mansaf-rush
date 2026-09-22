import { memo, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { foodPatches as patches, platterFood } from './platterFood';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type XZ = [number, number];
type V3 = [number, number, number];
type Particle = { position: V3; scale: V3; rotation: V3; color: string; refinedColor?: string; patch: number };
const RICE_RADIUS = 2.025;
const FLOOR = .275;
const grainGeometry = new THREE.SphereGeometry(1, 7, 5);
const almondGeometry = (() => {
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  const positions = geometry.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    // Taper both ends, with a slightly fuller base and shallow lengthwise ridges.
    const taper = (1 - .36 * Math.abs(z)) * (1 - .1 * z);
    const ridge = 1 + .035 * Math.cos(Math.atan2(y, x) * 9 + z * .6);
    positions.setXYZ(i, x * taper * ridge, y * ridge, z);
    const shade = .84 + .13 * Math.max(0, y) + .045 * Math.cos(Math.atan2(y, x) * 9);
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
})();
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
const random = seeded(1989);

// A broad, continuous dome; individual grains add detail without changing its silhouette.
export function fullRiceHeight(x: number, z: number) {
  const r2 = (x * x + z * z) / (RICE_RADIUS * RICE_RADIUS);
  return FLOOR + .05 + .53 * Math.pow(Math.max(0, 1 - r2), .85);
}
/** The plain scan. Kept for points outside the grid below, and as the reference the grid must match. */
function patchIndexScan(x: number, z: number) {
  let nearest = 0, distance = Infinity;
  for (let i = 0; i < patches.length; i++) { const d = (patches[i].x - x) ** 2 + (patches[i].z - z) ** 2; if (d < distance) { distance = d; nearest = i; } }
  return nearest;
}
// Which patch is nearest is asked tens of thousands of times a frame (every point of every hand is
// checked against the food). Each grid cell keeps only the patches that could be nearest to some
// point inside it, so the answer is the same as the full scan but takes a handful of comparisons.
const GRID = 64, GRID_MIN = -2.3, GRID_INV = GRID / 4.6;
const gridStart = new Uint16Array(GRID * GRID + 1), gridCandidates: number[] = [];
for (let gz = 0; gz < GRID; gz++) for (let gx = 0; gx < GRID; gx++) {
  const cx = GRID_MIN + (gx + .5) / GRID_INV, cz = GRID_MIN + (gz + .5) / GRID_INV;
  const distances = patches.map(p => Math.hypot(p.x - cx, p.z - cz));
  // Any point of the cell is within half a cell diagonal of its centre.
  const limit = Math.min(...distances) + 2 * (Math.SQRT1_2 / GRID_INV) + 1e-9;
  gridStart[gz * GRID + gx] = gridCandidates.length;
  distances.forEach((d, i) => { if (d <= limit) gridCandidates.push(i); });
}
gridStart[GRID * GRID] = gridCandidates.length;
const gridPatches = Uint8Array.from(gridCandidates);
function patchIndex(x: number, z: number) {
  const gx = Math.floor((x - GRID_MIN) * GRID_INV), gz = Math.floor((z - GRID_MIN) * GRID_INV);
  if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return patchIndexScan(x, z);
  const cell = gz * GRID + gx, end = gridStart[cell + 1];
  let k = gridStart[cell], nearest = gridPatches[k], distance = (patches[nearest].x - x) ** 2 + (patches[nearest].z - z) ** 2;
  for (k++; k < end; k++) {
    const i = gridPatches[k], d = (patches[i].x - x) ** 2 + (patches[i].z - z) ** 2;
    if (d < distance) { distance = d; nearest = i; }
  }
  return nearest;
}
const availablePatch = (index: number) => platterFood.riceAvailable(index);
/** The piece of lamb under (x, z), or -1. A piece that was already carried off the tray is gone. */
export function meatUnder(x: number, z: number) {
  let found = -1, nearest = Infinity;
  for (let i = 0; i < meatPieces.length; i++) {
    const p = meatPieces[i], reach = p.size * 1.2, d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d2 < reach * reach && d2 < nearest && !platterFood.isMeatTaken(i) && availablePatch(meatPatch[i])) { found = i; nearest = d2; }
  }
  return found;
}
/** The almond under (x, z), or -1. Same rule: an almond that was taken is gone. */
export function almondUnder(x: number, z: number) {
  let found = -1, nearest = Infinity;
  for (let i = 0; i < almondParticles.length; i++) {
    const p = almondParticles[i], d2 = (x - p.position[0]) ** 2 + (z - p.position[2]) ** 2;
    if (d2 < .0256 && d2 < nearest && !platterFood.isAlmondTaken(i) && availablePatch(p.patch)) { found = i; nearest = d2; }
  }
  return found;
}
/** The lamb pieces and almonds still on the tray that sit on this patch's rice. */
export function toppingsOnPatch(patch: number) {
  const meat: number[] = [], almonds: number[] = [];
  meatPieces.forEach((p, i) => { if (!platterFood.isMeatTaken(i) && meatPatch[i] === patch) meat.push(i); });
  almondParticles.forEach((p, i) => { if (!platterFood.isAlmondTaken(i) && p.patch === patch) almonds.push(i); });
  return { meat, almonds };
}
export function foodSurface(x: number, z: number, remaining: number) {
  const patch = patchIndex(x, z), bread = platterFood.breadAvailable(patch);
  return {
    height: .24 + riceHeight(x, z, remaining, patch),
    available: x * x + z * z < 2.12 * 2.12 && bread,
    bread: !availablePatch(patch) && bread,
  };
}

const RIM_RADIUS = 2.25, RIM_RADIUS_SQ = RIM_RADIUS * RIM_RADIUS, FOOD_EDGE_SQ = 2.03 * 2.03;
/** How high the food, a piece of lamb or the rim is at (x, z): what a hand must stay above. */
export function foodObstacleHeight(x: number, z: number, remaining: number) {
  const r2 = x * x + z * z;
  if (r2 > RIM_RADIUS_SQ) return -Infinity;
  let height = Math.max(.24 + riceHeight(x, z, remaining, patchIndex(x, z)), r2 > FOOD_EDGE_SQ ? .61 : .53);
  for (let i = 0; i < meatPieces.length; i++) {
    const piece = meatPieces[i], dx = x - piece.x, dz = z - piece.z, reach = piece.size * 1.45;
    // A piece that a scoop already took is not there any more, so it is nothing to stay above.
    if (dx * dx + dz * dz < reach * reach && availablePatch(meatPatch[i]) && !platterFood.isMeatTaken(i)) {
      height = Math.max(height, .24 + meatRestHeight(piece, remaining) + piece.size * .95);
    }
  }
  return height;
}
// A cheap ceiling on foodObstacleHeight: the full dome (nothing is ever higher, however much has
// been eaten), or the rim, plus room for a piece of lamb where lamb lies. A point above this cannot
// touch the food, so the exact height need not be worked out for it. The table is read at the
// smallest radius of each ring, and the dome falls with radius, so it never under-reports.
const TOP_BINS = 128, TOP_SCALE = TOP_BINS / RIM_RADIUS_SQ, LAMB_ALLOWANCE = .34;
const topTable = Float32Array.from({ length: TOP_BINS + 1 }, (_, bin) =>
  Math.max(.24 + fullRiceHeight(Math.sqrt(bin / TOP_SCALE), 0), .62) + 1e-4);
export function foodTopBound(x: number, z: number) {
  const r2 = x * x + z * z;
  if (r2 > RIM_RADIUS_SQ) return -Infinity;
  const dx = x - LAMB_CX, dz = z - LAMB_CZ;
  return topTable[(r2 * TOP_SCALE) | 0] + (dx * dx + dz * dz < LAMB_R * LAMB_R ? LAMB_ALLOWANCE : 0);
}
const edgePlanes = patches.map(p => patches.map((q, index) => {
  const nx = q.x - p.x, nz = q.z - p.z, length = Math.hypot(nx, nz) || 1;
  return { nx: nx / length, nz: nz / length, limit: (q.x * q.x + q.z * q.z - p.x * p.x - p.z * p.z) / (2 * length), index };
}));
let surfaceRevision = -1;
let exposedEdges: typeof edgePlanes = [];
function refreshEdges() {
  if (surfaceRevision === platterFood.trayVersion) return;
  // Only edges that can come within the smoothing distance of this patch can change its shape.
  exposedEdges = relevantEdges.map(edges => edges.filter(edge => !availablePatch(edge.index)));
  surfaceRevision = platterFood.trayVersion;
}
/** True when a patch beside this one has run out, so this one's rice slopes down toward the gap. */
function edgesExposed(index: number) {
  refreshEdges();
  return exposedEdges[index].length > 0;
}
export function riceHeight(x: number, z: number, remaining = 100, index = patchIndex(x, z)) {
  const full = fullRiceHeight(x, z);
  if (remaining >= 100) return full;
  if (!availablePatch(index)) return FLOOR;
  refreshEdges();
  let distance = 1;
  for (const edge of exposedEdges[index]) {
    distance = Math.min(distance, edge.limit - edge.nx * x - edge.nz * z);
  }
  return FLOOR + (full - FLOOR) * THREE.MathUtils.smoothstep(distance, 0, .18);
}

/** Clip each Voronoi cell to the round mound. Shared boundaries leave no holes at 100%. */
function clipPatchPolygon(index: number, radius: number) {
  let polygon: XZ[] = Array.from({ length: 192 }, (_, i) => [Math.cos(i / 192 * Math.PI * 2) * radius, Math.sin(i / 192 * Math.PI * 2) * radius]);
  const p = patches[index];
  patches.forEach((q, j) => {
    if (j === index) return;
    const nx = q.x - p.x, nz = q.z - p.z, limit = (q.x * q.x + q.z * q.z - p.x * p.x - p.z * p.z) / 2;
    const result: XZ[] = [];
    for (let k = 0; k < polygon.length; k++) {
      const a = polygon[k], b = polygon[(k + 1) % polygon.length];
      const da = a[0] * nx + a[1] * nz - limit, db = b[0] * nx + b[1] * nz - limit;
      if (da <= 1e-9) result.push(a);
      if ((da < 0) !== (db < 0)) { const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    polygon = result;
  });
  return polygon;
}
const polygons = new Map<string, XZ[]>();
/** A cell's outline never changes, so it is worked out once. Callers only read it. */
function patchPolygon(index: number, radius = RICE_RADIUS) {
  const key = index + ':' + radius;
  let polygon = polygons.get(key);
  if (!polygon) polygons.set(key, polygon = clipPatchPolygon(index, radius));
  return polygon;
}
// Which gaps can reach a patch: those whose edge comes within the smoothing distance (.18) of some point
// of its cell. Only a patch at the rim of the mound owns points beyond the mound (the tray wall is
// checked there too, up to .25 out), so only those get the extra margin. Farther edges cannot change a
// height, so they are never looked at.
const relevantEdges = patches.map((_, i) => {
  const polygon = patchPolygon(i);
  const margin = .18 + (polygon.some(([x, z]) => Math.hypot(x, z) > RICE_RADIUS - 1e-6) ? .25 : 0);
  return edgePlanes[i].filter(edge => edge.index !== i && polygon.some(([x, z]) => edge.limit - edge.nx * x - edge.nz * z < margin));
});
export function ricePatchGeometry(index: number, remaining: number) {
  const polygon = patchPolygon(index), vertices: number[] = [], normals: number[] = [];
  const p = patches[index];
  const normal = (x: number, z: number) => new THREE.Vector3(
    -(riceHeight(x + .002, z, remaining, index) - riceHeight(x - .002, z, remaining, index)) / .004, 1,
    -(riceHeight(x, z + .002, remaining, index) - riceHeight(x, z - .002, remaining, index)) / .004,
  ).normalize().toArray();
  const top = ([x, z]: XZ) => [x, Math.max(FLOOR, riceHeight(x, z, remaining, index) - .008), z];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    // Subdivision lets newly exposed edges slope down rather than leaving vertical cuts.
    const n = 6;
    const grid = (u: number, v: number): XZ => [p.x + (b[0] - p.x) * u / n + (a[0] - p.x) * v / n, p.z + (b[1] - p.z) * u / n + (a[1] - p.z) * v / n];
    const triangle = (points: XZ[]) => points.forEach(v => { vertices.push(...top(v)); normals.push(...normal(...v)); });
    for (let u = 0; u < n; u++) for (let v = 0; v < n - u; v++) {
      triangle([grid(u, v), grid(u + 1, v), grid(u, v + 1)]);
      if (u + v < n - 1) triangle([grid(u + 1, v), grid(u + 1, v + 1), grid(u, v + 1)]);
    }
    const sideNormal = new THREE.Vector3(b[1] - a[1], 0, a[0] - b[0]).normalize().toArray();
    vertices.push(...top(a), a[0], FLOOR, a[1], ...top(b), ...top(b), a[0], FLOOR, a[1], b[0], FLOOR, b[1]);
    for (let j = 0; j < 6; j++) normals.push(...sideNormal);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

export const grains: Particle[] = [], almondParticles: Particle[] = [];
const riceColors = ['#dfaf37', '#edc34d', '#e5b640', '#f0cd64'];
const refinedRiceColors = ['#d6a23b', '#dcac45', '#e2b650', '#e7bf61'];
for (let i = 0; i < 16600; i++) {
  // Even spacing plus small jitter gives a dense surface, not a random particle cloud.
  const a = i * 2.399963 + (random() - .5) * .018;
  const r = Math.sqrt((i + .5) / 16600) * (RICE_RADIUS - .015);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const warmth = Math.sin(x * 2.4 + Math.cos(z * 1.7)) + Math.cos(z * 2.2 - x * .8) + Math.sin((x + z) * 1.3);
  const cluster = THREE.MathUtils.clamp(Math.floor((warmth + 3) / 1.51), 0, refinedRiceColors.length - 1);
  grains.push({ position: [x, riceHeight(x, z) + .002 + random() * .005, z], scale: [.012 + random() * .003, .007 + random() * .002, .029 + random() * .007], rotation: [(random() - .5) * .20, random() * Math.PI, (random() - .5) * .22], color: riceColors[i % riceColors.length], refinedColor: refinedRiceColors[cluster], patch: patchIndex(x, z) });
}
for (let i = 0; i < 37; i++) {
  const a = i * 2.399963 + random() * .3, r = Math.sqrt((i + .8) / 38) * 1.84;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  almondParticles.push({ position: [x, riceHeight(x, z) + .024, z], scale: [.033, .019, .066], rotation: [.08, random() * 6, .08], color: ['#bd8549', '#c79255', '#b57b40'][i % 3], patch: patchIndex(x, z) });
}

type Prepared = { matrices: Float32Array; colors: Float32Array; refinedColors: Float32Array };
const preparedParticles = new WeakMap<Particle[], Prepared>();
/** Every particle's placement matrix and colours, worked out once (they never change). */
function prepareParticles(particles: Particle[]): Prepared {
  let prepared = preparedParticles.get(particles);
  if (prepared) return prepared;
  const matrices = new Float32Array(particles.length * 16), colors = new Float32Array(particles.length * 3), refinedColors = new Float32Array(particles.length * 3);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  particles.forEach((p, i) => {
    dummy.position.set(...p.position); dummy.scale.set(...p.scale); dummy.rotation.set(...p.rotation); dummy.updateMatrix();
    matrices.set(dummy.matrix.elements, i * 16);
    color.set(p.color).toArray(colors, i * 3);
    color.set(p.refinedColor ? p.refinedColor : p.color).toArray(refinedColors, i * 3);
  });
  preparedParticles.set(particles, prepared = { matrices, colors, refinedColors });
  return prepared;
}
/**
 * Lay out the particles that are still on the tray: copy each one's matrix and colour into the
 * instance buffers, lowering the rice beside a gap so it slopes down to it. Returns how many.
 */
export function fillInstances(particles: Particle[], remaining: number, refined: boolean, isTaken: ((index: number) => boolean) | undefined, matrixOut: Float32Array, colorOut: Float32Array) {
  const { matrices, colors, refinedColors } = prepareParticles(particles), colorIn = refined ? refinedColors : colors;
  let visible = 0;
  for (let index = 0; index < particles.length; index++) {
    const p = particles[index];
    if (!availablePatch(p.patch) || isTaken?.(index)) continue;
    const m = index * 16, o = visible * 16, c = index * 3, k = visible * 3;
    for (let e = 0; e < 16; e++) matrixOut[o + e] = matrices[m + e];
    // Everywhere else a grain sits exactly where it was placed, so only rice beside a gap is looked up.
    if (remaining < 100 && edgesExposed(p.patch)) matrixOut[o + 13] += riceHeight(p.position[0], p.position[2], remaining, p.patch) - fullRiceHeight(p.position[0], p.position[2]);
    colorOut[k] = colorIn[c]; colorOut[k + 1] = colorIn[c + 1]; colorOut[k + 2] = colorIn[c + 2];
    visible++;
  }
  return visible;
}
function FoodInstances({ particles, remaining, geometry, name, refined = false, version = 0, isTaken }: { particles: Particle[]; remaining: number; geometry: THREE.BufferGeometry; name: string; refined?: boolean; version?: number; isTaken?: (index: number) => boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    if (!target.instanceColor) target.setColorAt(0, new THREE.Color());   // creates the colour buffer
    target.count = fillInstances(particles, remaining, refined, isTaken, target.instanceMatrix.array as Float32Array, target.instanceColor!.array as Float32Array);
    target.instanceMatrix.needsUpdate = true; target.instanceColor!.needsUpdate = true; target.computeBoundingSphere();
  }, [particles, refined, version, isTaken]);
  return <instancedMesh name={name} ref={mesh} args={[geometry, undefined, particles.length]} receiveShadow>
    <meshStandardMaterial vertexColors={!!geometry.getAttribute('color')} roughness={name === 'Almonds' ? .68 : .83} emissive="#b68e36" emissiveIntensity={.025} />
  </instancedMesh>;
}

function ShrakBread({ shape }: { shape: number }) {
  const map = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d')!, random = seeded(452);
    ctx.fillStyle = '#d6b279';
    ctx.fillRect(0, 0, 1024, 1024);
    // Thin baked shrak: irregular toasted blisters and fine flour speckles.
    for (let i = 0; i < 1500; i++) {
      const x = random() * 1024, y = random() * 1024;
      const radius = 2 + random() * 12;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, i % 4 ? '#92572685' : '#704321a0');
      gradient.addColorStop(1, '#a7743500');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * (.35 + random() * .5), random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 7000; i++) {
      ctx.fillStyle = i % 2 ? '#fff0cc25' : '#82552c18';
      ctx.fillRect(random() * 1024, random() * 1024, 1 + random() * 2, 1);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  // A piece of bread never changes shape, only whether it is still there, so every one is built once.
  const all = useMemo(() => patches.map((p, index) => {
    const polygon = patchPolygon(index, 2.12), vertices: number[] = [], uvs: number[] = [];
    const vertex = (x: number, z: number) => {
      const radius = Math.hypot(x, z), angle = Math.atan2(z, x);
      const rim = THREE.MathUtils.smoothstep(radius, 1.95, 2.12);
      vertices.push(x, FLOOR + .012 + rim * .065 + .002 * Math.sin(x * 23 + z * 17), z);
      uvs.push(x / 4.24 + .5, z / 4.24 + .5);
    };
    polygon.forEach((a, i) => { const b = polygon[(i + 1) % polygon.length]; vertex(p.x, p.z); vertex(...b); vertex(...a); });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }), []);
  const pieces = all.map((geometry, index) => platterFood.breadAvailable(index) ? geometry : null);
  useEffect(() => () => map.dispose(), [map]);
  useEffect(() => () => all.forEach(piece => piece.dispose()), [all]);
  return <group name="shrak-bread-under-rice">{pieces.map((geometry, i) => geometry &&
    <mesh key={i} name={`shrak-piece-${i}`} geometry={geometry} receiveShadow>
      <meshStandardMaterial map={map} roughness={.96} side={THREE.DoubleSide} />
    </mesh>)}</group>;
}

function Tray({ refined = false }: { refined?: boolean }) {
  const geometry = useMemo(() => new THREE.LatheGeometry([
    [0, FLOOR], [1.98, FLOOR], [2.07, .295], [2.17, .349], [2.22, .363],
    [2.246, .348], [2.25, .31], [2.215, .22], [2.12, .13], [0, .13],
  ].map(([x, y]) => new THREE.Vector2(x, y)).reverse(), 128), []);
  return <group name="Tray">
    <mesh name="solid-metal-tray" geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={refined ? '#aaa9a3' : '#bcbab3'} metalness={refined ? .64 : .78} roughness={refined ? .42 : .31} emissive="#d3d4d0" emissiveIntensity={refined ? .015 : .035} />
    </mesh>
    <mesh name="rolled-metal-lip" position={[0, .357, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.221, refined ? .014 : .022, 10, 128]} /><meshStandardMaterial color="#d5d4cf" metalness={refined ? .67 : .85} roughness={refined ? .39 : .24} /></mesh>
    <mesh position={[0, .292, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.053, 2.06, 128]} /><meshStandardMaterial color="#979a93" metalness={.3} roughness={.5} /></mesh>
  </group>;
}
function LowSedrTable() {
  // The tabletop must stay below the tray's flat underside (local y=.13, the
  // Tray lathe's bottom disc) - it previously sat with its top flush with the
  // rice floor itself (both at local y=.275), so the brown wood z-fought with
  // and poked up through the golden rice. Shrunk and lowered so its top sits
  // at .095 (a clear .035 gap under the tray), with the legs' bottom left at
  // its original -.255 so they still meet the floor exactly as before.
  return <group name="low-wooden-sedr-table">
    <mesh position={[0,.04,0]} castShadow receiveShadow><cylinderGeometry args={[1.88,1.82,.11,96]} /><meshStandardMaterial color="#6f4027" roughness={.76} /></mesh>
    <mesh position={[0,.10,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.84,.035,10,96]} /><meshStandardMaterial color="#4f2d1d" roughness={.8} /></mesh>
    {Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2+.18;return <mesh key={i} position={[Math.cos(a)*1.68,-.11,Math.sin(a)*1.68]} castShadow><cylinderGeometry args={[.095,.14,.29,12]} /><meshStandardMaterial color="#55301f" roughness={.82} /></mesh>})}
  </group>;
}
// What a patch's shape depends on: its own rice, and the gaps beside it that can reach it.
const riceDeps = patches.map((_, i) => [i, ...relevantEdges[i].map(edge => edge.index)]);
function riceKey(index: number) {
  // A full tray and one with no gap beside this patch give it the same shape, so they share a key.
  let key = '';
  for (const j of riceDeps[index]) key += availablePatch(j) ? '1' : '0';
  return key;
}
export type RiceCache = Map<number, { key: string; geometry: THREE.BufferGeometry }>;
/**
 * The rice patches for the tray as it is now. A patch keeps its geometry until something that shapes
 * it changes, so a patch running out rebuilds only its neighbours, not all 48. `retired` are the
 * geometries no longer used, to free once the new ones are on screen.
 */
export function updateRiceGeometries(previous: RiceCache, remaining: number) {
  const next: RiceCache = new Map();
  const geometries = patches.map((_, i) => {
    if (!availablePatch(i)) return null;
    const key = riceKey(i), kept = previous.get(i);
    if (kept && kept.key === key) { next.set(i, kept); return kept.geometry; }
    const geometry = ricePatchGeometry(i, remaining);
    next.set(i, { key, geometry });
    return geometry;
  });
  const retired: THREE.BufferGeometry[] = [];
  previous.forEach((entry, i) => { if (next.get(i) !== entry) retired.push(entry.geometry); });
  return { cache: next, geometries, retired };
}
function RiceMound({ remaining, shape, refined = false }: { remaining: number; shape: number; refined?: boolean }) {
  const cache = useRef<RiceCache>(new Map());
  const { geometries: ricePatches, retired } = useMemo(() => {
    const result = updateRiceGeometries(cache.current, remaining);
    cache.current = result.cache;
    return result;
  }, [shape]);
  useEffect(() => { retired.forEach(geometry => geometry.dispose()); }, [retired]);
  useEffect(() => () => cache.current.forEach(entry => entry.geometry.dispose()), []);
  return <group name="RiceMound">
    {ricePatches.map((geometry, i) => geometry && <mesh name={`rice-patch-${i}`} key={i} geometry={geometry} receiveShadow>
      <meshStandardMaterial color={refined ? '#d5a33b' : '#e3b33f'} roughness={.94} side={THREE.DoubleSide} emissive="#b79034" emissiveIntensity={refined ? .008 : .025} />
    </mesh>)}
    <FoodInstances name="individual-rice-grains" particles={grains} geometry={grainGeometry} remaining={remaining} refined={refined} version={shape} />
  </group>;
}

// The meat and its jameed sauce sit this far from the sedr's center toward the player's seat (+z),
// so the lamb is a short reach from the front of the tray instead of buried in the middle.
const MEAT_SHIFT_Z = .6;
// Nine smaller portions gathered just in front of the center of the sedr.
const meatPieces = [
  { x: -.32, z: -.34, size: .165, angle: -.4 },
  { x: .02, z: -.41, size: .170, angle: .6 },
  { x: .35, z: -.28, size: .155, angle: -.6 },
  { x: -.43, z: .02, size: .160, angle: .8 },
  { x: -.06, z: -.02, size: .175, angle: -.2 },
  { x: .32, z: .08, size: .165, angle: .65 },
  { x: -.30, z: .36, size: .170, angle: -.7 },
  { x: .04, z: .34, size: .155, angle: .3 },
  { x: .36, z: .39, size: .160, angle: -.9 },
].map(piece => ({ ...piece, z: piece.z + MEAT_SHIFT_Z }));
const meatPatch = meatPieces.map(piece => patchIndex(piece.x, piece.z));
// Lamb is the only thing that can stand above the dome, and it lies in one small part of the tray:
// a circle around the pieces, as wide as the farthest piece's reach.
const LAMB_CX = meatPieces.reduce((s, p) => s + p.x, 0) / meatPieces.length;
const LAMB_CZ = meatPieces.reduce((s, p) => s + p.z, 0) / meatPieces.length;
const LAMB_R = Math.max(...meatPieces.map(p => Math.hypot(p.x - LAMB_CX, p.z - LAMB_CZ) + p.size * 1.45)) + .02;
const meatGeometry = meatPieces.map((_, i) => {
  const source = new THREE.IcosahedronGeometry(1, 1);
  source.deleteAttribute('normal'); source.deleteAttribute('uv');
  const g = mergeVertices(source), p = g.attributes.position;
  source.dispose();
  const colors: number[] = [];
  const uvs: number[] = [];
  for (let j = 0; j < p.count; j++) {
    const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
    const taper = 1.13 + z * (.18 + Math.sin(i) * .09) + Math.sin(z * 3 + i) * .09;
    p.setXYZ(j, x * taper, THREE.MathUtils.clamp(y * 1.12, -.56, .67) + x * (.18 + .08 * Math.sin(i)) - z * .13 + .065 * Math.sin(x * 3 + z * 2 + i), z * (.96 - x * .18));
    const shade = .83 + .13 * (y + .75) / 1.5 + .035 * Math.sin(x * 7 + z * 8 + i);
    colors.push(shade, shade * .98, shade * .95);
    uvs.push(x * .4 + .5, y * .4 + .5);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals(); return g;
});
function cookedLambTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!, random = seeded(738);
  ctx.fillStyle = '#8c5e45'; ctx.fillRect(0, 0, 512, 512);
  // Subtle cooked fibers, without angular stone patches or all-over white marbling.
  for (let i = 0; i < 320; i++) {
    const x = random() * 512, y = random() * 512;
    ctx.strokeStyle = i % 3 ? '#cba17c35' : '#51332230'; ctx.lineWidth = 1 + random() * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 9, y + 10, x - 4, y + 28, x + 6, y + 36 + random() * 20); ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function meatRestHeight(p: typeof meatPieces[number], remaining: number) {
  let height = riceHeight(p.x, p.z, remaining);
  for (let i = 0; i < 8; i++) height = Math.max(height, riceHeight(p.x + Math.cos(i * Math.PI / 4) * p.size * .65, p.z + Math.sin(i * Math.PI / 4) * p.size * .65, remaining));
  return height + p.size * .18;
}
function MeatPieces({ remaining, refined = false }: { remaining: number; refined?: boolean }) {
  const map = useMemo(cookedLambTexture, []);
  return <group name="MeatPieces">{meatPieces.map((p, i) => availablePatch(patchIndex(p.x, p.z)) && !platterFood.isMeatTaken(i) && <group name={`lamb-piece-${i}`} key={i} position={[p.x, meatRestHeight(p, remaining), p.z]} rotation={[0, p.angle, 0]} scale={p.size * 0.85}>
    <mesh geometry={meatGeometry[i]} castShadow><meshStandardMaterial map={map} color={refined ? '#9b755e' : '#ffffff'} vertexColors roughness={refined ? .87 : .80} /></mesh>
  </group>)}</group>;
}

const jameedPools = [
  { x: -.21, z: -.04, rx: .36, rz: .60 }, { x: -.58, z: .41, rx: .38, rz: .36 },
  { x: .45, z: .47, rx: .39, rz: .36 }, { x: -.26, z: -.72, rx: .53, rz: .25 },
  { x: .66, z: -.30, rx: .28, rz: .30 },
].map(pool => ({ ...pool, z: pool.z + MEAT_SHIFT_Z }));
function poolField(x: number, z: number) {
  let field = -Infinity;
  jameedPools.forEach((p, i) => {
    const dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz, angle = Math.atan2(dz, dx);
    const edge = 1 + .10 * Math.sin(angle * 5 + i) + .06 * Math.cos(angle * 9 - i * 2);
    field = Math.max(field, edge * edge - dx * dx - dz * dz);
  });
  return field;
}
type Sample = { p: THREE.Vector3; value: number };
/** The part of a polygon of samples where the sauce lies (value >= 0), as a list of points, or null when nothing is left. */
function clipToSauce(points: Sample[]) {
  const clipped: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (a.value >= 0) clipped.push(a.p);
    if ((a.value >= 0) !== (b.value >= 0)) clipped.push(a.p.clone().lerp(b.p, a.value / (a.value - b.value)));
  }
  return clipped.length < 3 ? null : clipped;
}
const centreOf = (points: THREE.Vector3[]) => points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
const pushFan = (into: number[], clipped: THREE.Vector3[]) => {
  for (let i = 1; i < clipped.length - 1; i++) into.push(...clipped[0].toArray(), ...clipped[i].toArray(), ...clipped[i + 1].toArray());
};

const SAUCE_STEP = .025;
type SauceStatic = {
  xs: number[]; zs: number[];
  pool: Float64Array;          // poolField at every grid point
  meat: number[][];            // per lamb piece: its sauce triangles, as if the piece sat at height 0
  deps: number[];              // every patch that can change how the sauce looks
};
let sauceStatic: SauceStatic | undefined;
/**
 * Everything about the sauce that does not depend on what has been eaten: where the pools are at each
 * grid point, the sauce that hugs each piece of lamb (worked out with the piece at height 0 and lifted
 * when drawn), and which patches can change it. Worked out once.
 */
function getSauceStatic(): SauceStatic {
  if (sauceStatic) return sauceStatic;
  const xs: number[] = [], zs: number[] = [];
  for (let x = -1.20; x < 1.16; x += SAUCE_STEP) xs.push(x);
  xs.push(xs[xs.length - 1] + SAUCE_STEP);
  for (let z = -1.13 + MEAT_SHIFT_Z; z < 1.04 + MEAT_SHIFT_Z; z += SAUCE_STEP) zs.push(z);
  zs.push(zs[zs.length - 1] + SAUCE_STEP);
  const zn = zs.length, pool = new Float64Array(xs.length * zn);
  for (let i = 0; i < xs.length; i++) for (let j = 0; j < zn; j++) pool[i * zn + j] = poolField(xs[i], zs[j]);

  const deps = new Set<number>();
  const dependOn = (x: number, z: number) => {
    const patch = patchIndex(x, z);
    deps.add(patch);
    relevantEdges[patch].forEach(edge => deps.add(edge.index));
  };
  const flat = (i: number, j: number): Sample => ({ p: new THREE.Vector3(xs[i], 0, zs[j]), value: pool[i * zn + j] });
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zn - 1; j++) {
    for (const corners of [[[i, j], [i, j + 1], [i + 1, j]], [[i + 1, j], [i, j + 1], [i + 1, j + 1]]]) {
      const clipped = clipToSauce(corners.map(([a, b]) => flat(a, b)));
      if (!clipped) continue;
      const centre = centreOf(clipped);
      deps.add(patchIndex(centre.x, centre.z));
      corners.forEach(([a, b]) => dependOn(xs[a], zs[b]));
    }
  }

  const meat = meatPieces.map((piece, i) => {
    const out: number[] = [];
    deps.add(meatPatch[i]);
    dependOn(piece.x, piece.z);
    for (let k = 0; k < 8; k++) dependOn(piece.x + Math.cos(k * Math.PI / 4) * piece.size * .65, piece.z + Math.sin(k * Math.PI / 4) * piece.size * .65);
    // Conform directly to the meat triangles: no projected bridges, floating caps or sawtooth intersections.
    const geometry = meatGeometry[i], positions = geometry.attributes.position, normals = geometry.attributes.normal, indices = geometry.index!;
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), piece.angle);
    const origin = new THREE.Vector3(piece.x, 0, piece.z);
    for (let face = 0; face < indices.count; face += 3) {
      const ids = [indices.getX(face), indices.getX(face + 1), indices.getX(face + 2)];
      const p = ids.map(id => new THREE.Vector3().fromBufferAttribute(positions, id));
      const n = ids.map(id => new THREE.Vector3().fromBufferAttribute(normals, id));
      const sample = (u: number, v: number): Sample => {
        const normal = n[0].clone().multiplyScalar(1 - u - v).addScaledVector(n[1], u).addScaledVector(n[2], v).normalize();
        const local = p[0].clone().multiplyScalar(1 - u - v).addScaledVector(p[1], u).addScaledVector(p[2], v);
        const world = local.clone().multiplyScalar(piece.size).addScaledVector(normal, .004).applyQuaternion(rotation).add(origin);
        return { p: world, value: Math.min(poolField(world.x, world.z), normal.y - .12 + .13 * Math.sin(local.x * 5 + local.z * 4 + i)) };
      };
      const subdivisions = 5;
      const add = (points: Sample[]) => { const clipped = clipToSauce(points); if (clipped) pushFan(out, clipped); };
      for (let a = 0; a < subdivisions; a++) for (let b = 0; b < subdivisions - a; b++) {
        const u = a / subdivisions, v = b / subdivisions, s = 1 / subdivisions;
        add([sample(u, v), sample(u + s, v), sample(u, v + s)]);
        if (a + b < subdivisions - 1) add([sample(u + s, v), sample(u + s, v + s), sample(u, v + s)]);
      }
    }
    return out;
  });
  return sauceStatic = { xs, zs, pool, meat, deps: [...deps].sort((a, b) => a - b) };
}

/**
 * The jameed sauce for the tray as it is now: one piece of geometry per patch that has some.
 * It follows the rice surface, so it changes when a patch it lies on (or one that can slope down to
 * it) runs out, and when a piece of lamb is taken.
 */
export function buildJameedGeometries(remaining: number) {
  if (remaining <= 0) return [];
  const { xs, zs, pool, meat } = getSauceStatic(), zn = zs.length;
  const vertices: number[][] = patches.map(() => []);
  const height = new Float64Array(xs.length * zn).fill(NaN);
  // The rice height at a grid point, worked out the first time it is needed (most points are never needed).
  const sample = (i: number, j: number): Sample => {
    const at = i * zn + j;
    let h = height[at];
    if (h !== h) height[at] = h = riceHeight(xs[i], zs[j], remaining) + .022;
    return { p: new THREE.Vector3(xs[i], h, zs[j]), value: pool[at] };
  };
  const add = (points: Sample[]) => {
    const clipped = clipToSauce(points);
    if (!clipped) return;
    const centre = centreOf(clipped), index = patchIndex(centre.x, centre.z);
    if (!availablePatch(index)) return;
    pushFan(vertices[index], clipped);
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zn - 1; j++) {
    const a = i * zn + j, b = a + 1, c = a + zn, d = c + 1;
    // Where the whole triangle is outside every pool there is no sauce and nothing to build.
    if (pool[a] >= 0 || pool[b] >= 0 || pool[c] >= 0) add([sample(i, j), sample(i, j + 1), sample(i + 1, j)]);
    if (pool[c] >= 0 || pool[b] >= 0 || pool[d] >= 0) add([sample(i + 1, j), sample(i, j + 1), sample(i + 1, j + 1)]);
  }
  meatPieces.forEach((piece, i) => {
    const patch = meatPatch[i];
    if (!availablePatch(patch) || platterFood.isMeatTaken(i)) return;
    const lift = meatRestHeight(piece, remaining), shape = meat[i], into = vertices[patch];
    for (let k = 0; k < shape.length; k += 3) into.push(shape[k], shape[k + 1] + lift, shape[k + 2]);
  });
  return vertices.filter(v => v.length > 0).map(v => {
    const source = new THREE.BufferGeometry(); source.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const geometry = mergeVertices(source); source.dispose(); geometry.computeVertexNormals(); return geometry;
  });
}
/** What the sauce looks like depends on exactly this, so it is rebuilt only when this changes. */
export function jameedKey(remaining: number) {
  let key = remaining <= 0 ? 'E' : '';
  for (const patch of getSauceStatic().deps) key += availablePatch(patch) ? '1' : '0';
  for (let i = 0; i < meatPieces.length; i++) key += platterFood.isMeatTaken(i) ? '1' : '0';
  return key;
}
function JameedSauce({ remaining, refined = false }: { remaining: number; refined?: boolean }) {
  const key = jameedKey(remaining);
  const geometries = useMemo(() => buildJameedGeometries(remaining), [key]);
  useEffect(() => () => geometries.forEach(g => g.dispose()), [geometries]);
  return <group name="JameedSauce">{geometries.map((geometry, i) => <mesh key={i} geometry={geometry} receiveShadow><meshStandardMaterial color={refined ? '#e5d1aa' : '#e9d7b1'} roughness={refined ? .72 : .62} side={THREE.DoubleSide} /></mesh>)}</group>
}
const almondTaken = (index: number) => platterFood.isAlmondTaken(index);
function Almonds({ remaining, shape }: { remaining: number; shape: number }) { return <FoodInstances name="Almonds" particles={almondParticles} remaining={remaining} geometry={almondGeometry} version={shape} isTaken={almondTaken} />; }
const trayVersion = () => platterFood.trayVersion;
export const MansafPlatter = memo(function MansafPlatter({ remaining, refined = false }: { remaining: number; refined?: boolean }) {
  // The tray only changes what it looks like when a piece of lamb or an almond is taken or a patch
  // of rice or bread runs out. Every heavy part below (each rice patch, 16,000 grains, the sauce) is
  // rebuilt on that, not on every small scoop: it used to be rebuilt on every frame of a scoop, which
  // made scooping the slowest thing in the game. The two flags keep the full-tray and empty-tray looks.
  const tray = useSyncExternalStore(platterFood.subscribeTray, trayVersion);
  const shape = tray * 4 + (remaining >= 100 ? 1 : 0) + (remaining <= 0 ? 2 : 0);
  return <group name="MansafPlatter" position={[0,.24,0]}>
    {refined && <LowSedrTable />}
    <Tray refined={refined} />
    <ShrakBread shape={shape} />
    <RiceMound remaining={remaining} shape={shape} refined={refined} />
    <MeatPieces remaining={remaining} refined={refined} />
    <JameedSauce remaining={remaining} refined={refined} />
    <Almonds remaining={remaining} shape={shape} />
  </group>;
});
