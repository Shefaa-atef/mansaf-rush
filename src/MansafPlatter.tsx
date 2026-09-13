import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { foodPatches as patches, platterFood } from './platterFood';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type XZ = [number, number];
type V3 = [number, number, number];
type Particle = { position: V3; scale: V3; rotation: V3; color: string; patch: number };
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
function fullRiceHeight(x: number, z: number) {
  const r2 = (x * x + z * z) / (RICE_RADIUS * RICE_RADIUS);
  return FLOOR + .05 + .53 * Math.pow(Math.max(0, 1 - r2), .85);
}
function patchIndex(x: number, z: number) {
  let nearest = 0, distance = Infinity;
  patches.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < distance) { distance = d; nearest = i; } });
  return nearest;
}
const availablePatch = (index: number) => platterFood.riceAvailable(index);
export function foodSurface(x: number, z: number, remaining: number) {
  return {
    height: .24 + riceHeight(x, z, remaining),
    available: Math.hypot(x, z) < 2.12 && platterFood.breadAvailable(patchIndex(x, z)),
    bread: !availablePatch(patchIndex(x, z)) && platterFood.breadAvailable(patchIndex(x, z)),
    almond: almondParticles.some(p => Math.hypot(x - p.position[0], z - p.position[2]) < .16 && availablePatch(p.patch)),
    meat: meatPieces.some(p => Math.hypot(x - p.x, z - p.z) < p.size * 1.2 && availablePatch(patchIndex(p.x, p.z))),
  };
}

export function foodObstacleHeight(x: number, z: number, remaining: number) {
  if (Math.hypot(x, z) > 2.25) return -Infinity;
  let height = Math.max(foodSurface(x, z, remaining).height, Math.hypot(x, z) > 2.03 ? .61 : .53);
  for (const piece of meatPieces) {
    if (Math.hypot(x - piece.x, z - piece.z) < piece.size * 1.45 && availablePatch(patchIndex(piece.x, piece.z))) {
      height = Math.max(height, .24 + meatRestHeight(piece, remaining) + piece.size * .95);
    }
  }
  return height;
}
const edgePlanes = patches.map(p => patches.map((q, index) => {
  const nx = q.x - p.x, nz = q.z - p.z, length = Math.hypot(nx, nz) || 1;
  return { nx: nx / length, nz: nz / length, limit: (q.x * q.x + q.z * q.z - p.x * p.x - p.z * p.z) / (2 * length), index };
}));
let surfaceRevision = -1;
let exposedEdges: typeof edgePlanes = [];
function riceHeight(x: number, z: number, remaining = 100, index = patchIndex(x, z)) {
  const full = fullRiceHeight(x, z);
  if (remaining >= 100) return full;
  if (!availablePatch(index)) return FLOOR;
  if (surfaceRevision !== platterFood.revision) {
    exposedEdges = edgePlanes.map(edges => edges.filter(edge => !availablePatch(edge.index)));
    surfaceRevision = platterFood.revision;
  }
  let distance = 1;
  for (const edge of exposedEdges[index]) {
    distance = Math.min(distance, edge.limit - edge.nx * x - edge.nz * z);
  }
  return FLOOR + (full - FLOOR) * THREE.MathUtils.smoothstep(distance, 0, .18);
}

/** Clip each Voronoi cell to the round mound. Shared boundaries leave no holes at 100%. */
function patchPolygon(index: number, radius = RICE_RADIUS) {
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
function ricePatchGeometry(index: number, remaining: number) {
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

const grains: Particle[] = [], almondParticles: Particle[] = [];
const riceColors = ['#dfaf37', '#edc34d', '#e5b640', '#f0cd64'];
for (let i = 0; i < 16600; i++) {
  // Even spacing plus small jitter gives a dense surface, not a random particle cloud.
  const a = i * 2.399963 + (random() - .5) * .018;
  const r = Math.sqrt((i + .5) / 16600) * (RICE_RADIUS - .015);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  grains.push({ position: [x, riceHeight(x, z) + .002 + random() * .005, z], scale: [.012 + random() * .003, .007 + random() * .002, .029 + random() * .007], rotation: [(random() - .5) * .20, random() * Math.PI, (random() - .5) * .22], color: riceColors[i % riceColors.length], patch: patchIndex(x, z) });
}
for (let i = 0; i < 37; i++) {
  const a = i * 2.399963 + random() * .3, r = Math.sqrt((i + .8) / 38) * 1.84;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  almondParticles.push({ position: [x, riceHeight(x, z) + .024, z], scale: [.033, .019, .066], rotation: [.08, random() * 6, .08], color: ['#bd8549', '#c79255', '#b57b40'][i % 3], patch: patchIndex(x, z) });
}

function FoodInstances({ particles, remaining, geometry, name }: { particles: Particle[]; remaining: number; geometry: THREE.BufferGeometry; name: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    let visible = 0;
    particles.forEach((p) => {
      if (!availablePatch(p.patch)) return;
      const i = visible++;
      dummy.position.set(...p.position); dummy.scale.set(...p.scale); dummy.rotation.set(...p.rotation); dummy.updateMatrix();
      dummy.position.y += riceHeight(p.position[0], p.position[2], remaining, p.patch) - fullRiceHeight(p.position[0], p.position[2]);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix); mesh.current!.setColorAt(i, color.set(p.color));
    });
    mesh.current.count = visible;
    mesh.current.instanceMatrix.needsUpdate = true; mesh.current.instanceColor!.needsUpdate = true; mesh.current.computeBoundingSphere();
  }, [particles, remaining]);
  return <instancedMesh name={name} ref={mesh} args={[geometry, undefined, particles.length]} receiveShadow>
    <meshStandardMaterial vertexColors={!!geometry.getAttribute('color')} roughness={name === 'Almonds' ? .68 : .83} emissive="#b68e36" emissiveIntensity={.025} />
  </instancedMesh>;
}

function ShrakBread({ remaining }: { remaining: number }) {
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
  const pieces = useMemo(() => patches.map((p, index) => {
    if (!platterFood.breadAvailable(index)) return null;
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
  }), [remaining]);
  useEffect(() => () => map.dispose(), [map]);
  useEffect(() => () => pieces.forEach(piece => piece?.dispose()), [pieces]);
  return <group name="shrak-bread-under-rice">{pieces.map((geometry, i) => geometry &&
    <mesh key={i} name={`shrak-piece-${i}`} geometry={geometry} receiveShadow>
      <meshStandardMaterial map={map} roughness={.96} side={THREE.DoubleSide} />
    </mesh>)}</group>;
}

function Tray() {
  const geometry = useMemo(() => new THREE.LatheGeometry([
    [0, FLOOR], [1.98, FLOOR], [2.07, .295], [2.17, .349], [2.22, .363],
    [2.246, .348], [2.25, .31], [2.215, .22], [2.12, .13], [0, .13],
  ].map(([x, y]) => new THREE.Vector2(x, y)).reverse(), 128), []);
  return <group name="Tray">
    <mesh name="solid-metal-tray" geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#bcbab3" metalness={.78} roughness={.31} emissive="#d3d4d0" emissiveIntensity={.035} />
    </mesh>
    <mesh name="rolled-metal-lip" position={[0, .357, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.221, .022, 10, 128]} /><meshStandardMaterial color="#e6e4da" metalness={.85} roughness={.24} /></mesh>
    <mesh position={[0, .292, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.053, 2.06, 128]} /><meshStandardMaterial color="#979a93" metalness={.3} roughness={.5} /></mesh>
  </group>;
}
function RiceMound({ remaining }: { remaining: number }) {
  const ricePatches = useMemo(() => patches.map((p, i) => availablePatch(i) ? ricePatchGeometry(i, remaining) : null), [remaining]);
  useEffect(() => () => ricePatches.forEach(geometry => geometry?.dispose()), [ricePatches]);
  return <group name="RiceMound">
    {ricePatches.map((geometry, i) => geometry && <mesh name={`rice-patch-${i}`} key={i} geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#e3b33f" roughness={.94} side={THREE.DoubleSide} emissive="#b79034" emissiveIntensity={.025} />
    </mesh>)}
    <FoodInstances name="individual-rice-grains" particles={grains} geometry={grainGeometry} remaining={remaining} />
  </group>;
}

// Nine smaller portions gathered at the center of the sedr.
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
];
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
function MeatPieces({ remaining }: { remaining: number }) {
  const map = useMemo(cookedLambTexture, []);
  return <group name="MeatPieces">{meatPieces.map((p, i) => availablePatch(patchIndex(p.x, p.z)) && <group name={`lamb-piece-${i}`} key={i} position={[p.x, meatRestHeight(p, remaining), p.z]} rotation={[0, p.angle, 0]} scale={p.size * 0.85}>
    <mesh geometry={meatGeometry[i]} castShadow><meshStandardMaterial map={map} vertexColors roughness={.80} /></mesh>
  </group>)}</group>;
}

const jameedPools = [
  { x: -.21, z: -.04, rx: .36, rz: .60 }, { x: -.58, z: .41, rx: .38, rz: .36 },
  { x: .45, z: .47, rx: .39, rz: .36 }, { x: -.26, z: -.72, rx: .53, rz: .25 },
  { x: .66, z: -.30, rx: .28, rz: .30 },
];
function poolField(x: number, z: number) {
  let field = -Infinity;
  jameedPools.forEach((p, i) => {
    const dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz, angle = Math.atan2(dz, dx);
    const edge = 1 + .10 * Math.sin(angle * 5 + i) + .06 * Math.cos(angle * 9 - i * 2);
    field = Math.max(field, edge * edge - dx * dx - dz * dz);
  });
  return field;
}
function JameedSauce({ remaining }: { remaining: number }) {
  const geometries = useMemo(() => {
    if (remaining <= 0) return [];
    const vertices: number[][] = patches.map(() => []);
    type Sample = { p: THREE.Vector3; value: number };
    const clip = (points: Sample[], patch?: number) => {
      const clipped: THREE.Vector3[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if (a.value >= 0) clipped.push(a.p);
        if ((a.value >= 0) !== (b.value >= 0)) clipped.push(a.p.clone().lerp(b.p, a.value / (a.value - b.value)));
      }
      if (clipped.length < 3) return;
      const center = clipped.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / clipped.length);
      const index = patch === undefined ? patchIndex(center.x, center.z) : patch;
      if (!availablePatch(index)) return;
      for (let i = 1; i < clipped.length - 1; i++) vertices[index].push(...clipped[0].toArray(), ...clipped[i].toArray(), ...clipped[i + 1].toArray());
    };
    const step = .025;
    const riceSample = (x: number, z: number): Sample => ({ p: new THREE.Vector3(x, riceHeight(x, z, remaining) + .022, z), value: poolField(x, z) });
    for (let x = -1.20; x < 1.16; x += step) for (let z = -1.13; z < 1.04; z += step) {
      clip([riceSample(x, z), riceSample(x, z + step), riceSample(x + step, z)]);
      clip([riceSample(x + step, z), riceSample(x, z + step), riceSample(x + step, z + step)]);
    }
    // Conform directly to the meat triangles: no projected bridges, floating caps or sawtooth intersections.
    meatPieces.forEach((piece, i) => {
      const patch = patchIndex(piece.x, piece.z);
      if (!availablePatch(patch)) return;
      const geometry = meatGeometry[i], positions = geometry.attributes.position, normals = geometry.attributes.normal, indices = geometry.index!;
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), piece.angle);
      const origin = new THREE.Vector3(piece.x, meatRestHeight(piece, remaining), piece.z);
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
        for (let a = 0; a < subdivisions; a++) for (let b = 0; b < subdivisions - a; b++) {
          const u = a / subdivisions, v = b / subdivisions, s = 1 / subdivisions;
          clip([sample(u, v), sample(u + s, v), sample(u, v + s)], patch);
          if (a + b < subdivisions - 1) clip([sample(u + s, v), sample(u + s, v + s), sample(u, v + s)], patch);
        }
      }
    });
    return vertices.filter(v => v.length > 0).map(v => {
      const source = new THREE.BufferGeometry(); source.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      const geometry = mergeVertices(source); source.dispose(); geometry.computeVertexNormals(); return geometry;
    });
  }, [remaining]);
  useEffect(() => () => geometries.forEach(g => g.dispose()), [geometries]);
  return <group name="JameedSauce">{geometries.map((geometry, i) => <mesh key={i} geometry={geometry} receiveShadow><meshStandardMaterial color="#e9d7b1" roughness={.62} side={THREE.DoubleSide} /></mesh>)}</group>;
}
function Almonds({ remaining }: { remaining: number }) { return <FoodInstances name="Almonds" particles={almondParticles} remaining={remaining} geometry={almondGeometry} />; }
export const MansafPlatter = memo(function MansafPlatter({ remaining }: { remaining: number }) {
  return <group name="MansafPlatter" position={[0,.24,0]}>
    <Tray />
    <ShrakBread remaining={remaining} />
    <RiceMound remaining={remaining} />
    <MeatPieces remaining={remaining} />
    <JameedSauce remaining={remaining} />
    <Almonds remaining={remaining} />
  </group>;
});
