export const foodPatches = Array.from({ length: 48 }, (_, i) => {
  const angle = i * 2.399963;
  const radius = Math.sqrt((i + .5) / 48) * 1.98;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
});

// Seats sit on a ring around the tray. The chibi bellies bulge toward it, so the ring is
// pushed .14 outward (from 2.63 to 2.77) to keep bodies and sleeves outside the tray's
// 2.25-unit outer wall instead of sinking into it.
export const botSeats = [[-2.56, -1.05], [0, -2.78], [2.56, -1.05]] as const;
export const BREAD_PER_PATCH = 20 / foodPatches.length;

/**
 * Below this much food (out of 100) the platter counts as finished. Thousands of small scoops
 * leave floating-point dust behind: a total like 3e-15 is "more than zero" yet has no cell left to
 * eat from, and a round must never wait forever on that.
 */
export const PLATTER_EMPTY = 0.001;

export function createPlatterFood() {
  const amounts = foodPatches.map(() => 100 / foodPatches.length);
  // Pieces of lamb and almonds that a scoop has already carried off the tray. They are numbered
  // like the meat and almond lists in MansafPlatter.tsx, which stops drawing the ones listed here.
  const meatTaken = new Set<number>(), almondTaken = new Set<number>();
  const listeners = new Set<() => void>();
  let revision = 0, trayVersion = 0;
  // The tray only changes what it looks like when a piece of lamb or an almond is taken, or when
  // a patch of rice or bread runs out (or the tray is refilled). Everything the scene draws is
  // keyed on this, so it is not rebuilt for the many small scoops in between.
  const trayChanged = () => {
    trayVersion++;
    revision++;
    listeners.forEach(listener => listener());
  };
  const total = () => { let sum = 0; for (const amount of amounts) sum += amount; return sum; };
  function nearest(x: number, z: number) {
    return foodPatches.map((p, index) => ({ index, distance: (p.x - x) ** 2 + (p.z - z) ** 2 }))
      .filter(p => amounts[p.index] > 1e-8)
      .sort((a, b) => a.distance - b.distance);
  }
  return {
    amounts,
    riceAvailable(index: number) { return amounts[index] > BREAD_PER_PATCH + 1e-8; },
    breadAvailable(index: number) { return amounts[index] > 1e-8; },
    get revision() { return revision; },
    /** Food actually left in the cells. */
    get total() { return total(); },
    /** True once nothing worth eating is left, whatever dust the running tally has picked up. */
    get empty() { return total() <= PLATTER_EMPTY; },
    /**
     * The one rule for ending a round: the caller's running tally (100 minus everything eaten) or the
     * cells themselves say nothing is left. Either alone can be off by floating-point dust.
     */
    finished(remaining: number) { return remaining <= PLATTER_EMPTY || total() <= PLATTER_EMPTY; },
    reset() {
      amounts.fill(100 / foodPatches.length);
      meatTaken.clear();
      almondTaken.clear();
      trayChanged();
    },
    /** Clear whatever crumbs are left, so a finished tray really is bare. */
    drain() { amounts.fill(0); trayChanged(); },
    target(x: number, z: number) {
      const first = nearest(x, z)[0];
      return first ? foodPatches[first.index] : undefined;
    },
    /**
     * Take up to `requested` food from the cells nearest (x, z). `onRiceGone` is told about every
     * patch whose rice this call finished (only bread is left there): whatever sat on that rice, lamb
     * or almonds, leaves the tray with it, so the scooper can put it in the lokma.
     */
    consume(x: number, z: number, requested: number, onRiceGone?: (patch: number) => void) {
      revision++;
      let left = Math.max(0, requested), shapeChanged = false;
      for (const { index } of nearest(x, z)) {
        const hadRice = amounts[index] > BREAD_PER_PATCH + 1e-8, hadBread = amounts[index] > 1e-8;
        const taken = Math.min(left, amounts[index]);
        amounts[index] -= taken;
        left -= taken;
        const riceGone = hadRice && amounts[index] <= BREAD_PER_PATCH + 1e-8;
        if (riceGone || (hadBread && amounts[index] <= 1e-8)) shapeChanged = true;
        if (riceGone) onRiceGone?.(index);
        if (left <= 1e-8) break;
      }
      if (shapeChanged) trayChanged();
      return Math.max(0, requested) - left;
    },

    isMeatTaken(index: number) { return meatTaken.has(index); },
    isAlmondTaken(index: number) { return almondTaken.has(index); },
    /** A piece can only be taken once. Returns false if somebody already took it. */
    takeMeat(index: number) {
      if (meatTaken.has(index)) return false;
      meatTaken.add(index);
      trayChanged();
      return true;
    },
    takeAlmond(index: number) {
      if (almondTaken.has(index)) return false;
      almondTaken.add(index);
      trayChanged();
      return true;
    },
    /** Bumps whenever the tray's look changes (see trayChanged); the scene redraws on it. */
    get trayVersion() { return trayVersion; },
    subscribeTray(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// One shared platter; rendering, hand projection and bite selection read the same cells.
export const platterFood = createPlatterFood();
