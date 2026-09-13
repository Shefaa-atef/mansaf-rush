import type { Lokma } from './lokma';
import { riceRollingMotion } from './riceRollingMotion.ts';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const mix = (a: string, b: string, t: number) => ({ [a]: 1 - clamp(t), [b]: clamp(t) });
export const EATING_TIMING = { lift: .78, swallow: .88, lower: 1.02, end: 1.72 };

/** Convex pose blends keep the fingertips continuous and clearance conservative. */
export function playerArmMotion(l: Lokma, now: number, speed = 0) {
  const elapsed = l.eating ? (now - l.eating) / 1000 : 0;
  let weights: Record<string, number>;
  let roll = 2.88, pitch = -.08, sway = 0, side = 0, lift = 0, yaw = 0;
  let foodRoll = 0;
  if (l.eating) {
    const close = smooth((elapsed - .25) / .45);
    if (elapsed < EATING_TIMING.swallow) weights = mix('CUP', 'HOLD_LOKMA', .50 + .35 * close);
    else {
      const release = smooth((elapsed - EATING_TIMING.swallow) / .70);
      weights = { HOLD_LOKMA: .85 * (1 - release), CUP: .15 * (1 - release), REACH: release };
    }
    const returning = smooth((elapsed - EATING_TIMING.lower) / .70);
    roll = .12 + returning * 2.76;
    pitch = .08 + .17 * close * (1 - returning);
  } else if (l.gathering) {
    const seconds = Math.max(0, (now - l.since) / 1000);
    const reach = smooth(seconds / .24), curl = smooth((seconds - .24) / .62);
    if (seconds < .30) weights = mix('REACH', 'SCOOP_START', smooth(seconds / .30));
    else weights = mix('SCOOP_START', 'SCOOP_CLOSE', smooth((seconds - .30) / .56));
    // One deliberate scoop: reach, curl, draw inward, then keep the grip.
    pitch = -.08 + .12 * curl;
    roll = 2.88 - .18 * curl;
    sway = -.055 * reach + .080 * curl;
  } else if (l.shaping || (l.readyToEat && riceRollingMotion(l, now).active)) {
    const shaping = riceRollingMotion(l, now);
    const pressure = shaping.close * .96;
    const first = shaping.direction < 0 ? 'KNEAD_A' : 'KNEAD_B';
    const second = shaping.direction < 0 ? 'KNEAD_B' : 'KNEAD_A';
    weights = { CUP: 1 - pressure, [first]: pressure * (1 - shaping.transfer), [second]: pressure * shaping.transfer };
    roll = .12 + shaping.direction * .045 * shaping.close;
    pitch = .08 + .055 * shaping.close;
    foodRoll = shaping.angle;
  } else if (l.readyToEat) {
    weights = mix('CUP', 'HOLD_LOKMA', .50);
    roll = .12; pitch = .08;
  } else {
    weights = { REACH: .65 + .12 * clamp(speed) };
    pitch -= .025 * clamp(speed);
  }
  return { weights, roll, pitch, sway, side, lift, yaw, foodRoll };
}
