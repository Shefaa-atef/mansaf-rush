import React, { memo, useEffect, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Character } from './Characters';
import { MansafPlatter } from './MansafPlatter';
import { Majlis } from './Majlis';
import { RoomReflections } from './RoomReflections';
import { VisualPolish } from './VisualPolish';
import { OpponentEffects } from './OpponentEffects';
import { PlayerHand } from './PlayerHand';
import type { Lang } from './i18n';
import type { Game } from './main';

// Everything that needs three.js and react-three-fiber lives behind this module, so main.tsx
// (lobby, HUD, game rules) loads without them. main.tsx imports it lazily; see loadScene() there.
// Do not import this file, or anything that imports three, statically from main.tsx.
export { foodSurface } from './MansafPlatter';

const refinedLook = new URLSearchParams(window.location.search).get('look') !== 'before';

function Scene({
  game,
  remaining,
  onEat,
  lang,
}: {
  game: React.RefObject<Game>;
  remaining: number;
  onEat: (now: number) => void;
  lang: Lang;
}) {
  return (
    <>
      <color attach="background" args={['#b08162']} />
      <fog attach="fog" args={['#b08162', 10, 22]} />
      <ambientLight intensity={refinedLook ? 0.30 : 0.38} color={refinedLook ? '#f7e8d7' : '#ffe0bb'} />
      <hemisphereLight args={refinedLook ? ['#e8f2ff', '#67483b', .78] : ['#ffe7ca', '#6f4a38', 1.0]} />
      <directionalLight
        position={[-3, 6, 4]}
        intensity={refinedLook ? 2.72 : 3.05}
        color={refinedLook ? '#ffd6a5' : '#ffdfb9'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-normalBias={0.04}
        shadow-bias={-0.00015}
        shadow-radius={refinedLook ? 7 : 5}
      />
      <directionalLight position={[3, 4, -2]} intensity={refinedLook ? .72 : 1.2} color={refinedLook ? '#b8d3e6' : '#ffd2a0'} />
      <directionalLight position={[1, 3, 5]} intensity={0.42} color="#fff2da" />
      <directionalLight position={[-1.5, 2.4, -4.5]} intensity={0.55} color="#ffcf9e" />
      <RoomReflections />
      <Majlis refined={refinedLook} />
      {refinedLook && <VisualPolish />}
      <Character id={1} position={[-2.02, 0.02, -0.3]} angle={0.78} game={game} />
      <Character id={2} position={[0, 0.02, -2.05]} angle={0} game={game} />
      <Character id={3} position={[2.02, 0.02, -0.3]} angle={-0.78} game={game} />
      {refinedLook && <OpponentEffects game={game} lang={lang} />}
      <MansafPlatter remaining={remaining} refined={refinedLook} />
      <PlayerHand game={game} onEat={onEat} lang={lang} />
    </>
  );
}

// Resolutions to fall back through, sharpest first. The canvas starts at its normal 1.5x to 2x.
const DPR_STEPS = [2, 1.5, 1.25, 1];

/**
 * Trades resolution for frame rate on slow machines, and only ever steps down. While a round is
 * being played it averages the frame rate over a couple of seconds; below 45 fps it drops to the
 * next lower pixel ratio. Frames right after a change (shader compiles, texture uploads) and
 * long stalls (a hidden tab) are ignored so they never trigger a false step down.
 */
function AdaptiveResolution({ active }: { active: boolean }) {
  const setDpr = useThree((state) => state.setDpr);
  const dpr = useThree((state) => state.viewport.dpr);
  const sample = useRef({ settle: 0, time: 0, frames: 0 });
  useEffect(() => { sample.current = { settle: 0, time: 0, frames: 0 }; }, [active, dpr]);
  useFrame((_, delta) => {
    if (!active) return;
    const s = sample.current;
    if (delta > 0.25) { s.time = 0; s.frames = 0; return; }
    if (s.settle < 1.5) { s.settle += delta; return; }
    s.time += delta; s.frames++;
    if (s.time < 2 || s.frames < 20) return;
    const fps = s.frames / s.time;
    s.time = 0; s.frames = 0;
    if (fps >= 45) return;
    const next = DPR_STEPS.find((step) => step < dpr - 0.01);
    if (next !== undefined) setDpr(next);
  });
  return null;
}

// Memoised on purpose: main.tsx hands it stable props, so React does not rebuild and re-apply the
// whole scene description (hundreds of meshes) on every frame. Everything that moves each frame is
// driven from useFrame and the game ref instead. `remaining` only needs to say full, in play or
// empty, because the tray redraws itself from the platter (see MansafPlatter).
export const GameCanvas = memo(function GameCanvas({ game, remaining, onEat, lang, phase }: {
  game: RefObject<Game>;
  remaining: number;
  onEat: (now: number) => void;
  lang: Lang;
  phase: Game['phase'];
}) {
  return (
    <Canvas
      shadows
      camera={{ position: refinedLook ? [0, 3.65, 5.75] : [0, 3.75, 5.2], fov: refinedLook ? 38 : 36 }}
      onCreated={({ camera }) => camera.lookAt(0, refinedLook ? .67 : .95, -0.05)}
      dpr={[1.5, 2]}
      gl={{ toneMappingExposure: 1.12, antialias: true }}
      // The lobby is an opaque overlay, so nothing behind it is visible. Rendering on demand there
      // still compiles shaders and uploads textures as assets arrive, without burning a full
      // 60 fps of GPU on an invisible scene. It switches to continuous rendering when a round starts.
      frameloop={phase === 'ready' ? 'demand' : 'always'}
    >
      <Scene game={game} remaining={remaining} onEat={onEat} lang={lang} />
      <AdaptiveResolution active={phase === 'playing'} />
    </Canvas>
  );
});
