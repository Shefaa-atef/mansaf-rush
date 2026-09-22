// Which parts of the 3D scene have finished loading their model: the player's arm (0) and the three
// bots (1 to 3). Nothing is drawn for a part until its model is in, so main.tsx waits for all of
// them before it lets a round begin, and nobody ever sees an empty seat fill in.
//
// This module must stay free of three.js: main.tsx imports it, and it must not pull the 3D engine
// into the first-load bundle.
const PARTS = [0, 1, 2, 3];
const ready = new Set<number>();
const waiters = new Set<() => void>();
const listeners = new Set<() => void>();

export const allPartsReady = () => PARTS.every((id) => ready.has(id));
export const readyPartCount = () => ready.size;
export const totalPartCount = () => PARTS.length;

/** Called by a part when its model is in, or when it has given up loading (a broken model must not block the game). */
export function markPartReady(id: number) {
  if (ready.has(id)) return;
  ready.add(id);
  listeners.forEach((fn) => fn());
  if (allPartsReady()) [...waiters].forEach((done) => done());
}

/** Called (once per part, as each one comes in) so a loading screen can show progress, not just the final all-ready event. Returns an unsubscribe function. */
export function onPartsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Resolves when every model is in. Gives up waiting after `timeoutMs` so a failed download cannot hold the game back for ever. */
export function whenPartsReady(timeoutMs = 20000): Promise<void> {
  if (allPartsReady()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { waiters.delete(done); clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, timeoutMs);
    waiters.add(done);
  });
}
