import { BOT_PICKUP_MS, BOT_SWALLOW_MS, BOT_CYCLE_MS } from './botBiteMotion';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { Character } from './Characters';
import { MansafPlatter } from './MansafPlatter';
import { Majlis } from './Majlis';
import { RoomReflections } from './RoomReflections';
import { VisualPolish } from './VisualPolish';
import { OpponentEffects } from './OpponentEffects';
import { PlayerHand } from './PlayerHand';
import { freshLokma, lokmaScore, type Lokma } from './lokma';
import { botSeats, foodPatches, platterFood } from './platterFood';
import { foodSurface } from './MansafPlatter';
import { ContextualHUD } from './ContextualHUD';
import { Scoreboard } from './Scoreboard';
import { type Lang, TRANSLATIONS } from './i18n';
import * as sfx from './sfx';
import logoImg from './assets/Mansaf Rush Arabian Game Logo.png';
import meImg from './assets/me.png';
import zaidImg from './assets/zaid.png';
import omarImg from './assets/omar.png';
import samiImg from './assets/sami.png';
import scoopStepImg from './assets/steps/جمع.png';
import rollStepImg from './assets/steps/دحبر.png';
import eatStepImg from './assets/steps/القم.png';
import './style.css';
import './photo.css';
import './arcade.css';

const COLORS = ['#e5b75d', '#e67a65', '#7bb6bb', '#a4b57d'];
const CHARACTER_PHOTOS = [meImg, zaidImg, omarImg, samiImg];
const STEP_PHOTOS = [scoopStepImg, rollStepImg, eatStepImg];
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
}

function Scene({
  game,
  remaining,
  onEat,
  lang,
}: {
  game: React.RefObject<Game>;
  remaining: number;
  onEat: (now: number) => void;
  lang: Lang;
}) {
  return (
    <>
      <color attach="background" args={['#b08162']} />
      <fog attach="fog" args={['#b08162', 10, 22]} />
      <ambientLight intensity={refinedLook ? 0.30 : 0.38} color={refinedLook ? '#f7e8d7' : '#ffe0bb'} />
      <hemisphereLight args={refinedLook ? ['#e8f2ff', '#67483b', .78] : ['#ffe7ca', '#6f4a38', 1.0]} />
      <directionalLight
        position={[-3, 6, 4]}
        intensity={refinedLook ? 2.72 : 3.05}
        color={refinedLook ? '#ffd6a5' : '#ffdfb9'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-normalBias={0.04}
        shadow-bias={-0.00015}
        shadow-radius={refinedLook ? 7 : 5}
      />
      <directionalLight position={[3, 4, -2]} intensity={refinedLook ? .72 : 1.2} color={refinedLook ? '#b8d3e6' : '#ffd2a0'} />
      <directionalLight position={[1, 3, 5]} intensity={0.42} color="#fff2da" />
      <directionalLight position={[-1.5, 2.4, -4.5]} intensity={0.55} color="#ffcf9e" />
      <RoomReflections />
      <Majlis refined={refinedLook} />
      {refinedLook && <VisualPolish />}
      <Character id={1} position={[-2.02, 0.02, -0.3]} angle={0.78} game={game} />
      <Character id={2} position={[0, 0.02, -2.05]} angle={0} game={game} />
      <Character id={3} position={[2.02, 0.02, -0.3]} angle={-0.78} game={game} />
      {refinedLook && <OpponentEffects game={game} lang={lang} />}
      <MansafPlatter remaining={remaining} refined={refinedLook} />
      <PlayerHand game={game} onEat={onEat} />
    </>
  );
}

function App() {
  const game = useRef(initial()),
    endSounded = useRef(false),
    [view, setView] = useState({ ...game.current }),
    [menuOpen, setMenuOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [soundMuted, setSoundMuted] = useState(false),
    [lang, setLang] = useState<Lang>(() => (localStorage.getItem('mansaf_lang') as Lang) || 'en');

  const t = TRANSLATIONS[lang];
  const names = t.names;
  const traits = t.traits;

  const toggleLang = () => {
    const nextLang: Lang = lang === 'en' ? 'ar' : 'en';
    setLang(nextLang);
    localStorage.setItem('mansaf_lang', nextLang);
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    sfx.setMuted(soundMuted);
  }, [soundMuted]);

  const publish = () =>
    setView({
      ...game.current,
      scores: [...game.current.scores],
      lokma: { ...game.current.lokma },
    });

  const start = () => {
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
    sfx.playBismillah();
    sfx.startAmbient();
    publish();
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
              if (g.remaining <= 0) finish(g, 'platter');
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
                return platterFood.breadAvailable(index) && (!reach || Math.hypot(p.x - reach.x, foodSurface(p.x, p.z, g.remaining).height + .13 - reach.y, p.z - reach.z) < reach.radius);
              }).sort((a, b) => Math.hypot(a.x - seat[0], a.z - seat[1]) - Math.hypot(b.x - seat[0], b.z - seat[1]))[0] ?? platterFood.target(seat[0], seat[1]);
            if (target) {
              g.biteTargets[i + 1] = [
                target.x,
                foodSurface(target.x, target.z, g.remaining).height + 0.13,
                target.z,
              ];
              g.botPending[i] = { amount, picked: false, taken: 0 };
            }
            if (!target) continue;
            g.bites[i + 1] = now;
            g.nextBots[i] = now + Math.max(refinedLook ? 3300 : BOT_CYCLE_MS, wait(i));
            if (g.remaining <= 0) finish(g, 'platter');
          }
        }
        publish();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [helpOpen, menuOpen]);

  const eat = (now: number) => {
    const g = game.current,
      l = g.lokma;
    if (g.phase !== 'playing' || l.failed) return;

    // The rice itself was already pulled off the platter progressively while
    // gathering (see PlayerHand.tsx) - `l.taken` is the real, already-applied
    // amount, so this only turns it into score/stats, it doesn't touch the
    // platter or g.remaining again (that would double-consume).
    const amount = Math.max(1, Math.round(l.taken));
    const pts = lokmaScore(l, now);
    g.eaten[0] += amount;
    g.scores[0] += pts;
    g.bites[0] = now;

    const fb = TRANSLATIONS[lang].feedback;
    g.feedback = `${
      l.meterZone === 'perfect'
        ? fb.perfect
        : l.meterZone === 'overfilled'
          ? fb.squashed
          : fb.sahtein
    } +${pts}${l.meat ? fb.lambBonus : ''}`;
    g.feedbackAt = now;

    if (g.remaining <= 0) finish(g, 'platter');
    publish();
  };

  const rankings = view.scores
    .map((score, id) => ({ score, id }))
    .sort((a, b) => b.score - a.score),
    winners = rankings.filter((x) => x.score === rankings[0].score),
    now = performance.now();

  const winner = rankings[0];
  const playerWon = winners.some((w) => w.id === 0);
  const playerRank = rankings.findIndex((r) => r.id === 0) + 1;

  useEffect(() => {
    if (view.phase === 'ended') {
      if (!endSounded.current) {
        endSounded.current = true;
        sfx.stopAmbient();
        if (playerWon) {
          sfx.playWin();
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
      <Canvas
        shadows
        camera={{ position: refinedLook ? [0, 3.65, 5.75] : [0, 3.75, 5.2], fov: refinedLook ? 38 : 36 }}
        onCreated={({ camera }) => camera.lookAt(0, refinedLook ? .67 : .95, -0.05)}
        dpr={[1.5, 2]}
        gl={{ toneMappingExposure: 1.12, antialias: true }}
      >
        <Scene game={game} remaining={view.remaining} onEat={eat} lang={lang} />
      </Canvas>
      <div className="vignette" />

      {/* Top Header Bar */}
      <header className="game-hud-header">
        <div className="hud-logo-stamp">
          <img src={logoImg} alt={t.header.logoAlt} className="hud-logo-img" />
        </div>

        <div className="top-right-hud">
          {/* Mansaf Left Widget */}
          <div className="hud-widget-box remaining-widget">
            <span className="widget-label">{t.header.remaining}</span>
            <strong className="widget-value">{view.remaining}<em>%</em></strong>
            <div className="widget-bar-track">
              <div
                className="widget-bar-fill"
                style={{ width: `${view.remaining}%` }}
              />
            </div>
          </div>

          <button
            className="hud-widget-box menu-btn"
            onClick={() => {
              sfx.playOpen();
              setMenuOpen(true);
            }}
            aria-label="Open Menu"
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
        <section className="lobby-screen" aria-label={lang === 'ar' ? 'منسف رش' : 'Mansaf Rush'}>
          <div className="lobby-backdrop" style={{ backgroundImage: `url(${scoopStepImg})` }} aria-hidden="true" />
          <header className="lobby-toolbar">
            <span className="edition-stamp"><span aria-hidden="true">✦</span> {lang === 'ar' ? 'العزومة بلّشت!' : 'DINNER IS ON!'}</span>
            <div className="lobby-settings">
              <button className="lobby-sound" aria-pressed={!soundMuted} onClick={() => { sfx.setMuted(!soundMuted); setSoundMuted(!soundMuted); }}>{soundMuted ? (lang === 'ar' ? 'الصوت: مكتوم' : 'Sound: off') : (lang === 'ar' ? 'الصوت: مفعل' : 'Sound: on')}</button>
              <button className="language-switch" onClick={toggleLang}>{t.header.langBtn}</button>
            </div>
          </header>
          <div className="lobby-main">
            <div className="lobby-intro">
              <h1 className="lobby-logo"><img src={logoImg} alt={t.header.logoAlt} /></h1>
              <p className="lobby-invitation" lang="ar" dir="rtl">طابخين لك منسف!</p>
              <p className="lobby-tagline">{lang === 'ar' ? 'سدر واحد، أربع شهيات. بتقدر تسبق الشباب؟' : 'One platter. Four appetites. Can you beat the boys?'}</p>
              <div className="lobby-start">
                <button className="primary-btn lobby-enter" onClick={start}><span className="lobby-play-icon" aria-hidden="true">▶</span>{lang === 'ar' ? 'يلا ناكل!' : 'LET’S EAT!'}</button>
                <span className="lobby-control-note">{lang === 'ar' ? 'العب بلوحة المفاتيح' : 'KEYBOARD REQUIRED'}</span>
              </div>
              <div className="lobby-rivals">
                <span>{lang === 'ar' ? 'الشباب جاهزين' : 'THE BOYS ARE READY'}</span>
                <div>{[zaidImg, omarImg, samiImg].map((photo, index) => <figure key={photo}><img src={photo} alt="" /><figcaption>{names[index + 1]}</figcaption></figure>)}</div>
              </div>
            </div>
            <div className="lobby-guide">
              <div className="lobby-guide-heading"><span aria-hidden="true">✦</span><h2>{lang === 'ar' ? 'أصول اللقمة' : 'MAKE EVERY BITE COUNT'}</h2><span aria-hidden="true">✦</span></div>
              <p className="lobby-guide-subtitle">{lang === 'ar' ? 'ثلاث حركات… وبتصير معلّم منسف.' : 'Three moves. One perfect lokma.'}</p>
              <ol className="lobby-steps" aria-label={t.intro.title}>
                {t.intro.steps.map((step, index) => (
                  <li className="lobby-step" key={step.label}>
                    <span className="lobby-step-number" aria-hidden="true">{index + 1}</span>
                    <img className="lobby-step-photo" src={STEP_PHOTOS[index]} alt={step.label} width="1254" height="1254" />
                    <div className="lobby-step-copy">
                      <h3>{step.title}</h3>
                      <p>{step.desc}</p>
                      <div className="lobby-step-keys" dir="ltr" aria-hidden="true">{[['↑ ↓ ← →', 'SPACE'], ['SPACE', '← →'], ['↑']][index].map(key => <kbd key={key}>{key}</kbd>)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <footer className="lobby-footer"><span>{lang === 'ar' ? 'سدر واحد. أربع شهيات.' : 'ONE PLATTER. FOUR APPETITES.'}</span><span>MANSAF RUSH</span></footer>
        </section>
      )}

      {/* 2. PAUSE MENU MODAL */}
      {menuOpen && (
        <div className="overlay">
          <section className="modal menu-modal-layout" role="dialog" aria-modal="true" aria-label={t.pauseMenu.title}>
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
              aria-label={lang === 'ar' ? 'إغلاق' : 'Close guide'}
              onClick={() => {
                sfx.playClose();
                setHelpOpen(false);
              }}
            >
              ×
            </button>
            <span className="eyebrow">{t.guide.eyebrow}</span>
            <h2>{t.guide.title}</h2>

            <div className="guide-2x2-grid">
              <div className="guide-card">
                <div className="guide-card-icon">🎮</div>
                <b>{t.guide.card1Title}</b>
                <p>{t.guide.card1Desc}</p>
              </div>

              <div className="guide-card">
                <div className="guide-card-icon">🌾</div>
                <b>{t.guide.card2Title}</b>
                <p>{t.guide.card2Desc}</p>
              </div>

              <div className="guide-card">
                <div className="guide-card-icon">🔄</div>
                <b>{t.guide.card3Title}</b>
                <p>{t.guide.card3Desc}</p>
              </div>

              <div className="guide-card">
                <div className="guide-card-icon">🍖</div>
                <b>{t.guide.card4Title}</b>
                <p>{t.guide.card4Desc}</p>
              </div>
            </div>

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

            <div className="result-badge-icon">{playerWon ? '🏆' : '🍽️'}</div>
            <span className="eyebrow">{playerWon ? t.results.victory : t.results.roundComplete}</span>
            <h2>{playerWon ? t.results.youWin : t.results.youLost}</h2>
            <p className="result-subline">
              {playerWon
                ? t.results.winSubline
                : t.results.loseSubline(names[winner.id], playerRank)}
            </p>

            <div className="winner-spotlight-card">
              <div className="winner-crown-badge">{t.results.winnerBadge}</div>
              <img
                src={CHARACTER_PHOTOS[winner.id]}
                alt={names[winner.id]}
                className="winner-avatar-img"
              />
              <div className="winner-details">
                <h3>{names[winner.id]}</h3>
                <span className="winner-trait-badge">{traits[winner.id]}</span>
                <div className="winner-score-tag">{winner.score} {t.results.pts}</div>
              </div>
            </div>

            <div className="leaderboard-list">
              {rankings.map((r, i) => (
                <div key={r.id} className={`rank-row ${i === 0 ? 'top-rank' : ''}`}>
                  <span className="rank-num">#{i + 1}</span>
                  <img src={CHARACTER_PHOTOS[r.id]} alt={names[r.id]} className="rank-img" />
                  <div className="rank-info">
                    <span className="rank-name">{names[r.id]}</span>
                    <span className="rank-trait">{traits[r.id]}</span>
                  </div>
                  <strong className="rank-score">{r.score} {t.results.pts}</strong>
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
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
