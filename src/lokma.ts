import { riceRollingMotion } from './riceRollingMotion.ts';
import { type Lang, TRANSLATIONS } from './i18n.ts';

// A bite has three steps and only the middle one has a gauge.
//   Scoop  hold SPACE over rice and steer with the arrows; the palm fills. No gauge, only "enough or
//          not yet". Let go of SPACE to lock the scoop. The arrows never roll while scooping, so
//          steering across the rice cannot start (or ruin) the roll by accident.
//   Roll   every left or right arrow rolls the rice rounder, no SPACE needed. The gauge shows how
//          round the circle is: yellow is still loose, green is a proper circle, red is over-rolled
//          (squashed).
//   Eat    press up to take the bite once it is round.

/** loose: not a circle yet. round: a proper circle. squashed: rolled too long. */
export type MeterZone = 'loose' | 'round' | 'squashed';

/**
 * Rice (in platter units) a scoop needs before it is worth rolling. One spot of the tray holds a
 * little over two, so this is reachable without sliding to fresh rice, even on a spot that has
 * been nibbled at.
 */
export const MIN_SCOOP = 1.5;
/** A full palm. Holding SPACE longer takes no more rice. */
export const MAX_SCOOP = 7;
export const SCOOP_PER_SECOND = 2.6;
/**
 * Rolling is the skill step, so it takes real work, and the more rice is in the palm the more rolls it
 * takes: ROLL_BASE plus ROLLS_PER_RICE for every unit of rice. That is about six rolls for the smallest
 * scoop that can be rolled and eleven for a full palm. It used to be three rolls whatever the scoop,
 * which was over before the rice had really been circled.
 */
export const ROLL_BASE = 4;
export const ROLLS_PER_RICE = 1;
/** Rolls that stay round once the circle is formed. The one after them squashes it. */
export const GREEN_ROLLS = 4;
/** Rolls of squashing after that. Then the rice cannot be rolled any further. */
export const RED_ROLLS = 3;
/** Where the gauge turns green and where it turns red (the gauge runs 0 to 100). */
export const GREEN_FROM = 36;
export const RED_FROM = 80;

/** Points. A round lokma is worth far more than a squashed one, and lamb or almonds add to either. */
export const SCORE = { round: 4, squashed: 1, quick: 3, meat: 3, almond: 2 } as const;
/** A bite finished within this long of the first scoop earns the quick bonus. */
export const QUICK_MS = 4000;

export type Lokma = {
  amount: number;
  taken: number;          // rice already pulled off the platter for this lokma, so far (see PlayerHand.tsx's gathering loop)
  bread: number;
  rolls: number;          // rolls so far. targetRolls of them make a circle, GREEN_ROLLS more squash it
  targetRolls: number;    // rolls needed to form the circle, worked out from the scoop by lockScoop
  last: 'left' | 'right' | '';
  rollAt: number;
  riceAngle?: number;
  previousRiceAngle?: number;
  space: boolean;
  gathering: boolean;     // holding SPACE to scoop rice
  shaping: boolean;       // pressing ← / → to roll into a circle
  readyToEat: boolean;    // circle formed, ready for ↑ arrow to eat
  eatQueued: boolean;     // ↑ was pressed while the last roll was still turning: eat the moment it stops
  dry: boolean;           // scooping, but there is no rice under the hand
  meat: boolean;          // a piece of lamb was really taken off the tray with this scoop
  almond: boolean;        // an almond was really taken off the tray with this scoop
  since: number;
  eating: number;
  failed: boolean;
  swallowed: boolean;
  spill: number;
  x: number;
  z: number;
  meter: number;          // roundness gauge, 0 to 100%
  meterZone: MeterZone;
};

export const freshLokma = (): Lokma => ({
  amount: 0,
  taken: 0,
  bread: 0,
  rolls: 0,
  targetRolls: rollsToRound(MIN_SCOOP),
  last: '',
  rollAt: 0,
  space: false,
  gathering: false,
  shaping: false,
  readyToEat: false,
  eatQueued: false,
  dry: false,
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
  meterZone: 'loose',
});

/** Rolls a scoop of this much rice needs before it is a round circle. */
export function rollsToRound(amount: number): number {
  return Math.max(1, Math.round(ROLL_BASE + amount * ROLLS_PER_RICE));
}

/** The most a lump can be rolled: enough to walk the gauge all the way through red. */
export function maxRolls(target: number): number {
  return target + GREEN_ROLLS + RED_ROLLS - 1;
}

/** Loose until the circle is formed, round for GREEN_ROLLS rolls, squashed after that. */
export function zoneForRolls(rolls: number, target: number): MeterZone {
  if (rolls < target) return 'loose';
  return rolls < target + GREEN_ROLLS ? 'round' : 'squashed';
}

/** Where the needle sits (0 to 100): yellow up to the circle, green through the safe rolls, then red. */
export function meterForRolls(rolls: number, target: number): number {
  const past = rolls - target;
  if (past < 0) return GREEN_FROM * rolls / Math.max(1, target);
  if (past < GREEN_ROLLS) return GREEN_FROM + (RED_FROM - GREEN_FROM) * past / GREEN_ROLLS;
  return Math.min(100, RED_FROM + (100 - RED_FROM) * (past - GREEN_ROLLS + 1) / RED_ROLLS);
}

/**
 * How flat the ball in the palm is drawn, 0 to 1. It starts to give a couple of rolls before it turns
 * red and is fully flat on the roll that squashes it, so the picture warns before the gauge does.
 */
export function squashAmount(l: Pick<Lokma, 'rolls' | 'targetRolls'>): number {
  const past = l.rolls - l.targetRolls;
  return Math.min(1, Math.max(0, (past - (GREEN_ROLLS - 3)) / 3));
}

/** Fill the palm while SPACE is held. Same speed at any frame rate, and no gauge is involved. */
export function updateScoop(l: Lokma, dt: number, now = performance.now()) {
  if (!l.gathering || l.eating || l.readyToEat || l.shaping) return;
  if (!l.since) l.since = now;
  l.amount = Math.min(MAX_SCOOP, l.amount + Math.max(0, dt) * SCOOP_PER_SECOND);
}

/**
 * End the scoop (SPACE released, or an arrow pressed with enough rice). With enough rice the roll
 * begins. With too little the rice stays in the palm and holding SPACE again adds to it.
 */
export function lockScoop(l: Lokma) {
  l.gathering = false;
  if (l.eating || l.shaping || l.readyToEat || l.amount < MIN_SCOOP) return;

  l.shaping = true;
  l.rolls = 0;
  l.riceAngle = 0;
  l.previousRiceAngle = 0;
  l.targetRolls = rollsToRound(l.amount);
  l.readyToEat = false;
  l.meter = 0;
  l.meterZone = zoneForRolls(0, l.targetRolls);
}

/**
 * One roll (a tap of ← or →, no SPACE needed). Like really rolling a ball of rice between two
 * palms, each tap has to be the opposite side of the last one: ← then → then ← again. The same
 * arrow twice in a row does nothing, so the first tap after a scoop can be either arrow, but every
 * one after that must switch. It pushes the gauge on. The circle is ready after targetRolls, and
 * rolling on after that is allowed: it walks the needle through green into red and squashes the
 * bite.
 */
export function performRoll(l: Lokma, dir: 'left' | 'right', now = performance.now()): boolean {
  if (l.eating || !(l.shaping || l.readyToEat) || l.rolls >= maxRolls(l.targetRolls)) return false;
  if (l.last === dir) return false; // same side twice running: no progress until the other arrow
  const currentAngle = riceRollingMotion(l, now).angle;

  l.rolls += 1;
  l.meter = meterForRolls(l.rolls, l.targetRolls);
  l.meterZone = zoneForRolls(l.rolls, l.targetRolls);
  l.last = dir;
  l.rollAt = now;

  l.previousRiceAngle = currentAngle;
  l.riceAngle = currentAngle + (dir === 'left' ? -1 : 1) * .72;

  if (l.rolls >= l.targetRolls) {
    l.shaping = false;
    l.readyToEat = true; // Circle formed! Ready to eat with Up Arrow (↑)
  }
  return true;
}

/** Would one more roll tip a round lokma into the red? Used to warn before it happens. */
export function nextRollSquashes(l: Lokma): boolean {
  return l.readyToEat && l.meterZone === 'round' && l.rolls < maxRolls(l.targetRolls)
    && zoneForRolls(l.rolls + 1, l.targetRolls) === 'squashed';
}

export function beginEating(l: Lokma, now: number): boolean {
  if (l.eating || !l.readyToEat || riceRollingMotion(l, now).active) return false;
  l.eating = now;
  l.failed = l.meterZone === 'loose';
  l.space = false;
  return true;
}

/**
 * The player pressed the eat key. Eating starts at once if the last roll has finished turning. If it
 * is still turning the press is remembered and served the moment it finishes, instead of being
 * thrown away: people kept rolling (and squashed the lokma) while waiting for the key to work.
 */
export function pressEat(l: Lokma, now: number): 'eating' | 'queued' | 'not-round-yet' {
  if (beginEating(l, now)) return 'eating';
  if (l.readyToEat && !l.eating) { l.eatQueued = true; return 'queued'; }
  return 'not-round-yet';
}

/** Called every frame. Starts a queued bite once the roll has finished; true when it started. */
export function serveQueuedEat(l: Lokma, now: number): boolean {
  if (!l.eatQueued) return false;
  if (!l.readyToEat || l.eating) { l.eatQueued = false; return false; }
  if (!beginEating(l, now)) return false;
  l.eatQueued = false;
  return true;
}

export function lokmaLabel(l: Lokma, lang: Lang = 'en'): string {
  const t = TRANSLATIONS[lang].lokmaLabels;
  if (l.eating) {
    return l.failed ? t.tooLoose : t.delicious;
  }
  if (l.readyToEat) {
    return l.meterZone === 'squashed' ? t.squashed : t.roundReady;
  }
  if (l.shaping) {
    return t.shapingHold(l.rolls, l.targetRolls);
  }
  if (l.gathering) {
    return l.amount >= MIN_SCOOP ? t.enough : t.scooping;
  }
  return t.defaultGuide;
}

/** The score broken into its parts, so the toast can say where the points came from. */
export function lokmaScoreParts(l: Lokma, now: number) {
  if (l.failed) return { base: 1, quick: 0, meat: 0, almond: 0, total: 1 };
  // More rice is worth more, and a round circle is worth much more than a squashed one.
  const base = Math.round(l.amount) + (l.meterZone === 'round' ? SCORE.round : SCORE.squashed);
  const quick = l.meterZone === 'round' && now - l.since < QUICK_MS ? SCORE.quick : 0;
  // Only food that really went into the lokma counts: rice alone is always worth less.
  const meat = l.meat ? SCORE.meat : 0;
  const almond = l.almond ? SCORE.almond : 0;
  return { base, quick, meat, almond, total: base + quick + meat + almond };
}

export function lokmaScore(l: Lokma, now: number): number {
  return lokmaScoreParts(l, now).total;
}
