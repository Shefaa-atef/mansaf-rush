// Lightweight synthesized UI/result sound effects — no audio files, just the
// Web Audio oscillator approach already used for bite sounds in
// PlayerHand.tsx and Characters.tsx. Kept in its own module so every button
// click and the win/lose stingers share one mute flag driven by the pause
// menu's "Sound" toggle.

let ctx: AudioContext | undefined;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    /* Audio is optional. */
  }
}

// Unlock on the very first user gesture (anywhere on the page) so the
// AudioContext has already resumed by the time a button's own click sound
// fires, instead of racing resume() inside that same click.
if (typeof window !== 'undefined') {
  const unlockOnce = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('keydown', unlockOnce);
}

function tone(
  freq: number,
  start: number,
  duration: number,
  gain: number,
  type: OscillatorType,
  glideTo?: number
) {
  if (!ctx) return;
  const o = ctx.createOscillator(),
    v = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo !== undefined) o.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
  v.gain.setValueAtTime(gain, start);
  v.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  o.connect(v);
  v.connect(ctx.destination);
  o.start(start);
  o.stop(start + duration + 0.02);
}

/** Soft tick for secondary/navigation buttons (back, next, menu, dots...). */
export function playClick() {
  unlockAudio();
  if (muted || !ctx) return;
  tone(660, ctx.currentTime, 0.055, 0.05, 'triangle', 480);
}

/** Slightly richer two-note blip for committing actions (start, resume, play again). */
export function playConfirm() {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  tone(494, t, 0.06, 0.045, 'triangle');
  tone(740, t + 0.06, 0.11, 0.05, 'triangle');
}

/** Downward blip for closing a panel. */
export function playClose() {
  unlockAudio();
  if (muted || !ctx) return;
  tone(420, ctx.currentTime, 0.08, 0.04, 'triangle', 260);
}

/** Triumphant rising fanfare for a player win. */
export function playWin() {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime,
    notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, t + i * 0.11, 0.32, 0.065, 'triangle'));
  tone(1568, t + notes.length * 0.11 + 0.02, 0.55, 0.045, 'sine'); // sparkle top note
}

/** Descending stinger for a loss. */
export function playLose() {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime,
    notes = [392, 349.23, 293.66, 261.63]; // G4 F4 D4 C4
  notes.forEach((f, i) => tone(f, t + i * 0.15, 0.24, 0.055, 'sawtooth', f * 0.9));
}
