import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { HandMotion } from './handPoses';
import type { Game } from './main';
import { foodObstacleHeight } from './MansafPlatter';
import { createSleeveDeformer } from './sleeveDeformation';

/** The entire first-person arm is authored in Blender; only its pose is updated here. */
export function BlenderPlayerArm({ motion, hand, shoulder, elbow, game }: {
  motion: RefObject<HandMotion>; hand: RefObject<THREE.Group | null>;
  shoulder: THREE.Vector3; elbow: THREE.Vector3; game: RefObject<Game>;
}) {
  const gl = useThree(state => state.gl);
  const root = useRef<THREE.Group>(null);
  const skin = useRef<THREE.Mesh | null>(null);
  const sleeve = useRef<THREE.Mesh | null>(null);
  const original = useRef<Float32Array | null>(null);
  const deformSleeve = useRef<ReturnType<typeof createSleeveDeformer> | null>(null);
  const poseBounds = useRef<THREE.Box3[]>([]);
  const p = useMemo(() => ({
    vertex: new THREE.Vector3(),
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
    new GLTFLoader().load(new URL('./assets/mansaf-player-arm-v6.glb', import.meta.url).href, gltf => {
      if (cancelled) { dispose(gltf.scene); return; }
      asset = gltf.scene;
      const parts: THREE.Mesh[] = [];
      asset.traverse(node => { if (node instanceof THREE.Mesh) parts.push(node); });
      for (const part of parts) {
        part.castShadow = true; part.frustumCulled = false;
        for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
          if (material instanceof THREE.MeshStandardMaterial && material.map) {
            material.map.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
            material.map.needsUpdate = true;
          }
        }
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
          deformSleeve.current = createSleeveDeformer(original.current);
          root.current?.add(part);
        } else {
          if (part.name === 'HandSkin') {
            skin.current = part;
            // Every blend is a convex combination of these poses. Cache their
            // bounds once instead of evaluating the dense skin on the CPU each frame.
            const weights = part.morphTargetInfluences ?? [];
            const contactVertices = new Set<number>();
            for (let i = 0; i < part.geometry.attributes.position.count; i += 96) contactVertices.add(i);
            weights.fill(0);
            poseBounds.current = Array.from({ length: weights.length + 1 }, (_, pose) => {
              weights.fill(0);
              if (pose) weights[pose - 1] = 1;
              const box = new THREE.Box3();
              for (let i = 0; i < part.geometry.attributes.position.count; i++) {
                part.getVertexPosition(i, p.vertex);
                if (p.vertex.x < box.min.x || p.vertex.x > box.max.x || p.vertex.y < box.min.y || p.vertex.y > box.max.y || p.vertex.z < box.min.z || p.vertex.z > box.max.z) contactVertices.add(i);
                box.expandByPoint(p.vertex);
              }
              return box;
            });
            weights.fill(0);
            part.userData.contactVertices = [...contactVertices];
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
      poseBounds.current = [];
      deformSleeve.current = null;
      if (asset) dispose(asset);
    };
  }, [hand, gl, p]);
  // Skin is posed before the existing gameplay controller checks food clearance.
  useFrame((_, delta) => {
    const mesh = skin.current;
    if (!mesh?.morphTargetInfluences || !mesh.morphTargetDictionary) return;
    const blend = 1 - Math.exp(-16 * Math.min(delta, .05));
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      const target = motion.current.weights ? motion.current.weights[name] ?? 0 : name === motion.current.pose ? 1 : 0;
      mesh.morphTargetInfluences[index] += (target - mesh.morphTargetInfluences[index]) * blend;
    }
    const boxes = poseBounds.current;
    if (!boxes.length) return;
    const weights = mesh.morphTargetInfluences;
    const basisWeight = Math.max(0, 1 - weights.reduce((sum, weight) => sum + weight, 0));
    const bounds = mesh.geometry.boundingBox ??= new THREE.Box3();
    bounds.min.copy(boxes[0].min).multiplyScalar(basisWeight);
    bounds.max.copy(boxes[0].max).multiplyScalar(basisWeight);
    for (let i = 0; i < weights.length; i++) {
      bounds.min.addScaledVector(boxes[i + 1].min, weights[i]);
      bounds.max.addScaledVector(boxes[i + 1].max, weights[i]);
    }
  }, -1);
  // Bend the exported cloth mesh after the controller has positioned the hand.
  useFrame(() => {
    const cloth = sleeve.current, h = hand.current;
    if (!cloth || !h || !deformSleeve.current) return;
    deformSleeve.current(cloth.geometry, h, elbow, shoulder, (x, z) => foodObstacleHeight(x, z, game.current.remaining));
  });
  return <group ref={root} name="blender-full-player-arm" />;
}
