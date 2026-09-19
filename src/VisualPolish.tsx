import { useMemo } from 'react';
import * as THREE from 'three';

export function VisualPolish() {
  const map = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!, g = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
    g.addColorStop(0, 'rgba(35,20,14,.34)'); g.addColorStop(.45, 'rgba(35,20,14,.14)'); g.addColorStop(1, 'rgba(35,20,14,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);
  const spots: Array<[number, number, number, number]> = [[-2.02, -.30, 1.15, .76], [0, -2.05, 1.15, .76], [2.02, -.30, 1.15, .76], [0, 0, 2.75, 2.75]];
  return <group name="soft-contact-shadows">{spots.map(([x,z,sx,sz], i) => <mesh key={i} position={[x, -.004 + i * .0001, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx, sz, 1]} renderOrder={1}>
    <planeGeometry args={[1.8, 1.8]} /><meshBasicMaterial map={map} transparent opacity={i === 3 ? .42 : .62} depthWrite={false} toneMapped={false} />
  </mesh>)}</group>;
}
