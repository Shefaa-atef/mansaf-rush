import React,{useRef,useState,useEffect} from 'react';
import * as THREE from 'three';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Character} from './Characters';
import {MansafPlatter,foodSurface} from './MansafPlatter';
import {Majlis} from './Majlis';
import {RoomReflections} from './RoomReflections';
import {VisualPolish} from './VisualPolish';
import {OpponentEffects} from './OpponentEffects';
import {freshLokma} from './lokma';
import {botSeats} from './platterFood';
import type {Game} from './main';
import type {Lang} from './i18n';
const positions:[number,number,number][]=[[-1.60,0,-.70],[-.30,0,-1.7],[1.64,0,-.52]];
const params=new URLSearchParams(location.search),original=params.get('characters')==='original',refined=params.get('look')!=='before';
const portrait=Number(params.get('portrait')||0);
const effectLang:Lang=(localStorage.getItem('mansaf_lang') as Lang)||'en';
function Camera({view}:{view:number}){
 const {camera,size}=useThree();
 useEffect(()=>{if(camera instanceof THREE.PerspectiveCamera)camera.fov=view===0?(refined?38:36)*Math.max(1,1.65/(size.width/size.height)):36;if(view===0){camera.position.set(0,refined?3.40:3.75,refined?6.65:5.2);camera.lookAt(0,refined?.65:.95,-.05);}else if(view===4){camera.position.set(-4.8,1.8,-4.5);camera.lookAt(-2.43,.82,-1);}else{const [x,z]=botSeats[view-1];if(view===1)camera.position.set(-3.15,1.55,3.0);else if(view===3)camera.position.set(3.15,1.55,3.0);else camera.position.set(3.0,1.60,.50);camera.lookAt(x,.72,z);}if(portrait){const [x,z]=botSeats[portrait-1],yaw=(portrait===1?.85:portrait===3?-.85:0)+Number(params.get("angle")||0);camera.position.set(x+Math.sin(yaw)*2.5,1.88,z+Math.cos(yaw)*2.5);camera.lookAt(x,portrait===1?1.25:1.58,z+.12);if(camera instanceof THREE.PerspectiveCamera)camera.fov=30;}camera.updateProjectionMatrix();},[camera,view,size.width,size.height]);return null;
}
function Preview({time,playing,view}:{time:number;playing:boolean;view:number}){
 const game=useRef<Game>({phase:'playing',remaining:100,scores:[0,0,0,0],eaten:[0,0,0,0],time:30,lokma:freshLokma(),feedback:'',feedbackAt:0,bites:[0,0,0,0],started:0,nextBots:[0,0,0],biteTargets:[[0,0,0],...positions.map(([x,,z])=>[x,foodSurface(x,z,100).height+.13,z] as [number,number,number])],reason:''});
 useFrame(()=>{const now=performance.now(),duration=refined?2000:1500;game.current.bites=[0,...[1,2,3].map(id=>now-(playing?((now+id*980)%4300):time*duration))];});
 return <><Camera view={view}/><color attach="background" args={['#b08162']}/><ambientLight intensity={refined?.30:.42} color={refined?'#f7e8d7':'#ffe0bb'}/><hemisphereLight args={refined?['#e8f2ff','#67483b',.78]:['#ffe7ca','#79503b',1.05]}/><directionalLight position={[-3,6,4]} intensity={refined?2.72:2.7} color={refined?'#ffd6a5':'#ffdfb9'} castShadow shadow-mapSize={[2048,2048]} shadow-normalBias={.04} shadow-radius={refined?7:5}/><directionalLight position={[3,4,-2]} intensity={refined?.72:1.15} color={refined?'#b8d3e6':'#ffd2a0'}/><RoomReflections/>{!portrait&&view!==4&&<Majlis refined={refined}/>} {!portrait&&refined&&<VisualPolish/>}{(portrait?[portrait]:[1,2,3]).map(id=><Character key={id} id={id} game={game} position={[0,0,0]} angle={0}/>)}{!portrait&&refined&&<OpponentEffects game={game} lang={effectLang}/>}{!portrait&&<MansafPlatter remaining={100} refined={refined}/>}</>;
}
const href=(next:{look?:'before'|'after';characters?:'original'|'refined'})=>{const p=new URLSearchParams();if((next.look??(refined?'after':'before'))==='before')p.set('look','before');if((next.characters??(original?'original':'refined'))==='original')p.set('characters','original');return '/character-review.html'+(p.size?'?'+p:'')};
function App(){const [time,setTime]=useState(2),[playing,setPlaying]=useState(params.get("motion")==="1"),[view,setView]=useState(0);return <>
 <style>{`${portrait?"header,.panel{display:none!important}":""}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;font-size:13px;color:#f5ead7}button,a{font:inherit}button{cursor:pointer;border:1px solid #ffffff30;background:#252c29;color:#f5ead7;padding:7px 10px;border-radius:7px}button:hover,button[aria-pressed=true]{background:#bb9150;color:#151c19}a{color:#f5d694;text-decoration:none}nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.panel{background:#15211eed;backdrop-filter:blur(14px);border:1px solid #ffffff25;border-radius:13px;padding:14px 18px;box-shadow:0 7px 25px #0003}`}</style>
 <div style={{position:'fixed',inset:0}}><Canvas dpr={portrait?1:undefined} shadows camera={{position:[0,3.75,5.2],fov:36}}><Preview time={time} playing={playing} view={view}/></Canvas></div>
 <header className="panel" style={{position:'fixed',top:16,left:18,right:18,display:'flex',justifyContent:'space-between',gap:20,alignItems:'center'}}><div><strong>Mansaf Rush · Character studio</strong><div style={{fontSize:12,opacity:.7,marginTop:5}}>{refined?'AFTER · refined scene and natural hands':'BEFORE · committed checkpoint'} · {original?'Original characters':'Refined chibi'}</div></div><nav><a href={href({look:'before'})}>Before</a><span style={{opacity:.3}}>/</span><a href={href({look:'after'})}>After</a><span style={{opacity:.3}}>|</span><a href={href({characters:'refined'})}>Refined chibi</a><a href={href({characters:'original'})}>Originals</a><a href={(refined?'/?look=after':'/?look=before')+(original?'&characters=original':'')} style={{marginLeft:20}}>Play game ↗</a></nav></header>
 <div className="panel" style={{position:'fixed',bottom:16,left:18,right:18,display:'flex',gap:12,justifyContent:'space-between',flexWrap:'wrap'}}><nav><button aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing?'Pause motion':'Play motion'}</button>{[['Rest',2],['Reach',.1],['Scoop',.3],['Cup',.55],['Lift',.78],['Eat',.92],['Return',1.08]].map(([label,t])=><button aria-pressed={!playing&&time===t} key={label} onClick={()=>{setPlaying(false);setTime(t as number)}}>{label}</button>)}</nav><nav>{['All three','Suhaib','Ameen','Mefleh','Back'].map((name,id)=><button aria-pressed={view===id} key={name} onClick={()=>setView(id)}>{name}</button>)}</nav></div>
 </>};createRoot(document.getElementById('root')!).render(<App/>);


