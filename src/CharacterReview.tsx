import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {Character} from './Characters';
import {MansafPlatter,foodSurface} from './MansafPlatter';
import {Majlis} from './Majlis';
import {RoomReflections} from './RoomReflections';
import {freshLokma} from './lokma';
import type {Game} from './main';
const positions:[number,number,number][]=[[-1.60,0,-.70],[-.30,0,-1.7],[1.64,0,-.52]];
function Preview({time}:{time:number}){
 const game=useRef<Game>({phase:'playing',remaining:100,scores:[0,0,0,0],eaten:[0,0,0,0],time:30,lokma:freshLokma(),feedback:'',feedbackAt:0,bites:[0,0,0,0],started:0,nextBots:[0,0,0],biteTargets:[[0,0,0],...positions.map(([x,,z])=>[x,foodSurface(x,z,100).height+.13,z] as [number,number,number])],reason:''});
 useFrame(()=>{game.current.bites=[0,...[1,2,3].map(()=>performance.now()-time*1000)];});
 return <><color attach="background" args={['#b08162']}/><ambientLight intensity={.42} color="#ffe0bb"/><hemisphereLight args={['#ffe7ca','#79503b',1.05]}/><directionalLight position={[-3,6,4]} intensity={2.7} color="#ffdfb9" castShadow shadow-mapSize={[2048,2048]} shadow-normalBias={.04}/><directionalLight position={[3,4,-2]} intensity={1.15} color="#ffd2a0"/><RoomReflections/><Majlis/>{[1,2,3].map(id=><Character key={id} id={id} game={game} position={[0,0,0]} angle={0}/>)}<MansafPlatter remaining={100}/></>;
}
function App(){const [time,setTime]=useState(2);return <><div style={{position:'fixed',inset:0}}><Canvas shadows camera={{position:[0,3.75,5.2],fov:36}} onCreated={({camera})=>camera.lookAt(0,.95,-.05)}><Preview time={time}/></Canvas></div><div style={{position:'fixed',bottom:20,left:20,display:'flex',gap:8}}>{[['Rest',2],['Reach',.1],['Scoop',.3],['Cup',.55],['Lift',.78],['Eat',.935],['Return',1.08]].map(([label,t])=><button key={label} onClick={()=>setTime(t as number)}>{label}</button>)}</div></>};createRoot(document.getElementById('root')!).render(<App/>);
