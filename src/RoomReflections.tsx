import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Broad procedural room reflections keep the metal readable without an imported HDRI.
export function RoomReflections(){
 const {gl,scene}=useThree();
 useEffect(()=>{const generator=new PMREMGenerator(gl),room=new RoomEnvironment(),map=generator.fromScene(room,.025),previous=scene.environment,previousIntensity=scene.environmentIntensity;
 scene.environment=map.texture;scene.environmentIntensity=.10;
 room.dispose();generator.dispose();
 return()=>{scene.environment=previous;scene.environmentIntensity=previousIntensity;map.dispose();};
 },[gl,scene]);return null;
}
