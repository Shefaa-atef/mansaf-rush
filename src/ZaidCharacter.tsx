import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { foodSurface } from './MansafPlatter';
import type { Game } from './main';

type Rig = { upper: THREE.Bone; fore: THREE.Bone; hand: THREE.Bone; fingers: THREE.Bone[]; rest: Map<THREE.Bone, THREE.Quaternion>; mouths: THREE.Mesh[]; a: number; b: number; handBind: THREE.Quaternion };
export function ZaidCharacter({game,fallback,onChew,onUnlock}:{game:RefObject<Game>;fallback:ReactNode;onChew:()=>void;onUnlock:()=>void}) {
 const [asset,setAsset]=useState<THREE.Group|null>(null);const rig=useRef<Rig|null>(null),food=useRef<THREE.Group>(null),lastSound=useRef(0);
 const p=useMemo(()=>({idle:new THREE.Vector3(-.38,1.20,.63),mouth:new THREE.Vector3(0,1.75,.49),target:new THREE.Vector3(),goal:new THREE.Vector3(),shoulder:new THREE.Vector3(),elbow:new THREE.Vector3(),wrist:new THREE.Vector3(),direction:new THREE.Vector3(),pole:new THREE.Vector3(),axis:new THREE.Vector3(),q:new THREE.Quaternion(),worldQ:new THREE.Quaternion(),parentQ:new THREE.Quaternion(),curlQ:new THREE.Quaternion()}),[]);
 useEffect(()=>{
  let cancelled=false,loaded:THREE.Group|undefined;
  const dispose=(scene:THREE.Object3D)=>{const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(n=>{if(n instanceof THREE.Mesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){materials.add(m);if(m instanceof THREE.MeshStandardMaterial&&m.map)textures.add(m.map);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
  window.addEventListener('pointerdown',onUnlock);
  new GLTFLoader().load(new URL('./assets/zaid-rigged.glb',import.meta.url).href,gltf=>{
   if(cancelled){dispose(gltf.scene);return;}
   loaded=gltf.scene;loaded.position.set(-2.43,-.5,-1);loaded.rotation.set(.40,.85,0,'YXZ');loaded.scale.setScalar(1.04);
   const upper=loaded.getObjectByName('upper_arm_R'),fore=loaded.getObjectByName('forearm_R'),hand=loaded.getObjectByName('hand_R');
   if(!(upper instanceof THREE.Bone)||!(fore instanceof THREE.Bone)||!(hand instanceof THREE.Bone)){console.error('Zaid rig controls missing; using fallback');dispose(loaded);loaded=undefined;return;}
   const rest=new Map<THREE.Bone,THREE.Quaternion>(),fingers:THREE.Bone[]=[],mouths:THREE.Mesh[]=[];
   loaded.traverse(n=>{if(n instanceof THREE.Bone){rest.set(n,n.quaternion.clone());if(n.name.startsWith('finger_R')||n.name.startsWith('thumb_R'))fingers.push(n);}if(n instanceof THREE.Mesh){n.castShadow=true;n.frustumCulled=false;if(n.morphTargetDictionary?.OPEN!==undefined)mouths.push(n);}});
   loaded.updateMatrixWorld(true);upper.getWorldPosition(p.shoulder);fore.getWorldPosition(p.elbow);hand.getWorldPosition(p.wrist);
   const handBind=loaded.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
   rig.current={upper,fore,hand,fingers,rest,mouths,handBind,a:p.shoulder.distanceTo(p.elbow),b:p.elbow.distanceTo(p.wrist)};setAsset(loaded);
  },undefined,e=>console.error('Zaid GLB failed to load; using fallback.',e));
  return()=>{cancelled=true;window.removeEventListener('pointerdown',onUnlock);rig.current=null;if(loaded)dispose(loaded);};
 },[onUnlock,p]);
 useFrame(()=>{
  const r=rig.current;if(!asset||!r)return;const g=game.current,t=(performance.now()-g.bites[1])/1000,active=g.phase==='playing'&&g.bites[1]>0&&t>=0&&t<1.2;
  r.rest.forEach((q,b)=>b.quaternion.copy(q));asset.updateMatrixWorld(true);
  p.idle.set(-1.84,foodSurface(-1.84,-.74,g.remaining).height+.17,-.74);asset.worldToLocal(p.idle);p.goal.copy(p.idle);let curl=.12,opening=0;
  if(active){
   p.target.set(...g.biteTargets[1]);asset.worldToLocal(p.target);p.target.y+=.04;p.target.z-=.12;
   if(t<.18)p.goal.lerpVectors(p.idle,p.target,THREE.MathUtils.smoothstep(t/.18,0,1));
   else if(t<.62){p.goal.copy(p.target);curl=t<.38?.55:.9;}
   else if(t<.94){const f=THREE.MathUtils.smoothstep((t-.62)/.32,0,1);p.goal.lerpVectors(p.target,p.mouth,f);curl=.7;opening=f;}
   else {const f=THREE.MathUtils.smoothstep((t-.94)/.26,0,1);p.goal.lerpVectors(p.mouth,p.idle,f);curl=.7*(1-f);opening=(1-f)*(.35+.25*Math.sin(t*65));}
   if(t>=.94&&lastSound.current!==g.bites[1]){lastSound.current=g.bites[1];onChew();}
  }
  asset.localToWorld(p.goal);r.upper.getWorldPosition(p.shoulder);
  p.direction.subVectors(p.goal,p.shoulder);const distance=THREE.MathUtils.clamp(p.direction.length(),Math.abs(r.a-r.b)+.001,r.a+r.b-.001);p.direction.normalize();p.wrist.copy(p.shoulder).addScaledVector(p.direction,distance);
  // Two-bone IK keeps the elbow connected and limits reach to the arm's length.
  p.pole.set(-1,-.25,.6).transformDirection(asset.matrixWorld);p.pole.addScaledVector(p.direction,-p.pole.dot(p.direction)).normalize();
  const along=(r.a*r.a-r.b*r.b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,r.a*r.a-along*along));p.elbow.copy(p.shoulder).addScaledVector(p.direction,along).addScaledVector(p.pole,height);
  const aim=(bone:THREE.Bone,from:THREE.Vector3,to:THREE.Vector3)=>{bone.getWorldQuaternion(p.worldQ);p.axis.set(0,1,0).applyQuaternion(p.worldQ);p.direction.subVectors(to,from).normalize();p.q.setFromUnitVectors(p.axis,p.direction).multiply(p.worldQ);bone.parent!.getWorldQuaternion(p.parentQ);bone.quaternion.copy(p.parentQ.invert().multiply(p.q));bone.updateWorldMatrix(false,true);};
  aim(r.upper,p.shoulder,p.elbow);r.fore.getWorldPosition(p.elbow);aim(r.fore,p.elbow,p.wrist);
  // Orient the palm independently of the elbow: down to scoop, then cup toward the mouth.
  const lift=active&&t>.62?THREE.MathUtils.smoothstep((t-.62)/.32,0,1)*(1-THREE.MathUtils.smoothstep((t-.94)/.26,0,1)):0;
  asset.getWorldQuaternion(p.worldQ);p.curlQ.setFromAxisAngle(p.axis.set(1,0,0),-Math.PI/2+lift*.95);
  p.q.copy(p.worldQ).multiply(p.curlQ).multiply(r.handBind);r.hand.parent!.getWorldQuaternion(p.parentQ);r.hand.quaternion.copy(p.parentQ.invert().multiply(p.q));
  for(const finger of r.fingers){p.curlQ.setFromAxisAngle(p.axis.set(1,0,0),curl);finger.quaternion.copy(r.rest.get(finger)!).multiply(p.curlQ);}
  for(const mesh of r.mouths){const dict=mesh.morphTargetDictionary!,weights=mesh.morphTargetInfluences!;weights[dict.HALF_OPEN]=opening<=.5?opening*2:2*(1-opening);weights[dict.OPEN]=Math.max(0,opening*2-1);}
  asset.updateMatrixWorld(true);
  if(food.current){food.current.visible=active&&t>.28&&t<.94;p.goal.set(0,.12,.06);r.hand.localToWorld(p.goal);food.current.position.copy(p.goal);}
 });
 if(!asset)return <>{fallback}</>;
 return <group name="character-1-blender"><primitive object={asset}/><group ref={food} visible={false}><mesh scale={[.085,.065,.085]}><icosahedronGeometry args={[1,2]}/><meshStandardMaterial color="#eac45e" roughness={.9}/></mesh>{Array.from({length:20},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*.075,Math.sin(i*1.7)*.05,Math.cos(i*2.4)*.075]} scale={[.016,.012,.023]}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color="#edcb66"/></mesh>)}</group></group>;
}

