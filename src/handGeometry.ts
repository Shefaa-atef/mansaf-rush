import * as THREE from 'three';
import type { HandPose } from './handPoses';

const SIDES = 12, DIGIT_RINGS = 16, PALM_RINGS = 22;
// Extra rings at the tip round it off without spending polygons along straight bones.
const DIGIT_STEPS = [0, .08, .16, .24, .32, .40, .48, .56, .64, .72, .80, .86, .91, .95, .975, .99, 1];
// Palm faces +Y, fingertips point -Z; thumb on +X makes this a RIGHT hand.
export const FINGERS = [
  { name: 'pinky', x: -.127, z: -.143, length: .226, width: .033, yaw: .10 },
  { name: 'ring', x: -.046, z: -.185, length: .307, width: .039, yaw: .025 },
  { name: 'middle', x: .043, z: -.204, length: .338, width: .041, yaw: -.012 },
  { name: 'index', x: .128, z: -.178, length: .301, width: .039, yaw: -.075 },
] as const;

const THUMB_SOCKET = [
  [8, 11], [8, 0], [8, 1], [8, 2], [9, 2], [10, 2],
  [11, 2], [11, 1], [11, 0], [11, 11], [10, 11], [9, 11],
] as const;

function tube(rings: number, palm = false) {
  const geometry = new THREE.BufferGeometry(), indices: number[] = [];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((rings + 1) * SIDES * 3), 3));
  for (let ring = 0; ring < rings; ring++) for (let side = 0; side < SIDES; side++) {
    // A real opening in the palm, joined vertex-for-vertex to the thumb root.
    if (palm && ring >= 8 && ring < 11 && [11, 0, 1].includes(side)) continue;
    const a = ring * SIDES + side, b = ring * SIDES + (side + 1) % SIDES;
    indices.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
  }
  geometry.setIndex(indices);
  return geometry;
}

function finish(geometry: THREE.BufferGeometry) {
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

// Cross sections flow from wrist through heel to knuckles, without a separate box.
const PALM_PROFILE = [
  [.34, .091, .051], [.25, .096, .052], [.16, .119, .056],
  [.055, .157, .058], [-.045, .173, .056], [-.135, .175, .049],
  [-.175, .155, .035], [-.205, .012, .006],
];

function updatePalm(geometry: THREE.BufferGeometry, cup: number) {
  const positions = geometry.attributes.position;
  for (let ring = 0; ring <= PALM_RINGS; ring++) {
    const z = .34 - ring / PALM_RINGS * .545;
    let section = 0;
    while (section < PALM_PROFILE.length - 2 && z < PALM_PROFILE[section + 1][0]) section++;
    const a = PALM_PROFILE[section], b = PALM_PROFILE[section + 1];
    const blend = THREE.MathUtils.smoothstep((a[0] - z) / (a[0] - b[0]), 0, 1);
    const width = THREE.MathUtils.lerp(a[1], b[1], blend), depth = THREE.MathUtils.lerp(a[2], b[2], blend);
    for (let side = 0; side < SIDES; side++) {
      const angle = side / SIDES * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      const x = Math.sign(c) * Math.pow(Math.abs(c), .86) * width;
      const hollow = .012 * Math.exp(-((x / .095) ** 2 + ((z - .01) / .135) ** 2));
      const thumbPad = .009 * Math.exp(-(((x - .105) / .062) ** 2 + ((z - .105) / .095) ** 2));
      const edgeLift = cup * .025 * (x / .18) ** 2 * Math.exp(-((z / .22) ** 2));
      const y = s >= 0 ? Math.pow(s, .85) * depth - hollow * s * s + thumbPad * s + edgeLift : s * depth * .90 + edgeLift * .3;
      const knuckle = THREE.MathUtils.smoothstep(-z, .10, .23);
      positions.setXYZ(ring * SIDES + side, x, y, z + knuckle * .043 * Math.max(0, -x / .17));
    }
  }
  finish(geometry);
}

function digit(geometry: THREE.BufferGeometry, finger: typeof FINGERS[number], bends: number[], spread: number) {
  const positions = geometry.attributes.position;
  let x = finger.x, y = 0, z = finger.z + .018;
  const yaw = finger.yaw * spread;
  for (let ring = 0; ring <= DIGIT_RINGS; ring++) {
    const t = DIGIT_STEPS[ring], step = ring ? t - DIGIT_STEPS[ring - 1] : 0;
    // Three phalanges, with small rounded transitions at the two finger joints.
    const pitch = bends[0] + bends[1] * THREE.MathUtils.smoothstep(t, .40, .53) + bends[2] * THREE.MathUtils.smoothstep(t, .73, .84);
    if (ring) {
      x -= Math.sin(yaw) * Math.cos(pitch) * finger.length * step;
      y += Math.sin(pitch) * finger.length * step;
      z -= Math.cos(yaw) * Math.cos(pitch) * finger.length * step;
    }
    const tip = t > .86 ? Math.sqrt(Math.max(.0001, 1 - ((t - .86) / .14) ** 2)) : 1;
    const knuckle = 1 + .035 * Math.exp(-(((t - .46) / .065) ** 2));
    const radius = finger.width * (1 - .30 * t) * tip * knuckle;
    for (let side = 0; side < SIDES; side++) {
      const angle = side / SIDES * Math.PI * 2, dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius * .83;
      positions.setXYZ(ring * SIDES + side,
        x + dx * Math.cos(yaw) + dy * Math.sin(pitch) * Math.sin(yaw),
        y + dy * Math.cos(pitch), z - dx * Math.sin(yaw) + dy * Math.sin(pitch) * Math.cos(yaw));
    }
  }
  finish(geometry);
}

function thumb(geometry: THREE.BufferGeometry, palm: THREE.BufferGeometry, opposition: number) {
  const positions = geometry.attributes.position;
  const socket = THUMB_SOCKET.map(([ring, side]) => new THREE.Vector3().fromBufferAttribute(palm.attributes.position, ring * SIDES + side));
  const origin = socket.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / SIDES);
  let x = origin.x, y = origin.y, z = origin.z;
  for (let ring = 0; ring <= DIGIT_RINGS; ring++) {
    const t = DIGIT_STEPS[ring], step = ring ? t - DIGIT_STEPS[ring - 1] : 0;
    const joint = THREE.MathUtils.smoothstep(t, .48, .66);
    const yaw = -Math.PI / 4 + opposition * .12 + joint * opposition * .64;
    const pitch = .08 + opposition * .18 + joint * (.16 + opposition * .60);
    if (ring) {
      x -= Math.sin(yaw) * Math.cos(pitch) * .19 * step;
      y += Math.sin(pitch) * .19 * step;
      z -= Math.cos(yaw) * Math.cos(pitch) * .19 * step;
    }
    const tip = t > .84 ? Math.sqrt(Math.max(.0001, 1 - ((t - .84) / .16) ** 2)) : 1;
    const radius = THREE.MathUtils.lerp(.046, .029, t) * tip;
    const blend = THREE.MathUtils.smoothstep(t, 0, .32);
    for (let side = 0; side < SIDES; side++) {
      const angle = side / SIDES * Math.PI * 2 - Math.PI / 4, dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius * .86;
      const base = socket[side];
      positions.setXYZ(ring * SIDES + side,
        x + THREE.MathUtils.lerp(base.x - origin.x, dx * Math.cos(yaw) + dy * Math.sin(pitch) * Math.sin(yaw), blend),
        y + THREE.MathUtils.lerp(base.y - origin.y, dy * Math.cos(pitch), blend),
        z + THREE.MathUtils.lerp(base.z - origin.z, -dx * Math.sin(yaw) + dy * Math.sin(pitch) * Math.cos(yaw), blend));
    }
  }
  finish(geometry);
  const normal = new THREE.Vector3(), other = new THREE.Vector3();
  THUMB_SOCKET.forEach(([ring, side], i) => {
    const index = ring * SIDES + side;
    normal.fromBufferAttribute(palm.attributes.normal, index);
    other.fromBufferAttribute(geometry.attributes.normal, i);
    normal.add(other).normalize();
    palm.attributes.normal.setXYZ(index, normal.x, normal.y, normal.z);
    geometry.attributes.normal.setXYZ(i, normal.x, normal.y, normal.z);
  });
  palm.attributes.normal.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
}

export function createHandGeometry() {
  return { palm: tube(PALM_RINGS, true), digits: Array.from({ length: 5 }, () => tube(DIGIT_RINGS)) };
}
export type HandGeometry = ReturnType<typeof createHandGeometry>;
export function updateHandGeometry(geometry: HandGeometry, pose: HandPose) {
  updatePalm(geometry.palm, pose.cup);
  FINGERS.forEach((finger, i) => digit(geometry.digits[i], finger, pose.fingers[i], pose.spread));
  thumb(geometry.digits[4], geometry.palm, pose.thumb);
}
