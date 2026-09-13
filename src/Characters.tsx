import { BlenderCharacter } from './BlenderCharacter';
import { StudioCharacter } from './StudioCharacter';
import { memo, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { keepHandAboveFood } from './handClearance';
import { createArmGeometry, updateArmGeometry } from './armGeometry';
import { foodObstacleHeight } from './MansafPlatter';
import { botSeats } from './platterFood';
import { keffiyeh } from './materials';
import type { Game } from './main';
import { PlayerHandModel } from './PlayerHandModel';
import { HAND_POSES, type HandMotion, type HandPoseName } from './handPoses';
import { isMuted } from './sfx';

type V3 = [number, number, number];
const rounded = new RoundedBoxGeometry(1, 1, 1, 4, .30);
const sphere = new THREE.SphereGeometry(1, 24, 16);
let botAudio:AudioContext|undefined;
function enableBotSound(){try{botAudio??=new AudioContext();void botAudio.resume();}catch{/* Sound is optional. */}}
function botChew(){if(!botAudio||botAudio.state!=='running'||isMuted())return;const t=botAudio.currentTime,o=botAudio.createOscillator(),gain=botAudio.createGain();o.type='triangle';o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(60,t+.10);gain.gain.setValueAtTime(.018,t);gain.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(gain);gain.connect(botAudio.destination);o.start(t);o.stop(t+.13);}

function Round({ position = [0, 0, 0], size, color, map, box = false, rotation = [0, 0, 0] }: {
  position?: V3; size: V3; color: string; map?: THREE.Texture; box?: boolean; rotation?: V3;
}) {
  return <mesh geometry={box ? rounded : sphere} position={position} scale={size} rotation={rotation} castShadow><meshStandardMaterial color={color} map={map} roughness={.86} /></mesh>;
}
export const EatingArm = memo(function EatingArm({ id, game, origin, rest, reach, mouth, sleeve, skin = '#d9a47b', player = false, still = false, leftHand = false }: {
  id: number; game: RefObject<Game>; origin: V3; rest: V3; reach: V3; mouth: V3; sleeve: string; skin?: string; player?: boolean; still?: boolean; leftHand?: boolean;
}) {
  const arm = useRef<THREE.Group>(null);
  const handGroup = useRef<THREE.Group>(null), food = useRef<THREE.Group>(null);
  const motion = useRef<HandMotion>({pose:'OPEN',pulse:0});
  const sounded=useRef(0);
  useEffect(()=>{window.addEventListener('pointerdown',enableBotSound);return()=>window.removeEventListener('pointerdown',enableBotSound);},[]);
  const armGeometry = useMemo(createArmGeometry, []);
  useEffect(() => () => armGeometry.dispose(), [armGeometry]);
  const points = useMemo(() => ({ shoulder: new THREE.Vector3(...origin), idle: new THREE.Vector3(...rest), target: new THREE.Vector3(...reach), face: new THREE.Vector3(...mouth), hand: new THREE.Vector3(...rest), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), offset: new THREE.Vector3(), direction: new THREE.Vector3(), rotation:new THREE.Euler(), quaternion:new THREE.Quaternion(), world:new THREE.Vector3() }), [origin, rest, reach, mouth]);
  useFrame((_,dt) => {
    const g = game.current, t = (performance.now() - g.bites[id]) / 1000;
    const active = !still && g.phase === 'playing' && g.bites[id] > 0 && t < 1.2;
    if (active && arm.current) {
      points.target.set(...g.biteTargets[id]);
      arm.current.worldToLocal(points.target);
    }
    if(active&&t>=.94&&sounded.current!==g.bites[id]){sounded.current=g.bites[id];botChew();}
    let name:HandPoseName='OPEN',tilt=0;
    points.hand.copy(points.idle);
    if (active) {
      if(t<.18){points.hand.lerpVectors(points.idle,points.target,THREE.MathUtils.smoothstep(t/.18,0,1));name='GATHER';}
      else if(t<.38){points.hand.copy(points.target);name=t<.27?'GATHER':'CUP';}
      else if(t<.62){points.hand.copy(points.target);name=t<.44||t>.56?'ROLL_LEFT':'ROLL_RIGHT';}
      else if(t<.94){const f=THREE.MathUtils.smoothstep((t-.62)/.32,0,1);points.hand.lerpVectors(points.target,points.face,f);name='HOLD_LOKMA';tilt=f*.32;}
      else{const f=THREE.MathUtils.smoothstep((t-.94)/.26,0,1);points.hand.lerpVectors(points.face,points.idle,f);name='EAT';tilt=.32*(1-f);}
    }
    motion.current={pose:name,pulse:name==='ROLL_LEFT'||name==='ROLL_RIGHT'?.8:0};
    if (!handGroup.current) return;
    handGroup.current.position.copy(points.hand);
    const yaw=player?0:Math.PI + THREE.MathUtils.clamp(Math.atan2(points.hand.x-points.shoulder.x,Math.max(.35,points.hand.z-points.shoulder.z)),-.45,.45);
    points.rotation.set(tilt,yaw,HAND_POSES[name].flip*(leftHand?-1:1),'YXZ');points.quaternion.setFromEuler(points.rotation);handGroup.current.quaternion.slerp(points.quaternion,1-Math.exp(-20*Math.min(dt,.05)));
    keepHandAboveFood(handGroup.current,(x,z)=>foodObstacleHeight(x,z,g.remaining));
    points.hand.copy(handGroup.current.position);
    if(food.current){food.current.visible=active&&t>.28&&t<.94;const form=THREE.MathUtils.smoothstep((t-.38)/.24,0,1);food.current.scale.set(1-form*.12,.45+form*.55,1-form*.12);}
    points.offset.set(0,0,.29*.92).applyQuaternion(handGroup.current.quaternion);points.wrist.copy(points.hand).add(points.offset);
    points.elbow.lerpVectors(points.shoulder,points.wrist,.48);points.elbow.y-=.10;points.elbow.x+=leftHand?.08:-.08;
    points.direction.set(0,0,1).applyQuaternion(handGroup.current.quaternion);
    updateArmGeometry(armGeometry,points.shoulder,points.elbow,points.wrist,points.direction,(x,z)=>{
      points.world.set(x,0,z);arm.current!.localToWorld(points.world);
      return foodObstacleHeight(points.world.x,points.world.z,g.remaining)-points.world.y;
    });
  });
  return <group ref={arm} name={still?'resting-arm':`eating-arm-${id}`}>
    <mesh name="continuous-arm" geometry={armGeometry} castShadow>
      <meshStandardMaterial attach="material-0" color={sleeve} roughness={.9}/>
      <meshStandardMaterial attach="material-1" color={skin} roughness={.78}/>
    </mesh>
    <group ref={handGroup}><group scale={[leftHand?-.92:.92,.92,.92]}><PlayerHandModel motion={motion} skin={skin}/></group><group ref={food} position={[0,.13,-.065]} visible={false}>
      <mesh scale={[.12,.10,.13]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#eac45e"/></mesh>
      {Array.from({length:28},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*.11,Math.sin(i*1.7)*.08,Math.cos(i*2.4)*.11]} scale={[.019,.015,.03]}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color="#edcb66"/></mesh>)}
    </group></group>
  </group>;
});

// The cloth is one open draped surface, with long folded sides and a shorter brow edge.
function headCloth(full=false){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];const rows=26,cols=64;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const phi=i/cols*Math.PI*2,v=j/rows,front=Math.max(0,Math.cos(phi));
  const edge=1.06+1.24*THREE.MathUtils.smoothstep(Math.acos(Math.cos(phi)),.90,1.65),polar=.025+v*edge;
  const fold=Math.sin(phi*11+v*3)*.030*Math.pow(v,3),r=(full?.727:.674)+fold;
  const skirt=Math.max(0,v-.55)*(1-Math.pow(front,5));
  positions.push(Math.sin(phi)*Math.sin(polar)*(r+skirt*.24),Math.cos(polar)*(full?.66:.62)-skirt*(full?.48:.30),Math.cos(phi)*Math.sin(polar)*(r-.035));
  uv.push(i/cols*1.35,v*.95);
  if(i<cols&&j<rows){const k=j*(cols+1)+i;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function beardShape(){
 const a:number[]=[],idx:number[]=[];
 for(let j=0;j<=8;j++)for(let i=0;i<=24;i++){
 const u=i/24*2-1,x=u*.49,top=-.265+.065*Math.abs(u),bottom=-.48+.19*Math.pow(Math.abs(u),1.5),y=THREE.MathUtils.lerp(top,bottom,j/8);
 const z=.55*Math.sqrt(Math.max(.02,1-(x/.625)**2-(y/.62)**2))+.018;
 a.push(x,y,z);if(i<24&&j<8){const k=j*25+i;idx.push(k,k+25,k+1,k+1,k+25,k+26);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const curls: {p:V3;s:V3}[]=[
 {p:[-.40,.35,.26],s:[.28,.27,.28]},{p:[-.10,.48,.34],s:[.30,.27,.28]},
 {p:[.22,.45,.32],s:[.31,.28,.28]},{p:[.45,.31,.17],s:[.26,.27,.28]},
 {p:[-.48,.18,-.03],s:[.22,.26,.28]},{p:[.48,.17,-.10],s:[.23,.27,.27]},
 {p:[-.30,.56,-.04],s:[.29,.26,.29]},{p:[.04,.61,-.03],s:[.31,.27,.30]},
 {p:[.34,.51,-.09],s:[.27,.26,.29]},{p:[-.25,.35,-.34],s:[.31,.29,.28]},
 {p:[.13,.38,-.35],s:[.34,.31,.27]},{p:[-.24,.21,.44],s:[.26,.20,.20]},
 {p:[.12,.24,.46],s:[.26,.21,.19]},
];
const ProceduralCharacter = memo(function ProceduralCharacter({ id, game }: { id: number; position: V3; angle: number; game: RefObject<Game> }) {
 const scarf=useMemo(keffiyeh,[]),cloth=useMemo(()=>headCloth(id===1),[id]),beard=useMemo(beardShape,[]);
 useEffect(()=>()=>{scarf.dispose();cloth.dispose();beard.dispose();},[scarf,cloth,beard]);
 const skin=id===3?'#c9936b':'#dda174',shirt=id===1?'#eae3d5':'#29292d',side=id===1?-1:1;
 // Every torso is beyond the 2.15-unit metal rim, with radial room for its depth.
 const seat = botSeats[id - 1];
 const placement:V3=[seat[0],.02,seat[1]];
 const facing=id===2?0:-side*.85,headY=id===2?1.42:1.26;
 const handSide=-1;
 return <group name={`character-${id}`} position={placement} rotation={[0,facing,0]}>
  <Round position={[0,.39,-.08]} size={[.53,.51,.35]} color={shirt}/>
  <Round position={[-.40,.73,-.015]} size={[.22,.29,.27]} color={shirt}/>
  <Round position={[.40,.73,-.015]} size={[.22,.29,.27]} color={shirt}/>
  {id===1&&<Round box position={[0,.84,.278]} size={[.036,.26,.018]} color="#d8cdbc"/>}
  <group scale={1.08} position={[0,headY,-.025]} rotation={[.17,0,id===2?0:-side*.065]}>
   <Round size={[.625,.605,.55]} color={skin}/>
   {[-1,1].map(n=><Round key={n} position={[n*.60,-.07,0]} size={[.087,.135,.095]} color={skin}/>)}
   {id<3?<>
    <mesh geometry={cloth} position={[0,.045,-.015]} castShadow><meshStandardMaterial color={id===1?'#fff2de':'#eee5d6'} map={id===1?scarf:undefined} roughness={.96} side={THREE.DoubleSide}/></mesh>
    <mesh position={[0,.35,.005]} rotation={[Math.PI/2,0,0]} scale={[1,.93,1]} castShadow><torusGeometry args={[id===1?.615:.573,.065,12,64]}/><meshStandardMaterial color="#25211f" roughness={.92}/></mesh>
   </>:<group name="thirteen-overlapping-curls">
     <Round position={[0,.31,-.05]} size={[.62,.39,.54]} color="#2c221f"/>
     {curls.map((c,i)=><Round key={i} position={c.p} size={c.s} color={i%3?'#302521':'#332823'}/>)}
   </group>}
   {id===2&&<mesh geometry={beard} castShadow><meshStandardMaterial color="#35271f" roughness={.93} side={THREE.DoubleSide}/></mesh>}
   {[-1,1].map(n=><group key={n}>
    <Round position={[n*.185,-.028,.533]} size={[.045,.080,.022]} color="#241e19"/>
    <Round box position={[n*.185,.115,.532]} size={[.145,.044,.026]} rotation={[0,0,n*.07]} color="#372820"/>
   </group>)}
   <Round position={[0,-.13,.554]} size={[.042,.038,.032]} color={skin}/>
   <Round position={[0,-.313,id===2?.514:.477]} size={[.086,.019,.018]} color={id===2?'#ba7c51':'#8e5f42'}/>
  </group>
  <EatingArm id={id} game={game} origin={[handSide*.43,.78,.035]} rest={[handSide*.39,.66,.30]} reach={[handSide*.23,.90,1.12]} mouth={[0,headY-.34,.51]} sleeve={shirt} skin={skin}/>
  <EatingArm id={id} game={game} still leftHand origin={[-handSide*.43,.73,-.035]} rest={[-handSide*.43,.29,.025]} reach={[0,0,0]} mouth={[0,0,0]} sleeve={shirt} skin={skin}/>
 </group>;
});

export const Character = memo(function Character(props: { id: number; position: V3; angle: number; game: RefObject<Game> }) {
  return props.id === 1 ? <StudioCharacter id={props.id} game={props.game} fallback={<ProceduralCharacter {...props}/>} onChew={botChew} onUnlock={enableBotSound}/> : <BlenderCharacter id={props.id} game={props.game} fallback={<ProceduralCharacter {...props}/>} onChew={botChew} onUnlock={enableBotSound}/>;
});