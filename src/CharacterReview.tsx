import React,{useRef,useState,useEffect} from 'react';
import * as THREE from 'three';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Character} from './Characters';
import {MansafPlatter,foodSurface} from './MansafPlatter';
import {Majlis} from './Majlis';
import {RoomReflections} from './RoomReflections';
import {freshLokma} from './lokma';
import {botSeats} from './platterFood';
import type {Game} from './main';
const positions:[number,number,number][]=[[-1.60,0,-.70],[-.30,0,-1.7],[1.64,0,-.52]];
function Camera({view}:{view:number}){
 const {camera,size}=useThree();
 useEffect(()=>{if(camera instanceof THREE.PerspectiveCamera)camera.fov=view===0?36*Math.max(1,1.65/(size.width/size.height)):36;if(view===0){camera.position.set(0,3.75,5.2);camera.lookAt(0,.95,-.05);}else if(view===4){camera.position.set(-3.8,2.1,-3.7);camera.lookAt(-2.43,1.15,-1);}else{const [x,z]=botSeats[view-1];camera.position.set(x+(view===1?1.7:view===3?-1.7:0),2.05,z+3);camera.lookAt(x,1.36,z+.10);}camera.updateProjectionMatrix();},[camera,view,size.width,size.height]);return null;
}
function Preview({time,playing,view}:{time:number;playing:boolean;view:number}){
 const game=useRef<Game>({phase:'playing',remaining:100,scores:[0,0,0,0],eaten:[0,0,0,0],time:30,lokma:freshLokma(),feedback:'',feedbackAt:0,bites:[0,0,0,0],started:0,nextBots:[0,0,0],biteTargets:[[0,0,0],...positions.map(([x,,z])=>[x,foodSurface(x,z,100).height+.13,z] as [number,number,number])],reason:''});
 useFrame(()=>{const now=performance.now();game.current.bites=[0,...[1,2,3].map(id=>now-(playing?((now+id*740)%3200):time*1500))];});
 return <><Camera view={view}/><color attach="background" args={['#b08162']}/><ambientLight intensity={.42} color="#ffe0bb"/><hemisphereLight args={['#ffe7ca','#79503b',1.05]}/><directionalLight position={[-3,6,4]} intensity={2.7} color="#ffdfb9" castShadow shadow-mapSize={[2048,2048]} shadow-normalBias={.04}/><directionalLight position={[3,4,-2]} intensity={1.15} color="#ffd2a0"/><RoomReflections/>{view!==4&&<Majlis/>}{[1,2,3].map(id=><Character key={id} id={id} game={game} position={[0,0,0]} angle={0}/>)}<MansafPlatter remaining={100}/></>;
}
const original=new URLSearchParams(location.search).get('characters')==='original';
function App(){const [time,setTime]=useState(2),[playing,setPlaying]=useState(false),[view,setView]=useState(0);return <>
 <style>{`*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;font-size:13px;color:#f5ead7}button,a{font:inherit}button{cursor:pointer;border:1px solid #ffffff30;background:#252c29;color:#f5ead7;padding:7px 10px;border-radius:7px}button:hover,button[aria-pressed=true]{background:#bb9150;color:#151c19}a{color:#f5d694;text-decoration:none}nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.panel{background:#15211eed;backdrop-filter:blur(14px);border:1px solid #ffffff25;border-radius:13px;padding:14px 18px;box-shadow:0 7px 25px #0003}`}</style>
 <div style={{position:'fixed',inset:0}}><Canvas shadows camera={{position:[0,3.75,5.2],fov:36}}><Preview time={time} playing={playing} view={view}/></Canvas></div>
 <header className="panel" style={{position:'fixed',top:16,left:18,right:18,display:'flex',justifyContent:'space-between',gap:20,alignItems:'center'}}><div><strong>Mansaf Rush · Character studio</strong><div style={{fontSize:12,opacity:.7,marginTop:5}}>{original?'Original characters · preserved':'Refined chibi · Zaid / Omar / Sami'}</div></div><nav><a href="/character-review.html">Refined chibi</a><span style={{opacity:.3}}>/</span><a href="/character-review.html?characters=original">Originals</a><a href={original?'/?characters=original':'/'} style={{marginLeft:20}}>Play game ↗</a></nav></header>
 <div className="panel" style={{position:'fixed',bottom:16,left:18,right:18,display:'flex',gap:12,justifyContent:'space-between',flexWrap:'wrap'}}><nav><button aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing?'Pause motion':'Play motion'}</button>{[['Rest',2],['Reach',.1],['Scoop',.3],['Cup',.55],['Lift',.78],['Eat',.92],['Return',1.08]].map(([label,t])=><button aria-pressed={!playing&&time===t} key={label} onClick={()=>{setPlaying(false);setTime(t as number)}}>{label}</button>)}</nav><nav>{['All three','Zaid','Omar','Sami','Back'].map((name,id)=><button aria-pressed={view===id} key={name} onClick={()=>setView(id)}>{name}</button>)}</nav></div>
 </>};createRoot(document.getElementById('root')!).render(<App/>);


