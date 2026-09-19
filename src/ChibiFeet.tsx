import * as THREE from 'three';
import { botSeats } from './platterFood';

export function ChibiFeet({ id }: { id: number }) {
  const [x,z]=botSeats[id-1], yaw=id===1 ? .85 : id===3 ? -.85 : 0;
  return <group name={`visible-chibi-feet-${id}`} position={[x,0,z]} rotation={[0,yaw,0]}>
    {[-1,1].map(side=><group key={side} position={[side*.29,0,.13]}>
      <mesh position={[0,.245,-.04]} castShadow><cylinderGeometry args={[.09,.105,.20,24]} /><meshStandardMaterial color={id === 1 ? '#ddd7c9' : '#242321'} roughness={.9}/></mesh>
      <mesh position={[0,.155,.075]} scale={[.17,.085,.245]} castShadow receiveShadow><sphereGeometry args={[1,20,12]} /><meshStandardMaterial color="#191817" roughness={.72}/></mesh>
      <mesh position={[0,.116,.095]} scale={[.175,.026,.25]}><sphereGeometry args={[1,18,10]} /><meshStandardMaterial color="#0f0f0f" roughness={.8}/></mesh>
    </group>)}
  </group>;
}
