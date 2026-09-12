export const foodPatches = Array.from({ length: 48 }, (_, i) => {
  const angle = i * 2.399963;
  const radius = Math.sqrt((i + .5) / 48) * 1.98;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
});

export const botSeats = [[-2.43, -1], [0, -2.64], [2.43, -1]] as const;
export const BREAD_PER_PATCH = 20 / foodPatches.length;

export function createPlatterFood() {
  const amounts = foodPatches.map(() => 100 / foodPatches.length);
  let revision = 0;
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
    reset() { amounts.fill(100 / foodPatches.length); revision++; },
    target(x: number, z: number) {
      const first = nearest(x, z)[0];
      return first ? foodPatches[first.index] : undefined;
    },
    consume(x: number, z: number, requested: number) {
      revision++;
      let left = Math.max(0, requested);
      for (const { index } of nearest(x, z)) {
        const taken = Math.min(left, amounts[index]);
        amounts[index] -= taken;
        left -= taken;
        if (left <= 1e-8) break;
      }
      return Math.max(0, requested) - left;
    },
  };
}

// One shared platter; rendering, hand projection and bite selection read the same cells.
export const platterFood = createPlatterFood();
