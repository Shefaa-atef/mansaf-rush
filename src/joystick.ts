// The phone joystick, kept free of React and three.js so the maths can be unit tested.
//
// While the hand is moving the stick is analog: how far the thumb is pushed sets how fast the hand
// goes, and PlayerHand reads `touchSteer` every frame. While a lokma is being rolled the same stick
// turns into a left/right flick: each push past a side rolls once, and the key handler in PlayerHand
// still decides whether the roll counts, so touch and keyboard share one set of rules.

export type Stick = { x: number; y: number };

/** Below this the thumb is treated as resting, so a shaky thumb does not drag the hand around. */
export const STICK_DEAD_ZONE = 0.16;
/** While rolling, pushing the stick past this far to a side rolls once. */
export const ROLL_PUSH = 0.55;
/** While rolling, the stick has to come back inside this before the same side can roll again. */
export const ROLL_RELEASE = 0.3;

/**
 * What PlayerHand steers by, in stick units (-1 to 1 on each axis, y positive is towards the player).
 * Written by the joystick component and zeroed whenever the stick is let go or turned off.
 */
export const touchSteer: Stick = { x: 0, y: 0 };

export function setTouchSteer(x: number, y: number) {
  touchSteer.x = x;
  touchSteer.y = y;
}

/** Turn a thumb offset from the stick's centre, in pixels, into a stick position inside the unit circle. */
export function stickFromOffset(dx: number, dy: number, radius: number): Stick {
  const length = Math.hypot(dx, dy);
  if (length === 0 || radius <= 0) return { x: 0, y: 0 };
  const scale = Math.min(1, length / radius) / length;
  return { x: dx * scale, y: dy * scale };
}

/**
 * The steering the hand gets from a stick position. The dead zone is cut out and the rest is
 * stretched back over 0 to 1, so the hand starts slowly just outside the dead zone and reaches full
 * speed at the rim instead of jumping straight to a fixed speed.
 */
export function steerFromStick(stick: Stick): Stick {
  const length = Math.hypot(stick.x, stick.y);
  if (length <= STICK_DEAD_ZONE) return { x: 0, y: 0 };
  const strength = Math.min(1, (length - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE));
  return { x: (stick.x / length) * strength, y: (stick.y / length) * strength };
}

export type RollSide = 'left' | 'right' | '';

/** Which side of the roll flick the stick is on right now, with the release gap so it does not chatter. */
export function rollSide(x: number, previous: RollSide): RollSide {
  if (x <= -ROLL_PUSH) return 'left';
  if (x >= ROLL_PUSH) return 'right';
  if (Math.abs(x) < ROLL_RELEASE) return '';
  return previous; // between the two thresholds: stay on whatever side we were on
}

/**
 * A roll to send, or null. Pushing to a new side rolls once, and swinging straight from one side to
 * the other rolls again without passing through the middle. Staying on the same side, or coming back
 * to the middle, never rolls.
 */
export function rollFromMove(previous: RollSide, next: RollSide): 'left' | 'right' | null {
  return next !== '' && next !== previous ? next : null;
}
