import * as THREE from 'three';
import { sleeveRestHeight } from './trayRim.ts';

/**
 * Sleeve tube radius at the cuff and at the elbow, in world units. CharacterSleeves' radiusAt grows
 * between roughly these two, so the forearm is treated as a tube that thickens toward the elbow.
 */
export const SLEEVE_CUFF_RADIUS = .105;
export const SLEEVE_ELBOW_RADIUS = .145;
/** Air kept between the underside of the sleeve and whatever it rests over. */
export const SLEEVE_FOOD_MARGIN = .012;
/** Past this distance from the tray's center the rice is over and only the metal lip is left to clear. */
export const FOOD_EDGE_RADIUS = 2.03;
/** Where across the tube, as a fraction of its radius, the food is checked. */
const ACROSS = [-1, -.5, 0, .5, 1];
/**
 * The sleeve's end cap sits a few centimetres past the wrist bone toward the fingers, so the span that
 * is checked starts this far (as a fraction of the forearm) beyond the wrist as well as running to the elbow.
 */
const PAST_WRIST = .15;

/**
 * How far the wrist has to rise for the sleeve between the wrist and the elbow to ride above the
 * food. The hand's own skin is cleared separately from its vertices, but the cuff and forearm sit
 * a whole tube radius below the wrist line, so a palm resting on the rice would otherwise drag the
 * sleeve under it.
 *
 * `foodAt` is the height of the rice or lamb under a point. It is read across the width of the
 * tube as well as along it, because the mound falls away in a steep step beside a bitten patch and
 * the side of the sleeve meets rice the centre line never sees. Over the rim the tube rests on the
 * lip instead, at the height CharacterSleeves already drapes it to.
 */
export function forearmLift(wrist: THREE.Vector3, elbow: THREE.Vector3, foodAt: (x: number, z: number) => number, samples = 11) {
  const dx = elbow.x - wrist.x, dz = elbow.z - wrist.z, length = Math.hypot(dx, dz);
  // Horizontal direction across the forearm. A vertical arm has no side to prefer.
  const nx = length > 1e-6 ? -dz / length : 1, nz = length > 1e-6 ? dx / length : 0;
  let lift = 0;
  for (let i = 0; i < samples; i++) {
    // s runs from just past the wrist (negative) to the elbow (1). Past the wrist the cap stays at wrist height.
    const s = THREE.MathUtils.lerp(-PAST_WRIST, 1, i / (samples - 1)), along = Math.max(0, s);
    const x = THREE.MathUtils.lerp(wrist.x, elbow.x, s), z = THREE.MathUtils.lerp(wrist.z, elbow.z, s);
    const radius = THREE.MathUtils.lerp(SLEEVE_CUFF_RADIUS, SLEEVE_ELBOW_RADIUS, along);
    let rest = sleeveRestHeight(Math.hypot(x, z), radius);
    for (const k of ACROSS) {
      const px = x + nx * k * radius, pz = z + nz * k * radius;
      // The tube is round, so food off to one side only needs the part of the circle that reaches it.
      if (Math.hypot(px, pz) <= FOOD_EDGE_RADIUS) rest = Math.max(rest, foodAt(px, pz) + radius * Math.sqrt(1 - k * k));
    }
    lift = Math.max(lift, rest + SLEEVE_FOOD_MARGIN - THREE.MathUtils.lerp(wrist.y, elbow.y, along));
  }
  return lift;
}
