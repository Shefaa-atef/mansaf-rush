import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sleeveRestHeight } from './trayRim';

const ringWorld = new THREE.Vector3(), worldToScene = new THREE.Matrix4();

/**
 * Let the fabric ride over the tray's rim instead of sinking into it. Each ring of the sleeve is lifted
 * just enough for its tube to rest on the metal, the lift is spread over the neighbouring rings so the
 * sleeve bends smoothly, and the cuff stays on the wrist. The arm itself is not moved.
 */
function drapeOverRim(centers: THREE.Vector3[], frames: { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] }, scene: THREE.Object3D, radiusAt: (t: number) => number) {
  const count = centers.length, lift = new Float32Array(count), scale = scene.matrixWorld.getMaxScaleOnAxis();
  let touching = false;
  for (let i = 0; i < count; i++) {
    ringWorld.copy(centers[i]).applyMatrix4(scene.matrixWorld);
    // Below the rim height the arm is beside or under the tray, not crossing it.
    if (ringWorld.y < .4) continue;
    const need = sleeveRestHeight(Math.hypot(ringWorld.x, ringWorld.z), radiusAt(i / (count - 1)) * scale) + .006 - ringWorld.y;
    if (need > 0) { lift[i] = need; touching = true; }
  }
  if (!touching) return;
  const spread = 4, smooth = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    for (let j = Math.max(0, i - spread); j <= Math.min(count - 1, i + spread); j++) smooth[i] = Math.max(smooth[i], lift[j] * (1 - Math.abs(i - j) / (spread + 1)));
  }
  worldToScene.copy(scene.matrixWorld).invert();
  for (let i = 0; i < count; i++) {
    const amount = smooth[i] * THREE.MathUtils.smoothstep(i, 0, 3);
    if (amount <= 0) continue;
    ringWorld.copy(centers[i]).applyMatrix4(scene.matrixWorld);
    ringWorld.y += amount;
    centers[i].copy(ringWorld).applyMatrix4(worldToScene);
  }
  // Square each ring to the bent path so the tube keeps a round section.
  for (let i = 0; i < count; i++) {
    const tangent = frames.tangents[i].copy(centers[Math.min(count - 1, i + 1)]).sub(centers[Math.max(0, i - 1)]).normalize();
    const normal = frames.normals[i];
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    frames.binormals[i].crossVectors(tangent, normal);
  }
}

/** A single tapered surface follows each shoulder, elbow and wrist. */
export function CharacterSleeves({ scene }: { scene: THREE.Group }) {
  const arms = useRef<Array<{ mesh: THREE.Mesh; upper: THREE.Object3D; elbow: THREE.Object3D; wrist: THREE.Object3D; old: THREE.Object3D[]; ticks: number }>>([]);
  useEffect(() => {
    for (const side of ['R', 'L']) {
      const upper = scene.getObjectByName(`upper_arm_${side}`), elbow = scene.getObjectByName(`forearm_${side}`), wrist = scene.getObjectByName(`hand_${side}`);
      const sleeve = scene.getObjectByName(`Wide_sleeve_${side}`);
      if (!upper || !elbow || !wrist || !(sleeve instanceof THREE.Mesh)) continue;
      const geometry = new THREE.CylinderGeometry(1, 1, 1, 32, 48, false);
      const original = Array.isArray(sleeve.material) ? sleeve.material[0] : sleeve.material;
      const material = original.clone();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `ContinuousSleeve_${side}`; mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = true;
      const old = [sleeve, scene.getObjectByName(`Arm_anatomy_${side}`)].filter(Boolean) as THREE.Object3D[];
      old.forEach(part => { part.visible = false; });
      scene.add(mesh);
      // Preserve the cylinder coordinates as stable ring parameters.
      geometry.userData.rest = new Float32Array(geometry.attributes.position.array);
      arms.current.push({ mesh, upper, elbow, wrist, old, ticks: 0 });
    }
    return () => {
      for (const arm of arms.current) {
        arm.old.forEach(part => { part.visible = true; });
        arm.mesh.removeFromParent(); arm.mesh.geometry.dispose(); (arm.mesh.material as THREE.Material).dispose();
      }
      arms.current = [];
    };
  }, [scene]);
  // Run after the character's IK without taking over rendering.
  useFrame(() => {
    scene.updateWorldMatrix(true, true);
    for (const arm of arms.current) {
      const hand = arm.wrist.getObjectByName(`PlayerStyleHand_${arm.wrist.name.endsWith('_R') ? 'R' : 'L'}`);
      const start = new THREE.Vector3(), cuffDirection = new THREE.Vector3();
      if (hand) {
        // Place the cuff inside the wrist and align its opening to the wrist,
        // rather than cutting across the skin when the hand rotates.
        start.set(0, 0, .19).applyMatrix4(hand.matrixWorld);
        cuffDirection.set(0, 0, .34).applyMatrix4(hand.matrixWorld);
      } else {
        arm.wrist.getWorldPosition(start);
        arm.elbow.getWorldPosition(cuffDirection);
      }
      const elbow = arm.elbow.getWorldPosition(new THREE.Vector3()), end = arm.upper.getWorldPosition(new THREE.Vector3());
      scene.worldToLocal(start); scene.worldToLocal(cuffDirection); scene.worldToLocal(elbow); scene.worldToLocal(end);
      const refined = scene.getObjectByName('ZaidRig')?.userData.chibiRefinement === 2;
      const shoulder = end.clone();
      // Bury a full-width sleeve root inside the chest. A narrow tip here
      // made the shoulder look like a separate tube plugged into the body.
      end.x *= refined ? .48 : .70;
      end.y -= .025;
      // Follow the wrist axis at the opening so the skin exits through the cuff.
      cuffDirection.sub(start).normalize();
      cuffDirection.multiplyScalar(Math.min(.18, start.distanceTo(elbow) * .4)).add(start);
      const elbowTangent = shoulder.clone().sub(start).normalize();
      const elbowHandle = Math.min(start.distanceTo(elbow), elbow.distanceTo(shoulder)) * .28;
      const shoulderTangent = end.clone().sub(elbow).normalize();
      const shoulderHandle = Math.min(elbow.distanceTo(shoulder), shoulder.distanceTo(end)) * .38;
      // Bezier handles give the cuff, elbow and shoulder continuous tangents.
      // Interpolating a tiny extra wrist point produced an S-bend at the cuff.
      const curve = new THREE.CurvePath<THREE.Vector3>();
      curve.add(new THREE.CubicBezierCurve3(start, cuffDirection, elbow.clone().addScaledVector(elbowTangent, -elbowHandle), elbow));
      curve.add(new THREE.CubicBezierCurve3(elbow, elbow.clone().addScaledVector(elbowTangent, elbowHandle), shoulder.clone().addScaledVector(shoulderTangent, -shoulderHandle), shoulder));
      curve.add(new THREE.CubicBezierCurve3(shoulder, shoulder.clone().addScaledVector(shoulderTangent, shoulderHandle), end.clone().lerp(shoulder, .25), end));
      const frames = curve.computeFrenetFrames(48, false);
      const geometry = arm.mesh.geometry, position = geometry.attributes.position, rest = geometry.userData.rest as Float32Array;
      const radiusAt = (t: number) => THREE.MathUtils.lerp(.105, refined ? .175 : .185, THREE.MathUtils.smoothstep(t, 0, .82)) * (scene.userData.fullerChibi ? 1 + .16 * THREE.MathUtils.smoothstep(t, .12, .72) : 1);
      const centers = Array.from({ length: 49 }, (_, i) => curve.getPoint(i / 48));
      drapeOverRim(centers, frames, scene, radiusAt);
      const point = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.clamp(.5 - rest[i * 3 + 1], 0, 1), ring = Math.round(t * 48);
        const center = point.copy(centers[ring]);
        const radius = radiusAt(t);
        center.addScaledVector(frames.normals[ring], rest[i * 3] * radius);
        center.addScaledVector(frames.binormals[ring], rest[i * 3 + 2] * radius);
        position.setXYZ(i, center.x, center.y, center.z);
      }
      position.needsUpdate = true;
      // The shape follows the arm every frame. Its shading normals change far too little between two
      // frames to see, and recomputing them is the most expensive part, so every other frame is enough.
      if ((arm.ticks++ & 1) === 0) geometry.computeVertexNormals();
    }
  });
  return null;
}

