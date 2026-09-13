import { riceRollingMotion } from './riceRollingMotion.ts';
import { type Lang, TRANSLATIONS } from './i18n.ts';

export type MeterZone = 'underfilled' | 'perfect' | 'overfilled';

export type Lokma = {
  amount: number;
  bread: number;
  rolls: number;          // completed rolls into a circle (0..targetRolls)
  targetRolls: number;    // target rolls needed to form circle (3)
  last: 'left' | 'right' | '';
  rollAt: number;
  riceAngle?: number;
  previousRiceAngle?: number;
  space: boolean;
  gathering: boolean;     // holding SPACE to scoop rice
  shaping: boolean;       // pressing ← / → to roll into a circle
  readyToEat: boolean;    // circle complete, ready for ↑ arrow to eat
  meat: boolean;
  almond: boolean;
  since: number;
  eating: number;
  failed: boolean;
  swallowed: boolean;
  spill: number;
  x: number;
  z: number;
  meter: number;          // 0 to 100%
  meterZone: MeterZone;
};

export const freshLokma = (): Lokma => ({
  amount: 0,
  bread: 0,
  rolls: 0,
  targetRolls: 3,
  last: '',
  rollAt: 0,
  space: false,
  gathering: false,
  shaping: false,
  readyToEat: false,
  meat: false,
  almond: false,
  since: 0,
  eating: 0,
  failed: false,
  swallowed: false,
  spill: 0,
  x: 0.4,
  z: 1.2,
  meter: 0,
  meterZone: 'underfilled',
});

export function computeMeterZone(meter: number): MeterZone {
  if (meter < 45) return 'underfilled';
  if (meter <= 80) return 'perfect';
  return 'overfilled';
}

export function updateMeter(l: Lokma, dt: number, now = performance.now()) {
  if (!l.gathering || l.eating || l.readyToEat || l.shaping) return;
  if (!l.since) l.since = now;

  // A consistent two-second fill gives players time to react to green.
  l.meter = Math.min(100, l.meter + Math.max(0, dt) * 50);
  l.meterZone = computeMeterZone(l.meter);
  l.rollAt = now;

  if (l.meterZone === 'underfilled') {
    l.amount = 1.5 + (l.meter / 45) * 1.5;
  } else if (l.meterZone === 'perfect') {
    l.amount = 3.0 + ((l.meter - 45) / 35) * 2.5;
  } else {
    l.amount = 5.5 + ((l.meter - 80) / 20) * 1.5;
    if (l.meter >= 98 && now - l.spill > 800) {
      l.spill = now;
    }
  }
}

export function lockMeter(l: Lokma, now = performance.now()) {
  l.gathering = false;
  if (l.meter <= 0 || l.eating || l.shaping || l.readyToEat) return;
  l.meterZone = computeMeterZone(l.meter);

  if (l.meter < 45) {
    // Underfilled
    l.shaping = false;
    l.readyToEat = false;
    return;
  }

  // Transition to shaping phase (roll into a circle using ← → arrows)
  l.shaping = true;
  l.rolls = 0;
  l.riceAngle = 0;
  l.previousRiceAngle = 0;
  l.targetRolls = 3;
  l.readyToEat = false;
  if (l.meterZone === 'overfilled') {
    l.spill = now;
  }
}

export function performRoll(l: Lokma, dir: 'left' | 'right', now = performance.now()): boolean {
  if (!l.space || !l.shaping || l.readyToEat || l.eating) return false;
  const currentAngle = riceRollingMotion(l, now).angle;

  l.rolls = Math.min(l.targetRolls, l.rolls + 1);
  l.last = dir;
  l.rollAt = now;

  l.previousRiceAngle = currentAngle;
  l.riceAngle = l.previousRiceAngle + (dir === 'left' ? -1 : 1) * .72;

  if (l.rolls >= l.targetRolls) {
    l.shaping = false;
    l.readyToEat = true; // Circle complete! Ready to eat with Up Arrow (↑)
  }
  return true;
}

export function beginEating(l: Lokma, now: number): boolean {
  if (l.eating || !l.readyToEat || riceRollingMotion(l, now).active) return false;
  l.eating = now;
  l.failed = l.meterZone === 'underfilled' || l.meter < 20;
  l.space = false;
  return true;
}

export function lokmaLabel(l: Lokma, lang: Lang = 'en'): string {
  const t = TRANSLATIONS[lang].lokmaLabels;
  if (l.eating) {
    return l.failed ? t.tooLoose : t.delicious;
  }
  if (l.readyToEat) {
    return t.roundReady;
  }
  if (l.shaping) {
    return lang === 'ar'
      ? `اضغط المسافة + ← / → للتكبيب (${l.rolls}/${l.targetRolls})`
      : `HOLD SPACE + ← / → TO ROLL (${l.rolls}/${l.targetRolls})`;
  }
  if (l.gathering) {
    if (l.meterZone === 'perfect') return t.perfectHold;
    if (l.meterZone === 'overfilled') return t.tooMuchHold;
    return t.gatheringHold;
  }
  return t.defaultGuide;
}

export function lokmaScore(l: Lokma, now: number): number {
  if (l.failed) return 1;
  if (l.meterZone === 'perfect') {
    const timeBonus = now - l.since < 4000 ? 3 : 0;
    const lambBonus = l.meat ? 2 : 0;
    return 8 + timeBonus + lambBonus + (l.almond ? 1 : 0);
  }
  if (l.meterZone === 'overfilled') {
    return 4 + (l.meat ? 2 : 0) + (l.almond ? 1 : 0);
  }
  return 2;
}
