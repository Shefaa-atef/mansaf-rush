import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { keepHandAboveFood } from './handClearance';
import { foodObstacleHeight, foodSurface } from './MansafPlatter';
import { freshLokma, roll, beginEating } from './lokma';
import { HAND_POSES, type HandMotion, type HandPoseName } from './handPoses';
import { HandFood } from './HandFood';
import { BlenderPlayerArm } from './BlenderPlayerArm';

import type { Game } from './main';

let audio:AudioContext|undefined;
function unlock(){try{audio??=new AudioContext();void audio.resume();}catch{/* Audio is optional. */}}
function chew(){if(!audio)return;const t=audio.currentTime;for(let i=0;i<3;i++){const o=audio.createOscillator(),v=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(180-i*25,t+i*.07);o.frequency.exponentialRampToValueAtTime(65,t+i*.07+.07);v.gain.setValueAtTime(.055,t+i*.07);v.gain.exponentialRampToValueAtTime(.001,t+i*.07+.08);o.connect(v);v.connect(audio.destination);o.start(t+i*.07);o.stop(t+i*.07+.09);}}
const smooth=(t:number)=>THREE.MathUtils.smoothstep(t,0,1);
export function PlayerHand({game,onEat}:{game:RefObject<Game>;onEat:(now:number)=>void}) {
 const {camera,gl}=useThree();
 const hand=useRef<THREE.Group>(null),spills=useRef<THREE.Group>(null),intake=useRef<THREE.Group>(null);

 const motion=useRef<HandMotion>({pose:'OPEN',pulse:0});

 const p=useMemo(()=>({mouse:new THREE.Vector2(),ray:new THREE.Raycaster(),plane:new THREE.Plane(new THREE.Vector3(0,1,0),-.65),target:new THREE.Vector3(.65,1.20,1.30),hand:new THREE.Vector3(.65,1.20,1.30),previous:new THREE.Vector3(),from:new THREE.Vector3(),mouth:new THREE.Vector3(),shoulder:new THREE.Vector3(1.65,.25,2.95),elbow:new THREE.Vector3(),wrist:new THREE.Vector3(),delta:new THREE.Vector3(),hit:new THREE.Vector3(),spillOrigin:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),rotation:new THREE.Euler(),quaternion:new THREE.Quaternion(),inside:false,onTray:false,spillAt:0,session:-1}),[]);
 useEffect(()=>{
 const move=(e:PointerEvent)=>{const r=gl.domElement.getBoundingClientRect();p.mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);p.inside=true;};
 const down=(e:PointerEvent)=>{if(e.button!==0||game.current.phase!=='playing')return;move(e);unlock();const l=game.current.lokma;if(!l.eating&&!l.space&&l.rolls===0){l.gathering=true;gl.domElement.setPointerCapture(e.pointerId);}};
 const up=()=>{game.current.lokma.gathering=false;};
 const key=(e:KeyboardEvent)=>{
 const g=game.current,l=g.lokma;
 if(g.phase!=='playing'||!['Space','ArrowLeft','ArrowRight','ArrowUp'].includes(e.code)||e.ctrlKey||e.metaKey||e.altKey)return;
 e.preventDefault();if(e.repeat||l.eating)return;unlock();
 if(e.code==='Space'){if(l.gathering){g.feedback='Release the mouse to turn your palm up';g.feedbackAt=performance.now();return;}l.space=true;}
 else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){if(!roll(l,e.code)){g.feedback='Hold SPACE and alternate ← →';g.feedbackAt=performance.now();}}
 else if(beginEating(l,performance.now())){p.from.copy(p.hand);if(l.failed){g.feedback='Too loose! Back onto the sedr';g.feedbackAt=performance.now();}}
 };
 const release=(e:KeyboardEvent)=>{if(e.code==='Space')game.current.lokma.space=false;};
 const blur=()=>{up();game.current.lokma.space=false;p.inside=false;};
 gl.domElement.addEventListener('pointermove',move);gl.domElement.addEventListener('pointerdown',down);gl.domElement.addEventListener('pointercancel',blur);window.addEventListener('pointerup',up);window.addEventListener('keydown',key);window.addEventListener('keyup',release);window.addEventListener('blur',blur);
 return()=>{gl.domElement.removeEventListener('pointermove',move);gl.domElement.removeEventListener('pointerdown',down);gl.domElement.removeEventListener('pointercancel',blur);window.removeEventListener('pointerup',up);window.removeEventListener('keydown',key);window.removeEventListener('keyup',release);window.removeEventListener('blur',blur);};
 },[gl,game,p]);

 useFrame((_,delta)=>{
 const g=game.current,l=g.lokma,now=performance.now(),dt=Math.min(delta,.05),blend=1-Math.exp(-14*dt);
 if(p.session!==g.started){p.session=g.started;p.hand.set(.65,1.20,1.30);p.target.copy(p.hand);p.inside=false;motion.current.pose='OPEN';if(hand.current)hand.current.rotation.set(0,0,2.85);}
 if(g.phase==='ended'){if(spills.current)spills.current.visible=false;if(intake.current)intake.current.visible=false;return;}
 p.previous.copy(p.hand);
 if(p.inside){p.plane.constant=-.6;p.ray.setFromCamera(p.mouse,camera);if(p.ray.ray.intersectPlane(p.plane,p.hit)){
 for(let i=0;i<3;i++){p.plane.constant=-foodSurface(p.hit.x,p.hit.z,g.remaining).height;p.ray.ray.intersectPlane(p.plane,p.hit);}
 const radius=Math.hypot(p.hit.x,p.hit.z),k=Math.min(1,2.08/Math.max(radius,.001));p.onTray=radius<2.12;l.x=p.hit.x*k;l.z=p.hit.z*k;
 const surface=foodSurface(l.x,l.z,g.remaining);p.target.set(l.x,surface.height+(l.amount&&!l.gathering?.38:l.gathering?.145:.25),l.z);
 }}
 let eatT=l.eating?(now-l.eating)/1000:0;
 if(l.eating){
 // Mouth sits just below camera center; the forearm carries the bite there.
 p.mouth.set(.13,-.34,-1.4).applyQuaternion(camera.quaternion).add(camera.position);
 if(l.failed)p.mouth.lerpVectors(p.from,p.mouth,.30);
 if(eatT<.58)p.hand.lerpVectors(p.from,p.mouth,smooth(eatT/.58));
 else if(eatT<.72)p.hand.copy(p.mouth);
 else p.hand.lerpVectors(p.mouth,p.target,smooth((eatT-.72)/.48));
 if(l.failed&&eatT>.20&&!l.swallowed){l.swallowed=true;l.spill=now;}
 if(!l.failed&&eatT>=.62&&!l.swallowed){l.swallowed=true;onEat(now);chew();}
 if(eatT>1.2){g.lokma={...freshLokma(),x:l.x,z:l.z};}
 }else p.hand.lerp(p.target,blend);
 const moved=Math.hypot(p.hand.x-p.previous.x,p.hand.z-p.previous.z),surface=foodSurface(p.hand.x,p.hand.z,g.remaining);
 if(g.phase==='playing'&&l.gathering&&!l.eating&&p.onTray&&surface.available&&moved>.0005){
 if(!l.since)l.since=now;
 const gathered=Math.min(Math.max(0,g.remaining-l.amount),Math.min(moved*3.0,dt*4));l.amount+=gathered;if(surface.bread)l.bread+=gathered;l.meat ||= l.amount>2&&surface.meat;
 if(l.amount>7){l.bread*=6.25/l.amount;l.amount=6.25;l.spill=now;g.feedback='Too much! Food is slipping';g.feedbackAt=now;}
 }
 const pulse=l.space?Math.max(0,1-(now-l.rollAt)/220):0;
 let name:HandPoseName=l.eating?(l.swallowed?'EAT':'HOLD_LOKMA'):l.gathering?'GATHER':!l.amount?'OPEN':l.space&&pulse>0?(l.last==='ArrowLeft'?'ROLL_LEFT':'ROLL_RIGHT'):l.rolls>=4?'HOLD_LOKMA':'CUP';
 motion.current={pose:name,pulse};
 const pose=HAND_POSES[name];
 if(hand.current){
 hand.current.position.copy(p.hand);
 const lift=l.eating?smooth(eatT/.58)*(1-smooth((eatT-.72)/.48)):0;
 const relaxed=name==='OPEN';
 p.rotation.set((relaxed?0:.08)+lift*.42,0,(name==='OPEN'?2.85:name==='GATHER'?2.90:pose.flip)+lift*.12);
 p.quaternion.setFromEuler(p.rotation);hand.current.quaternion.slerp(p.quaternion,blend);
 keepHandAboveFood(hand.current,(x,z)=>foodObstacleHeight(x,z,g.remaining));
 p.hand.copy(hand.current.position);
 hand.current.userData.pose=name;
 }
 if(l.spill>p.spillAt){p.spillAt=l.spill;p.spillOrigin.copy(p.hand);}
 if(spills.current){const t=(now-p.spillAt)/700;spills.current.visible=p.spillAt>0&&t>=0&&t<1;spills.current.position.copy(p.spillOrigin);spills.current.children.forEach((c,i)=>{const a=i*2.4,x=p.spillOrigin.x+Math.sin(a)*t*.44,z=p.spillOrigin.z+Math.cos(a)*t*.3,ground=foodSurface(x,z,g.remaining).height;c.position.set(x-p.spillOrigin.x,Math.max(ground-p.spillOrigin.y+.015,.09-t*t*.85),z-p.spillOrigin.z);});}
 if(intake.current){intake.current.visible=l.gathering&&moved>.001&&surface.available&&p.onTray;intake.current.position.copy(p.hand);intake.current.children.forEach((c,i)=>{const t=((now/220+i/10)%1);c.position.set(Math.sin(i*2.4)*.23*(1-t),-.1+t*.18,Math.cos(i*2.4)*.24*(1-t));});}
 if(hand.current){p.wrist.set(0,0,.38).multiplyScalar(1.65).applyQuaternion(hand.current.quaternion).add(p.hand);}
 p.elbow.lerpVectors(p.shoulder,p.wrist,.46);p.elbow.x+=.38;p.elbow.y-=.20;


 }, -.5);
 return <group name="mouse-controlled-hand">
 <BlenderPlayerArm motion={motion} hand={hand} shoulder={p.shoulder} elbow={p.elbow} game={game}/><group ref={hand} scale={1.65}>

   <HandFood game={game}/>

 </group>
 <group ref={spills}>{Array.from({length:24},(_,i)=><mesh key={i} scale={[.018,.014,.031]}><sphereGeometry args={[1,5,3]}/><meshStandardMaterial color="#eac45e"/></mesh>)}</group>
 <group ref={intake}>{Array.from({length:10},(_,i)=><mesh key={i} scale={[.018,.014,.031]}><sphereGeometry args={[1,5,3]}/><meshStandardMaterial color="#edc557"/></mesh>)}</group>
 </group>;
}
