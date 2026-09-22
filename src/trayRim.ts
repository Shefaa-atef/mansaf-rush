/**
 * The tray's top edge, as [distance from its center, height]: the slope up out of the bowl, the
 * rolled lip, then the outer wall falling away. Inside the bowl the food is the obstacle, and
 * outside the wall there is nothing to catch on from above.
 */
const RIM: ReadonlyArray<readonly [number, number]> = [[1.98, .515], [2.07, .535], [2.17, .589], [2.22, .603], [2.246, .588], [2.25, .55]];

/** Height of the tray's metal at this distance from its center, or -Infinity where there is none. */
export function rimTop(r: number) {
  if (r <= RIM[0][0] || r >= RIM[RIM.length - 1][0]) return -Infinity;
  for (let i = 1; i < RIM.length; i++) {
    const [r1, h1] = RIM[i];
    if (r <= r1) {
      const [r0, h0] = RIM[i - 1];
      return h0 + (h1 - h0) * (r - r0) / (r1 - r0);
    }
  }
  return -Infinity;
}

/**
 * Height a sleeve axis must have at distance `r` for a tube of this radius to clear the rim. The tube
 * rests on the highest rim point it overlaps, like a ball rolling over a ridge, so a tube that is
 * beside the lip still needs lifting when its curved side would touch it.
 */
export function sleeveRestHeight(r: number, radius: number) {
  let need = -Infinity;
  for (let k = -4; k <= 4; k++) {
    const offset = k / 4 * radius, top = rimTop(r + offset);
    if (top > -Infinity) need = Math.max(need, top + Math.sqrt(radius * radius - offset * offset));
  }
  return need;
}
