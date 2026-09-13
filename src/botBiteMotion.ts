import * as THREE from 'three';

export const BOT_PICKUP_MS = 870;
export const BOT_SWALLOW_MS = 1410;
export const BOT_CYCLE_MS = 1950;
export const BOT_FOOD_OFFSET = new THREE.Vector3(0, .23, .065);
const ease = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);

/** Position the rice first, then solve the wrist behind that exact palm socket. */
export function botBiteWrist(t: number, bite: THREE.Vector3, mouth: THREE.Vector3, idle: THREE.Vector3, facing: THREE.Quaternion, out: THREE.Vector3) {
  const offset = BOT_FOOD_OFFSET.clone().multiplyScalar(.98).applyQuaternion(facing);
  const contact = bite.clone().sub(offset);
  if (t < .20) {
    const u = ease(t / .20);
    out.lerpVectors(idle, contact, u);
    out.y += .055 * Math.sin(Math.PI * u);
  } else if (t < .58) out.copy(contact);
  else if (t < .88) {
    const u = ease((t - .58) / .30);
    out.lerpVectors(bite, mouth, u).sub(offset);
    out.y += .055 * Math.sin(Math.PI * u);
  } else if (t < .94) out.copy(mouth).sub(offset);
  else out.lerpVectors(mouth.clone().sub(offset), idle, ease((t - .94) / .31));
  return out;
}
