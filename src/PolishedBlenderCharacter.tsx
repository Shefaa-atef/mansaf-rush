import { refineCharacterFace } from './characterFaces';
import { refineSamiHair } from './characterHair';
import { refineCharacterNose } from './characterNoses';
import { refineCharacterEye } from './characterEyes';
import { extendArmForReach } from './characterArmProportions';
import { botBiteWrist } from './botBiteMotion';
import { CharacterHands } from './CharacterHands';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { botSeats } from './platterFood';
import { foodSurface, foodObstacleHeight } from './MansafPlatter';
import type { Game } from './main';
import { ChibiFeet } from './ChibiFeet';
const refinedLook = new URLSearchParams(window.location.search).get('look') !== 'before';
type FacePart = { mesh: THREE.Mesh; position: THREE.Vector3; scale: THREE.Vector3; side: number };
type Rig = {
    asset: THREE.Group;
    upper: THREE.Bone;
    fore: THREE.Bone;
    hand: THREE.Bone;
    fingers: THREE.Bone[];
    rest: Map<THREE.Bone, THREE.Quaternion>;
    mouths: THREE.Mesh[];
    eyes: THREE.Mesh[];
    head?: THREE.Bone;
    chest?: THREE.Bone;
    a: number;
    b: number;
    handBind: THREE.Quaternion;
    handMeshes: THREE.SkinnedMesh[];
    eyeParts: FacePart[];
    brows: FacePart[];
    face?: FacePart;
};
export function PolishedBlenderCharacter({ id, game, fallback, onChew, onUnlock }: {
    id: number;
    game: RefObject<Game>;
    fallback: ReactNode;
    onChew: () => void;
    onUnlock: () => void;
}) {
    const [asset, setAsset] = useState<THREE.Group | null>(null);
    const rig = useRef<Rig | null>(null), food = useRef<THREE.Group>(null), lastSound = useRef(0);
    const p = useMemo(() => ({ idle: new THREE.Vector3(-.38, 1.20, .63), mouth: new THREE.Vector3(-.025, 1.53, .39), sample: new THREE.Vector3(), target: new THREE.Vector3(), goal: new THREE.Vector3(), shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), direction: new THREE.Vector3(), pole: new THREE.Vector3(), axis: new THREE.Vector3(), q: new THREE.Quaternion(), worldQ: new THREE.Quaternion(), parentQ: new THREE.Quaternion(), curlQ: new THREE.Quaternion() }), []);
    useEffect(() => {
        let cancelled = false, loaded: THREE.Group | undefined;
        const dispose = (scene: THREE.Object3D) => { const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(); scene.traverse(n => { if (n instanceof THREE.Mesh) {
            geometries.add(n.geometry);
            for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
                materials.add(m);
                if (m instanceof THREE.MeshStandardMaterial && m.map)
                    textures.add(m.map);
            }
        } }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); };
        window.addEventListener('pointerdown', onUnlock);
        new GLTFLoader().load([new URL('./assets/zaid-chibi-polished.glb', import.meta.url).href, new URL('./assets/omar-chibi-polished.glb', import.meta.url).href, new URL('./assets/sami-chibi-polished.glb', import.meta.url).href][id - 1], gltf => {
            if (cancelled) {
                dispose(gltf.scene);
                return;
            }
            loaded = gltf.scene;
            const seat = botSeats[id - 1];
            loaded.position.set(seat[0], refinedLook ? -.28 : -.40, seat[1]);
            loaded.rotation.set(.16, id === 1 ? .85 : id === 3 ? -.85 : 0, 0, 'YXZ');
            if (refinedLook) loaded.rotation.z = [0, .012, -.010, .016][id];
            loaded.scale.setScalar(.98);
            const upper = loaded.getObjectByName('upper_arm_R'), fore = loaded.getObjectByName('forearm_R'), hand = loaded.getObjectByName('hand_R');
            if (!(upper instanceof THREE.Bone) || !(fore instanceof THREE.Bone) || !(hand instanceof THREE.Bone)) {
                console.error(`Character ${id} rig controls missing; using fallback`);
                dispose(loaded);
                loaded = undefined;
                return;
            }
            const rest = new Map<THREE.Bone, THREE.Quaternion>(), fingers: THREE.Bone[] = [], mouths: THREE.Mesh[] = [], eyes: THREE.Mesh[] = [], eyeParts: FacePart[] = [], brows: FacePart[] = [];
            let face: FacePart|undefined;
            loaded.traverse(n => { if (n instanceof THREE.Bone) {
                rest.set(n, n.quaternion.clone());
                if (n.name.startsWith('finger_R') || n.name.startsWith('thumb_R'))
                    fingers.push(n);
            } if (n instanceof THREE.Mesh) {
                n.castShadow = true;
                n.frustumCulled = false;
                if (n.morphTargetDictionary?.OPEN !== undefined)
                    mouths.push(n);
                // Both the eye and eyebrow meshes carry a BLINK morph target (the
                // eyebrow slides down to act as the closing eyelid, same technique
                // as Zaid's StudioCharacter.tsx) - collect whichever mesh has it.
                if (n.morphTargetDictionary?.BLINK !== undefined)
                    eyes.push(n);
                refineCharacterFace(n,id);
                if (id === 3) refineSamiHair(n);
            const part={mesh:n,position:n.position.clone(),scale:n.scale.clone(),side:0};n.geometry.computeBoundingBox();part.side=Math.sign(((n.geometry.boundingBox?.min.x??0)+(n.geometry.boundingBox?.max.x??0))*.5);
                if(/^Eye(?:\.?\d+)?$/.test(n.name)){eyeParts.push(part);refineCharacterEye(n);}if(/Small.?rounded.?nose/i.test(n.name))refineCharacterNose(n,id);if(/^Eyebrow(?:\.\d+)?$/.test(n.name))brows.push(part);if(n.name==='Rounded head')face=part;
                if (refinedLook && /Keffiyeh/i.test(n.name) && n.material instanceof THREE.MeshStandardMaterial) {
                    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
                    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#858585'; ctx.fillRect(0,0,64,64);
                    for (let x=0;x<64;x++){const v=Math.round(128+14*Math.cos(x/64*Math.PI*6));ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,0,1,64)}
                    for (let y=0;y<64;y+=3){ctx.fillStyle=y%6?'#929292':'#767676';ctx.fillRect(0,y,64,1)}
                    const bump = new THREE.CanvasTexture(canvas); bump.wrapS=bump.wrapT=THREE.RepeatWrapping; bump.repeat.set(12,12);
                    n.material=n.material.clone(); n.material.roughness=.92; n.material.bumpMap=bump; n.material.bumpScale=.018;
                }
                if (refinedLook && /Eyebrow/i.test(n.name)) n.rotation.z += (n.name.includes('L') ? 1 : -1) * [0,.035,-.02,.05][id];
                if (refinedLook && n.morphTargetDictionary?.OPEN !== undefined) n.scale.x *= [1,1.04,.94,1.08][id];
                if (refinedLook && /^(Shoe|Short leg)/i.test(n.name)) { n.geometry.computeBoundingBox(); const cx=(n.geometry.boundingBox!.min.x+n.geometry.boundingBox!.max.x)*.5; n.position.x+=Math.sign(cx||1)*(n.name.startsWith('Shoe') ? .16 : .13); n.position.z+=.10; if(n.name.startsWith('Shoe'))n.scale.multiplyScalar(1.07); }
            } });
            loaded.updateMatrixWorld(true);
            upper.getWorldPosition(p.shoulder);
            fore.getWorldPosition(p.elbow);
            hand.getWorldPosition(p.wrist);
            const handMeshes: THREE.SkinnedMesh[] = [];
            loaded.traverse(n => { if (n instanceof THREE.SkinnedMesh && n.name === 'Hand_R')
                handMeshes.push(n); });
            const handBind = loaded.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
            const head = loaded.getObjectByName('head'), chest = loaded.getObjectByName('chest');
            rig.current = { asset: loaded, upper, fore, hand, fingers, rest, mouths, eyes,
                head: head instanceof THREE.Bone ? head : undefined,
                chest: chest instanceof THREE.Bone ? chest : undefined,
                handBind, handMeshes, a: p.shoulder.distanceTo(p.elbow), b: p.elbow.distanceTo(p.wrist), eyeParts, brows, face };
            setAsset(loaded);
        }, undefined, e => console.error(`Character ${id} GLB failed to load; using fallback.`, e));
        return () => { cancelled = true; window.removeEventListener('pointerdown', onUnlock); rig.current = null; if (loaded)
            dispose(loaded); };
    }, [id, onUnlock, p]);
    useFrame(() => {
        const r = rig.current;
        if (!asset || !r || r.asset !== asset)
            return;
        const g = game.current, now = performance.now(), t = (now - g.bites[id]) / (refinedLook ? 2450 : 1500), active = g.phase === 'playing' && g.bites[id] > 0 && t >= 0 && t < 1.2;
        r.rest.forEach((q, b) => b.quaternion.copy(q));
        // Head + chest movement copied from Zaid's StudioCharacter.tsx: a
        // constant idle chest breathe and head sway, plus a dip into the reach,
        // a lift toward the mouth, and a little chew bob, all driven by the
        // same bite timeline `t`. `reach` is shared by both so chest and head
        // react to the same "going for it" phase, exactly like Zaid.
        const ease = (x: number) => THREE.MathUtils.smootherstep(x, 0, 1);
        const reach = active ? ease(t / .20) * (1 - ease((t - .58) / .30)) : 0;
        const focus = active ? ease(t/.16)*(1-ease((t-1.02)/.20)) : 0;
        if (r.chest) {
            p.q.setFromAxisAngle(p.axis.set(1, 0, 0), (refinedLook ? [0,.17,.14,.24][id] : .04) * reach + .009 * Math.sin(now * (.0015 + id * .0001) + id));
            r.chest.quaternion.multiply(p.q);
        }
        if (r.head) {
            const lift = active ? ease((t - .58) / .30) * (1 - ease((t - 1.02) / .23)) : 0;
            const chew = active && t > .88 && t < 1.04 ? Math.sin((t - .88) * 65) : 0;
            p.q.setFromAxisAngle(p.axis.set(1, 0, 0), .055 + reach * (refinedLook ? .14 : .055) - lift * .07 + chew * .018);
            r.head.quaternion.multiply(p.q);
            if (refinedLook) { p.q.setFromAxisAngle(p.axis.set(0, 0, 1), [0,.018,-.024,.030][id]); r.head.quaternion.multiply(p.q); }
            p.q.setFromAxisAngle(p.axis.set(0, 1, 0), -(refinedLook ? .085 : .035) * reach + .018 * Math.sin(now * .0007 + id * 2));
            r.head.quaternion.multiply(p.q);
        }
        const gaze=refinedLook?(active?THREE.MathUtils.clamp((g.biteTargets[id][0]-botSeats[id-1][0])*.030,-.045,.045):Math.sin(now*.0011+id)*.008):0;
        for(const part of r.eyeParts){part.mesh.position.copy(part.position);if(refinedLook){part.mesh.position.x+=gaze;part.mesh.position.y-=focus*.006;}}
        for(const part of r.brows){part.mesh.position.copy(part.position);part.mesh.scale.copy(part.scale);if(refinedLook){part.mesh.position.x-=part.side*focus*(id===3 ? .055 : .038);part.mesh.position.y-=focus*(id===3 ? .052 : .038);part.mesh.scale.multiplyScalar(1+focus*.10);}}
        if(r.face){r.face.mesh.scale.copy(r.face.scale);if(refinedLook){const puff=(active&&t>.86?Math.max(0,Math.sin(t*65))*.035:0)+focus*.012;r.face.mesh.scale.x*=1+puff;r.face.mesh.scale.y*=1-puff*.45;}}
        asset.updateMatrixWorld(true);
        g.botReach ??= [];
        r.upper.getWorldPosition(p.shoulder);
        const reachOffset = new THREE.Vector3(0, -.065, .23).multiplyScalar(.98).applyQuaternion(asset.getWorldQuaternion(new THREE.Quaternion()));
        reachOffset.add(p.shoulder);
        g.botReach[id - 1] = { x: reachOffset.x, y: reachOffset.y, z: reachOffset.z, radius: r.a + r.b - .025 };
        p.idle.set(-.28, 1.10, .84);
        asset.localToWorld(p.idle);
        p.idle.y = Math.max(p.idle.y, foodSurface(p.idle.x, p.idle.z, g.remaining).height + .12);
        asset.worldToLocal(p.idle);
        p.goal.copy(p.idle);
        let curl = .16, opening = 0;
        if (active) {
            p.target.set(...g.biteTargets[id]);
            asset.worldToLocal(p.target);
            p.target.y += .06;
            p.target.z -= .24;
            if (t < .18) {
                const f = THREE.MathUtils.smoothstep(t / .18, 0, 1);
                p.goal.lerpVectors(p.idle, p.target, f);
                // A quick side-to-side roam while the hand is still in flight, settling as it arrives.
                p.goal.y += Math.sin(f * Math.PI) * .035;
            }
            else if (t < .62) {
                p.goal.copy(p.target);
                curl = t < .38 ? .35 : .65;
            }
            else if (t < .94) {
                const f = THREE.MathUtils.smoothstep((t - .62) / .32, 0, 1);
                p.goal.lerpVectors(p.target, p.mouth, f);
                curl = .55;
                opening = f;
            }
            else {
                const f = THREE.MathUtils.smoothstep((t - .94) / .26, 0, 1);
                p.goal.lerpVectors(p.mouth, p.idle, f);
                curl = .7 * (1 - f);
                opening = (1 - f) * (.35 + .25 * Math.sin(t * 65));
            }
            if (t >= .94 && lastSound.current !== g.bites[id]) {
                lastSound.current = g.bites[id];
                onChew();
            }
        }
        const aim = (bone: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3) => { bone.getWorldQuaternion(p.worldQ); p.axis.set(0, 1, 0).applyQuaternion(p.worldQ); p.direction.subVectors(to, from).normalize(); p.q.setFromUnitVectors(p.axis, p.direction).multiply(p.worldQ); bone.parent!.getWorldQuaternion(p.parentQ); bone.quaternion.copy(p.parentQ.invert().multiply(p.q)); bone.updateWorldMatrix(false, true); };
        asset.localToWorld(p.goal);
        if (active) {
            const flip = THREE.MathUtils.smootherstep(t, refinedLook ? .42 : .48, refinedLook ? .55 : .82) * (1 - THREE.MathUtils.smootherstep(t, .95, 1.05));
            asset.getWorldQuaternion(p.worldQ);
            p.curlQ.setFromAxisAngle(p.axis.set(1, 0, 0), Math.PI / 2 - flip * .35);
            const facing = p.worldQ.clone().multiply(p.curlQ);
            p.curlQ.setFromAxisAngle(p.axis.set(0, 1, 0), flip * Math.PI);
            facing.multiply(p.curlQ);
            const mouth = new THREE.Vector3(0, 1.72, .46);
            asset.localToWorld(mouth);
            const idle = p.idle.clone(); asset.localToWorld(idle);
            botBiteWrist(t, new THREE.Vector3(...g.biteTargets[id]), mouth, idle, facing, p.goal);
        }
        // Check the deformed fingers, not only the wrist, against the food surface.
        for (let pass = 0; pass < 3; pass++) {
            r.upper.getWorldPosition(p.shoulder);
            p.direction.subVectors(p.goal, p.shoulder);
            const { a: upperLength, b: foreLength } = extendArmForReach(r.fore, r.hand, r.a, r.b, p.direction.length(), active);
            const distance = THREE.MathUtils.clamp(p.direction.length(), Math.abs(upperLength - foreLength) + .001, upperLength + foreLength - .001);
            p.direction.normalize();
            p.wrist.copy(p.shoulder).addScaledVector(p.direction, distance);
            // Two-bone IK keeps the elbow connected and limits reach to the arm's length.
            p.pole.set(-1, -.25, .6).transformDirection(asset.matrixWorld);
            p.pole.addScaledVector(p.direction, -p.pole.dot(p.direction)).normalize();
            const along = (upperLength * upperLength - foreLength * foreLength + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
            p.elbow.copy(p.shoulder).addScaledVector(p.direction, along).addScaledVector(p.pole, height);
            aim(r.upper, p.shoulder, p.elbow);
            r.fore.getWorldPosition(p.elbow);
            aim(r.fore, p.elbow, p.wrist);
            // Orient the palm independently of the elbow: down to scoop, then a quick, distinct
            // flip to cup upward toward the mouth (a short window, not a slow continuous roll).
            const flip = active ? THREE.MathUtils.smootherstep(t, refinedLook ? .42 : .48, refinedLook ? .55 : .82) * (1 - THREE.MathUtils.smootherstep(t, .95, 1.05)) : 0;
            asset.getWorldQuaternion(p.worldQ);
            p.curlQ.setFromAxisAngle(p.axis.set(1, 0, 0), Math.PI / 2 - flip * .35);
            p.q.copy(p.worldQ).multiply(p.curlQ);
            p.curlQ.setFromAxisAngle(p.axis.set(0, 1, 0), flip * Math.PI);
            p.q.multiply(p.curlQ);
            // Retain the palm's scoop/roll, but limit wrist flex relative to
            // the forearm. A world-fixed palm otherwise folds sharply at the cuff.
            p.sample.set(0, 1, 0).applyQuaternion(p.q).normalize();
            p.direction.subVectors(p.wrist, p.elbow).normalize();
            const wristBend = p.sample.angleTo(p.direction);
            const relaxedBend = Math.PI / 15;
            if (wristBend > relaxedBend) {
                p.curlQ.setFromUnitVectors(p.sample, p.direction);
                p.curlQ.slerp(new THREE.Quaternion(), relaxedBend / wristBend);
                p.q.premultiply(p.curlQ);
            }
            r.hand.parent!.getWorldQuaternion(p.parentQ);
            r.hand.quaternion.copy(p.parentQ.invert().multiply(p.q));
            for (const finger of r.fingers) {
                p.curlQ.setFromAxisAngle(p.axis.set(1, 0, 0), curl);
                finger.quaternion.copy(r.rest.get(finger)!).multiply(p.curlQ);
            }
            asset.updateMatrixWorld(true);
            let clearance = 0;
            for (const original of r.handMeshes) {
                const mesh = (asset.getObjectByName('PlayerStyleHand_R') as THREE.Mesh | undefined) ?? original;
                if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
                for (let i = 0; i < mesh.geometry.attributes.position.count; i += 24) {
                    mesh.getVertexPosition(i, p.sample);
                    mesh.localToWorld(p.sample);
                    clearance = Math.max(clearance, foodObstacleHeight(p.sample.x, p.sample.z, g.remaining) + .015 - p.sample.y);
                }
            }
            if (clearance < .003)
                break;
            p.goal.y += Math.min(clearance, .35);
        }
        opening=Math.max(opening,refinedLook&&active&&t<.58 ? .22*focus : 0);
        for (const mesh of r.mouths) {
            const dict = mesh.morphTargetDictionary!, weights = mesh.morphTargetInfluences!;
            weights[dict.HALF_OPEN] = opening <= .5 ? opening * 2 : 2 * (1 - opening);
            weights[dict.OPEN] = Math.max(0, opening * 2 - 1);
        }
        // Periodic blink, phase-offset per character so bots don't blink in unison
        // (same formula as Zaid's StudioCharacter.tsx).
        const blinkT = (now / 1000 + id * 1.17) % (4.2 + id * .37), blink = blinkT < .16 ? Math.sin(blinkT / .16 * Math.PI) : 0;
        for (const eye of r.eyes)
            eye.morphTargetInfluences![eye.morphTargetDictionary!.BLINK] = Math.max(blink,refinedLook ? focus*(id===3 ? .34 : .20) : 0);
        asset.updateMatrixWorld(true);
        const leftUpper = asset.getObjectByName('upper_arm_L') as THREE.Bone, leftFore = asset.getObjectByName('forearm_L') as THREE.Bone, leftHand = asset.getObjectByName('hand_L') as THREE.Bone;
        if (leftUpper && leftFore && leftHand) {
            leftUpper.getWorldPosition(p.shoulder);
            // NOTE: an earlier attempt mirrored this offset's X sign for Sami
            // (id 3) to pull his resting hand away from his side-bench cushion.
            // That changed the arm's target direction, and the fixed -90 deg
            // twist applied to leftHand below was only ever tuned for the
            // original (unmirrored) direction - for Sami it rotated the hand
            // out of view entirely, so that direction is untouched here.
            // A second attempt only raised Y (.70->.92), which actually made
            // things worse: raising Y pulls the target *closer* to the
            // shoulder's own height, shortening the reach distance (measured
            // against the real rig: .71 -> .53 out of a .95 max), tightening
            // the fold and reading as the hand pinned against his own torso.
            // The fix that actually lands on the cushion (checked against the
            // real bone lengths and the individual-player-cushion boxes in
            // Majlis.tsx) is to extend the reach outward and down instead:
            // this new target sits at ~96% of max arm extension and lands
            // right at the cushion's own height and footprint, not above it.
            p.goal.set(refinedLook ? .55 : .55, refinedLook ? .45 : .43, refinedLook ? .15 : .04);
            asset.localToWorld(p.goal);
            // Rest beneath the tray's overhang, outside the wooden support.
            if (refinedLook && id === 3) p.goal.set(2.02, .16, -.45);
            p.direction.subVectors(p.goal, p.shoulder);
            const restLengths = extendArmForReach(leftFore, leftHand, r.a, r.b, p.direction.length(), refinedLook && id === 3);
            const d = THREE.MathUtils.clamp(p.direction.length(), Math.abs(restLengths.a - restLengths.b) + .001, restLengths.a + restLengths.b - .001);
            p.direction.normalize();
            p.wrist.copy(p.shoulder).addScaledVector(p.direction, d);
            p.pole.set(1, refinedLook ? -.12 : -.4, refinedLook ? .42 : .1).transformDirection(asset.matrixWorld);
            p.pole.addScaledVector(p.direction, -p.pole.dot(p.direction)).normalize();
            const a = (restLengths.a * restLengths.a - restLengths.b * restLengths.b + d * d) / (2 * d);
            p.elbow.copy(p.shoulder).addScaledVector(p.direction, a).addScaledVector(p.pole, Math.sqrt(Math.max(0, restLengths.a * restLengths.a - a * a)));
            aim(leftUpper, p.shoulder, p.elbow);
            leftFore.getWorldPosition(p.elbow);
            aim(leftFore, p.elbow, p.wrist);
            leftHand.quaternion.copy(r.rest.get(leftHand)!);
            if (refinedLook) { p.q.setFromAxisAngle(p.axis.set(0,1,0),-Math.PI/2); leftHand.quaternion.multiply(p.q); }
            if (refinedLook && id === 3) {
                // Keep a gentle wrist bend; forcing a horizontal palm here
                // makes a right-angle fold against the descending forearm.
                p.q.setFromAxisAngle(p.axis.set(0, 1, 0), -.85);
                p.curlQ.setFromAxisAngle(p.axis.set(1, 0, 0), Math.PI / 2);
                p.q.multiply(p.curlQ);
                p.sample.set(0, 1, 0).applyQuaternion(p.q).normalize();
                p.direction.subVectors(p.wrist, p.elbow).normalize();
                const bend = p.sample.angleTo(p.direction);
                const relaxed = Math.PI / 9;
                if (bend > relaxed) {
                    p.curlQ.setFromUnitVectors(p.sample, p.direction);
                    p.curlQ.slerp(new THREE.Quaternion(), relaxed / bend);
                    p.q.premultiply(p.curlQ);
                }
                leftHand.parent!.getWorldQuaternion(p.parentQ);
                leftHand.quaternion.copy(p.parentQ.invert().multiply(p.q));
            }
            asset.updateMatrixWorld(true);
        }
        if (food.current) {
            food.current.visible = active && t >= .58 && t < .94;
            p.goal.set(0, .23, .07);
            r.hand.localToWorld(p.goal);
            food.current.position.copy(p.goal);
        }
    }, -.1);
    if (!asset)
        return <>{fallback}</>;
    return <group name={`character-${id}-blender`}><primitive object={asset}/>{refinedLook&&<ChibiFeet id={id}/>}<CharacterHands scene={asset} id={id} game={game}/><group ref={food} visible={false}><mesh scale={[.085, .065, .085]}><icosahedronGeometry args={[1, 2]}/><meshStandardMaterial color="#eac45e" roughness={.9}/></mesh>{Array.from({ length: 20 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * .075, Math.sin(i * 1.7) * .05, Math.cos(i * 2.4) * .075]} scale={[.016, .012, .023]}><sphereGeometry args={[1, 6, 4]}/><meshStandardMaterial color="#edcb66"/></mesh>)}</group></group>;
}
