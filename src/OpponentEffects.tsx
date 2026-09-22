import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { botSeats } from './platterFood';
import type { Game } from './main';
import { type Lang, TRANSLATIONS } from './i18n';
import { createDealer } from './phraseDealer';
import { type BubbleKind, drawSpeechBubble } from './speechBubble';

// A bubble pops up above a bot's head after their bite resolves. Misses
// always get called out; good bites only get a line some of the time
// (EAT_SHOW_CHANCE), so heads aren't chattering after every single lokma.
//
// Lines come out of one shuffled deck shared by all three bots (phraseDealer),
// so nothing repeats until the whole pool has been used, and two bots never
// say the same thing at once. The pools live in i18n.ts (`opponent`).
const EAT_SHOW_CHANCE = 0.35;
const WINDOW = 4200; // total on-screen lifetime; quick pop-in, long hold, quick fade

type Bag = {
  /** Draws the next line for this kind from the shuffled deck. */
  deal(kind: BubbleKind): number;
  /** The bubble texture for a dealt line, baked the first time it is needed. */
  texture(kind: BubbleKind, index: number): THREE.Texture;
  /** Throws the baked textures away (they are re-baked on demand). */
  rebake(): void;
};

function createBag(lang: Lang): Bag {
  const lines = TRANSLATIONS[lang].opponent;
  const dealers = { eat: createDealer(lines.eat.length), missed: createDealer(lines.missed.length) };
  const cache = new Map<string, THREE.Texture>();
  const rebake = () => {
    cache.forEach((map) => map.dispose());
    cache.clear();
  };
  return {
    deal: (kind) => dealers[kind].next(),
    texture(kind, index) {
      const id = `${kind}:${index}`;
      let map = cache.get(id);
      if (!map) {
        const canvas = document.createElement('canvas');
        drawSpeechBubble(canvas, kind, lines[kind][index], lang);
        map = new THREE.CanvasTexture(canvas);
        map.colorSpace = THREE.SRGBColorSpace;
        cache.set(id, map);
      }
      return map;
    },
    rebake,
  };
}

function OpponentBadge({ id, game, bag }: { id: number; game: RefObject<Game>; bag: Bag }) {
  const sprite = useRef<THREE.Sprite>(null),
    lastResultAt = useRef(0),
    shownAt = useRef(-Infinity),
    active = useRef<{ kind: BubbleKind; index: number } | undefined>(undefined);
  const mobile = window.innerWidth <= 700;
  const [x, z] = mobile
    ? (id === 1 ? [-1.62, -1.1] : id === 2 ? [0, -1.75] : [1.62, -1.1])
    : botSeats[id - 1],
    baseY = id === 2 ? 1.82 : 2.15;

  useFrame(() => {
    if (!sprite.current) return;
    const g = game.current,
      now = performance.now();
    const result = g.botResults?.[id - 1];
    // Each bot resolves a bite every few seconds regardless of whether we
    // choose to display anything for it. We only reset the on-screen timer
    // (shownAt) when we actually decide to show a bubble, so a badge that's
    // already up always gets its full WINDOW instead of being silently cut
    // short the instant the next bite resolves behind it.
    if (result && result.at !== lastResultAt.current) {
      lastResultAt.current = result.at;
      const missed = result.taken <= 0;
      if (missed || Math.random() < EAT_SHOW_CHANCE) {
        const kind: BubbleKind = missed ? 'missed' : 'eat';
        active.current = { kind, index: bag.deal(kind) };
        shownAt.current = now;
      }
    }
    const age = now - shownAt.current;
    let map: THREE.Texture | undefined,
      phase = 0;
    if (g.phase === 'playing' && active.current && age < WINDOW) {
      map = bag.texture(active.current.kind, active.current.index);
      phase = age / WINDOW;
    }
    sprite.current.visible = !!map;
    if (!map) return;
    const material = sprite.current.material as THREE.SpriteMaterial;
    if (material.map !== map) {
      material.map = map;
      material.needsUpdate = true;
    }
    const enter = THREE.MathUtils.smootherstep(phase, 0, 0.08),
      exit = 1 - THREE.MathUtils.smootherstep(phase, 0.88, 1),
      pop = enter * exit;
    sprite.current.scale.set((mobile ? 1.25 : 0.96) * pop, (mobile ? 0.52 : 0.39) * pop, 1);
    sprite.current.position.y = baseY + Math.sin(Math.min(1, phase) * Math.PI) * 0.045;
  });

  // frustumCulled must be off: the sprite starts at scale 0 for its pop-in
  // animation, and Three.js can bake that zero-size bounding sphere in and
  // then wrongly keep culling the sprite even once its scale grows back up,
  // which reads as "the badge never shows" even though everything else -
  // the bite resolving, the texture, visible/scale updates - is correct.
  return (
    <sprite
      ref={sprite}
      position={[x + (id === 1 ? -0.42 : id === 3 ? 0.42 : 0.62), baseY, z + 0.02]}
      visible={false}
      renderOrder={20}
      frustumCulled={false}
    >
      <spriteMaterial transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

export function OpponentEffects({ game, lang }: { game: RefObject<Game>; lang: Lang }) {
  const bag = useMemo(() => createBag(lang), [lang]);
  useEffect(() => () => bag.rebake(), [bag]);

  // The bubble text is painted into a canvas once, but the web fonts arrive
  // after first paint. Re-bake when they land so the bubbles use them too.
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    const rebake = () => bag.rebake();
    fonts.load('800 40px Changa', 'أ').then(rebake, () => {});
    fonts.addEventListener('loadingdone', rebake);
    return () => fonts.removeEventListener('loadingdone', rebake);
  }, [bag]);

  return (
    <group name="opponent-action-effects">
      {[1, 2, 3].map((id) => (
        <OpponentBadge key={id} id={id} game={game} bag={bag} />
      ))}
    </group>
  );
}
