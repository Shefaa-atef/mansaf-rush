import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { keepHandAboveFood } from './handClearance';
import { almondUnder, foodObstacleHeight, foodSurface, foodTopBound, meatUnder, toppingsOnPatch } from './MansafPlatter';
import { platterFood } from './platterFood';
import { freshLokma, pressEat, serveQueuedEat, updateScoop, lockScoop, performRoll, nextRollSquashes } from './lokma';
import { type HandMotion, type HandPoseName } from './handPoses';
import { playerArmMotion, EATING_TIMING } from './playerArmMotion';
import { HandFood } from './HandFood';
import { BlenderPlayerArm } from './BlenderPlayerArm';
import { playEat, playRoundLokma, playSquashed, unlockAudio } from './sfx';
import { type Lang, TRANSLATIONS } from './i18n';

import type { Game } from './main';
const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
/**
 * The forearm's screen-space angle is set by (shoulder.x - hand.x), so shifting only one
 * end "moves the hand" and tilts the arm — this constant is added to BOTH the shoulder
 * anchor and the hand's resting/home x so that delta, and therefore the arm's angle, stays
 * identical: the whole arm slides right as a rigid unit instead of pivoting.
 */
const ARM_RIGHT_SHIFT = 0.32;

export function PlayerHand({
  game,
  onEat,
  lang = 'en',
}: {
  game: RefObject<Game>;
  onEat: (now: number) => void;
  lang?: Lang;
}) {
  const { camera } = useThree();
  // Key handlers below are registered once, so they read the language through
  // a ref to always show the hint in whatever language is currently selected.
  const langRef = useRef<Lang>(lang);
  langRef.current = lang;
  const hand = useRef<THREE.Group>(null),
    spills = useRef<THREE.Group>(null),
    intake = useRef<THREE.Group>(null);

  const motion = useRef<HandMotion>({ pose: 'OPEN', pulse: 0 });
  const keysDown = useRef<{ [key: string]: boolean }>({});
  const mouthSounded = useRef(0);

  const p = useMemo(
    () => ({
      target: new THREE.Vector3(0.55 + ARM_RIGHT_SHIFT, 1.2, 1.2),
      hand: new THREE.Vector3(0.55 + ARM_RIGHT_SHIFT, 1.2, 1.2),
      previous: new THREE.Vector3(),
      from: new THREE.Vector3(),
      mouth: new THREE.Vector3(),
      shoulder: new THREE.Vector3(),
      elbow: new THREE.Vector3(),
      elbowTarget: new THREE.Vector3(),
      velocity: new THREE.Vector2(),
      input: new THREE.Vector2(),
      wrist: new THREE.Vector3(),
      spillOrigin: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      quaternion: new THREE.Quaternion(),
      onTray: true,
      spillAt: 0,
      session: -1,
    }),
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const g = game.current,
        l = g.lokma;
      if (
        g.phase !== 'playing' ||
        !['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;

      e.preventDefault();
      unlockAudio();
      keysDown.current[e.code] = true;

      const now = performance.now();

      if (e.repeat) return;
      if (e.code === 'Space') {
        l.space = true;
        if (!l.eating && !l.gathering && !l.shaping && !l.readyToEat) {
          l.gathering = true;
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        // While SPACE is held to scoop, ← / → only steer the hand across the rice. They roll only
        // once the scoop is locked (SPACE let go) and SPACE is held again. Starting the roll from a
        // steering tap made people roll, and squash the lokma, before they knew it had begun.
        if (l.space && !l.eating && (l.shaping || l.readyToEat)) {
          const before = l.meterZone, wasReady = l.readyToEat;
          if (performRoll(l, e.code === 'ArrowLeft' ? 'left' : 'right', now)) {
            const fb = TRANSLATIONS[langRef.current].feedback;
            if (l.meterZone === 'squashed') {
              g.feedback = fb.overRolled;
              if (before !== 'squashed') playSquashed();
            } else if (!wasReady && l.readyToEat) {
              g.feedback = fb.roundLokma;
              playRoundLokma();
            } else if (nextRollSquashes(l)) {
              g.feedback = fb.almostSquashed;
            } else {
              g.feedback = l.readyToEat ? fb.roundLokma : fb.rollHint(l.rolls, l.targetRolls);
            }
            g.feedbackAt = now;
          }
        }
      } else if (e.code === 'ArrowUp') {
        const result = pressEat(l, now);
        if (result === 'eating') p.from.copy(p.hand);
        // A round lokma whose last roll is still turning is queued by pressEat and eaten a moment
        // later, so only a lokma that is not round yet gets a hint.
        else if (result === 'not-round-yet' && l.shaping) {
          g.feedback = TRANSLATIONS[langRef.current].feedback.finishRolling;
          g.feedbackAt = now;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const g = game.current,
        l = g.lokma;
      keysDown.current[e.code] = false;

      if (e.code === 'Space') {
        l.space = false;
        if (l.gathering) {
          const now = performance.now();
          lockScoop(l);
          const fb = TRANSLATIONS[langRef.current].feedback;
          g.feedback = l.shaping ? fb.scooped(l.targetRolls) : fb.smallScoop;
          g.feedbackAt = now;
        }
      }
    };

    const handleBlur = () => {
      keysDown.current = {};
      if (game.current?.lokma) {
        game.current.lokma.space = false;
        if (game.current.lokma.gathering) lockScoop(game.current.lokma);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [game, p]);

  useFrame((_, delta) => {
    const g = game.current,
      l = g.lokma,
      now = performance.now(),
      dt = Math.min(delta, 0.05),
      blend = 1 - Math.exp(-14 * dt);

    if (p.session !== g.started) {
      p.session = g.started;
      p.hand.set(0.55 + ARM_RIGHT_SHIFT, 1.2, 1.2);
      p.target.copy(p.hand);
      motion.current.pose = 'OPEN';
      p.velocity.set(0, 0);
      if (hand.current) hand.current.rotation.set(0, 0, 2.85);
    }
    if (g.phase === 'ended') {
      if (spills.current) spills.current.visible = false;
      if (intake.current) intake.current.visible = false;
      return;
    }

    // Fixed to the camera's bottom center, including during reaching and eating.
    p.shoulder.set(ARM_RIGHT_SHIFT, -1.2, -3).applyQuaternion(camera.quaternion).add(camera.position);
    p.previous.copy(p.hand);

    // Keyboard-based movement of hand position (Arrow Keys / WASD)
    if (g.phase === 'playing' && !l.eating) {
      const speed = 1.45;
      let dx = 0,
        dz = 0;
      // Arrows / WASD steer the hand any time it isn't rolling a lokma or
      // lifting a finished one. Holding SPACE to gather does NOT pin the hand
      // any more, so the player can keep sliding across the rice while the
      // palm fills.
      if (!l.shaping && !l.readyToEat) {
        if (keysDown.current['ArrowLeft'] || keysDown.current['KeyA']) dx -= speed;
        if (keysDown.current['ArrowRight'] || keysDown.current['KeyD']) dx += speed;
        if (keysDown.current['ArrowUp'] || keysDown.current['KeyW']) dz -= speed;
        if (keysDown.current['ArrowDown'] || keysDown.current['KeyS']) dz += speed;
      }
      p.input.set(dx, dz).clampLength(0, speed);
      p.velocity.lerp(p.input, 1 - Math.exp(-10 * dt));
      if (p.velocity.lengthSq() > .00001) {
        p.target.x += p.velocity.x * dt;
        p.target.z += p.velocity.y * dt;

        // Clamp inside platter radius (~1.8)
        const radius = Math.hypot(p.target.x, p.target.z);
        if (radius > 1.8) {
          p.target.x = (p.target.x / radius) * 1.8;
          p.target.z = (p.target.z / radius) * 1.8;
        }
      }

      l.x = p.target.x;
      l.z = p.target.z;

      const surface = foodSurface(l.x, l.z, g.remaining);
      l.dry = l.gathering && !surface.available;
      p.target.y = surface.height + (l.gathering ? 0.145 : l.shaping ? 0.22 : l.readyToEat ? 0.38 : 0.25);

      if (l.gathering) {
        if (surface.available) {
          updateScoop(l, Math.min(delta, .25), now);
          // Lamb and almonds only go into the lokma if they really left the tray with it, and the
          // lokma gets everything that leaves. The hand takes a piece the moment it closes on it, no
          // matter how little rice it holds yet (the old check waited for two units of rice, by which
          // time the rice under the lamb was already gone and the lamb had vanished for nothing).
          const piece = meatUnder(l.x, l.z);
          if (piece >= 0 && platterFood.takeMeat(piece)) l.meat = true;
          const nut = almondUnder(l.x, l.z);
          if (nut >= 0 && platterFood.takeAlmond(nut)) l.almond = true;
          if (surface.bread) l.bread += dt * 2;
          // Pull rice off the platter as it's scooped, not only once the whole
          // lokma is later swallowed - the mound should visibly shrink under
          // the hand while gathering. `taken` tracks how much of `amount` has
          // actually been removed so far; eat() in main.tsx uses it instead of
          // re-consuming the full amount at the end. A failed/underfilled
          // attempt still keeps this rice gone (spilled/wasted), matching the
          // scoop already having been taken off the tray.
          const want = l.amount - l.taken;
          if (want > 1e-4) {
            const got = platterFood.consume(l.x, l.z, want, (patch) => {
              // Rice that leaves the tray takes whatever sat on it along.
              const { meat, almonds } = toppingsOnPatch(patch);
              for (const i of meat) if (platterFood.takeMeat(i)) l.meat = true;
              for (const i of almonds) if (platterFood.takeAlmond(i)) l.almond = true;
            });
            g.remaining = Math.max(0, g.remaining - got);
            l.taken += got;
            // Ending the round is main.tsx's job (its tick sees the empty platter and publishes
            // the result). Flipping the phase here left the results screen unpublished.
          }
        }
      }
    }

    if (serveQueuedEat(l, now)) p.from.copy(p.hand);
    let eatT = l.eating ? (now - l.eating) / 1000 : 0;
    if (l.eating) {
      p.mouth.set(0, -0.58, -2.65).applyQuaternion(camera.quaternion).add(camera.position);
      if (l.failed) p.mouth.lerpVectors(p.from, p.mouth, 0.3);
      if (eatT < EATING_TIMING.lift) {
        const t = smooth(eatT / EATING_TIMING.lift);
        p.hand.lerpVectors(p.from, p.mouth, t);
        p.hand.y += .05 * Math.sin(Math.PI * t);
      }
      else if (eatT < EATING_TIMING.lower) p.hand.copy(p.mouth);
      else p.hand.lerpVectors(p.mouth, p.target, smooth((eatT - EATING_TIMING.lower) / (EATING_TIMING.end - EATING_TIMING.lower)));

      if (!l.failed && eatT >= EATING_TIMING.lift && mouthSounded.current !== l.eating) {
        mouthSounded.current = l.eating;
        playEat('player');
      }
      if (l.failed && eatT > 0.2 && !l.swallowed) {
        l.swallowed = true;
        l.spill = now;
      }
      if (!l.failed && eatT >= EATING_TIMING.swallow && !l.swallowed) {
        l.swallowed = true;
        onEat(now);
      }
      if (eatT > EATING_TIMING.end) {
        g.lokma = { ...freshLokma(), x: l.x, z: l.z };
      }
    } else {
      p.hand.lerp(p.target, blend);
    }

    let name: HandPoseName = l.eating
      ? l.swallowed
        ? 'EAT'
        : 'HOLD_LOKMA'
      : l.shaping
      ? l.last === 'left'
        ? 'ROLL_LEFT'
        : 'ROLL_RIGHT'
      : l.readyToEat
      ? 'HOLD_LOKMA'
      : l.gathering
      ? 'GATHER'
      : 'OPEN';

    const animation = playerArmMotion(l, now, p.velocity.length());
    motion.current = { pose: name, pulse: l.gathering ? 0.5 : l.shaping ? 0.3 : 0, weights: animation.weights };
    if (hand.current) {
      hand.current.position.copy(p.hand);
      hand.current.position.x += animation.side;
      hand.current.position.y += animation.lift;
      hand.current.position.z += animation.sway;
      const yaw = THREE.MathUtils.clamp(Math.atan2(p.shoulder.x - p.hand.x, p.shoulder.z - p.hand.z), -.55, .55);
      p.rotation.set(
        animation.pitch,
        yaw + animation.yaw,
        animation.roll
      );
      p.quaternion.setFromEuler(p.rotation);
      hand.current.quaternion.slerp(p.quaternion, blend);
      keepHandAboveFood(hand.current, (x, z) => foodObstacleHeight(x, z, g.remaining), foodTopBound);
      // Keep the gesture offset out of the movement integrator: no accumulating drift.
      p.hand.y = hand.current.position.y - animation.lift;
      hand.current.userData.pose = name;
    }

    if (l.spill > p.spillAt) {
      p.spillAt = l.spill;
      p.spillOrigin.copy(p.hand);
    }
    if (spills.current) {
      const t = (now - p.spillAt) / 700;
      spills.current.visible = p.spillAt > 0 && t >= 0 && t < 1;
      spills.current.position.copy(p.spillOrigin);
      spills.current.children.forEach((c, i) => {
        const a = i * 2.4,
          x = p.spillOrigin.x + Math.sin(a) * t * 0.44,
          z = p.spillOrigin.z + Math.cos(a) * t * 0.3,
          ground = foodSurface(x, z, g.remaining).height;
        c.position.set(
          x - p.spillOrigin.x,
          Math.max(ground - p.spillOrigin.y + 0.015, 0.09 - t * t * 0.85),
          z - p.spillOrigin.z
        );
      });
    }
    if (intake.current) {
      intake.current.visible = l.gathering;
      intake.current.position.copy(p.hand);
      intake.current.children.forEach((c, i) => {
        const t = (now / 220 + i / 10) % 1;
        c.position.set(
          Math.sin(i * 2.4) * 0.23 * (1 - t),
          -0.1 + t * 0.18,
          Math.cos(i * 2.4) * 0.24 * (1 - t)
        );
      });
    }
    if (hand.current) {
      p.wrist
        .set(0, 0, 0.38)
        .multiplyScalar(1.2)
        .applyQuaternion(hand.current.quaternion)
        .add(p.hand);
    }
    p.elbowTarget.lerpVectors(p.shoulder, p.wrist, 0.52);
    if (p.elbow.lengthSq() < .001) p.elbow.copy(p.elbowTarget);
    else p.elbow.lerp(p.elbowTarget, 1 - Math.exp(-12 * dt));
  }, -0.5);

  return (
    <group name="keyboard-controlled-hand">
      <BlenderPlayerArm
        motion={motion}
        hand={hand}
        shoulder={p.shoulder}
        elbow={p.elbow}
        game={game}
      />
      <group ref={hand} scale={1.2}>
        <HandFood game={game} />
      </group>
      <group ref={spills}>
        {Array.from({ length: 24 }, (_, i) => (
          <mesh key={i} scale={[0.018, 0.014, 0.031]}>
            <sphereGeometry args={[1, 5, 3]} />
            <meshStandardMaterial color="#eac45e" />
          </mesh>
        ))}
      </group>
      <group ref={intake}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} scale={[0.018, 0.014, 0.031]}>
            <sphereGeometry args={[1, 5, 3]} />
            <meshStandardMaterial color="#edc557" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
