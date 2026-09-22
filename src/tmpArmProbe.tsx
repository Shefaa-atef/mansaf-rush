import React,{useRef,useEffect} from 'react';
import * as THREE from 'three';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Character} from './Characters';
import {MansafPlatter,foodSurface,foodObstacleHeight} from './MansafPlatter';
import {Majlis} from './Majlis';
import {RoomReflections} from './RoomReflections';
import {VisualPolish} from './VisualPolish';
import {freshLokma} from './lokma';
import {foodPatches,botSeats} from './platterFood';
import type {Game} from './main';
const q=new URLSearchParams(location.search);
const T=Number(q.get('t')??-1), ids=(q.get('ids')??'1,2,3').split(',').map(Number);
const vec=(k:string,d:number[])=>((q.get(k)?.split(',').map(Number))??d) as [number,number,number];
function Cam(){const {camera}=useThree();useEffect(()=>{const c=camera as THREE.PerspectiveCamera;c.fov=Number(q.get('fov')??30);const p=vec('cam',[0,3,6]),l=vec('look',[0,1,0]);c.position.set(...p);c.lookAt(...l);c.updateProjectionMatrix();},[camera]);return null;}
function nearest(id:number,k=0){const s=botSeats[id-1];return [...foodPatches].sort((a,b)=>Math.hypot(a.x-s[0],a.z-s[1])-Math.hypot(b.x-s[0],b.z-s[1]))[k];}
// tray solid (world height, outer radius) and inner wall (world height, inner radius)
const OUT:[number,number][]=[[.37,2.12],[.46,2.215],[.55,2.25],[.588,2.246],[.603,2.22]];
const INN:[number,number][]=[[.515,1.98],[.535,2.07],[.589,2.17],[.603,2.22]];
function lerpTab(t:[number,number][],y:number){for(let i=1;i<t.length;i++)if(y<=t[i][0]){const a=t[i-1],b=t[i];return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);}return t[t.length-1][1];}
// returns penetration depth (radial) of point into the tray metal, 0 if outside
function pen(r:number,y:number){if(y<.37||y>.603)return 0;const o=lerpTab(OUT,y);if(r>=o)return 0;const inner=y<=.515?0:lerpTab(INN,y);if(r<=inner)return 0;return Math.min(o-r,r-inner);}
function Probe(){
 const {scene}=useThree();
 useEffect(()=>{
  (window as any).__names=()=>{const n:string[]=[];scene.traverse(o=>{if(/PlayerStyleHand_R|ContinuousSleeve_R/.test(o.name))n.push(o.name)});return n;};
  (window as any).__sleeve=(rem=100)=>{
   const out:any={};
   for(const id of ids){
    let root:THREE.Object3D|undefined;scene.traverse(n=>{if(!root&&(n.name===('character-'+id+'-blender')||n.name===('studio-character-'+id)))root=n;});
    if(!root)continue;root.updateMatrixWorld(true);
    const res:any={};
    const w=new THREE.Vector3();
    const sl=root.getObjectByName('ContinuousSleeve_R') as THREE.Mesh|undefined;
    if(sl){sl.updateMatrixWorld(true);const P=sl.geometry.attributes.position;let gap=9,at=[0,0,0],under=0,n=0;
      for(let i=0;i<P.count;i++){w.fromBufferAttribute(P,i).applyMatrix4(sl.matrixWorld);const r=Math.hypot(w.x,w.z);if(r>2.0)continue;n++;const g=w.y-foodSurface(w.x,w.z,rem).height;if(g<0)under++;if(g<gap){gap=g;at=[w.x,w.y,w.z];}}
      res.sleeve={gap:+gap.toFixed(3),under,inFood:n,at:at.map(v=>+v.toFixed(2))};}
    const hand=root.getObjectByName('PlayerStyleHand_R') as THREE.Mesh|undefined;
    if(hand){if(hand instanceof THREE.SkinnedMesh)hand.skeleton.update();const P=hand.geometry.attributes.position;let gap=9,at=[0,0,0],under=0,n=0;
      for(let i=0;i<P.count;i++){hand.getVertexPosition(i,w);w.applyMatrix4(hand.matrixWorld);const r=Math.hypot(w.x,w.z);if(r>2.0)continue;n++;const g=w.y-foodSurface(w.x,w.z,rem).height;if(g<0)under++;if(g<gap){gap=g;at=[w.x,w.y,w.z];}}
      res.hand={gap:+gap.toFixed(3),under,inFood:n,at:at.map(v=>+v.toFixed(2))};}
    const b=(n:string)=>{const o=root!.getObjectByName(n) as THREE.Object3D;const v=new THREE.Vector3();o.getWorldPosition(v);return [v.x,v.y,v.z].map(x=>+x.toFixed(2));};
    res.wrist=b('hand_R');res.elbow=b('forearm_R');res.shoulder=b('upper_arm_R');
    out[id]=res;
   }
   return out;
  };
  (window as any).__runProbe=()=>{
   const out:any={};
   for(const id of ids){
    let root:THREE.Object3D|undefined;scene.traverse(n=>{if(!root&&(n.name===('character-'+id+'-blender')||n.name===('studio-character-'+id)))root=n;});
    if(!root)continue;root.updateMatrixWorld(true);
    const hand=root.getObjectByName('PlayerStyleHand_R') as THREE.Mesh|undefined;if(!hand)continue;
    if(hand instanceof THREE.SkinnedMesh)hand.skeleton.update();
    const P=hand.geometry.attributes.position,w=new THREE.Vector3();
    let gapObs=9,gapRice=9,low=[0,0,0],lowRice=[0,0,0],n=0,touching=0;
    for(let i=0;i<P.count;i+=4){hand.getVertexPosition(i,w);w.applyMatrix4(hand.matrixWorld);
      const go=w.y-foodObstacleHeight(w.x,w.z,100),gr=w.y-foodSurface(w.x,w.z,100).height;
      if(go<gapObs){gapObs=go;low=[w.x,w.y,w.z];}
      if(Math.hypot(w.x,w.z)<2.0&&gr<gapRice){gapRice=gr;lowRice=[w.x,w.y,w.z];}
      if(Math.hypot(w.x,w.z)<2.0&&gr<.03)touching++;n++;}
    const mouth=new THREE.Vector3();
    out[id]={gapObs:+gapObs.toFixed(3),gapRice:+gapRice.toFixed(3),touching,low:low.map(v=>+v.toFixed(2)),lowRice:lowRice.map(v=>+v.toFixed(2))};
    const wristB=root.getObjectByName('hand_R') as THREE.Object3D, upperB=root.getObjectByName('upper_arm_R') as THREE.Object3D, foreB=root.getObjectByName('forearm_R') as THREE.Object3D;
    const wp=new THREE.Vector3(),sp=new THREE.Vector3(),ep=new THREE.Vector3();wristB.getWorldPosition(wp);upperB.getWorldPosition(sp);foreB.getWorldPosition(ep);
    const s0=botSeats[id-1];const bp=[...foodPatches].sort((p,q)=>Math.hypot(p.x-s0[0],p.z-s0[1])-Math.hypot(q.x-s0[0],q.z-s0[1]))[(window as any).__PICK??0];
    const bite=[bp.x,foodSurface(bp.x,bp.z,100).height+.13,bp.z];
    let minR=9,maxR=0,ymin=9,ymax=-9;for(let i=0;i<P.count;i+=4){hand.getVertexPosition(i,w);w.applyMatrix4(hand.matrixWorld);const r=Math.hypot(w.x,w.z);minR=Math.min(minR,r);maxR=Math.max(maxR,r);ymin=Math.min(ymin,w.y);ymax=Math.max(ymax,w.y);}
    const fd=new THREE.Vector3(0,1,0).applyQuaternion(wristB.getWorldQuaternion(new THREE.Quaternion()));
    Object.assign(out[id],{wrist:[wp.x,wp.y,wp.z].map(v=>+v.toFixed(2)),elbow:[ep.x,ep.y,ep.z].map(v=>+v.toFixed(2)),shoulder:[sp.x,sp.y,sp.z].map(v=>+v.toFixed(2)),bite:bite.map(v=>+v.toFixed(2)),biteR:+Math.hypot(bp.x,bp.z).toFixed(2),handR:[+minR.toFixed(2),+maxR.toFixed(2)],handY:[+ymin.toFixed(2),+ymax.toFixed(2)],boneY:[fd.x,fd.y,fd.z].map(v=>+v.toFixed(2)),reach:+sp.distanceTo(new THREE.Vector3(bite[0],bite[1],bite[2])).toFixed(2)});
   }
   return out;
  };
 },[scene]);
 return null;
}
function Preview(){
 const game=useRef<Game>({phase:'playing',remaining:100,scores:[0,0,0,0],eaten:[0,0,0,0],time:30,lokma:freshLokma(),feedback:'',feedbackAt:0,bites:[0,0,0,0],started:0,nextBots:[0,0,0],
  biteTargets:[[0,0,0],...[1,2,3].map(id=>{const p=nearest(id);return [p.x,foodSurface(p.x,p.z,100).height+.13,p.z] as [number,number,number];})],reason:''} as any);
 useFrame(()=>{const now=performance.now();const tt=(window as any).__T??T;game.current.bites=tt<0?[0,0,0,0]:[0,...[1,2,3].map(id=>now-tt*2450)];const kk=(window as any).__PICK??0;game.current.biteTargets=[[0,0,0],...[1,2,3].map(id=>{const p=nearest(id,kk);return [p.x,foodSurface(p.x,p.z,100).height+.13,p.z] as [number,number,number];})] as any;(window as any).__ready=true;(window as any).__frames=((window as any).__frames||0)+1;},-1000);
 return <><Cam/><Probe/><color attach="background" args={['#b08162']}/><ambientLight intensity={.30} color="#f7e8d7"/><hemisphereLight args={['#e8f2ff','#67483b',.78]}/><directionalLight position={[-3,6,4]} intensity={2.72} color="#ffd6a5" castShadow shadow-mapSize={[2048,2048]}/><directionalLight position={[3,4,-2]} intensity={.72} color="#b8d3e6"/><RoomReflections/><Majlis refined/><VisualPolish/>{ids.map(id=><Character key={id} id={id} game={game} position={[0,0,0]} angle={0}/>)}<MansafPlatter remaining={100} refined/></>;
}
createRoot(document.getElementById('root')!).render(<div style={{position:'fixed',inset:0}}><Canvas shadows={!q.get('noshadow')} camera={{position:[0,3,6],fov:30}}><Preview/></Canvas></div>);
