import React,{useRef,useEffect} from 'react';
import * as THREE from 'three';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Character} from './Characters';
import {MansafPlatter,foodSurface} from './MansafPlatter';
import {Majlis} from './Majlis';
import {RoomReflections} from './RoomReflections';
import {VisualPolish} from './VisualPolish';
import {freshLokma} from './lokma';
import {foodPatches,botSeats} from './platterFood';
const q=new URLSearchParams(location.search);
const ids=(q.get('ids')??'1,2,3').split(',').map(Number);
const vec=(k:string,d:number[])=>((q.get(k)?.split(',').map(Number))??d) as [number,number,number];
function Cam(){const {camera}=useThree();useEffect(()=>{const c=camera as THREE.PerspectiveCamera;c.fov=Number(q.get('fov')??38);c.position.set(...vec('cam',[0,3.65,5.75]));c.lookAt(...vec('look',[0,.67,-.05]));c.updateProjectionMatrix();},[camera]);return null;}
function nearest(id:number,k=0){const s=botSeats[id-1];return [...foodPatches].sort((a,b)=>Math.hypot(a.x-s[0],a.z-s[1])-Math.hypot(b.x-s[0],b.z-s[1]))[k];}
// Independent copy of the tray profile (the Tray lathe points, +.24 world height): outer wall and inner slope.
const OUT:[number,number][]=[[.37,2.12],[.46,2.215],[.55,2.25],[.588,2.246],[.603,2.22]];
const TOP:[number,number][]=[[1.98,.515],[2.07,.535],[2.17,.589],[2.22,.603],[2.246,.588],[2.25,.55]];
const lerpTab=(t:[number,number][],x:number)=>{for(let i=1;i<t.length;i++)if(x<=t[i][0]){const a=t[i-1],b=t[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return t[t.length-1][1];};
function pen(r:number,y:number){if(y<.37||r<=1.98||r>=2.25)return 0;if(r>=lerpTab(OUT,Math.min(y,.603)))return 0;const top=lerpTab(TOP,r);return y>=top?0:top-y;}
function Probe(){
 const {scene}=useThree();
 useEffect(()=>{
  (window as any).__names=()=>{const n:string[]=[];scene.traverse(o=>{if(/PlayerStyleHand_R|ContinuousSleeve_R/.test(o.name))n.push(o.name)});return n;};
  (window as any).__runProbe=()=>{
   const out:any={};
   for(const id of ids){
    let root:THREE.Object3D|undefined;scene.traverse(n=>{if(!root&&(n.name===('character-'+id+'-blender')||n.name===('studio-character-'+id)))root=n;});
    if(!root)continue;root.updateMatrixWorld(true);
    const meshes:any[]=[];const v=new THREE.Vector3();
    root.traverse(n=>{
     if(!(n instanceof THREE.Mesh)||!n.visible)return;let hid=false;n.traverseAncestors(a=>{if(!a.visible)hid=true;});if(hid)return;
     if(/^(PlayerStyleHand|Hand_)/.test(n.name))return;
     if(n instanceof THREE.SkinnedMesh)n.skeleton.update();
     const pos=n.geometry.attributes.position;let inside=0,max=0;
     for(let i=0;i<pos.count;i++){n.getVertexPosition(i,v);v.applyMatrix4(n.matrixWorld);const d=pen(Math.hypot(v.x,v.z),v.y);if(d>0){inside++;if(d>max)max=d;}}
     if(inside)meshes.push({name:n.name,verts:pos.count,inside,maxDepth:+max.toFixed(3)});
    });
    out[id]=meshes;
   }
   return out;
  };
 },[scene]);
 return null;
}
function Preview(){
 const game=useRef<any>({phase:'playing',remaining:100,scores:[0,0,0,0],eaten:[0,0,0,0],time:30,lokma:freshLokma(),feedback:'',feedbackAt:0,bites:[0,0,0,0],started:0,nextBots:[0,0,0],biteTargets:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]],reason:''});
 useFrame(()=>{const now=performance.now(),tt=(window as any).__T??-1,kk=(window as any).__PICK??0;
  game.current.bites=tt<0?[0,0,0,0]:[0,...[1,2,3].map(()=>now-tt*2450)];
  game.current.biteTargets=[[0,0,0],...[1,2,3].map(id=>{const p=nearest(id,kk);return [p.x,foodSurface(p.x,p.z,100).height+.13,p.z];})];
  (window as any).__ready=true;(window as any).__frames=((window as any).__frames||0)+1;},-1000);
 return <><Cam/><Probe/><color attach="background" args={['#b08162']}/><ambientLight intensity={.30} color="#f7e8d7"/><hemisphereLight args={['#e8f2ff','#67483b',.78]}/><directionalLight position={[-3,6,4]} intensity={2.72} color="#ffd6a5" castShadow shadow-mapSize={[1024,1024]}/><directionalLight position={[3,4,-2]} intensity={.72} color="#b8d3e6"/><RoomReflections/><Majlis refined/><VisualPolish/>{ids.map(id=><Character key={id} id={id} game={game} position={[0,0,0]} angle={0}/>)}<MansafPlatter remaining={100} refined/></>;
}
createRoot(document.getElementById('root')!).render(<div style={{position:'fixed',inset:0}}><Canvas shadows camera={{position:[0,3,6],fov:30}}><Preview/></Canvas></div>);
