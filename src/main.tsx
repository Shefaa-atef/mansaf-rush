import { BOT_PICKUP_MS, BOT_SWALLOW_MS, BOT_CYCLE_MS, BOT_BITE_HOVER } from './botTiming';
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { freshLokma, lokmaScoreParts, type Lokma } from './lokma';
import { botSeats, foodPatches, platterFood } from './platterFood';
import { ContextualHUD } from './ContextualHUD';
import { Scoreboard } from './Scoreboard';
import { TouchControls } from './TouchControls';
import { MobileHeader } from './MobileHeader';
import { type Lang, TRANSLATIONS, isolateLtr } from './i18n';
import { formatNumber, roundTo2 } from './formatNumber';
import * as sfx from './sfx';
import { prefetchSceneAssets, sceneLoadFraction, onSceneLoadProgress } from './sceneAssets';
import { allPartsReady, whenPartsReady, readyPartCount, totalPartCount, onPartsChange } from './sceneReadiness';
import logoImg from './assets/web/mansaf-rush-logo.webp';
import meImg from './assets/web/portrait-me.webp';
import zaidImg from './assets/web/portrait-zaid.webp';
import omarImg from './assets/web/portrait-omar.webp';
import samiImg from './assets/web/portrait-sami.webp';
import winImg from './assets/web/result-win.webp';
import loseImg from './assets/web/result-lose.webp';
import scoopStepImg from './assets/web/step-gather.webp';
import rollStepImg from './assets/web/step-roll.webp';
import eatStepImg from './assets/web/step-eat.webp';
import mobileGatherImg from './assets/web/mobile-step-gather.png';
import mobileRollImg from './assets/web/mobile-step-roll.png';
import mobileEatImg from './assets/web/mobile-step-eat.png';
import './style.css';
import './photo.css';
import './arcade.css';
import './game-ui.css';
import './mobile.css';

// The 3D scene (three.js, react-three-fiber, every model and texture) lives in GameCanvas and is
// loaded on demand, so the lobby can paint before any of it is downloaded or parsed. Nothing
// statically imported here may import three.js, or that engine lands back in the first-load bundle.
// `foodSurface` is the one scene function the bot logic below needs. It is bound the moment the
// chunk arrives, and start() never begins a round before that.
type SceneModule = typeof import('./GameCanvas');
let foodSurface!: SceneModule['foodSurface'];
let sceneReady = false;
let sceneLoad: Promise<SceneModule> | undefined;
const loadScene = () => (sceneLoad ??= (prefetchSceneAssets(), import('./GameCanvas')).then((module) => {
  foodSurface = module.foodSurface;
  sceneReady = true;
  return module;
}));
const GameCanvas = lazy(() => loadScene().then((module) => ({ default: module.GameCanvas })));

const COLORS = ['#e5b75d', '#e67a65', '#7bb6bb', '#a4b57d'];
const CHARACTER_PHOTOS = [meImg, zaidImg, omarImg, samiImg];
const STEP_PHOTOS = [scoopStepImg, rollStepImg, eatStepImg];
const MOBILE_STEP_PHOTOS = [mobileGatherImg, mobileRollImg, mobileEatImg];
const MOBILE_STEPS = {
  en: [
    { label: 'Tap and scoop', title: 'Scoop', desc: 'Use the wheel to reach the rice, then hold Scoop. Release when your palm is full.' },
    { label: 'Roll the lokma', title: 'Roll', desc: 'Tap left and right on the wheel to shape one round lokma.' },
    { label: 'Take the bite', title: 'Eat', desc: 'When the lokma is green, tap Eat and score your bite.' },
  ],
  ar: [
    { label: 'اجمع الرز', title: 'اجمع', desc: 'حرّك العجلة نحو الرز واضغط مطولاً على جمع، ثم اتركه عندما تمتلئ يدك.' },
    { label: 'دوّر اللقمة', title: 'دوّر', desc: 'اضغط يميناً ويساراً على العجلة حتى تصبح اللقمة مستديرة.' },
    { label: 'خذ اللقمة', title: 'كُل', desc: 'عندما تصبح اللقمة خضراء، اضغط كُل لتحصل على النقاط.' },
  ],
} as const;
const refinedLook = new URLSearchParams(window.location.search).get('look') !== 'before';

const CONFETTI_COLORS = ['#f5d676', '#e67a65', '#7bb6bb', '#a4b57d', '#ffffff'];
const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => i);

export type Game = {
  phase: 'ready' | 'playing' | 'ended';
  remaining: number;
  scores: number[];
  eaten: number[];
  time?: number;
  lokma: Lokma;
  feedback: string;
  feedbackAt: number;
  bites: number[];
  started: number;
  nextBots: number[];
  biteTargets: [number, number, number][];
  botReach?: Array<{ x: number; y: number; z: number; radius: number }>;
  botPending?: Array<{ amount: number; picked: boolean; taken: number } | undefined>;
  botResults?: Array<{ at: number; taken: number } | undefined>;
  reason: string;
};

const wait = (i: number) => [1300, 1900, 2600][i] + Math.random() * 700;

// A while into a round, once the opening bismillah is over, a recorded voice
// reminds the player how to eat ("gather it, roll it, take a bite").
const GATHER_TIP_DELAY_MS = 7000;

// The screen only needs the game state about 30 times a second. Publishing on every frame made
// React redo the whole page 60 times a second for nothing.
const PUBLISH_EVERY_MS = 33;

const initial = (): Game => ({
  phase: 'ready',
  remaining: 100,
  scores: [0, 0, 0, 0],
  eaten: [0, 0, 0, 0],
  lokma: freshLokma(),
  feedback: '',
  feedbackAt: 0,
  bites: [0, 0, 0, 0],
  started: 0,
  nextBots: [0, 0, 0],
  botResults: [],
  biteTargets: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  reason: '',
});

export function finish(g: Game, reason: string) {
  g.phase = 'ended';
  g.reason = reason;
  g.lokma.gathering = false;
  g.lokma.space = false;
  if (reason === 'platter') {
    // Nothing worth eating is left. Settle the tally and sweep up any crumbs so the tray reads empty.
    g.remaining = 0;
    platterFood.drain();
  }
}

/**
 * True once nothing is left to eat. Thousands of small scoops leave floating-point dust in the
 * running tally, and waiting for an exact zero left rounds hanging with an empty tray and no results.
 */
const platterEmpty = (g: Game) => platterFood.finished(g.remaining);

function App() {
  const game = useRef(initial()),
    endSounded = useRef(false),
    gatherTipPlayed = useRef(false),
    publishedPhase = useRef<Game['phase']>('ready'),
    lastPublish = useRef(0),
    [view, setView] = useState({ ...game.current }),
    [menuOpen, setMenuOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [soundMuted, setSoundMuted] = useState(false),
    [lang, setLang] = useState<Lang>(() => (localStorage.getItem('mansaf_lang') as Lang) || 'en'),
    [sceneWanted, setSceneWanted] = useState(false),
    [starting, setStarting] = useState(false),
    [loadFraction, setLoadFraction] = useState(0),
    [canPlay, setCanPlay] = useState(() => allPartsReady()),
    [showLoadingPanel, setShowLoadingPanel] = useState(false),
    [loadingTipIndex] = useState(() => Math.floor(Math.random() * 3));

  const t = TRANSLATIONS[lang];
  // eat() must keep one identity for the life of the page (it is a prop of the 3D scene), so it
  // reads the language through a ref.
  const langRef = useRef(lang);
  langRef.current = lang;
  const names = t.names;
  const traits = t.traits;
  const mobileSteps = window.innerWidth <= 700 ? MOBILE_STEPS[lang] : t.intro.steps;
  const loadingTips = window.innerWidth <= 700 ? t.lobby.loadingTipsMobile : t.lobby.loadingTips;

  const toggleLang = () => {
    const nextLang: Lang = lang === 'en' ? 'ar' : 'en';
    setLang(nextLang);
    localStorage.setItem('mansaf_lang', nextLang);
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.title = TRANSLATIONS[lang].meta.title;
  }, [lang]);

  useEffect(() => {
    sfx.setMuted(soundMuted);
  }, [soundMuted]);

  // The site has just opened: greet the visitor and start the restaurant
  // ambience, which then plays for the whole visit. Browsers hold sound back
  // until the first click or key press, so on a first visit both begin on that
  // gesture (see autoplayGate.ts).
  useEffect(() => {
    sfx.playWelcome();
    sfx.startAmbient();
  }, []);

  const publish = () => {
    publishedPhase.current = game.current.phase;
    lastPublish.current = performance.now();
    setView({
      ...game.current,
      scores: [...game.current.scores],
      lokma: { ...game.current.lokma },
    });
  };

  const begin = () => {
    platterFood.reset();
    const now = performance.now();
    game.current = {
      ...initial(),
      phase: 'playing',
      started: now,
      nextBots: [0, 1, 2].map((i) => now + wait(i)),
    };
    setMenuOpen(false);
    setHelpOpen(false);
    gatherTipPlayed.current = false;
    sfx.playBismillah();
    sfx.startAmbient();
    publish();
  };

  // From the results screen, leave the round behind and return to the lobby (title screen)
  // instead of jumping straight into a new round. The scene stays mounted, so pressing Play
  // again from the lobby begins at once.
  const backToLobby = () => {
    game.current = initial();
    publish();
  };

  // Mount the 3D scene once the lobby has painted and the browser is idle, so the lobby's own
  // images and first render are not competing with the models and shaders for bandwidth and CPU.
  // Hovering, focusing or pressing Play skips the wait.
  useEffect(() => {
    if (sceneWanted) return;
    let idle: number | undefined, timer: number | undefined;
    const arm = () => setSceneWanted(true);
    // Safari has no requestIdleCallback, so test for it on a loosely typed alias.
    const win: Window & { requestIdleCallback?: Window['requestIdleCallback'] } = window;
    const schedule = () => {
      if (win.requestIdleCallback) idle = win.requestIdleCallback(arm, { timeout: 4000 });
      else timer = win.setTimeout(arm, 1500);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [sceneWanted]);

  // Combine the models' download bytes (the dominant share of the wait) with how many of them have
  // finished parsing and mounting into a seat, into one 0 to 1 figure for the lobby's loading bar.
  useEffect(() => {
    const recompute = () => {
      const bytes = sceneLoadFraction();
      const parts = readyPartCount() / totalPartCount();
      setLoadFraction(0.85 * bytes + 0.15 * parts);
      setCanPlay(allPartsReady());
    };
    recompute();
    const offBytes = onSceneLoadProgress(recompute);
    const offParts = onPartsChange(recompute);
    return () => { offBytes(); offParts(); };
  }, []);

  // The loading panel only appears once the wait has gone on long enough to notice, so a fast or
  // cached load (the model bytes already in the browser's cache) goes straight to an enabled
  // button instead of flashing a progress bar that finishes before anyone could read it.
  useEffect(() => {
    if (canPlay) return;
    const timer = window.setTimeout(() => setShowLoadingPanel(true), 250);
    return () => window.clearTimeout(timer);
  }, [canPlay]);

  const warmScene = () => { setSceneWanted(true); void loadScene(); };

  // Once the wait has been noticeable long enough to show the loading panel (see the effect
  // above), the Play button stays disabled until every part is actually in, instead of accepting
  // an early click and only then admitting it is still busy.
  const loadingActive = showLoadingPanel && !canPlay;

  const start = () => {
    if (sceneReady && allPartsReady()) { begin(); return; }
    // The click beat the 3D chunk or the characters' models: show Play as busy and begin the moment
    // they are all in. Nothing stands in for a model that has not loaded, so a round never starts
    // with an empty seat.
    if (starting) return;
    setStarting(true);
    setSceneWanted(true);
    loadScene().then(() => whenPartsReady()).then(
      () => { setStarting(false); begin(); },
      (error) => { console.error('Could not load the 3D scene', error); setStarting(false); },
    );
  };

  // Keep keyboard navigation inside the active dialog and restore its trigger.
  useEffect(() => {
    if (!menuOpen && !helpOpen && view.phase !== 'ended') return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.overlay .modal');
    const buttons = () => Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    buttons()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = buttons(), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [menuOpen, helpOpen, view.phase]);

  // Keyboard shortcut: Escape toggles pause menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && helpOpen) {
        setHelpOpen(false);
      } else if (e.code === 'Escape' && game.current.phase === 'playing') {
        setMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [helpOpen]);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      const g = game.current,
        now = performance.now();
      if (g.phase === 'playing' && !menuOpen && !helpOpen) {
        if (!gatherTipPlayed.current && now - g.started >= GATHER_TIP_DELAY_MS) {
          gatherTipPlayed.current = true;
          sfx.playGatherTip();
        }
        g.botPending ??= [];
        for (let i = 0; i < 3; i++) {
          const pending = g.botPending[i];
          if (pending) {
            const elapsed = now - g.bites[i + 1];
            const target = g.biteTargets[i + 1];
            if (!pending.picked && elapsed >= (refinedLook ? 1420 : BOT_PICKUP_MS)) {
              pending.taken = platterFood.consume(target[0], target[2], Math.min(g.remaining, pending.amount));
              g.remaining = Math.max(0, g.remaining - pending.taken);
              pending.picked = true;
            }
            if (elapsed >= (refinedLook ? 2300 : BOT_SWALLOW_MS)) {
              g.scores[i + 1] += pending.taken;
              g.eaten[i + 1] += pending.taken;
              g.botResults ??= [];
              g.botResults[i] = { at: now, taken: pending.taken };
              g.botPending[i] = undefined;
              if (platterEmpty(g)) finish(g, 'platter');
            }
          }
          if (now >= g.nextBots[i] && g.phase === 'playing') {
            const amount = Math.min(
              g.remaining,
              i === 0
                ? 2 + Math.floor(Math.random() * 2)
                : i === 1
                  ? 2 + Math.floor(Math.random() * 4)
                  : 4 + Math.floor(Math.random() * 2)
            );
            const seat = botSeats[i],
              target = foodPatches.filter((p, index) => {
                const reach = g.botReach?.[i];
                return platterFood.breadAvailable(index) && (!reach || Math.hypot(p.x - reach.x, foodSurface(p.x, p.z, g.remaining).height + BOT_BITE_HOVER - reach.y, p.z - reach.z) < reach.radius);
              }).sort((a, b) => Math.hypot(a.x - seat[0], a.z - seat[1]) - Math.hypot(b.x - seat[0], b.z - seat[1]))[0] ?? platterFood.target(seat[0], seat[1]);
            if (target) {
              g.biteTargets[i + 1] = [
                target.x,
                foodSurface(target.x, target.z, g.remaining).height + BOT_BITE_HOVER,
                target.z,
              ];
              g.botPending[i] = { amount, picked: false, taken: 0 };
            }
            if (!target) continue;
            g.bites[i + 1] = now;
            g.nextBots[i] = now + Math.max(refinedLook ? 3300 : BOT_CYCLE_MS, wait(i));
            if (platterEmpty(g)) finish(g, 'platter');
          }
        }
        // Whoever emptied the platter (a bot, the player's own scoop, or rounding dust), the
        // round ends here and the result is published below.
        if (g.phase === 'playing' && platterEmpty(g)) finish(g, 'platter');
        if (g.phase !== publishedPhase.current || now - lastPublish.current >= PUBLISH_EVERY_MS) publish();
      } else if (g.phase !== publishedPhase.current) {
        // The round was ended (or restarted) from outside this loop while it was paused or
        // between frames. The screen only learns about it when we publish, so do it now.
        publish();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [helpOpen, menuOpen]);

  const eat = useCallback((now: number) => {
    const g = game.current,
      l = g.lokma;
    if (g.phase !== 'playing' || l.failed) return;

    // The rice itself was already pulled off the platter progressively while
    // gathering (see PlayerHand.tsx) - `l.taken` is the real, already-applied
    // amount, so this only turns it into score/stats, it doesn't touch the
    // platter or g.remaining again (that would double-consume).
    const amount = Math.max(1, Math.round(l.taken));
    const parts = lokmaScoreParts(l, now);
    const pts = parts.total;
    g.eaten[0] += amount;
    g.scores[0] += pts;
    g.bites[0] = now;

    const fb = TRANSLATIONS[langRef.current].feedback;
    // Say where the points came from, so lamb and almonds visibly pay more than rice alone.
    g.feedback = `${l.meterZone === 'round' ? fb.perfect : fb.squashed} ${isolateLtr(`+${formatNumber(pts)}`)}${
      parts.meat ? fb.lamb(parts.meat) : ''
    }${parts.almond ? fb.almond(parts.almond) : ''}`;
    g.feedbackAt = now;

    if (platterEmpty(g)) finish(g, 'platter');
    publish();
  }, []);

  const rankings = view.scores
    .map((score, id) => ({ score: roundTo2(score), id }))
    .sort((a, b) => b.score - a.score),
    winners = rankings.filter((x) => x.score === rankings[0].score),
    now = performance.now();

  const winner = rankings[0];
  const playerWon = winners.some((w) => w.id === 0);
  const playerRank = rankings.findIndex((r) => r.id === 0) + 1;

  // Warm the browser cache with both result illustrations while the match is in play,
  // so the win/lose picture is already there the moment the round ends.
  useEffect(() => {
    if (view.phase !== 'playing') return;
    [winImg, loseImg].forEach((src) => { new Image().src = src; });
  }, [view.phase]);

  useEffect(() => {
    if (view.phase === 'ended') {
      if (!endSounded.current) {
        endSounded.current = true;
        // The restaurant ambience deliberately keeps going under the results.
        if (playerWon) {
          sfx.playWin();
          window.setTimeout(() => sfx.playWinVoice(), 450);
        } else {
          sfx.playLose();
          window.setTimeout(() => sfx.playLoseVoice(), 450);
        }
      }
    } else {
      endSounded.current = false;
    }
  }, [view.phase, playerWon]);

  return (
    <main className={`game phase-${view.phase}`}>
      {sceneWanted && (
        <Suspense fallback={null}>
          <GameCanvas game={game} remaining={view.remaining >= 100 ? 100 : view.remaining <= 0 ? 0 : 50} onEat={eat} lang={lang} phase={view.phase} />
        </Suspense>
      )}
      <div className="vignette" />
      {view.phase === 'playing' && <MobileHeader scores={view.scores} names={names} remaining={view.remaining} onMenu={() => setMenuOpen(true)} />}

      {/* Top Header Bar */}
      <header className="game-hud-header">
        {/* Top corner one: how much mansaf is left on the tray */}
        <div className="hud-widget-box remaining-widget">
          <span className="widget-label">{t.header.remaining}</span>
          <strong className="widget-value">{formatNumber(view.remaining)}<em>%</em></strong>
          <div className="widget-bar-track">
            <div
              className="widget-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, roundTo2(view.remaining)))}%` }}
            />
          </div>
        </div>

        {/* Top corner two: the menu */}
        <div className="top-right-hud">
          <button
            className="hud-widget-box menu-btn"
            onClick={() => {
              sfx.playOpen();
              setMenuOpen(true);
            }}
            aria-label={t.a11y.openMenu}
          >
            <span className="btn-icon">☰</span> {t.header.menu}
          </button>
        </div>
      </header>

      {/* Smart Contextual Keyboard Assistant */}
      {view.phase === 'playing' && (
        <ContextualHUD
          lokma={view.lokma}
          feedback={view.feedback}
          showFeedback={now - view.feedbackAt < 1200}
          lang={lang}
        />
      )}

      {/* 4-Player Scoreboard */}
      {view.phase === 'playing' && <TouchControls lokma={view.lokma} lang={lang} enabled={!menuOpen && !helpOpen} />}
      {view.phase === 'playing' && (
        <Scoreboard
          scores={view.scores}
          names={names}
          colors={COLORS}
          traits={traits}
          lang={lang}
        />
      )}

      {view.phase === 'ready' && (
        <section className="lobby-screen" aria-label={t.lobby.ariaLabel}>
          <div className="lobby-backdrop" style={{ backgroundImage: `url(${scoopStepImg})` }} aria-hidden="true" />
          <header className="lobby-toolbar">
            <span className="edition-stamp"><span aria-hidden="true">✦</span> {t.lobby.edition}</span>
            <div className="lobby-settings">
              <button className="lobby-sound" aria-pressed={!soundMuted} onClick={() => { sfx.setMuted(!soundMuted); setSoundMuted(!soundMuted); }}>{soundMuted ? t.lobby.soundOff : t.lobby.soundOn}</button>
              <button className="language-switch" onClick={toggleLang}>{t.header.langBtn}</button>
            </div>
          </header>
          <div className="lobby-main">
            <div className="lobby-intro">
              <h1 className="lobby-logo"><img src={logoImg} alt={t.header.logoAlt} width="720" height="593" fetchPriority="high" decoding="async" /></h1>
              <p className="lobby-invitation" lang="ar" dir="rtl">طابخين لك منسف!</p>
              <p className="lobby-tagline">{t.lobby.tagline}</p>
              <div className="lobby-start">
                <button
                  className="primary-btn lobby-enter"
                  onClick={start}
                  onPointerEnter={warmScene}
                  onFocus={warmScene}
                  disabled={loadingActive}
                  aria-busy={(starting || loadingActive) || undefined}
                  style={starting && !loadingActive ? { opacity: 0.7, cursor: 'progress' } : undefined}
                >
                  <span className="lobby-play-icon" aria-hidden="true">▶</span>
                  {loadingActive ? t.lobby.preparing : t.lobby.start}
                </button>
                {loadingActive ? (
                  <div className="lobby-loading" role="status" aria-live="polite">
                    <div className="lobby-loading-track">
                      <div className="lobby-loading-fill" style={{ width: `${Math.round(loadFraction * 100)}%` }} />
                    </div>
                    <div className="lobby-loading-meta">
                      <span className="lobby-loading-label">{t.lobby.loadingLabel}</span>
                      <span className="lobby-loading-pct">{isolateLtr(`${Math.round(loadFraction * 100)}%`)}</span>
                    </div>
                    <p className="lobby-loading-tip">💡 {loadingTips[loadingTipIndex]}</p>
                  </div>
                ) : (
                  <span className="lobby-control-note">{t.lobby.keyboardNote}</span>
                )}
              </div>
              <div className="lobby-rivals">
                <span>{t.lobby.rivalsHeading}</span>
                <div>{[zaidImg, omarImg, samiImg].map((photo, index) => <figure key={photo}><img src={photo} alt="" /><figcaption>{names[index + 1]}</figcaption></figure>)}</div>
              </div>
            </div>
            <div className="lobby-guide">
              <div className="lobby-guide-heading"><span aria-hidden="true">✦</span><h2>{t.lobby.guideHeading}</h2><span aria-hidden="true">✦</span></div>
              <p className="lobby-guide-subtitle">{t.lobby.guideSubtitle}</p>
              <ol className="lobby-steps" aria-label={t.intro.title}>
                {mobileSteps.map((step, index) => (
                  <li className="lobby-step" key={step.label}>
                    <span className="lobby-step-number" aria-hidden="true">{index + 1}</span>
                    <img className="lobby-step-photo" src={(window.innerWidth <= 700 ? MOBILE_STEP_PHOTOS : STEP_PHOTOS)[index]} alt={step.label} width="720" height="720" loading="lazy" decoding="async" />
                    <div className="lobby-step-copy">
                      <h3>{step.title}</h3>
                      <p>{step.desc}</p>
                      <div className="lobby-step-keys" dir="ltr" aria-hidden="true">{[['↑ ↓ ← →', t.keys.space], ['← →'], ['↑']][index].map(key => <kbd key={key}>{key}</kbd>)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <footer className="lobby-footer"><span>{t.lobby.footerTagline}</span><span>{t.lobby.brand}</span></footer>
        </section>
      )}

      {/* 2. PAUSE MENU MODAL */}
      {menuOpen && (
        <div className="overlay">
          <section className="modal menu-modal-layout" role="dialog" aria-modal="true" aria-label={t.pauseMenu.title}>
            <img className="pause-logo" src={logoImg} alt="" />
            <span className="eyebrow">{t.pauseMenu.eyebrow}</span>
            <h2>{t.pauseMenu.title}</h2>

            <div className="menu-action-stack">
              <button
                className="primary-btn"
                onClick={() => {
                  sfx.playConfirm();
                  setMenuOpen(false);
                }}
              >
                {t.pauseMenu.resume}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  sfx.playOpen();
                  setMenuOpen(false);
                  setHelpOpen(true);
                }}
              >
                {t.pauseMenu.howToPlay}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  sfx.playClick();
                  toggleLang();
                }}
              >
                {t.pauseMenu.switchLang}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  const next = !soundMuted;
                  // Update sfx's internal mute flag synchronously — the
                  // [soundMuted] effect above only fires after this render,
                  // so without this the un-mute confirmation blip below
                  // would still see the old (muted) flag and stay silent.
                  sfx.setMuted(next);
                  setSoundMuted(next);
                  if (!next) sfx.playToggle(true);
                }}
              >
                {soundMuted ? t.pauseMenu.soundMuted : t.pauseMenu.soundOn}
              </button>
              <button
                className="danger-btn"
                onClick={() => {
                  sfx.playRestart();
                  start();
                }}
              >
                {t.pauseMenu.restart}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 3. HOW TO PLAY GUIDE MODAL */}
      {helpOpen && (
        <div className="overlay">
          <section className="modal guide-modal-layout" role="dialog" aria-modal="true" aria-label={t.guide.title}>
            <button
              className="close-btn"
              aria-label={t.a11y.closeGuide}
              onClick={() => {
                sfx.playClose();
                setHelpOpen(false);
              }}
            >
              ×
            </button>
            <span className="eyebrow">{t.guide.eyebrow}</span>
            <h2>{t.guide.title}</h2>

            <ol className="match-guide-steps">
              {t.intro.steps.map((step, index) => (
                <li className="match-guide-card" key={step.label}>
                  <img src={STEP_PHOTOS[index]} alt={step.label} width="720" height="720" decoding="async" />
                  <div><h3><span aria-hidden="true">{index + 1}</span>{step.title}</h3><p>{step.desc}</p></div>
                </li>
              ))}
            </ol>

            <button
              className="primary-btn guide-close-btn"
              onClick={() => {
                sfx.playConfirm();
                setHelpOpen(false);
              }}
            >
              {t.guide.gotIt}
            </button>
          </section>
        </div>
      )}

      {/* 4. GAME OVER RESULTS MODAL — distinct WIN / LOSE moods for the player */}
      {view.phase === 'ended' && (
        <div className="overlay">
          <section className={`modal results-modal-layout ${playerWon ? 'is-win' : 'is-lose'}`} role="dialog" aria-modal="true" aria-label={playerWon ? t.results.youWin : t.results.youLost}>
            {playerWon && (
              <div className="confetti-burst">
                {CONFETTI_PIECES.map((i) => (
                  <span
                    key={i}
                    className="confetti-piece"
                    style={{
                      left: `${(i * 47) % 100}%`,
                      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                      animationDelay: `${(i % 6) * 0.28}s`,
                      animationDuration: `${2.2 + (i % 4) * 0.4}s`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="result-art">
              <img src={playerWon ? winImg : loseImg} alt="" className="result-art-img" />
            </div>

            <div className="result-body">
              <span className="eyebrow">{playerWon ? t.results.victory : t.results.roundComplete}</span>
              <h2>{playerWon ? t.results.youWin : t.results.youLost}</h2>
              <p className="result-subline">
                {playerWon
                  ? t.results.winSubline
                  : t.results.loseSubline(names[winner.id], playerRank)}
              </p>

              <div className="leaderboard-list">
                {rankings.map((r, i) => (
                  <div key={r.id} className={`rank-row ${i === 0 ? 'top-rank' : ''}`}>
                    <span className="rank-num">#{i + 1}</span>
                    <img src={CHARACTER_PHOTOS[r.id]} alt={names[r.id]} className="rank-img" />
                    <div className="rank-info">
                      <span className="rank-name">{names[r.id]}</span>
                      <span className="rank-trait">{traits[r.id]}</span>
                    </div>
                    <strong className="rank-score">{formatNumber(r.score)} {t.results.pts}</strong>
                  </div>
                ))}
              </div>

              <div className="results-actions">
                <button
                  className="primary-btn"
                  onClick={() => {
                    sfx.playRestart();
                    start();
                  }}
                >
                  {playerWon ? t.results.playAgain : t.results.tryAgain}
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    sfx.playClick();
                    backToLobby();
                  }}
                >
                  {t.results.backToLobby}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
