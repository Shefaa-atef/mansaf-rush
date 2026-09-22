// Lightweight synthesized UI/result sound effects — no audio files, just the
// Web Audio oscillator approach already used for bite sounds in
// PlayerHand.tsx and Characters.tsx. Kept in its own module so every button
// click and the win/lose stingers share one mute flag driven by the pause
// menu's "Sound" toggle.

let ctx: AudioContext | undefined;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
  activeVoices.forEach((el) => (el.volume = value ? 0 : VOICE_VOLUME));
  applyAmbientVolume();
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

/** A short, textured noise burst (band-passed) for crunch/bite impacts. */
function noiseBurst(start: number, duration: number, gain: number, freq: number) {
  if (!ctx) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, start);
  filter.Q.value = 0.8;
  const v = ctx.createGain();
  v.gain.setValueAtTime(gain, start);
  v.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter);
  filter.connect(v);
  v.connect(ctx.destination);
  src.start(start);
  src.stop(start + duration + 0.01);
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

/** Upward blip for opening a panel — the open-side counterpart to playClose(). */
export function playOpen() {
  unlockAudio();
  if (muted || !ctx) return;
  tone(420, ctx.currentTime, 0.07, 0.04, 'triangle', 640);
}

/** Two-note toggle switch: rises for "on", falls for "off". */
export function playToggle(on: boolean) {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  if (on) {
    tone(520, t, 0.05, 0.045, 'triangle');
    tone(780, t + 0.05, 0.08, 0.05, 'triangle');
  } else {
    tone(780, t, 0.05, 0.04, 'triangle');
    tone(480, t + 0.05, 0.08, 0.035, 'triangle');
  }
}

/** A bright two-note chime: the lokma just became a round circle, so stop rolling. */
export function playRoundLokma() {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  tone(660, t, 0.09, 0.05, 'triangle');
  tone(990, t + 0.08, 0.18, 0.055, 'triangle');
}

/** A soft low thud: the lokma was rolled too long and got squashed. */
export function playSquashed() {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  tone(220, t, 0.16, 0.06, 'sine', 110);
  noiseBurst(t, 0.09, 0.05, 300);
}

/** Reset whoosh for restarting/replaying a round. */
export function playRestart() {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  tone(320, t, 0.09, 0.05, 'sawtooth', 720);
  tone(720, t + 0.08, 0.1, 0.045, 'triangle', 520);
}

/** Bite/chomp sound for the moment a lokma reaches a mouth — player or bot. */
export function playEat(variant: 'player' | 'bot' = 'player') {
  unlockAudio();
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  if (variant === 'player') {
    noiseBurst(t, 0.05, 0.05, 2200);
    tone(210, t, 0.09, 0.07, 'triangle', 100);
    tone(175, t + 0.08, 0.08, 0.05, 'triangle', 90);
  } else {
    // A touch softer and lower than the player's bite, as if farther from camera.
    noiseBurst(t, 0.045, 0.03, 1600);
    tone(150, t, 0.12, 0.05, 'triangle', 70);
  }
  playEatBiteSample(variant);
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

// ---------------------------------------------------------------------------
// Recorded voice lines + quiet restaurant ambience.
//
// These are real actor lines (not synthesized) layered on top of the
// oscillator sfx above. Which one plays when:
//
//   site opens ............ Zaid "we're inviting you" or Sami "we're cooking
//                           mansaf" (one of the two, at random)
//   round starts .......... Zaid, Omar and Sami say "bismillah" together
//                           (omar-say-bismillah.mp3 is deliberately not used)
//   a while into the round  Zaid or Sami: "gather it, roll it, take a bite"
//   the player wins ....... one of the old bot taunts (Omar, Sami or Zaid)
//   the player loses ...... Sami: "that's not how Jordanian mansaf is eaten"
//
// The restaurant ambience runs underneath all of it for the whole visit. All
// of it respects the same mute flag as the rest of this module.
// ---------------------------------------------------------------------------
// A 2-minute seamless loop (was a 63-minute, 54 MB file); see tools/optimize-assets.mjs.
import ambientUrl from './assets/web/ambient-restaurant-loop.mp3';
import eatBiteUrl from './assets/sounds/eat-bite.mp3';
import omarBismillahUrl from './assets/sounds/omar-bismillah.mp3';
import omarLoseTauntUrl from './assets/sounds/omar-lose-taunt.mp3';
import zaidBismillahUrl from './assets/sounds/zaid-bismillah.mp3';
import zaidGatherTipUrl from './assets/sounds/zaid-gather-tip.mp3';
import zaidInviteLunchUrl from './assets/sounds/zaid-invite-lunch.mp3';
import zaidLoseShawarmaUrl from './assets/sounds/zaid-lose-shawarma.mp3';
import samiBismillahUrl from './assets/sounds/sami-bismillah.mp3';
import samiCookingMansafUrl from './assets/sounds/sami-cooking-mansaf.mp3';
import samiGatherTipUrl from './assets/sounds/sami-gather-tip.mp3';
import samiLoseTauntUrl from './assets/sounds/sami-lose-taunt.mp3';
import samiNotHowYouEatUrl from './assets/sounds/sami-not-how-you-eat.mp3';
import { playWhenAllowed } from './autoplayGate';

const VOICE_VOLUME = 0.9;
// Deliberately subtle — this is background restaurant hum, not a soundtrack.
const AMBIENT_VOLUME = 0.07;
// The recorded bite/chew texture layered under every playEat() — kept low
// overall since it fires on nearly every bite, and quieter still for bots
// ("other users") than for the player's own bite, which sits a little
// higher but is still far from loud.
const EAT_BITE_VOLUME = { player: 0.16, bot: 0.08 };

/** Plays the real recorded bite sample on top of the synthesized crunch in
 *  playEat(). Independent of the voice-line ducking system — this is a
 *  short, frequent one-shot, not dialogue. */
function playEatBiteSample(variant: 'player' | 'bot') {
  if (muted) return;
  try {
    const el = new Audio(eatBiteUrl);
    el.volume = EAT_BITE_VOLUME[variant];
    void el.play().catch(() => {
      /* Autoplay/decoding hiccup — the synthesized crunch still covers it. */
    });
  } catch {
    /* Audio is optional. */
  }
}

// Voice lines that are currently playing. A plain single line is just a set
// of one, but the round-opening "bismillah" chorus needs several clips
// running concurrently, so ducking is driven off how many are active rather
// than a single slot.
let activeVoices = new Set<HTMLAudioElement>();
let ambientEl: HTMLAudioElement | undefined;
let ambientLevel = 0; // 0..1 fade progress, independent of ducking/mute
let ambientDucked = false;
let ambientFadeTimer: ReturnType<typeof setInterval> | undefined;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function applyAmbientVolume() {
  if (!ambientEl) return;
  const duckMul = ambientDucked ? 0.35 : 1;
  ambientEl.volume = muted ? 0 : ambientLevel * duckMul * AMBIENT_VOLUME;
}

function refreshDucking() {
  ambientDucked = activeVoices.size > 0;
  applyAmbientVolume();
}

function stopAllVoices() {
  activeVoices.forEach((el) => el.pause());
  activeVoices.clear();
  refreshDucking();
}

/** Starts one clip, tracking it in `activeVoices` for ducking/ended cleanup.
 *  Resolves once it is playing and rejects if the browser refused (which the
 *  welcome uses to wait for a first gesture; see autoplayGate.ts). */
function trackVoice(el: HTMLAudioElement): Promise<void> {
  activeVoices.add(el);
  refreshDucking();
  const done = () => {
    activeVoices.delete(el);
    refreshDucking();
  };
  el.addEventListener('ended', done);
  el.addEventListener('error', done);
  const started = el.play();
  started.catch(done); // this also counts as handling the rejection for callers that ignore it
  return started;
}

/** Plays one recorded voice line, cutting off whichever one(s) are already playing. */
function playVoice(url: string): Promise<void> {
  if (muted) return Promise.resolve();
  try {
    stopAllVoices();
    const el = new Audio(url);
    el.volume = VOICE_VOLUME;
    return trackVoice(el);
  } catch {
    return Promise.resolve(); /* Audio is optional. */
  }
}

/** Plays every clip at once, kicked off in the same tick so they stay in
 *  sync — a chorus rather than one after another. */
function playVoicesTogether(urls: string[]) {
  if (muted || urls.length === 0) return;
  stopAllVoices();
  for (const url of urls) {
    try {
      const el = new Audio(url);
      el.volume = VOICE_VOLUME;
      void trackVoice(el);
    } catch {
      /* Audio is optional. */
    }
  }
}

let welcomeSettled = false; // played, or no longer wanted because a round began
let cancelWelcome: (() => void) | undefined;

/** The site has just opened: Zaid says "we're inviting you" or Sami says
 *  "we're cooking mansaf". Browsers block sound until the first click or key
 *  press, so on a first visit this waits for one. It only ever happens once,
 *  and never after a round has begun. */
export function playWelcome() {
  if (welcomeSettled) return;
  welcomeSettled = true;
  const url = pick([zaidInviteLunchUrl, samiCookingMansafUrl]);
  cancelWelcome = playWhenAllowed(() => playVoice(url));
}

/** Every character says "bismillah" together, in sync, as the round starts. */
export function playBismillah() {
  // A greeting still waiting for its first gesture (that click may be the one
  // starting the round) is pointless now.
  welcomeSettled = true;
  cancelWelcome?.();
  playVoicesTogether([zaidBismillahUrl, omarBismillahUrl, samiBismillahUrl]);
}

/** "Gather it, roll it, take a bite" — Zaid or Sami reminds the player how to
 *  eat, a while into the round (the delay lives with the game loop in main.tsx). */
export function playGatherTip() {
  void playVoice(pick([zaidGatherTipUrl, samiGatherTipUrl]));
}

/** The player won: one of the bots answers with the taunt clips that used to be
 *  loss-only. The files keep their old "lose" names. */
export function playWinVoice() {
  void playVoice(pick([omarLoseTauntUrl, samiLoseTauntUrl, zaidLoseShawarmaUrl]));
}

/** The player lost: Sami says "that's not how Jordanian mansaf is eaten". */
export function playLoseVoice() {
  void playVoice(samiNotHowYouEatUrl);
}

function fadeAmbientLevelTo(target: number, ms: number, onDone?: () => void) {
  if (ambientFadeTimer) clearInterval(ambientFadeTimer);
  const steps = 24,
    stepMs = ms / steps,
    start = ambientLevel,
    diff = target - start;
  let i = 0;
  ambientFadeTimer = setInterval(() => {
    i++;
    ambientLevel = Math.max(0, Math.min(1, start + diff * (i / steps)));
    applyAmbientVolume();
    if (i >= steps) {
      clearInterval(ambientFadeTimer);
      ambientFadeTimer = undefined;
      onDone?.();
    }
  }, stepMs);
}

let cancelAmbientRetry: (() => void) | undefined;

/** Starts (or resumes) the very quiet restaurant ambience loop. It then plays
 *  for the whole visit: lobby, round and results. Idempotent, so it is safe to
 *  call on every round start. Muting only silences it (see applyAmbientVolume),
 *  which means unmuting brings it back even if it began while muted. If the
 *  browser blocks sound until the first click or key press, it begins there. */
export function startAmbient() {
  if (!ambientEl) {
    ambientEl = new Audio(ambientUrl);
    ambientEl.loop = true;
  }
  const el = ambientEl;
  applyAmbientVolume();
  cancelAmbientRetry?.();
  cancelAmbientRetry = playWhenAllowed(() => el.play().then(() => fadeAmbientLevelTo(1, 1500)));
}

/** Fades the ambience out and pauses it. */
export function stopAmbient() {
  if (!ambientEl) return;
  fadeAmbientLevelTo(0, 900, () => ambientEl?.pause());
}
