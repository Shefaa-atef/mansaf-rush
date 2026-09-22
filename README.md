# Mansaf Rush

Play online: https://Shefaa-atef.github.io/mansaf-rush/

Pushes to `main` automatically build and publish the game to GitHub Pages.

A single-player, one-handed mansaf game built with React, TypeScript, Three.js, and React Three Fiber. The hand uses nested geometry and finger pivots; no imported rigs or physics.

## Run

```sh
npm install
npm run dev
```

Click **LET’S EAT**. Move the hand over the rice with the arrow keys. Hold **SPACE** to scoop, and steer with the arrows while you do: the palm fills with rice, there is no gauge while scooping, and a badge says when there is enough. Let go of **SPACE** to lock the scoop, then hold it again and tap **LEFT / RIGHT** to roll the rice into a circle. The arrows never roll while you are still scooping, so steering cannot squash the lokma by accident. Press **UP** to eat it. A press a moment before the last roll has stopped turning is remembered.

The green and red gauge belongs to the roll. Each roll pushes the needle on: yellow is still loose. How many rolls a circle takes depends on the scoop: six for a small one, up to eleven for a full palm, and the counter on screen shows it. The circle stays green for three more rolls, and the next one tips it into the red and squashes it. A round lokma scores far more than a squashed one, a bigger scoop is worth more, and a quick bite earns a bonus. Scoop over a piece of lamb or an almond and it leaves the tray and goes into the lokma for extra points (lamb +3, almond +2). A lokma only counts food it really took. Three bots scoop, roll, and eat independently. Food comes off the shared platter as it is scooped. The round ends when the platter is empty, and replay refills it.

```sh
npm run build
npm run preview
node --test tests/*.test.mjs
```

Tests use Node 24 native TypeScript support. `PlayerHand.tsx` handles projection and the eating sequence, `SculptedHand.tsx` defines the seven finger/wrist poses, and `lokma.ts` holds the scoop, roll gauge, and scoring rules. `MansafPlatter.tsx` renders the shared, progressively depleted food.

## Performance and assets

The first load is the lobby only. The 3D scene (three.js, react-three-fiber, the models and textures) is a separate chunk that `main.tsx` loads once the lobby has painted and the browser is idle, or as soon as the player hovers or presses Play. Keep it that way:

- Do not import three.js, or a module that imports it, statically from `main.tsx` or anything it imports. Plain numbers that `main.tsx` needs go in a light module such as `botTiming.ts`. Everything that needs the engine sits behind `GameCanvas.tsx`.
- The game only imports the compressed copies in `src/assets/web/`. The originals in `src/assets/` are the source art (there is no .blend for the models) and are never modified or shipped by default.
- Regenerate the copies after changing an original: `npm i --no-save sharp ffmpeg-static @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer`, then `node tools/optimize-assets.mjs` (or `images`, `audio`, `models`). The script checks every optimised model against its original and fails if triangles or data drift.
- The optimised models use meshopt compression, so load them through `createGLTFLoader()` in `src/gltf.ts`. The player arm keeps only the pose morphs the game drives; add a name to `KEEP_ARM_POSES` in the script if you start using another.
- `sceneAssets.ts` lists the files the scene fetches so they download in parallel with the scene chunk. Add new scene models or textures there.
- Nothing stands in for a model that has not loaded: the seats stay empty and `main.tsx` holds the round back until every model is in (`sceneReadiness.ts`). Do not bring back placeholder characters.

## Frame rate

The game is CPU-bound, so per-frame work is what to watch. It ran at about 5 to 14 frames per second before these were fixed, and stays above 60 with them:

- Every hand (yours and the three bots') is checked against the food every frame, and a bot solves up to eight passes. Use `contactLift` in `handContact.ts` with the `foodTopBound` ceiling for that, not three.js's per-vertex `getVertexPosition` and `localToWorld`. Refresh only the arm that moved (`updateWorldMatrix(false, true)`), not the whole character.
- `foodObstacleHeight` and `foodSurface` in `MansafPlatter.tsx` are hot: keep them free of allocation and full scans (the nearest patch comes from a precomputed grid).
- The tray (each rice patch, the grains, the sauce) rebuilds only when `platterFood.trayVersion` changes, that is when a patch of rice runs out or a lamb piece or almond is taken, never on every scoop.
- `GameCanvas` is memoised and `main.tsx` gives it stable props, so the scene is not re-described each frame. The screen state is published about 30 times a second.
