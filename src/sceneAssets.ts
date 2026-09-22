// The models the 3D scene loads. main.tsx requests them the moment it requests the scene chunk,
// so these downloads overlap with the chunk's download and evaluation instead of starting only
// after the scene has mounted. The loaders in gltf.ts then take the bytes from here, so every
// model is fetched exactly once whatever the browser's cache does (private windows have a tiny
// one). Keep this list in step with the models the scene loads.
const modelUrls = [
  new URL('./assets/web/mansaf-player-arm-v6.glb', import.meta.url).href,
  new URL('./assets/web/zaid-chibi-polished.glb', import.meta.url).href,
  new URL('./assets/web/omar-chibi-polished.glb', import.meta.url).href,
  new URL('./assets/web/sami-chibi-polished.glb', import.meta.url).href,
];

const pending = new Map<string, Promise<ArrayBuffer>>();

export function prefetchSceneAssets() {
  if (typeof fetch !== 'function') return;
  for (const url of modelUrls) {
    if (pending.has(url)) continue;
    const request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.arrayBuffer();
    });
    // A failed prefetch is forgotten, so the loader falls back to its own request and reports any real error.
    request.catch(() => pending.delete(url));
    pending.set(url, request);
  }
}

/** The in-flight or finished prefetch for `url`, if there is one. The bytes are only ever read. */
export const prefetchedModel = (url: string) => pending.get(url);
