#!/usr/bin/env node
/**
 * Builds the web-optimised copies of the heavy game assets into src/assets/web/.
 *
 * The originals in src/assets/ are NEVER modified. They stay as the source art
 * (there is no .blend source for the GLBs, so they must be kept). The game only
 * imports the smaller copies produced here.
 *
 *   npm i --no-save sharp ffmpeg-static @gltf-transform/core @gltf-transform/extensions \
 *                   @gltf-transform/functions meshoptimizer
 *   node tools/optimize-assets.mjs            # everything
 *   node tools/optimize-assets.mjs images     # or: audio | models
 *
 * What it does
 *   images  PNG -> WebP, resized to what the UI actually displays (2x for retina).
 *   audio   the 63-minute ambience file -> a 2-minute seamless mono loop.
 *   models  GLB -> EXT_meshopt_compression (lossless) plus mantissa truncation on
 *           attributes the game code never reads back (normals, UVs, skin weights,
 *           morph deltas). Vertex positions of the characters stay bit-exact
 *           because character*.ts / CharacterSleeves rewrite them in local space.
 *           The player arm additionally drops the 6 pose morph targets that no
 *           game code references (see KEEP_ARM_POSES) and reorders vertices for
 *           locality, which is what makes the dense 47k-vertex hand compress.
 *           Meshopt-compressed files need setMeshoptDecoder() on the GLTFLoader;
 *           see src/gltf.ts.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src/assets');
const OUT = path.join(SRC, 'web');
fs.mkdirSync(OUT, { recursive: true });

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const which = process.argv[2] ?? 'all';

/* ------------------------------------------------------------------ images */

const IMAGES = [
  // Logo is shown at most ~330 CSS px wide. Keeps its transparency.
  { src: 'Mansaf Rush Arabian Game Logo.png', out: 'mansaf-rush-logo.webp', width: 720, quality: 86 },
  // Portraits are 46 px avatars and scoreboard thumbnails.
  { src: 'me.png', out: 'portrait-me.webp', width: 256, quality: 82 },
  { src: 'zaid.png', out: 'portrait-zaid.webp', width: 256, quality: 82 },
  { src: 'omar.png', out: 'portrait-omar.webp', width: 256, quality: 82 },
  { src: 'sami.png', out: 'portrait-sami.webp', width: 256, quality: 82 },
  // Result art sits in a column at most 380 px wide.
  { src: 'win.png', out: 'result-win.webp', width: 768, quality: 82 },
  { src: 'lose.png', out: 'result-lose.webp', width: 768, quality: 82 },
  // How-to-play cards; the scoop card is also the blurred lobby backdrop.
  { src: 'steps/جمع.png', out: 'step-gather.webp', width: 720, quality: 82 },
  { src: 'steps/دحبر.png', out: 'step-roll.webp', width: 720, quality: 82 },
  { src: 'steps/القم.png', out: 'step-eat.webp', width: 720, quality: 82 },
  // Tiling textures on the majlis cushions and rugs.
  { src: 'pattern 1.png', out: 'pattern-1.webp', width: 1024, quality: 84 },
  { src: 'pattern 2.png', out: 'pattern-2.webp', width: 512, quality: 84 },
  // Tab icon: was a 934 KB PNG.
  { src: 'header icon.png', out: 'favicon.png', width: 128, png: true },
];

async function images() {
  const { default: sharp } = await import('sharp');
  for (const item of IMAGES) {
    const input = path.join(SRC, item.src);
    const output = path.join(OUT, item.out);
    let pipeline = sharp(input).resize({ width: item.width, kernel: 'lanczos3', withoutEnlargement: true });
    pipeline = item.png
      ? pipeline.png({ compressionLevel: 9, palette: true, quality: 90 })
      : pipeline.webp({ quality: item.quality, effort: 6, alphaQuality: 100, smartSubsample: true });
    await pipeline.toFile(output);
    console.log(`  ${item.out.padEnd(24)} ${kb(fs.statSync(input).size).padStart(8)} -> ${kb(fs.statSync(output).size).padStart(7)}`);
  }
}

/* ------------------------------------------------------------------- audio */

// The game always starts the ambience at 0:00 and only ever heard the opening
// minutes of the hour-long file, which is steady room chatter with no fade-in.
const AMBIENT = { from: 0, seconds: 122, crossfade: 2, bitrate: '56k', rate: 32000 };

async function audio() {
  const { default: ffmpeg } = await import('ffmpeg-static');
  const input = path.join(SRC, 'sounds/ambient-restaurant.mp3');
  const output = path.join(OUT, 'ambient-restaurant-loop.mp3');
  const { from, seconds, crossfade: x, bitrate, rate } = AMBIENT;
  const run = (args) => {
    const result = spawnSync(ffmpeg, ['-v', 'error', '-y', ...args], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr}`);
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mansaf-ambient-'));
  try {
    // main = [from+x, from+seconds], head = [from, from+x]. Cross-fading the last x seconds of
    // main into head makes the final sample flow straight into the first, so audio.loop has no seam.
    // (Two separate inputs: acrossfade stalls when both halves come out of one decoder graph.)
    const mono = ['-ac', '1', '-ar', String(rate)];
    run(['-ss', String(from + x), '-t', String(seconds - x), '-i', input, ...mono, path.join(tmp, 'main.wav')]);
    run(['-ss', String(from), '-t', String(x), '-i', input, ...mono, path.join(tmp, 'head.wav')]);
    run([
      '-i', path.join(tmp, 'main.wav'), '-i', path.join(tmp, 'head.wav'),
      '-filter_complex', `acrossfade=d=${x}:c1=qsin:c2=qsin`,
      '-c:a', 'libmp3lame', '-b:a', bitrate, output,
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`  ${path.basename(output).padEnd(30)} ${mb(fs.statSync(input).size).padStart(9)} -> ${kb(fs.statSync(output).size).padStart(7)}`);
}

/* ------------------------------------------------------------------ models */

// Pose morphs the game drives by name (playerArmMotion.ts + CharacterHands.tsx). The GLB skin is
// always driven by explicit weights, so GATHER / ROLL_LEFT / ROLL_RIGHT / EAT / RELEASE / EAT_PINCH
// never receive an influence. Dropping them cuts the hand's morph data (and the GPU morph
// textures, cloned once per bot hand) almost in half. Add a name here to keep it.
const KEEP_ARM_POSES = ['CUP', 'HOLD_LOKMA', 'REACH', 'SCOOP_START', 'SCOOP_CLOSE', 'KNEAD_A', 'KNEAD_B'];

/** Zero the low `drop` mantissa bits of every float (round to nearest). Stays a plain float32. */
function truncateFloats(array, drop) {
  if (!drop) return;
  const u = new Uint32Array(array.buffer, array.byteOffset, array.length);
  const mask = (0xffffffff << drop) >>> 0;
  const half = 1 << (drop - 1);
  for (let i = 0; i < u.length; i++) u[i] = ((u[i] + half) & mask) >>> 0;
}

const MODELS = [
  {
    src: 'mansaf-player-arm-v6.glb',
    reorder: true,
    keepMorphs: KEEP_ARM_POSES,
    // morph deltas: ~2^-11 relative (<=6e-5 units); morph normal deltas ~2^-8; base normals/UVs 2^-15.
    drop: { morphPosition: 12, morphNormal: 16, normal: 8, uv: 8, weights: 8 },
  },
  ...['zaid', 'omar', 'sami'].map((name) => ({
    src: `${name}-chibi-polished.glb`,
    reorder: false,
    drop: { morphPosition: 12, morphNormal: 12, normal: 8, uv: 8, weights: 8 },
  })),
];

async function models() {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS, EXTMeshoptCompression } = await import('@gltf-transform/extensions');
  const { reorder, prune } = await import('@gltf-transform/functions');
  const { MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer');
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const makeIO = () => new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  for (const model of MODELS) {
    const input = path.join(SRC, model.src);
    const output = path.join(OUT, model.src);
    const io = makeIO();
    const doc = await io.read(input);

    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (!model.keepMorphs) continue;
        const targets = prim.listTargets();
        if (!targets.length) continue;
        const weights = mesh.getWeights();
        const kept = [];
        targets.forEach((target, index) => {
          if (model.keepMorphs.includes(target.getName())) kept.push(weights[index] ?? 0);
          else { prim.removeTarget(target); target.dispose(); }
        });
        mesh.setWeights(kept);
      }
    }
    // A dropped target's accessors stay in the file until nothing references them; pruning them frees the bytes.
    // Accessors only: the default also strips UV sets it thinks are unused, and the attribute set must not change.
    if (model.keepMorphs) await doc.transform(prune({ propertyTypes: ['Accessor'], keepAttributes: true, keepIndices: true, keepLeaves: true, keepExtras: true }));
    if (model.reorder) await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));

    const seen = new Set();
    const shave = (accessor, bits) => { if (accessor && !seen.has(accessor)) { seen.add(accessor); truncateFloats(accessor.getArray(), bits); } };
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        for (const semantic of prim.listSemantics()) {
          const bits = semantic === 'NORMAL' ? model.drop.normal
            : semantic.startsWith('TEXCOORD') ? model.drop.uv
            : semantic.startsWith('WEIGHTS') ? model.drop.weights : 0;
          shave(prim.getAttribute(semantic), bits); // POSITION and JOINTS stay exact
        }
        for (const target of prim.listTargets()) {
          shave(target.getAttribute('POSITION'), model.drop.morphPosition);
          shave(target.getAttribute('NORMAL'), model.drop.morphNormal);
        }
      }
    }
    doc.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    await io.write(output, doc);

    verifyModel(await makeIO().read(input), await makeIO().read(output), model);
    console.log(`  ${model.src.padEnd(30)} ${mb(fs.statSync(input).size).padStart(9)} -> ${mb(fs.statSync(output).size).padStart(8)}`);
  }
}

/**
 * Fails loudly if the optimised file is not the same model. Vertices are matched by exact
 * position (ties broken by UV) because the arm is reordered. Then every triangle, base
 * normal, UV and surviving morph delta must agree within the truncation tolerance.
 */
function verifyModel(before, after, model) {
  const primitives = (doc) => new Map(doc.getRoot().listMeshes().flatMap((mesh) =>
    mesh.listPrimitives().map((prim, i) => [`${mesh.getName()}#${i}`, prim])));
  const a = primitives(before), b = primitives(after);
  if (a.size !== b.size) throw new Error(`${model.src}: primitive count changed`);
  const t1 = [0, 0, 0], t2 = [0, 0, 0], u1 = [0, 0], u2 = [0, 0];
  const maxDiff = (x, y) => Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
  let worstMorph = 0, worstMorphNormal = 0, worstNormal = 0, worstUv = 0;

  for (const [id, src] of a) {
    const dst = b.get(id);
    const label = `${model.src}/${id}`;
    if (!dst) throw new Error(`${label}: missing`);
    const count = src.getAttribute('POSITION').getCount();
    if (dst.getAttribute('POSITION').getCount() !== count) throw new Error(`${label}: vertex count changed`);
    const idxA = src.getIndices().getArray(), idxB = dst.getIndices().getArray();
    if (idxA.length !== idxB.length) throw new Error(`${label}: index count changed`);

    const posA = src.getAttribute('POSITION'), posB = dst.getAttribute('POSITION');
    const uvA = src.getAttribute('TEXCOORD_0'), uvB = dst.getAttribute('TEXCOORD_0');
    const nrmA = src.getAttribute('NORMAL'), nrmB = dst.getAttribute('NORMAL');

    // orig vertex i -> new vertex map[i]
    const map = new Int32Array(count);
    if (model.reorder) {
      const byPosition = new Map();
      for (let j = 0; j < count; j++) {
        const k = posB.getElement(j, t2).join(',');
        (byPosition.get(k) ?? byPosition.set(k, []).get(k)).push(j);
      }
      const taken = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        const list = byPosition.get(posA.getElement(i, t1).join(','));
        if (!list) throw new Error(`${label}: vertex ${i} vanished`);
        let best = -1, bestDistance = Infinity;
        for (const j of list) {
          if (taken[j]) continue;
          const d = uvA ? Math.hypot(...uvA.getElement(i, u1).map((v, n) => v - uvB.getElement(j, u2)[n])) : 0;
          if (d < bestDistance) { bestDistance = d; best = j; }
        }
        if (best < 0) throw new Error(`${label}: vertex ${i} has no unique match`);
        taken[best] = 1; map[i] = best;
      }
    } else {
      for (let i = 0; i < count; i++) {
        map[i] = i;
        if (maxDiff(posA.getElement(i, t1), posB.getElement(i, t2)) !== 0) throw new Error(`${label}: position ${i} changed`);
      }
    }

    // Same triangles, same winding (compare as rotations-normalised strings).
    const tri = (x, y, z) => (x <= y && x <= z ? [x, y, z] : y <= z ? [y, z, x] : [z, x, y]).join(',');
    const counts = new Map();
    for (let n = 0; n < idxB.length; n += 3) {
      const k = tri(idxB[n], idxB[n + 1], idxB[n + 2]);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (let n = 0; n < idxA.length; n += 3) {
      const k = tri(map[idxA[n]], map[idxA[n + 1]], map[idxA[n + 2]]);
      const left = counts.get(k);
      if (!left) throw new Error(`${label}: triangle ${n / 3} is missing or altered`);
      counts.set(k, left - 1);
    }

    for (let i = 0; i < count; i++) {
      const j = map[i];
      if (nrmA) worstNormal = Math.max(worstNormal, maxDiff(nrmA.getElement(i, t1), nrmB.getElement(j, t2)));
      if (uvA) worstUv = Math.max(worstUv, Math.hypot(...uvA.getElement(i, u1).map((v, n) => v - uvB.getElement(j, u2)[n])));
    }

    const wanted = src.listTargets().filter((t) => !model.keepMorphs || model.keepMorphs.includes(t.getName()));
    const afterTargets = new Map(dst.listTargets().map((t) => [t.getName(), t]));
    if (afterTargets.size !== wanted.length) throw new Error(`${label}: ${afterTargets.size} morph targets, expected ${wanted.length}`);
    for (const target of wanted) {
      const other = afterTargets.get(target.getName());
      if (!other) throw new Error(`${label}: morph ${target.getName()} missing`);
      for (let i = 0; i < count; i++) {
        const j = map[i];
        worstMorph = Math.max(worstMorph, maxDiff(target.getAttribute('POSITION').getElement(i, t1), other.getAttribute('POSITION').getElement(j, t2)));
        if (target.getAttribute('NORMAL')) worstMorphNormal = Math.max(worstMorphNormal, maxDiff(target.getAttribute('NORMAL').getElement(i, t1), other.getAttribute('NORMAL').getElement(j, t2)));
      }
    }
  }
  if (worstMorph > 5e-4 || worstMorphNormal > 2e-2 || worstNormal > 1e-3 || worstUv > 1e-3) {
    throw new Error(`${model.src}: precision loss too large (morph ${worstMorph}, morph normal ${worstMorphNormal}, normal ${worstNormal}, uv ${worstUv})`);
  }
  console.log(`    verified ${a.size} primitives: triangles identical; worst error morph ${worstMorph.toExponential(1)}, morph normal ${worstMorphNormal.toExponential(1)}, normal ${worstNormal.toExponential(1)}, uv ${worstUv.toExponential(1)}`);
}

/* -------------------------------------------------------------------- main */

console.log(`Writing optimised assets to ${path.relative(ROOT, OUT)}/`);
if (which === 'all' || which === 'images') { console.log('images'); await images(); }
if (which === 'all' || which === 'audio') { console.log('audio'); await audio(); }
if (which === 'all' || which === 'models') { console.log('models'); await models(); }
