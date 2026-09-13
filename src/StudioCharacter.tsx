import { extendArmForReach } from './characterArmProportions';
import { botBiteWrist } from './botBiteMotion';
import { CharacterHands } from './CharacterHands';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { botSeats } from './platterFood';
import { foodObstacleHeight, foodSurface } from './MansafPlatter';
import type { Game } from './main';

const urls = [
  new URL('./assets/zaid-studio.glb', import.meta.url).href,
  new URL('./assets/omar-studio.glb', import.meta.url).href,
  new URL('./assets/sami-studio.glb', import.meta.url).href,
];
const ease = (t: number) => THREE.MathUtils.smootherstep(t, 0, 1);
type Arm = { upper: THREE.Bone; fore: THREE.Bone; hand: THREE.Bone; bind: THREE.Quaternion; a: number; b: number };
type Rig = { scene: THREE.Group; right: Arm; left: Arm; head: THREE.Bone; chest: THREE.Bone;
  rest: Map<THREE.Bone, THREE.Quaternion>; fingers: THREE.Bone[]; mouths: THREE.Mesh[];
  eyes: THREE.Mesh[]; skin: THREE.SkinnedMesh[]; mouthSocket: THREE.Vector3 };

function dispose(scene: THREE.Object3D) {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  scene.traverse(n => { if (n instanceof THREE.Mesh) {
    geometry.add(n.geometry);
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      materials.add(m);
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
    }
  }});
  geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

export function StudioCharacter({ id, game, fallback, onChew, onUnlock }: {
  id: number; game: RefObject<Game>; fallback: ReactNode; onChew: () => void; onUnlock: () => void;
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const rig = useRef<Rig | null>(null), food = useRef<THREE.Group>(null), lastBite = useRef(0);
  const p = useMemo(() => ({
    shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), direction: new THREE.Vector3(),
    pole: new THREE.Vector3(), axis: new THREE.Vector3(), point: new THREE.Vector3(), ready: new THREE.Vector3(),
    scoop: new THREE.Vector3(), mouth: new THREE.Vector3(), goal: new THREE.Vector3(), foodOffset: new THREE.Vector3(0, .23, .065),
    world: new THREE.Quaternion(), parent: new THREE.Quaternion(), q: new THREE.Quaternion(),
    handQ: new THREE.Quaternion(), eatQ: new THREE.Quaternion(), yaw: new THREE.Quaternion(), twist: new THREE.Quaternion(),
  }), []);

  useEffect(() => {
    let cancelled = false, loaded: THREE.Group | undefined;
    window.addEventListener('pointerdown', onUnlock);
    new GLTFLoader().load(urls[id - 1], gltf => {
      if (cancelled) { dispose(gltf.scene); return; }
      loaded = gltf.scene;
      const seat = botSeats[id - 1], yaw = id === 1 ? .85 : id === 3 ? -.85 : 0;
      loaded.position.set(seat[0], -.40, seat[1]);
      loaded.rotation.set(.16, yaw, 0, 'YXZ'); loaded.scale.setScalar(.98);
      loaded.updateMatrixWorld(true);
      const bone = (name: string) => { const b = loaded!.getObjectByName(name); if (!(b instanceof THREE.Bone)) throw new Error(`Missing ${name}`); return b; };
      try {
        const rest = new Map<THREE.Bone, THREE.Quaternion>(), fingers: THREE.Bone[] = [], mouths: THREE.Mesh[] = [], eyes: THREE.Mesh[] = [], skin: THREE.SkinnedMesh[] = [];
        loaded.traverse(n => {
          if (n instanceof THREE.Bone) { rest.set(n, n.quaternion.clone()); if (/^(finger_R|thumb_R)/.test(n.name)) fingers.push(n); }
          if (n instanceof THREE.Mesh) {
            n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false;
            if (n.morphTargetDictionary?.OPEN !== undefined) mouths.push(n);
            if (n.morphTargetDictionary?.BLINK !== undefined) eyes.push(n);
            if (n instanceof THREE.SkinnedMesh && n.name === 'Hand_R') skin.push(n);
          }
        });
        const arm = (side: string): Arm => {
          const upper = bone(`upper_arm_${side}`), fore = bone(`forearm_${side}`), hand = bone(`hand_${side}`);
          upper.getWorldPosition(p.shoulder); fore.getWorldPosition(p.elbow); hand.getWorldPosition(p.wrist);
          return { upper, fore, hand, a: p.shoulder.distanceTo(p.elbow), b: p.elbow.distanceTo(p.wrist),
            bind: loaded!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion())) };
        };
        const head = bone('head'), chest = bone('chest');
        const mouthSocket = new THREE.Vector3(0, 1.94 + (1.75 - 1.94) * 1.18, .414 * 1.18);
        loaded.localToWorld(mouthSocket); head.worldToLocal(mouthSocket);
        rig.current = { scene: loaded, right: arm('R'), left: arm('L'), head, chest, rest, fingers, mouths, eyes, skin, mouthSocket };
        p.yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        setScene(loaded);
      } catch (error) { console.error(`Character ${id} could not be rigged`, error); dispose(loaded); loaded = undefined; }
    }, undefined, error => console.error(`Character ${id} failed to load`, error));
    return () => { cancelled = true; rig.current = null; window.removeEventListener('pointerdown', onUnlock); if (loaded) dispose(loaded); };
  }, [id, onUnlock, p]);

  useFrame(() => {
    const r = rig.current;
    if (!r || !scene || r.scene !== scene) return;
    const g = game.current, now = performance.now(), t = (now - g.bites[id]) / 1500;
    const active = g.phase === 'playing' && g.bites[id] > 0 && t >= 0 && t < 1.25;
    const reach = active ? ease(t / .20) * (1 - ease((t - .58) / .30)) : 0;
    const lift = active ? ease((t - .58) / .30) * (1 - ease((t - 1.02) / .23)) : 0;
    const chew = active && t > .88 && t < 1.04 ? Math.sin((t - .88) * 65) : 0;
    r.rest.forEach((q, bone) => bone.quaternion.copy(q));
    p.q.setFromAxisAngle(p.axis.set(1, 0, 0), .025 * reach + .012 * Math.sin(now * .002 + id)); r.chest.quaternion.multiply(p.q);
    p.q.setFromAxisAngle(p.axis.set(1, 0, 0), .055 + reach * .055 - lift * .04 + chew * .008); r.head.quaternion.multiply(p.q);
    p.q.setFromAxisAngle(p.axis.set(0, 1, 0), -.035 * reach + .015 * Math.sin(now * .0007 + id * 2)); r.head.quaternion.multiply(p.q);
    scene.updateMatrixWorld(true);

        g.botReach ??= [];
        r.right.upper.getWorldPosition(p.shoulder);
        const reachOffset = new THREE.Vector3(0, -.065, .23).multiplyScalar(.98).applyQuaternion(scene.getWorldQuaternion(new THREE.Quaternion()));
        reachOffset.add(p.shoulder);
        g.botReach[id - 1] = { x: reachOffset.x, y: reachOffset.y, z: reachOffset.z, radius: r.right.a + r.right.b - .025 };
    const aim = (bone: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3) => {
      bone.getWorldQuaternion(p.world); p.axis.set(0, 1, 0).applyQuaternion(p.world);
      p.direction.subVectors(to, from).normalize(); p.q.setFromUnitVectors(p.axis, p.direction).multiply(p.world);
      bone.parent!.getWorldQuaternion(p.parent); bone.quaternion.copy(p.parent.invert().multiply(p.q)); bone.updateWorldMatrix(false, true);
    };
    const solve = (arm: Arm, goal: THREE.Vector3, side: number) => {
      arm.upper.getWorldPosition(p.shoulder); p.direction.subVectors(goal, p.shoulder);
      const { a, b } = extendArmForReach(arm.fore, arm.hand, arm.a, arm.b, p.direction.length(), side === -1 && active);
      const d = THREE.MathUtils.clamp(p.direction.length(), Math.abs(a - b) + .002, a + b - .002);
      p.direction.normalize(); p.wrist.copy(p.shoulder).addScaledVector(p.direction, d);
      p.pole.set(side, -.55, -.08).applyQuaternion(p.yaw); p.pole.addScaledVector(p.direction, -p.pole.dot(p.direction)).normalize();
      const along = (a * a - b * b + d * d) / (2 * d);
      p.elbow.copy(p.shoulder).addScaledVector(p.direction, along).addScaledVector(p.pole, Math.sqrt(Math.max(0, a * a - along * along)));
      aim(arm.upper, p.shoulder, p.elbow); arm.fore.getWorldPosition(p.elbow); aim(arm.fore, p.elbow, p.wrist);
    };
    const orient = (angle: number, roll: number, out: THREE.Quaternion) => {
      p.q.setFromAxisAngle(p.axis.set(1, 0, 0), angle);
      p.twist.setFromAxisAngle(p.axis.set(0, 1, 0), roll);
      out.copy(p.yaw).multiply(p.q).multiply(p.twist);
    };
    const rolling = active ? ease((t - .40) / .15) * (1 - ease((t - .58) / .22)) : 0;
    // The replacement hand uses +Z for the palm and +Y for the fingers.
    // Turn about the forearm to cup upward, then tilt the palm toward the mouth.
    const flip = active ? THREE.MathUtils.smootherstep(t, .48, .82) * (1 - THREE.MathUtils.smootherstep(t, .95, 1.05)) : 0;
    orient(Math.PI / 2 - flip * .60, flip * Math.PI + rolling * .08, p.handQ);
    orient(Math.PI / 2 - .60, Math.PI, p.eatQ);
    p.mouth.copy(r.mouthSocket); r.head.localToWorld(p.mouth);
    p.point.copy(p.foodOffset).multiplyScalar(.98).applyQuaternion(p.eatQ); p.mouth.sub(p.point);
    p.ready.set(-.22, 1.10, .83); scene.localToWorld(p.ready);
    p.ready.y = Math.max(p.ready.y, foodSurface(p.ready.x, p.ready.z, g.remaining).height + .10);
    p.goal.copy(p.ready);
    let curl = .13;
    if (active) {
      p.scoop.set(...g.biteTargets[id]); p.point.set(0, .055, -.24).applyQuaternion(p.yaw); p.scoop.add(p.point);
      if (t < .20) {
        p.goal.lerpVectors(p.ready, p.scoop, ease(t / .20));
        // A quick side-to-side roam while the hand is still in flight, settling out as it arrives.
        const roam = 0;
        p.point.set(roam, 0, 0).applyQuaternion(p.yaw); p.goal.add(p.point);
      }
      else if (t < .58) {
        p.goal.copy(p.scoop); p.point.set(0, .012 * rolling, -.035 * Math.sin((t - .20) / .38 * Math.PI)).applyQuaternion(p.yaw); p.goal.add(p.point);
      } else if (t < .88) { p.goal.lerpVectors(p.scoop, p.mouth, ease((t - .58) / .30)); p.goal.y += Math.sin((t - .58) / .30 * Math.PI) * .10; }
      else if (t < 1.02) p.goal.copy(p.mouth);
      else p.goal.lerpVectors(p.mouth, p.ready, ease((t - 1.02) / .23));
      curl = (.15 + .65 * ease((t - .20) / .32)) * (1 - ease((t - 1.02) / .23));
      if (t > .90 && lastBite.current !== g.bites[id]) { lastBite.current = g.bites[id]; onChew(); }
    }
    if (active) {
      p.scoop.set(...g.biteTargets[id]);
      p.mouth.copy(r.mouthSocket); r.head.localToWorld(p.mouth);
      botBiteWrist(t, p.scoop, p.mouth, p.ready, p.handQ, p.goal);
    }
    for (const finger of r.fingers) {
      const thumb = finger.name.startsWith('thumb'), distal = finger.name.endsWith('_2');
      p.q.setFromAxisAngle(p.axis.set(1, 0, 0), curl * (thumb ? .50 : distal ? .92 : .64));
      finger.quaternion.copy(r.rest.get(finger)!).multiply(p.q);
    }
    for (let pass = 0; pass < 3; pass++) {
      solve(r.right, p.goal, -1);
      r.right.hand.parent!.getWorldQuaternion(p.parent); r.right.hand.quaternion.copy(p.parent.invert().multiply(p.handQ));
      scene.updateMatrixWorld(true);
      let liftOut = 0;
      for (const original of r.skin) {
        const mesh = (scene.getObjectByName('PlayerStyleHand_R') as THREE.Mesh | undefined) ?? original;
        if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i += 32) {
          mesh.getVertexPosition(i, p.point); mesh.localToWorld(p.point);
          liftOut = Math.max(liftOut, foodObstacleHeight(p.point.x, p.point.z, g.remaining) + .008 - p.point.y);
        }
      }
      if (liftOut < .004) break;
      p.goal.y += Math.min(liftOut, .25);
    }
    p.goal.set(.58, 1.03, -.10); scene.localToWorld(p.goal); solve(r.left, p.goal, 1);
    scene.updateMatrixWorld(true);
    const opening = active ? Math.max(0, Math.min(1, lift * (t < .9 ? 1 : .45 + .30 * chew))) : 0;
    for (const mesh of r.mouths) {
      const d = mesh.morphTargetDictionary!, w = mesh.morphTargetInfluences!;
      w[d.HALF_OPEN] = opening < .5 ? opening * 2 : (1 - opening) * 2; w[d.OPEN] = Math.max(0, opening * 2 - 1);
    }
    const blinkT = (now / 1000 + id * 1.17) % 4.7, blink = blinkT < .16 ? Math.sin(blinkT / .16 * Math.PI) : 0;
    for (const eye of r.eyes) eye.morphTargetInfluences![eye.morphTargetDictionary!.BLINK] = blink;
    if (food.current) {
      food.current.visible = active && t >= .58 && t < .94;
      p.point.copy(p.foodOffset); r.right.hand.localToWorld(p.point); food.current.position.copy(p.point);
      food.current.quaternion.copy(p.handQ); food.current.scale.setScalar(.85 + .15 * ease((t - .43) / .15));
    }
  }, -.1);
  if (!scene) return <>{fallback}</>;
  return <group name={`studio-character-${id}`}><primitive object={scene}/><CharacterHands scene={scene} id={id} game={game}/><group ref={food} visible={false}>
    <mesh scale={[.085, .064, .08]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#e8bc60" roughness={.95}/></mesh>
    {Array.from({ length: 20 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * .073, Math.sin(i * 1.7) * .047, Math.cos(i * 2.4) * .07]} scale={[.015, .01, .025]}><sphereGeometry args={[1, 6, 4]}/><meshStandardMaterial color="#efd18a" roughness={.9}/></mesh>)}
  </group></group>;
}
