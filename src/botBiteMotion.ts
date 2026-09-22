import * as THREE from 'three';
import { BOT_BITE_HOVER } from './botTiming.ts';

// The plain numbers live in botTiming.ts so main.tsx can read them without loading three.js.
export { BOT_PICKUP_MS, BOT_SWALLOW_MS, BOT_CYCLE_MS, BOT_BITE_HOVER } from './botTiming.ts';
export const BOT_FOOD_OFFSET = new THREE.Vector3(0, .23, .065);
/** How far below the bite target the palm is pressed while scooping: onto the rice, then a little into it. */
export const BOT_SCOOP_SINK = BOT_BITE_HOVER + .03;
const ease = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);

/**
 * Position the rice first, then solve the wrist behind that exact palm socket. `sink` presses the
 * pickup that far below `bite`; the caller's food clearance pass then lifts the hand back onto the
 * rice, so the hand rests on it however its fingers hang.
 */
export function botBiteWrist(t: number, bite: THREE.Vector3, mouth: THREE.Vector3, idle: THREE.Vector3, facing: THREE.Quaternion, out: THREE.Vector3, sink = 0) {
  const offset = BOT_FOOD_OFFSET.clone().multiplyScalar(.98).applyQuaternion(facing);
  const pickup = bite.clone(); pickup.y -= sink;
  const contact = pickup.clone().sub(offset);
  if (t < .20) {
    const u = ease(t / .20);
    out.lerpVectors(idle, contact, u);
    out.y += .055 * Math.sin(Math.PI * u);
  } else if (t < .58) out.copy(contact);
  else if (t < .88) {
    const u = ease((t - .58) / .30);
    out.lerpVectors(pickup, mouth, u).sub(offset);
    out.y += .055 * Math.sin(Math.PI * u);
  } else if (t < .94) out.copy(mouth).sub(offset);
  else out.lerpVectors(mouth.clone().sub(offset), idle, ease((t - .94) / .31));
  return out;
}
