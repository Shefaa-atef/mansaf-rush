// Plain numbers that main.tsx needs for the bot schedule. They live here, not in
// botBiteMotion.ts, because that module imports three.js: reading these from main.tsx
// would drag the whole 3D engine into the first-load bundle. botBiteMotion.ts re-exports them.
export const BOT_PICKUP_MS = 870;
export const BOT_SWALLOW_MS = 1410;
export const BOT_CYCLE_MS = 1950;
/** main.tsx aims every bite this far above the rice, so a palm placed exactly on the target scoops from the air. */
export const BOT_BITE_HOVER = .13;
