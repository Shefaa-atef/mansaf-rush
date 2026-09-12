import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { copyHandPose, HAND_POSES, interpolateHandPose, type HandMotion } from './handPoses';
import { createHandGeometry, FINGERS, updateHandGeometry } from './handGeometry';

/** One procedural right hand, shared by every pose and character. */
export function PlayerHandModel({ motion, skin = '#e2a678' }: { motion: RefObject<HandMotion>; skin?: string }) {
  const geometry = useMemo(() => {
    const hand = createHandGeometry();
    updateHandGeometry(hand, HAND_POSES.OPEN);
    return hand;
  }, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: skin, roughness: .79 }), [skin]);
  const current = useRef(copyHandPose(HAND_POSES.OPEN));
  useEffect(() => () => {
    geometry.palm.dispose(); geometry.digits.forEach(digit => digit.dispose());
  }, [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    interpolateHandPose(current.current, HAND_POSES[motion.current.pose], 1 - Math.exp(-16 * Math.min(delta, .05)));
    updateHandGeometry(geometry, current.current);
  }, -1);
  return <group name="hand-anatomy">
    <mesh name="tapered-palm-and-wrist" geometry={geometry.palm} material={material} castShadow />
    {FINGERS.map((finger, i) => <mesh key={finger.name} name={finger.name} geometry={geometry.digits[i]} material={material} castShadow />)}
    <mesh name="thumb" geometry={geometry.digits[4]} material={material} castShadow />
  </group>;
}
