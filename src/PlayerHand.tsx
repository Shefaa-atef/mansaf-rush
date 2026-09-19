import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { keepHandAboveFood } from './handClearance';
import { foodObstacleHeight, foodSurface } from './MansafPlatter';
import { platterFood } from './platterFood';
import { freshLokma, beginEating, updateMeter, lockMeter, performRoll } from './lokma';
import { type HandMotion, type HandPoseName } from './handPoses';
import { playerArmMotion, EATING_TIMING } from './playerArmMotion';
import { HandFood } from './HandFood';
import { BlenderPlayerArm } from './BlenderPlayerArm';
import { playEat, playGatherTip, unlockAudio } from './sfx';

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
}: {
  game: RefObject<Game>;
  onEat: (now: number) => void;
}) {
  const { camera } = useThree();
  const hand = useRef<THREE.Group>(null),
    spills = useRef<THREE.Group>(null),
    intake = useRef<THREE.Group>(null);

  const motion = useRef<HandMotion>({ pose: 'OPEN', pulse: 0 });
  const keysDown = useRef<{ [key: string]: boolean }>({});
  const mouthSounded = useRef(0);
  // Plays the "gather it, roll it, take a bite" tip once, the first time the
  // player actually starts gathering rice in real gameplay (not the tutorial).
  const gatherTipSounded = useRef(false);

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
          if (!gatherTipSounded.current) {
            gatherTipSounded.current = true;
            playGatherTip();
          }
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (l.space && !l.eating && !l.readyToEat) {
          if (l.gathering && l.meter < 45) {
            g.feedback = 'Keep gathering until the meter reaches GREEN.';
            g.feedbackAt = now;
            return;
          }
          if (l.gathering) lockMeter(l, now);
          if (performRoll(l, e.code === 'ArrowLeft' ? 'left' : 'right', now)) {
            g.feedback = l.readyToEat ? 'ROUND LOKMA! Press Up after the last roll finishes.' : `Hold SPACE + Left / Right to roll (${l.rolls}/${l.targetRolls})`;
            g.feedbackAt = now;
          }
        }
      } else if (e.code === 'ArrowUp') {
        if (beginEating(l, now)) p.from.copy(p.hand);
        else if (l.shaping || l.readyToEat) {
          g.feedback = 'Finish rolling with SPACE + Left / Right, then press Up to eat.';
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
          lockMeter(l, now);
          if (l.meter < 45) {
            g.feedback = 'UNDERFILLED! Hold SPACE longer until GREEN!';
            g.feedbackAt = now;
          } else {
            g.feedback = 'RICE GATHERED! Hold SPACE + ← / → to roll!';
            g.feedbackAt = now;
          }
        }
      }
    };

    const handleBlur = () => {
      keysDown.current = {};
      if (game.current?.lokma) {
        game.current.lokma.space = false;
        if (game.current.lokma.gathering) lockMeter(game.current.lokma);
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
      // Movement is allowed when not shaping/eating
      if (!l.space && !l.shaping && !l.readyToEat) {
        if (keysDown.current['ArrowLeft'] || keysDown.current['KeyA']) dx -= speed;
        if (keysDown.current['ArrowRight'] || keysDown.current['KeyD']) dx += speed;
        if (keysDown.current['ArrowUp'] || keysDown.current['KeyW']) {
          if (!l.readyToEat) dz -= speed;
        }
        if (keysDown.current['ArrowDown'] || keysDown.current['KeyS']) dz += speed;
      }

      if (l.gathering && !l.shaping) {
        if (keysDown.current['KeyA']) dx -= speed;
        if (keysDown.current['KeyD']) dx += speed;
        if (keysDown.current['KeyW']) dz -= speed;
        if (keysDown.current['KeyS']) dz += speed;
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
      p.target.y = surface.height + (l.gathering ? 0.145 : l.shaping ? 0.22 : l.readyToEat ? 0.38 : 0.25);

      if (l.gathering) {
        if (surface.available) {
          updateMeter(l, Math.min(delta, .25), now);
          l.almond = l.almond || surface.almond;
          l.meat = l.meat || (l.amount > 2 && surface.meat);
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
            const got = platterFood.consume(l.x, l.z, want);
            g.remaining = Math.max(0, g.remaining - got);
            l.taken += got;
            // Normally a bot-tick notices g.remaining hitting 0 and ends the
            // round; if the player's own gathering is what empties it, end it
            // right here instead of waiting on the next bot cycle (mirrors
            // finish() in main.tsx without importing back from it).
            if (g.remaining <= 0 && g.phase === 'playing') {
              g.phase = 'ended';
              g.reason = 'platter';
              l.gathering = false;
              l.space = false;
            }
          }
        }
      }
    }

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
      keepHandAboveFood(hand.current, (x, z) => foodObstacleHeight(x, z, g.remaining));
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
