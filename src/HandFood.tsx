import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { squashAmount, type Lokma } from './lokma';
import { riceRollingMotion } from './riceRollingMotion';

/** Local palm coordinates: loose food sits toward the heel, formed food near the knuckles. */
export const FOOD_HOLDING_REGION = {
  loose: new THREE.Vector3(-.014, .062, .035),
  formed: new THREE.Vector3(-.012, .062, -.080),
};

type V3 = [number, number, number];
/**
 * Lamb and almonds ride on the rice: on the palm while it is loose, and in the outer skin of the ball
 * once it is round. They sit on the side facing the game camera (local +z) so they read from the
 * camera and stay put when the ball spins about z during the roll. Positions are in the same local
 * space as the rice, so they follow the roll and the squash.
 */
const LAMB = { loose: new THREE.Vector3(.030, .030, .040), formed: new THREE.Vector3(.030, .034, .076), rotation: [.35, .5, .25] as V3, scale: [.056, .036, .046] as V3 };
const ALMONDS = [
  { loose: new THREE.Vector3(-.050, .020, .030), formed: new THREE.Vector3(-.052, .040, .062), rotation: [.30, .9, .2] as V3, color: '#a8682f' },
  { loose: new THREE.Vector3(-.020, .024, .050), formed: new THREE.Vector3(-.012, .010, .084), rotation: [.20, -.5, -.2] as V3, color: '#b57b40' },
  { loose: new THREE.Vector3(-.038, .026, -.010), formed: new THREE.Vector3(-.034, .086, .030), rotation: [.10, .2, 0] as V3, color: '#a8682f' },
];
const ALMOND_SCALE: V3 = [.020, .013, .036];

export function HandFood({ game }: { game: RefObject<{ lokma: Lokma; phase: string }> }) {
  const root = useRef<THREE.Group>(null), rice = useRef<THREE.InstancedMesh>(null);
  const mass = useRef<THREE.Mesh>(null), bread = useRef<THREE.Group>(null), lamb = useRef<THREE.Mesh>(null), almonds = useRef<THREE.Group>(null);
  const smooth = useRef({ formation: 0, amount: 0, count: 0, squash: 0 });
  const { gl, scene, camera } = useThree();
  // The hand's food is hidden until the first scoop, so its shaders would only be compiled then, as a
  // stall of well over a hundred milliseconds in the middle of the first scoop. Show all of it for one
  // synchronous compile now, while the scene is loading, and hide it again.
  useEffect(() => {
    const group = root.current;
    if (!group) return;
    const hidden: THREE.Object3D[] = [];
    group.traverse((o) => { if (!o.visible) { o.visible = true; hidden.push(o); } });
    gl.compile(scene, camera);
    hidden.forEach((o) => { o.visible = false; });
  }, [gl, scene, camera]);
  const resources = useMemo(() => {
    const grain = new THREE.SphereGeometry(1, 6, 4);
    const core = new THREE.IcosahedronGeometry(1, 2);
    const positions = core.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const uneven = 1 + .045 * Math.sin(x * 11 + z * 7) * Math.cos(y * 9);
      positions.setXYZ(i, x * uneven, y * uneven, z * uneven);
    }
    core.computeVertexNormals();
    const samples = Array.from({ length: 80 }, (_, i) => {
      const angle = i * 2.399963, r = Math.sqrt((i + .5) / 80);
      const y = 1 - 2 * (i + .5) / 80, ring = Math.sqrt(1 - y * y);
      return {
        loose: new THREE.Vector3(Math.cos(angle) * r * .109 + .004 * Math.sin(i * 7.3), .006 + .045 * (1 - r * r) + (i % 3) * .003, Math.sin(angle) * r * .109 + .004 * Math.cos(i * 5.7)),
        formed: new THREE.Vector3(Math.cos(angle) * ring * .092, y * .066, Math.sin(angle) * ring * .09),
        current: new THREE.Vector3(), angle,
      };
    });
    return { grain, core, samples, dummy: new THREE.Object3D(), target: new THREE.Vector3() };
  }, []);
  useEffect(() => () => { resources.grain.dispose(); resources.core.dispose(); }, [resources]);

  useFrame((_, delta) => {
    const l = game.current.lokma, state = smooth.current, blend = 1 - Math.exp(-15 * Math.min(delta, .05));
    if (!root.current || !rice.current) return;
    root.current.visible = game.current.phase !== 'ended' && l.amount > 0 && !l.swallowed;
    if (!root.current.visible) { state.formation = 0; state.amount = 0; state.count = 0; state.squash = 0; return; }
    const shaping = riceRollingMotion(l, performance.now());
    state.formation += (shaping.formation - state.formation) * blend;
    state.amount += (l.amount - state.amount) * blend;
    // Rolling on after the circle is round flattens the ball, more with every extra roll.
    state.squash += (squashAmount(l) - state.squash) * blend;
    const form = state.formation, size = .62 + .34 * Math.cbrt(Math.min(state.amount, 7) / 6);
    root.current.position.lerpVectors(FOOD_HOLDING_REGION.loose, FOOD_HOLDING_REGION.formed, form);
    root.current.position.y += .092 * form * size;
    root.current.position.x += shaping.x;
    root.current.position.z += shaping.z;
    // Rolling has a horizontal axis; spinning around Y made the rice look like a top.
    root.current.rotation.set(shaping.angle * .28, 0, -shaping.angle);
    const widen = shaping.compression * .3 + state.squash * .14, flatten = shaping.compression + state.squash * .18;
    root.current.scale.set(size * (1 + widen), size * (1 - flatten), size * (1 + widen));
    const count = Math.min(80, Math.ceil(Math.max(0, state.amount - l.bread) * 11.4));
    resources.samples.forEach((sample, i) => {
      if (i >= count) return;
      if (i >= state.count) sample.current.set(sample.loose.x * .8, .035, -.14);
      const sphereY = 1 - 2 * (i + .5) / Math.max(1, count);
      const ring = Math.sqrt(Math.max(0, 1 - sphereY * sphereY));
      sample.formed.set(Math.cos(sample.angle) * ring * .092, sphereY * .092, Math.sin(sample.angle) * ring * .092);
      resources.target.lerpVectors(sample.loose, sample.formed, form);
      sample.current.lerp(resources.target, blend);
      resources.dummy.position.copy(sample.current);
      resources.dummy.rotation.set(.20 * Math.sin(sample.angle), i * 1.711, .20 * Math.cos(i * 3.7) + form * sample.angle * .3);
      resources.dummy.scale.set(.010, .0065, .021 + (i % 4) * .0015);
      resources.dummy.updateMatrix(); rice.current!.setMatrixAt(i, resources.dummy.matrix);
    });
    state.count = count;
    rice.current.count = count; rice.current.instanceMatrix.needsUpdate = true;
    rice.current.computeBoundingSphere();
    if (mass.current) {
      mass.current.visible = l.amount - l.bread > .1 && form > .15;
      const fill = THREE.MathUtils.smoothstep(form, .15, .9);
      mass.current.scale.setScalar(.086 * fill);
    }
    if (bread.current) {
      bread.current.children.forEach((piece, i) => {
        piece.visible = i < Math.ceil(l.bread * 4);
        const sample = resources.samples[i * 3];
        piece.position.lerpVectors(sample.loose, sample.formed, form);
        piece.rotation.set(form * .4, sample.angle, .08 * Math.sin(i));
      });
    }
    // Only food that was really taken off the tray with this scoop is drawn in the palm.
    if (lamb.current) {
      lamb.current.visible = l.meat;
      lamb.current.position.lerpVectors(LAMB.loose, LAMB.formed, form);
    }
    if (almonds.current) {
      almonds.current.visible = l.almond;
      almonds.current.children.forEach((nut, i) => nut.position.lerpVectors(ALMONDS[i].loose, ALMONDS[i].formed, form));
    }
  }, -1);

  return <group ref={root} name="food-holding-region" visible={false}>
    <instancedMesh ref={rice} name="rice-in-palm" args={[resources.grain, undefined, 80]}>
      <meshStandardMaterial color="#e9c054" roughness={.86} />
    </instancedMesh>
    <mesh ref={mass} geometry={resources.core} name="formed-lokma"><meshStandardMaterial color="#e6bb4e" roughness={.9} /></mesh>
    <group ref={bread} name="shrak-in-palm">{Array.from({ length: 24 }, (_, i) =>
      <mesh key={i} scale={[.038, .005, .030]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 3 ? '#d6b279' : '#b98b54'} roughness={.95} /></mesh>
    )}</group>
    {/* Lamb and almonds sit in the outer skin of the ball, so they stay visible after it is rolled round. */}
    <mesh ref={lamb} position={LAMB.formed} rotation={LAMB.rotation} scale={LAMB.scale}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#6f4128" roughness={.85} /></mesh>
    <group ref={almonds}>{ALMONDS.map((nut, i) =>
      <mesh key={i} position={nut.formed} rotation={nut.rotation} scale={ALMOND_SCALE}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={nut.color} roughness={.8} /></mesh>
    )}</group>
  </group>;
}
