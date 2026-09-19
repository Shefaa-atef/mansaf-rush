import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { textile, minimalTextile, rugPattern, wallRugPattern } from './materials';
import { botSeats } from './platterFood';

type V3 = [number, number, number];
const box = new RoundedBoxGeometry(1, 1, 1, 2, .08);
function Block({ at, size, color, map, rotation = [0, 0, 0], shadow = true }: { at: V3; size: V3; color: string; map?: THREE.Texture; rotation?: V3; shadow?: boolean }) {
  return <mesh geometry={box} position={at} scale={size} rotation={rotation} castShadow={shadow} receiveShadow><meshStandardMaterial color={color} map={map} roughness={.95} /></mesh>;
}

export const Majlis = memo(function Majlis({ refined = false }: { refined?: boolean }) {
  const backrest = useMemo(() => textile([2, 1], refined), [refined]);
  const minimalSeat = useMemo(() => minimalTextile([2, 1], refined), [refined]);
  // Use the same local front/top faces as the rear seats, then turn them inward.
  // Match repeats to the longer side benches so the motifs keep their proportions.
  const sideBackrest = useMemo(() => textile([2 * 5.9 / 1.35, .84 / .91], refined), [refined]);
  const sideSeat = useMemo(() => minimalTextile([2 * 5.9 / 7.3, .85], refined), [refined]);
  const rug = useMemo(() => rugPattern([4, 4]), []);
  const wallRug = useMemo(() => wallRugPattern([1, 1]), []);
  return <group name="jordanian-majlis">
    <Block at={[0, -.20, 0]} size={[24, .18, 24]} color="#a77453" />
    <Block at={[0, 2.6, -4.10]} size={[16, 7.5, .2]} color="#c29873" />
    <Block at={[0, -.075, 0]} size={[8.3, .08, 8]} color="#ffffff" map={rug} />
    {refined && <group name="individual-player-cushions">{botSeats.map(([x,z], i) => <group key={i} position={[x,0,z]} rotation={[0,[.85,0,-.85][i],0]}>
      <Block at={[0,.035,0]} size={[1.30,.16,.94]} color="#c7a274" />
      <Block at={[0,.105,0]} size={[1.18,.18,.82]} color="#ffffff" map={backrest} />
    </group>)}</group>}
    <Block at={[0, .25, -3.35]} size={[7.3, .5, 1]} color="#ffffff" map={minimalSeat} />
    {[-2.8, -1.4, 0, 1.4, 2.8].map(x => <group key={x}>
      <Block at={[x, .92, -3.62]} size={[1.35, .91, .32]} color="#ffffff" map={backrest} rotation={[-.09, 0, 0]} />
      <Block at={[x, .91, -3.45]} size={[1.27, .025, .018]} color="#c5a37d" />
    </group>)}
    {[-1, 1].map(side => <group key={side}>
      <Block at={[side * 3.46, .26, .14]} size={[5.9, .52, .85]} rotation={[0, -side * Math.PI / 2, 0]} color="#ffffff" map={sideSeat} />
      <Block at={[side * 3.79, .85, .14]} size={[5.9, .84, .26]} rotation={[0, -side * Math.PI / 2, 0]} color="#ffffff" map={sideBackrest} />
      <Block at={[side * 3.65, 1.26, .14]} size={[.018, .025, 5.7]} color="#c5a37d" />
    </group>)}
    <Block at={[-1.4, 2.75, -3.93]} size={[1.43, 2.05, .16]} color="#64472f" rotation={[0, 0, -.035]} shadow={!refined} />
    <Block at={[-1.4, 2.75, -3.83]} size={[1.23, 1.82, .035]} color="#ffffff" map={wallRug} rotation={[0, 0, -.035]} shadow={!refined} />
    <group name="pottery-shelf" position={[-3.1, 1.78, -3.80]}>
      <Block at={[0,-.17,0]} size={[.83,.11,.42]} color="#895d3c" shadow={!refined}/>
      <mesh position={[-.12,.05,0]} castShadow={!refined}><sphereGeometry args={[.19,16,12]}/><meshStandardMaterial color="#a65e3a" roughness={.92}/></mesh>
      <mesh position={[-.12,.24,0]} castShadow={!refined}><cylinderGeometry args={[.074,.10,.22,16]}/><meshStandardMaterial color="#a65e3a" roughness={.92}/></mesh>
      <mesh position={[.055,.15,0]}><torusGeometry args={[.102,.026,8,20]}/><meshStandardMaterial color="#975432"/></mesh>
      <mesh position={[.25,-.065,0]}><cylinderGeometry args={[.094,.06,.15,16]}/><meshStandardMaterial color="#c89b65" roughness={.9}/></mesh>
    </group>
    <group name="recessed-window" position={[2.68, 2.62, -3.95]}>
      <Block at={[0,0,0]} size={[1.20,1.44,.085]} color="#795033" shadow={!refined}/>
      <Block at={[0,0,.047]} size={[.99,1.22,.04]} color="#5c665f" shadow={!refined}/>
      <Block at={[0,0,.085]} size={[.055,1.26,.08]} color="#916039" shadow={!refined}/>
      <Block at={[0,-.05,.085]} size={[1.03,.055,.08]} color="#916039" shadow={!refined}/>
      <Block at={[0,-.70,.10]} size={[1.29,.10,.28]} color="#b08158" shadow={!refined}/>
    </group>
  </group>;
});
