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

// Built file sizes, in the same order as modelUrls. Used only as the loading bar's starting guess
// for each file's total, before that response's real Content-Length is known, so the bar has
// something believable to show from its very first tick instead of sitting at 0%. A real
// Content-Length always overrides this once the response headers arrive.
const APPROX_BYTES = [3_618_376, 2_062_756, 1_801_228, 1_258_040];

const pending = new Map<string, Promise<ArrayBuffer>>();

/** Bytes received / bytes expected for a model currently being prefetched. */
const progress = new Map<string, { loaded: number; total: number }>();
const listeners = new Set<() => void>();
let notifyScheduled = false;

function notify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn: () => void) => setTimeout(fn, 16);
  raf(() => {
    notifyScheduled = false;
    listeners.forEach((fn) => fn());
  });
}

/**
 * Every prefetched model's bytes combined into one 0 to 1 figure, for a loading screen. 0 once
 * nothing has been requested yet (there is nothing to divide), 1 once every requested model has
 * fully arrived.
 */
export function sceneLoadFraction(): number {
  let loaded = 0, total = 0;
  for (const entry of progress.values()) { loaded += entry.loaded; total += entry.total; }
  return total > 0 ? Math.min(1, loaded / total) : 0;
}

/** Called (rAF-throttled) every time any prefetch receives more bytes. Returns an unsubscribe function. */
export function onSceneLoadProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function prefetchSceneAssets() {
  if (typeof fetch !== 'function') return;
  modelUrls.forEach((url, i) => {
    if (pending.has(url)) return;
    progress.set(url, { loaded: 0, total: APPROX_BYTES[i] ?? 2_000_000 });
    const request = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const entry = progress.get(url)!;
      const knownTotal = Number(response.headers.get('content-length'));
      if (knownTotal > 0) entry.total = knownTotal;

      const reader = response.body?.getReader();
      if (!reader) {
        // No streaming reader available: fall back to one lump read, with a single jump in the bar.
        const buffer = await response.arrayBuffer();
        entry.loaded = entry.total = buffer.byteLength;
        notify();
        return buffer;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        entry.loaded = received;
        if (received > entry.total) entry.total = received; // a short guess must never cap the bar
        notify();
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return bytes.buffer;
    });
    // A failed prefetch is forgotten, so the loader falls back to its own request and reports any real error.
    request.catch(() => { pending.delete(url); progress.delete(url); notify(); });
    pending.set(url, request);
  });
}

/** The in-flight or finished prefetch for `url`, if there is one. The bytes are only ever read. */
export const prefetchedModel = (url: string) => pending.get(url);
