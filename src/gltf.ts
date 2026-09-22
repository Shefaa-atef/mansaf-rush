import { LoaderUtils } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { prefetchedModel } from './sceneAssets';

/** Reads a model from the bytes sceneAssets.ts already started downloading, so it is never fetched twice. */
class SceneGLTFLoader extends GLTFLoader {
  override load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
    const prefetched = prefetchedModel(url);
    if (!prefetched) { super.load(url, onLoad, onProgress, onError); return; }
    prefetched.then(
      (bytes) => this.parse(bytes, LoaderUtils.extractUrlBase(url), onLoad, (error) => onError?.(error)),
      () => super.load(url, onLoad, onProgress, onError),
    );
  }
}

/**
 * A GLTFLoader that can read the EXT_meshopt_compression files in src/assets/web/
 * (written by tools/optimize-assets.mjs). Uncompressed GLBs load exactly as before.
 * The decoder is a ~25 KB WASM blob that three bundles inside its own module.
 */
export function createGLTFLoader() {
  return new SceneGLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
