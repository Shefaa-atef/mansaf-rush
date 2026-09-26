/**
 * The same test mobile.css uses to swap the keyboard hints for the touch controls (joystick, Scoop
 * and Eat buttons). Anything that words an instruction for the player has to agree with it: a phone
 * has no SPACE key and no arrows, so it must not be told to press them.
 */
export const TOUCH_LAYOUT_QUERY = '(max-width: 700px), (hover: none) and (pointer: coarse)';

export function isTouchLayout(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(TOUCH_LAYOUT_QUERY).matches;
}
