import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { textile } from './materials';

type V3 = [number, number, number];
const box = new RoundedBoxGeometry(1, 1, 1, 2, .08);
function Block({ at, size, color, map, rotation = [0, 0, 0] }: { at: V3; size: V3; color: string; map?: THREE.Texture; rotation?: V3 }) {
  return <mesh geometry={box} position={at} scale={size} rotation={rotation} castShadow receiveShadow><meshStandardMaterial color={color} map={map} roughness={.95} /></mesh>;
}
export const Majlis = memo(function Majlis() {
  const cushion = useMemo(() => textile([2, 1]), []), rug = useMemo(() => textile([6, 6]), []), wallRug = useMemo(() => textile([1, 1]), []);
  const glow=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!,g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,210,115,.5)');g.addColorStop(.3,'rgba(255,163,65,.18)');g.addColorStop(1,'rgba(255,140,40,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);},[]);
  return <group name="jordanian-majlis">
    <Block at={[0, -.20, 0]} size={[24, .18, 24]} color="#a77453" />
    <Block at={[0, 2, -3.65]} size={[14, 6, .2]} color="#c29873" />
    <Block at={[0, -.075, 0]} size={[8.3, .08, 8]} color="#ffffff" map={rug} />
    <Block at={[0, .25, -2.88]} size={[7.3, .5, 1]} color="#ffffff" map={cushion} />
    {[-2.8, -1.4, 0, 1.4, 2.8].map(x => <group key={x}>
      <Block at={[x, .92, -3.15]} size={[1.35, .91, .32]} color="#ffffff" map={cushion} rotation={[-.09, 0, 0]} />
      <Block at={[x, .91, -2.977]} size={[1.27, .025, .018]} color="#c5a37d" />
    </group>)}
    {[-1, 1].map(side => <group key={side}>
      <Block at={[side * 3.46, .26, .14]} size={[.85, .52, 5.9]} color="#ffffff" map={cushion} />
      <Block at={[side * 3.79, .85, .14]} size={[.26, .84, 5.9]} color="#ffffff" map={cushion} />
    </group>)}
    <Block at={[-1.4, 2.60, -3.48]} size={[1.43, 1.94, .16]} color="#64472f" rotation={[0, 0, -.035]} />
    <Block at={[-1.4, 2.60, -3.38]} size={[1.23, 1.72, .035]} color="#ffffff" map={wallRug} rotation={[0, 0, -.035]} />
    <group position={[1.52, .89, -2.95]}>
      <Block at={[0, -.22, 0]} size={[.73, .55, .62]} color="#5b3c28" />
      <Block at={[0, .11, 0]} size={[.89, .12, .73]} color="#745137" />
      <Block at={[0, .23, 0]} size={[.43, .085, .38]} color="#312b23" />
      <Block at={[0, .85, 0]} size={[.44, .07, .4]} color="#312b23" />
      {[-1, 1].flatMap(x => [-1, 1].map(z => <Block key={`${x}${z}`} at={[x * .17, .54, z * .145]} size={[.035, .61, .035]} color="#302c26" />))}
      <mesh position={[0, .53, 0]}><boxGeometry args={[.29, .52, .24]} /><meshStandardMaterial color="#e5ad55" transparent opacity={.3} roughness={.3} /></mesh>
      <mesh position={[0, .52, 0]} scale={[.05, .20, .05]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#ffd889" emissive="#ffb543" emissiveIntensity={3} /></mesh>
      <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[.34, .27, 4]} /><meshStandardMaterial color="#312b23" /></mesh>
      <mesh position={[0, 1.19, 0]}><torusGeometry args={[.055, .012, 8, 16]} /><meshStandardMaterial color="#312b23" /></mesh>
      <sprite position={[0,.54,.10]} scale={[.80,1.05,1]}><spriteMaterial map={glow} transparent depthWrite={false}/></sprite><pointLight position={[0, .65, .3]} intensity={7} distance={5} color="#ffb552" decay={2} />
    </group>
    <group position={[-2.05, .66, -3.05]}>
      <mesh castShadow><cylinderGeometry args={[.24, .17, .48, 12]} /><meshStandardMaterial color="#976945" /></mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[Math.cos(i * 2.4) * .17, .57 + (i % 3) * .16, Math.sin(i * 2.4) * .17]} rotation={[Math.sin(i) * .6, i, Math.cos(i) * .65]} scale={[.11, .49, .04]} castShadow><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={i % 2 ? '#526b39' : '#637b40'} /></mesh>)}
    </group>
    <group name="pottery-shelf" position={[-3.1,1.55,-3.35]}>
      <Block at={[0,-.17,0]} size={[.83,.11,.42]} color="#895d3c"/>
      <mesh position={[-.12,.05,0]} castShadow><sphereGeometry args={[.19,16,12]}/><meshStandardMaterial color="#a65e3a" roughness={.92}/></mesh>
      <mesh position={[-.12,.24,0]} castShadow><cylinderGeometry args={[.074,.10,.22,16]}/><meshStandardMaterial color="#a65e3a" roughness={.92}/></mesh>
      <mesh position={[.055,.15,0]}><torusGeometry args={[.102,.026,8,20]}/><meshStandardMaterial color="#975432"/></mesh>
      <mesh position={[.25,-.065,0]}><cylinderGeometry args={[.094,.06,.15,16]}/><meshStandardMaterial color="#c89b65" roughness={.9}/></mesh>
    </group>
    <group name="recessed-window" position={[2.68,2.46,-3.50]}>
      <Block at={[0,0,0]} size={[1.20,1.44,.085]} color="#795033"/>
      <Block at={[0,0,.047]} size={[.99,1.22,.04]} color="#5c665f"/>
      <Block at={[0,0,.085]} size={[.055,1.26,.08]} color="#916039"/>
      <Block at={[0,-.05,.085]} size={[1.03,.055,.08]} color="#916039"/>
      <Block at={[0,-.70,.10]} size={[1.29,.10,.28]} color="#b08158"/>
    </group>
  </group>;
});
