// Browsers refuse audible autoplay until the visitor has clicked, tapped or
// pressed a key on the page. That is exactly the situation when the site first
// opens, so the welcome voice and the restaurant ambience can't simply be
// started on load and hoped for.
//
// `playWhenAllowed` makes the attempt straight away (it just works for
// returning visitors the browser already trusts) and, if the browser says no,
// tries again on the visitor's first gesture, and keeps doing so until the
// attempt goes through.
//
// The retry listens for `click` on the window rather than `pointerdown`. A
// click reaches the window only after React has run the button's own onClick,
// so a click that starts the round can cancel a pending welcome before it ever
// sounds, instead of the welcome starting and being cut off a moment later.

export type PlayAttempt = () => Promise<unknown> | void;

const GESTURES = ['click', 'keydown'] as const;

/** Runs `attempt`; if the browser blocks it, re-runs it on the visitor's next
 *  gesture until it isn't blocked. Returns a function that gives up. */
export function playWhenAllowed(
  attempt: PlayAttempt,
  target: EventTarget | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  if (!target) return () => {};
  let cancelled = false;

  const arm = () => GESTURES.forEach((name) => target.addEventListener(name, run));
  const disarm = () => GESTURES.forEach((name) => target.removeEventListener(name, run));

  function run() {
    disarm();
    if (cancelled) return;
    let started: Promise<unknown>;
    try {
      started = Promise.resolve(attempt());
    } catch {
      return; // Audio is optional.
    }
    started.catch((error: unknown) => {
      // Only "the browser wants a gesture first" is worth waiting out. A
      // decode error or a cancelled play would just fail again.
      if (!cancelled && (error as { name?: string } | undefined)?.name === 'NotAllowedError') arm();
    });
  }

  run();
  return () => {
    cancelled = true;
    disarm();
  };
}
