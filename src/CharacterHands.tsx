import { useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Game } from './main';
import { CharacterSleeves } from './CharacterSleeves';

let source: Promise<THREE.Group> | undefined;
function playerSkin() {
  return source ??= new GLTFLoader().loadAsync(new URL('./assets/mansaf-player-arm-v6.glb', import.meta.url).href)
    .then(gltf => {
      const skin = gltf.scene.getObjectByName('HandSkin');
      if (!(skin instanceof THREE.Mesh)) throw new Error('Player hand skin missing');
      return gltf.scene;
    });
}

/** Same continuous skin and finger poses as the player, fitted to each wrist. */
export function CharacterHands({ scene, id, game }: { scene: THREE.Group; id: number; game: RefObject<Game> }) {
  const hands = useRef<THREE.Mesh[]>([]);
  useEffect(() => {
    let cancelled = false;
    const originals: THREE.Object3D[] = [], attachments: THREE.Mesh[] = [];
    playerSkin().then(source => {
      const template = source.getObjectByName('HandSkin') as THREE.Mesh;
      if (cancelled) return;
      for (const side of ['R', 'L']) {
        const wrist = scene.getObjectByName(`hand_${side}`);
        const old = scene.getObjectByName(`Hand_${side}`);
        if (!wrist || !(old instanceof THREE.Mesh)) continue;
        const mesh = template.clone();
        mesh.name = `PlayerStyleHand_${side}`;
        mesh.geometry = template.geometry.clone();
        const material = (Array.isArray(template.material) ? template.material[0] : template.material).clone() as THREE.MeshStandardMaterial;
        const oldMaterial = Array.isArray(old.material) ? old.material[0] : old.material;
        if (oldMaterial instanceof THREE.MeshStandardMaterial) material.color.copy(oldMaterial.color);
        mesh.material = material;
        // Player fingers point -Z; the characters' wrist bones point +Y.
        mesh.rotation.set(Math.PI / 2, 0, 0);
        mesh.scale.set(side === 'R' ? .82 : -.82, .82, .82);
        mesh.position.set(0, .23 * .82, 0);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        wrist.add(mesh);
        old.visible = false;
        originals.push(old); attachments.push(mesh);
      }
      hands.current = attachments;
    }).catch(error => console.error('Could not fit player-style character hands', error));
    return () => {
      cancelled = true; hands.current = [];
      originals.forEach(mesh => { mesh.visible = true; });
      attachments.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
    };
  }, [scene]);
  useFrame((_, delta) => {
    const g = game.current, t = (performance.now() - g.bites[id]) / 1500;
    const active = g.phase === 'playing' && g.bites[id] > 0 && t >= 0 && t < 1.25;
    const ease = (v: number) => THREE.MathUtils.smoothstep(v, 0, 1);
    let weights: Record<string, number> = { REACH: 1 };
    if (active && t < .40) {
      const close = ease((t - .15) / .25);
      weights = { REACH: 1 - close, SCOOP_CLOSE: close };
    } else if (active && t < .62) {
      const roll = ease((t - .40) / .22);
      weights = { SCOOP_CLOSE: 1 - roll, KNEAD_A: roll * (1 - roll), KNEAD_B: roll * roll };
    } else if (active && t < .94) {
      const hold = ease((t - .62) / .12);
      weights = { KNEAD_B: 1 - hold, HOLD_LOKMA: hold };
    } else if (active) {
      const release = ease((t - .94) / .26);
      weights = { HOLD_LOKMA: 1 - release, REACH: release };
    }
    const blend = 1 - Math.exp(-20 * Math.min(delta, .05));
    for (const mesh of hands.current) {
      const pose = mesh.name.endsWith('_L') ? { REACH: .8 } : weights;
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
        const values = mesh.morphTargetInfluences!;
        values[index] += ((pose[name as keyof typeof pose] ?? 0) - values[index]) * blend;
      }
    }
  });
  return <CharacterSleeves scene={scene} />;
}
