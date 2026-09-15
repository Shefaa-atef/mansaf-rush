import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** A single tapered surface follows each shoulder, elbow and wrist. */
export function CharacterSleeves({ scene }: { scene: THREE.Group }) {
  const arms = useRef<Array<{ mesh: THREE.Mesh; upper: THREE.Object3D; elbow: THREE.Object3D; wrist: THREE.Object3D; old: THREE.Object3D[] }>>([]);
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
      arms.current.push({ mesh, upper, elbow, wrist, old });
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
      end.x *= refined ? .52 : .84;
      if (refined) end.y -= .055;
      cuffDirection.sub(start).normalize().multiplyScalar(.14).add(start);
      const curve = refined
        ? new THREE.CatmullRomCurve3([start, cuffDirection, elbow, shoulder, end], false, 'centripetal')
        : new THREE.CubicBezierCurve3(start, cuffDirection, elbow, end);
      const frames = curve.computeFrenetFrames(48, false);
      const geometry = arm.mesh.geometry, position = geometry.attributes.position, rest = geometry.userData.rest as Float32Array;
      const centers = Array.from({ length: 49 }, (_, i) => curve.getPoint(i / 48));
      const point = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.clamp(.5 - rest[i * 3 + 1], 0, 1), ring = Math.round(t * 48);
        const center = point.copy(centers[ring]);

        const radius = THREE.MathUtils.lerp(.105, refined ? .145 : .185, THREE.MathUtils.smoothstep(t, 0, .82)) * (refined ? THREE.MathUtils.lerp(1,.28,THREE.MathUtils.smoothstep(t,.90,1)) : 1);
        center.addScaledVector(frames.normals[ring], rest[i * 3] * radius);
        center.addScaledVector(frames.binormals[ring], rest[i * 3 + 2] * radius);
        position.setXYZ(i, center.x, center.y, center.z);
      }
      position.needsUpdate = true; geometry.computeVertexNormals();
    }
  });
  return null;
}

