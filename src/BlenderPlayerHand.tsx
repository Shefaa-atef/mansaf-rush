import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { HandMotion } from './handPoses';
import { PlayerHandModel } from './PlayerHandModel';

/** Player-only Blender asset. Opponents keep their existing model. */
export function BlenderPlayerHand({ motion }: { motion: RefObject<HandMotion> }) {
  const root = useRef<THREE.Group>(null);
  const [ready, setReady] = useState(false);
  const meshes = useRef<THREE.Mesh[]>([]);
  const vertex = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Group | undefined;
    const dispose = (scene: THREE.Group) => scene.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
      }
    });
    new GLTFLoader().load(new URL('./assets/mansaf-player-hand.glb', import.meta.url).href, gltf => {
      if (cancelled) { dispose(gltf.scene); return; }
      loaded = gltf.scene;
      loaded.name = 'blender-player-hand';
      loaded.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = true;
        node.frustumCulled = false;
        meshes.current.push(node);
      });
      loaded.name = 'hand-anatomy';
      root.current?.add(loaded);
      setReady(true);
    }, undefined, error => console.error('Player hand asset could not load; using original hand.', error));
    return () => {
      cancelled = true;
      meshes.current = [];
      if (loaded) { loaded.removeFromParent(); dispose(loaded); }
    };
  }, []);
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-16 * Math.min(delta, .05));
    for (const mesh of meshes.current) {
      const weights = mesh.morphTargetInfluences, names = mesh.morphTargetDictionary;
      if (!weights || !names) continue;
      for (const [name, index] of Object.entries(names)) {
        const target = name === motion.current.pose ? 1 : 0;
        weights[index] += (target - weights[index]) * blend;
      }
      // The existing food-clearance hook reads geometry bounds. Supply posed
      // bounds instead of glTF's union of every possible morph target.
      const bounds = mesh.geometry.boundingBox ??= new THREE.Box3();
      bounds.makeEmpty();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, vertex); bounds.expandByPoint(vertex);
      }
    }
  }, -1);
  return <group ref={root} name="player-hand-asset">
    {!ready && <PlayerHandModel motion={motion} />}
  </group>;
}
