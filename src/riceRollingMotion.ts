import type { Lokma } from './lokma';

export const RICE_ROLL_DURATION = 640;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };

/** Press, push across the palm, catch with the thumb, and release. */
export function riceRollingMotion(l: Lokma, now: number) {
  const progress = l.rolls ? clamp((now - l.rollAt) / RICE_ROLL_DURATION) : 1;
  const active = l.rolls > 0 && progress < 1 && !l.gathering && !l.eating;
  const direction = l.last === 'left' ? -1 : 1;
  const close = active ? ease(progress / .25) * (1 - ease((progress - .70) / .30)) : 0;
  const transfer = ease((progress - .25) / .45);
  const travel = active ? Math.sin(Math.PI * progress) : 0;
  const formation = (l.rolls - (active ? 1 - ease(progress) : 0)) / Math.max(1, l.targetRolls);
  const fromAngle = l.previousRiceAngle ?? 0, toAngle = l.riceAngle ?? 0;
  return {
    active, progress, direction, close, transfer,
    // The ball travels less than its radius and stays supported by the palm.
    x: direction * .018 * travel,
    z: -.012 * travel,
    compression: .09 * close,
    angle: fromAngle + (toAngle - fromAngle) * ease((progress - .18) / .62),
    formation: clamp(formation),
  };
}
