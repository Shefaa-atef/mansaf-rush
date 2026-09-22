// The tray is rebuilt incrementally (only what a change can reach) and looked up through shortcuts.
// Every shortcut must give exactly what the plain, slow way would. MansafPlatter is a .tsx module, so
// it is bundled on the fly with esbuild (already here for vite) and then imported.
import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import * as THREE from 'three';

const root = fileURLToPath(new URL('..', import.meta.url));
let M;
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mansaf-tray-'));
  const entry = join(dir, 'entry.ts'), out = join(dir, 'tray.mjs');
  const src = (name) => join(root, 'src', name).split(String.fromCharCode(92)).join('/');
  writeFileSync(entry, `export * from '${src('MansafPlatter.tsx')}';\nexport { platterFood, foodPatches } from '${src('platterFood.ts')}';\n`);
  buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.tsx': 'tsx' }, outfile: out, logLevel: 'error', nodePaths: [join(root, 'node_modules')] });
  M = await import(pathToFileURL(out).href);
});

let seed = 2024; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const close = (a, b, tol) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > tol) return false; return true; };
const eat = (times) => { let total = 0; for (let k = 0; k < times; k++) total += M.platterFood.consume((rnd() * 2 - 1) * 1.9, (rnd() * 2 - 1) * 1.9, .4 + rnd() * 3.5); return total; };

test('the rice patches a tray keeps between changes are never stale', () => {
  M.platterFood.reset();
  let cache = new Map(), eaten = 0, reused = 0, total = 0;
  for (let step = 0; step < 24; step++) {
    eaten += eat(1);
    const remaining = Math.max(0, 100 - eaten), result = M.updateRiceGeometries(cache, remaining);
    result.geometries.forEach((geometry, i) => {
      assert.equal(geometry !== null, M.platterFood.riceAvailable(i), `patch ${i} is drawn exactly while it has rice`);
      if (!geometry) return;
      const fresh = M.ricePatchGeometry(i, remaining);
      assert.ok(close(geometry.attributes.position.array, fresh.attributes.position.array, 1e-9), `step ${step} patch ${i} shape`);
      assert.ok(close(geometry.attributes.normal.array, fresh.attributes.normal.array, 1e-9), `step ${step} patch ${i} shading`);
      total++; if (cache.get(i)?.geometry === geometry) reused++;
      fresh.dispose();
    });
    cache = result.cache;
  }
  assert.ok(reused > total * .4, `most patch shapes should be reused, got ${reused} of ${total}`);
});

test('the fast grain layout equals placing every grain one by one', () => {
  M.platterFood.reset();
  let eaten = 0;
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  for (let step = 0; step < 6; step++) {
    eaten += eat(3);
    const remaining = Math.max(0, 100 - eaten);
    for (const [particles, isTaken] of [[M.grains, undefined], [M.almondParticles, (i) => i % 5 === 0]]) {
      const matrices = new Float32Array(particles.length * 16), colors = new Float32Array(particles.length * 3);
      const count = M.fillInstances(particles, remaining, true, isTaken, matrices, colors);
      const want = { matrices: [], colors: [] };
      particles.forEach((p, index) => {
        if (!M.platterFood.riceAvailable(p.patch) || isTaken?.(index)) return;
        dummy.position.set(...p.position); dummy.scale.set(...p.scale); dummy.rotation.set(...p.rotation); dummy.updateMatrix();
        dummy.position.y += M.riceHeight(p.position[0], p.position[2], remaining, p.patch) - M.fullRiceHeight(p.position[0], p.position[2]);
        dummy.updateMatrix();
        want.matrices.push(...dummy.matrix.elements); want.colors.push(...color.set(p.refinedColor ? p.refinedColor : p.color).toArray());
      });
      assert.equal(count * 16, want.matrices.length);
      assert.ok(close(matrices.subarray(0, count * 16), want.matrices, 2e-6), 'matrices');
      assert.ok(close(colors.subarray(0, count * 3), want.colors, 1e-6), 'colours');
    }
  }
});

test('the sauce is only rebuilt when it could have changed: an unchanged key means an unchanged sauce', () => {
  let unchanged = 0;
  for (let trial = 0; trial < 3; trial++) {
    M.platterFood.reset();
    let eaten = 0, key = M.jameedKey(100), sauce = M.buildJameedGeometries(100);
    for (let step = 0; step < 12; step++) {
      eaten += eat(1);
      if (rnd() < .3) M.platterFood.takeMeat(Math.floor(rnd() * 9));
      const remaining = Math.max(0, 100 - eaten), next = M.buildJameedGeometries(remaining), nextKey = M.jameedKey(remaining);
      if (nextKey === key) {
        unchanged++;
        assert.equal(next.length, sauce.length, 'same key, same number of pieces');
        next.forEach((g, i) => assert.ok(close(g.attributes.position.array, sauce[i].attributes.position.array, 1e-9), `same key but piece ${i} changed`));
      }
      key = nextKey; sauce = next;
    }
  }
  assert.ok(unchanged > 0, 'the test must see the key stay put at least once');
});

test('the cheap ceiling is never below the real height of the food', () => {
  for (let trial = 0; trial < 20; trial++) {
    M.platterFood.reset();
    const remaining = Math.max(0, 100 - eat(Math.floor(rnd() * 25)));
    if (rnd() < .4) M.platterFood.takeMeat(Math.floor(rnd() * 9));
    for (let k = 0; k < 1500; k++) {
      // half the points sit around the lamb, where the ceiling has to allow for it
      const x = k % 2 ? (rnd() * 2 - 1) * .9 : (rnd() * 2 - 1) * 2.4, z = k % 2 ? 1.6 * rnd() - .1 : (rnd() * 2 - 1) * 2.4;
      const height = M.foodObstacleHeight(x, z, remaining), ceiling = M.foodTopBound(x, z);
      assert.ok(height === -Infinity ? ceiling === -Infinity : ceiling >= height, `ceiling ${ceiling} below the food ${height} at ${x}, ${z}`);
    }
  }
});

test('a piece of lamb that was taken is no longer something a hand must stay above', () => {
  M.platterFood.reset();
  const spot = [0.36, 0.99];    // on top of one of the lamb pieces
  const before = M.foodObstacleHeight(spot[0], spot[1], 100);
  const piece = M.meatUnder(spot[0], spot[1]);
  assert.ok(piece >= 0 && before > 1.1, 'the lamb stands above the rice');
  M.platterFood.takeMeat(piece);
  assert.ok(M.foodObstacleHeight(spot[0], spot[1], 100) < before - .1, 'once taken, the height drops back to the rice');
});
