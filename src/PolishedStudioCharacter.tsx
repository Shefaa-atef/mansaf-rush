import { limitWristBend } from './characterWrist';
import { refineCharacterFace } from './characterFaces';
import { refineCharacterBody } from './characterBody';
import { refineCharacterNose } from './characterNoses';
import { refineCharacterEye } from './characterEyes';
import { extendArmForReach } from './characterArmProportions';
import { botBiteWrist, BOT_SCOOP_SINK } from './botBiteMotion';
import { CharacterHands } from './CharacterHands';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createGLTFLoader } from './gltf';
import { botSeats } from './platterFood';
import { foodObstacleHeight, foodSurface, foodTopBound } from './MansafPlatter';
import { contactLift } from './handContact';
import type { Game } from './main';
import { ChibiFeet } from './ChibiFeet';
const refinedLook = new URLSearchParams(window.location.search).get('look') !== 'before';

const urls = [
  new URL('./assets/web/zaid-chibi-polished.glb', import.meta.url).href,
  new URL('./assets/web/omar-chibi-polished.glb', import.meta.url).href,
  new URL('./assets/web/sami-chibi-polished.glb', import.meta.url).href,
];
const ease = (t: number) => THREE.MathUtils.smootherstep(t, 0, 1);
type Arm = { upper: THREE.Bone; fore: THREE.Bone; hand: THREE.Bone; bind: THREE.Quaternion; a: number; b: number };
type FacePart = { mesh: THREE.Mesh; position: THREE.Vector3; scale: THREE.Vector3; side: number };
type Rig = { scene: THREE.Group; right: Arm; left: Arm; head: THREE.Bone; chest: THREE.Bone;
  rest: Map<THREE.Bone, THREE.Quaternion>; fingers: THREE.Bone[]; mouths: THREE.Mesh[];
  eyes: THREE.Mesh[]; skin: THREE.SkinnedMesh[]; mouthSocket: THREE.Vector3; eyeParts: FacePart[]; brows: FacePart[]; face?: FacePart };

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

export function PolishedStudioCharacter({ id, game, fallback, onChew, onUnlock }: {
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
    createGLTFLoader().load(urls[id - 1], gltf => {
      if (cancelled) { dispose(gltf.scene); return; }
      loaded = gltf.scene;
      const seat = botSeats[id - 1], yaw = id === 1 ? .85 : id === 3 ? -.85 : 0;
      loaded.position.set(seat[0], refinedLook ? -.28 : -.40, seat[1]);
      loaded.rotation.set(.16, yaw, 0, 'YXZ'); loaded.scale.setScalar(.98);
      loaded.userData.fullerChibi = refinedLook;
      if (refinedLook) loaded.rotation.z = [0,.012,-.010,.016][id];
      loaded.updateMatrixWorld(true);
      const bone = (name: string) => { const b = loaded!.getObjectByName(name); if (!(b instanceof THREE.Bone)) throw new Error(`Missing ${name}`); return b; };
      try {
        const rest = new Map<THREE.Bone, THREE.Quaternion>(), fingers: THREE.Bone[] = [], mouths: THREE.Mesh[] = [], eyes: THREE.Mesh[] = [], skin: THREE.SkinnedMesh[] = [], eyeParts: FacePart[] = [], brows: FacePart[] = [];
        let face: FacePart|undefined;
        loaded.traverse(n => {
          if (n instanceof THREE.Bone) { rest.set(n, n.quaternion.clone()); if (/^(finger_R|thumb_R)/.test(n.name)) fingers.push(n); }
          if (n instanceof THREE.Mesh) {
            n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false;
            if (n.morphTargetDictionary?.OPEN !== undefined) mouths.push(n);
            if (n.morphTargetDictionary?.BLINK !== undefined) eyes.push(n);
            if (n instanceof THREE.SkinnedMesh && n.name === 'Hand_R') skin.push(n);
            refineCharacterFace(n,id);
            if (refinedLook) refineCharacterBody(n);
            const part={mesh:n,position:n.position.clone(),scale:n.scale.clone(),side:0};n.geometry.computeBoundingBox();part.side=Math.sign(((n.geometry.boundingBox?.min.x??0)+(n.geometry.boundingBox?.max.x??0))*.5);
            if(/^Eye(?:\.?\d+)?$/.test(n.name)){eyeParts.push(part);refineCharacterEye(n);}if(/Small.?rounded.?nose/i.test(n.name))refineCharacterNose(n,id);if(/^Eyebrow(?:\.\d+)?$/.test(n.name))brows.push(part);if(n.name==='Rounded head')face=part;
            if (refinedLook && /Keffiyeh/i.test(n.name) && n.material instanceof THREE.MeshStandardMaterial) {
              const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#858585';ctx.fillRect(0,0,64,64);for(let x=0;x<64;x++){const v=Math.round(128+14*Math.cos(x/64*Math.PI*6));ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,0,1,64)}
              for(let y=0;y<64;y+=3){ctx.fillStyle=y%6?'#929292':'#767676';ctx.fillRect(0,y,64,1)}
              const bump=new THREE.CanvasTexture(canvas);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(12,12);n.material=n.material.clone();n.material.roughness=.92;n.material.bumpMap=bump;n.material.bumpScale=.018;
            }
            if (refinedLook && /Eyebrow/i.test(n.name)) n.rotation.z+=(n.name.includes('L')?1:-1)*[0,.035,-.02,.05][id];
            if (refinedLook && n.morphTargetDictionary?.OPEN !== undefined) n.scale.x*=[1,1.04,.94,1.08][id];
            if (refinedLook && /^Shoe/i.test(n.name)) { n.geometry.computeBoundingBox(); const cx=(n.geometry.boundingBox!.min.x+n.geometry.boundingBox!.max.x)*.5; n.position.x+=Math.sign(cx||1)*.16;n.position.z+=.10;n.scale.multiplyScalar(1.07); }
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
        rig.current = { scene: loaded, right: arm('R'), left: arm('L'), head, chest, rest, fingers, mouths, eyes, skin, mouthSocket, eyeParts, brows, face };
        p.yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        setScene(loaded);
      } catch (error) { console.error(`Character ${id} could not be rigged`, error); dispose(loaded); loaded = undefined; }
    }, undefined, error => console.error(`Character ${id} failed to load`, error));
    return () => { cancelled = true; rig.current = null; window.removeEventListener('pointerdown', onUnlock); if (loaded) dispose(loaded); };
  }, [id, onUnlock, p]);

  useFrame(() => {
    const r = rig.current;
    if (!r || !scene || r.scene !== scene) return;
    const g = game.current, now = performance.now(), t = (now - g.bites[id]) / (refinedLook ? 2450 : 1500);
    const active = g.phase === 'playing' && g.bites[id] > 0 && t >= 0 && t < 1.25;
    const reach = active ? ease(t / .20) * (1 - ease((t - .58) / .30)) : 0;
    const lift = active ? ease((t - .58) / .30) * (1 - ease((t - 1.02) / .23)) : 0;
    const chew = active && t > .88 && t < 1.04 ? Math.sin((t - .88) * 65) : 0;
    r.rest.forEach((q, bone) => bone.quaternion.copy(q));
    const drive=refinedLook?[0,.17,.14,.24][id]:.04,focus=active?ease(t/.16)*(1-ease((t-1.02)/.20)):0;
    p.q.setFromAxisAngle(p.axis.set(1, 0, 0), drive * reach + .009 * Math.sin(now * (.0015 + id * .0001) + id)); r.chest.quaternion.multiply(p.q);
    p.q.setFromAxisAngle(p.axis.set(1, 0, 0), .055 + reach * (refinedLook ? .14 : .055) - lift * .07 + chew * .018); r.head.quaternion.multiply(p.q);
    p.q.setFromAxisAngle(p.axis.set(0, 1, 0), -(refinedLook ? .085 : .035) * reach + .018 * Math.sin(now * .0007 + id * 2)); r.head.quaternion.multiply(p.q);
    if (refinedLook) { p.q.setFromAxisAngle(p.axis.set(0,0,1),[0,.018,-.024,.030][id]); r.head.quaternion.multiply(p.q); }
    const gaze=refinedLook?(active?THREE.MathUtils.clamp((g.biteTargets[id][0]-botSeats[id-1][0])*.030,-.045,.045):Math.sin(now*.0011+id)*.008):0;
    for(const part of r.eyeParts){part.mesh.position.copy(part.position);if(refinedLook){part.mesh.position.x+=gaze;part.mesh.position.y-=focus*.006;}}
    for(const part of r.brows){part.mesh.position.copy(part.position);part.mesh.scale.copy(part.scale);if(refinedLook){part.mesh.position.x-=part.side*focus*(id===3 ? .055 : .038);part.mesh.position.y-=focus*(id===3 ? .052 : .038);part.mesh.scale.multiplyScalar(1+focus*.10);}}
    if(r.face){r.face.mesh.scale.copy(r.face.scale);if(refinedLook){const puff=Math.max(0,chew)*.035+focus*.012;r.face.mesh.scale.x*=1+puff;r.face.mesh.scale.y*=1-puff*.45;}}
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
    const flip = active ? THREE.MathUtils.smootherstep(t, refinedLook ? .42 : .48, refinedLook ? .55 : .82) * (1 - THREE.MathUtils.smootherstep(t, .95, 1.05)) : 0;
    orient(Math.PI / 2 - flip * .35, flip * Math.PI + rolling * .05, p.handQ);
    orient(Math.PI / 2 - .35, Math.PI, p.eatQ);
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
      botBiteWrist(t, p.scoop, p.mouth, p.ready, p.handQ, p.goal, BOT_SCOOP_SINK);
    }
    for (const finger of r.fingers) {
      const thumb = finger.name.startsWith('thumb'), distal = finger.name.endsWith('_2');
      p.q.setFromAxisAngle(p.axis.set(1, 0, 0), curl * (thumb ? .50 : distal ? .92 : .64));
      finger.quaternion.copy(r.rest.get(finger)!).multiply(p.q);
    }
    const desiredHandQ = p.handQ.clone();
    const foodAt = (x: number, z: number) => foodObstacleHeight(x, z, g.remaining);
    const skinMeshes = r.skin.map(original => (scene.getObjectByName('PlayerStyleHand_R') as THREE.Mesh | undefined) ?? original);
    for (let pass = 0; pass < 8; pass++) {
      solve(r.right, p.goal, -1);
      p.handQ.copy(desiredHandQ);
      limitWristBend(p.handQ, p.elbow, p.wrist);
      if (active && pass < 7) {
        botBiteWrist(t, p.scoop, p.mouth, p.ready, p.handQ, p.goal, BOT_SCOOP_SINK);
      }
      r.right.hand.parent!.getWorldQuaternion(p.parent); r.right.hand.quaternion.copy(p.parent.invert().multiply(p.handQ));
      // solve() refreshed the arm above the hand; only the hand itself moved since then.
      r.right.hand.updateWorldMatrix(false, true);
      let liftOut = 0;
      for (const mesh of skinMeshes) liftOut = Math.max(liftOut, contactLift(mesh, 32, .008, foodAt, foodTopBound));
      if (liftOut < .004 && (!active || pass >= 7)) break;
      p.goal.y += Math.min(liftOut, .25);
    }
    // Same fix as PolishedBlenderCharacter.tsx's leftHand target: checked
    // against the real rig and the individual-player-cushion boxes in
    // Majlis.tsx, this lands the resting hand at the cushion's own height and
    // footprint (~96% arm extension) instead of pinned up near the torso.
    // Checked against the real rig and the individual-player-cushion boxes
    // in Majlis.tsx: lands the resting hand at the cushion's own height and
    // footprint (~96% of arm extension) instead of pinned up near the torso
    // (an earlier attempt raised Y alone, which actually shortens the reach
    // and tightens the fold - the opposite of what was needed).
    // Pull Zaid's resting hand back toward his side, away from the platter.
    p.goal.set(refinedLook && id === 1 ? .43 : .55, refinedLook ? .45 : .43, refinedLook && id === 1 ? .01 : refinedLook ? .15 : .04); scene.localToWorld(p.goal); solve(r.left, p.goal, refinedLook ? .46 : .35);
    if (refinedLook) { p.q.setFromAxisAngle(p.axis.set(0,1,0),-Math.PI/2); r.left.hand.quaternion.copy(r.rest.get(r.left.hand)!).multiply(p.q); }
    scene.updateMatrixWorld(true);
    const opening = active ? Math.max(refinedLook&&t<.58 ? .22*focus : 0, Math.min(1, lift * (t < .9 ? 1.32 : .58 + .46 * chew))) : 0;
    for (const mesh of r.mouths) {
      const d = mesh.morphTargetDictionary!, w = mesh.morphTargetInfluences!;
      w[d.HALF_OPEN] = opening < .5 ? opening * 2 : (1 - opening) * 2; w[d.OPEN] = Math.max(0, opening * 2 - 1);
    }
    const blinkT = (now / 1000 + id * 1.17) % (4.2 + id * .37), blink = blinkT < .16 ? Math.sin(blinkT / .16 * Math.PI) : 0;
    for (const eye of r.eyes) eye.morphTargetInfluences![eye.morphTargetDictionary!.BLINK] = Math.max(blink,refinedLook ? focus*(id===3 ? .34 : .20) : 0);
    if (food.current) {
      food.current.visible = active && t >= .58 && t < .94;
      p.point.copy(p.foodOffset); r.right.hand.localToWorld(p.point); food.current.position.copy(p.point);
      food.current.quaternion.copy(p.handQ); food.current.scale.setScalar(.85 + .15 * ease((t - .43) / .15));
    }
  }, -.1);
  if (!scene) return <>{fallback}</>;
  return <group name={`studio-character-${id}`}><primitive object={scene}/>{refinedLook&&<ChibiFeet id={id}/>}<CharacterHands scene={scene} id={id} game={game}/><group ref={food} visible={false}>
    <mesh scale={[.085, .064, .08]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#e8bc60" roughness={.95}/></mesh>
    {Array.from({ length: 20 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * .073, Math.sin(i * 1.7) * .047, Math.cos(i * 2.4) * .07]} scale={[.015, .01, .025]}><sphereGeometry args={[1, 6, 4]}/><meshStandardMaterial color="#efd18a" roughness={.9}/></mesh>)}
  </group></group>;
}

