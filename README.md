# Mansaf Rush

A single-player, one-handed mansaf game built with React, TypeScript, Three.js, and React Three Fiber. The hand uses nested geometry and finger pivots; no imported rigs or physics.

## Run

```sh
npm install
npm run dev
```

Click **LET’S EAT**. Move the mouse over the platter, hold the left mouse button, and drag to scoop. Aim for 3–6 rice. Release the mouse: the wrist flips palm up. Hold **SPACE** and alternate **LEFT / RIGHT** four to six times to roll a lokma. Press **UP** to carry it to the mouth.

Loose attempts lift and spill with no score. Overloading spills rice; over-compressing shrinks the bite. Quality, amount, speed, and a small lamb piece affect points. Food is deducted from the shared total only when swallowed; dropped food was never deducted. Three bots scoop, roll, and eat independently. The game ends at zero food or 30 seconds, and replay resets the hand and platter.

```sh
npm run build
npm run preview
node --test tests/lokma.test.mjs
```

Tests use Node 24 native TypeScript support. `PlayerHand.tsx` handles projection and the eating sequence, `SculptedHand.tsx` defines the seven finger/wrist poses, and `lokma.ts` handles shaping rules. `MansafPlatter.tsx` renders the shared, progressively depleted food.
