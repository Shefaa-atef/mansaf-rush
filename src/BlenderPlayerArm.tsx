import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { HandMotion } from './handPoses';
import type { Game } from './main';
import { foodObstacleHeight } from './MansafPlatter';

/** The entire first-person arm is authored in Blender; only its pose is updated here. */
export function BlenderPlayerArm({ motion, hand, shoulder, elbow, game }: {
  motion: RefObject<HandMotion>; hand: RefObject<THREE.Group | null>;
  shoulder: THREE.Vector3; elbow: THREE.Vector3; game: RefObject<Game>;
}) {
  const root = useRef<THREE.Group>(null);
  const skin = useRef<THREE.Mesh | null>(null);
  const sleeve = useRef<THREE.Mesh | null>(null);
  const original = useRef<Float32Array | null>(null);
  const p = useMemo(() => ({
    vertex: new THREE.Vector3(), curve: new THREE.CubicBezierCurve3(),
    center: new THREE.Vector3(), tangent: new THREE.Vector3(), side: new THREE.Vector3(),
    normal: new THREE.Vector3(), direction: new THREE.Vector3(), handX: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0), rotatedSide: new THREE.Vector3(), rotatedNormal: new THREE.Vector3(),
  }), []);
  useEffect(() => {
    let cancelled = false;
    let asset: THREE.Group | undefined;
    const attachment = new THREE.Group(); attachment.name = 'blender-hand-and-cuff';
    const dispose = (scene: THREE.Object3D) => scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
        material.dispose();
      }
    });
    new GLTFLoader().load(new URL('./assets/mansaf-player-arm-v4.glb', import.meta.url).href, gltf => {
      if (cancelled) { dispose(gltf.scene); return; }
      asset = gltf.scene;
      const parts: THREE.Mesh[] = [];
      asset.traverse(node => { if (node instanceof THREE.Mesh) parts.push(node); });
      for (const part of parts) {
        part.castShadow = true; part.frustumCulled = false;
        if (part.name === 'Sleeve') {
          sleeve.current = part;
          const positions = part.geometry.attributes.position;
          original.current = new Float32Array(positions.count * 3);
          for (let i = 0; i < positions.count; i++) {
            original.current[i * 3] = positions.getX(i);
            original.current[i * 3 + 1] = positions.getY(i);
            original.current[i * 3 + 2] = positions.getZ(i);
          }
          part.geometry.setAttribute('position', new THREE.BufferAttribute(original.current.slice(), 3).setUsage(THREE.DynamicDrawUsage));
          root.current?.add(part);
        } else {
          if (part.name === 'HandSkin') {
            skin.current = part;
            const anatomy = new THREE.Group(); anatomy.name = 'hand-anatomy';
            anatomy.add(part); attachment.add(anatomy);
          } else attachment.add(part);
        }
      }
      hand.current?.add(attachment);
    }, undefined, error => console.error('Could not load Blender player arm', error));
    return () => {
      cancelled = true;
      attachment.removeFromParent(); dispose(attachment);
      if (sleeve.current) { dispose(sleeve.current); sleeve.current.removeFromParent(); }
      skin.current = null; sleeve.current = null; original.current = null;
      if (asset) dispose(asset);
    };
  }, [hand]);
  // Skin is posed before the existing gameplay controller checks food clearance.
  useFrame((_, delta) => {
    const mesh = skin.current;
    if (!mesh?.morphTargetInfluences || !mesh.morphTargetDictionary) return;
    const blend = 1 - Math.exp(-16 * Math.min(delta, .05));
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      mesh.morphTargetInfluences[index] += ((name === motion.current.pose ? 1 : 0) - mesh.morphTargetInfluences[index]) * blend;
    }
    const bounds = mesh.geometry.boundingBox ??= new THREE.Box3(); bounds.makeEmpty();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, p.vertex); bounds.expandByPoint(p.vertex);
    }
  }, -1);
  // Bend the exported cloth mesh after the controller has positioned the hand.
  useFrame(() => {
    const cloth = sleeve.current, rest = original.current, h = hand.current;
    if (!cloth || !rest || !h) return;
    h.updateWorldMatrix(true, false);
    p.curve.v0.set(0, 0, .425); h.localToWorld(p.curve.v0);
    p.direction.set(0, 0, 1).applyQuaternion(h.quaternion);
    p.handX.set(1, 0, 0).applyQuaternion(h.quaternion);
    p.curve.v1.copy(p.curve.v0).addScaledVector(p.direction, .28);
    p.curve.v2.copy(elbow);
    p.curve.v3.copy(shoulder);
    const positions = cloth.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      const t = THREE.MathUtils.clamp((z - .425) / (2.25 - .425), 0, 1);
      p.curve.getPoint(t, p.center); p.curve.getTangent(t, p.tangent);
      p.side.crossVectors(p.up, p.tangent);
      if (p.side.lengthSq() < .001) p.side.set(1, 0, 0); else p.side.normalize();
      p.normal.crossVectors(p.tangent, p.side).normalize();
      const twist = Math.atan2(p.handX.dot(p.normal), p.handX.dot(p.side)) * (1 - THREE.MathUtils.smoothstep(t, 0, .8));
      p.rotatedSide.copy(p.side).multiplyScalar(Math.cos(twist)).addScaledVector(p.normal, Math.sin(twist));
      p.rotatedNormal.copy(p.normal).multiplyScalar(Math.cos(twist)).addScaledVector(p.side, -Math.sin(twist));
      const width = THREE.MathUtils.lerp(1.65, 1.25, THREE.MathUtils.smoothstep(t, 0, .7));
      const radius = Math.hypot(x, y) * width;
      if (t > .08 && t < .95) p.center.y = Math.max(p.center.y, foodObstacleHeight(p.center.x, p.center.z, game.current.remaining) + radius + .025);
      p.vertex.copy(p.center).addScaledVector(p.rotatedSide, x * width).addScaledVector(p.rotatedNormal, y * width);
      positions.setXYZ(i, p.vertex.x, p.vertex.y, p.vertex.z);
    }
    positions.needsUpdate = true; cloth.geometry.computeVertexNormals();
  });
  return <group ref={root} name="blender-full-player-arm" />;
}
