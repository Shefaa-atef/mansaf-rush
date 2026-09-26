import { useEffect, useRef } from 'react';
import { type Lang, TRANSLATIONS } from './i18n';
import { biteStage, biteStep, type Lokma } from './lokma';
import { rollFromMove, rollSide, setTouchSteer, stickFromOffset, type RollSide } from './joystick';

// Buttons and the roll flick feed the same input path as the keyboard, so touch and keyboard share
// one set of game rules. Only the joystick's steering bypasses it: that one is analog (see joystick.ts).
const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
const tap = (code: string) => { key(code, true); key(code, false); };

/** How far the knob can travel from the middle of the stick, as a share of the stick's width. */
const KNOB_TRAVEL = 0.28;

/**
 * The thumb stick. It steers the hand while the player is moving and scooping. Once the rice is
 * being rolled it turns into a left/right flick stick: the knob is held on the horizontal and each
 * push to a side rolls once.
 */
function Joystick({ rolling, active, label }: { rolling: boolean; active: boolean; label: string }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const stick = useRef({ x: 0, y: 0 });
  const side = useRef<RollSide>('');
  // Pointer handlers outlive a render, so they read the latest mode from here.
  const mode = useRef({ rolling, active });
  mode.current = { rolling, active };

  const paint = (x: number, y: number) => {
    const el = base.current;
    if (!el || !knob.current) return;
    const travel = el.clientWidth * KNOB_TRAVEL;
    knob.current.style.transform = `translate(${x * travel}px, ${y * travel}px)`;
  };

  /** Push the stick position as it is now to the game, in whichever mode the stick is in. */
  const apply = () => {
    const { x, y } = stick.current;
    if (!mode.current.active) {
      setTouchSteer(0, 0);
      paint(0, 0);
    } else if (mode.current.rolling) {
      setTouchSteer(0, 0);
      paint(x, 0);
      const next = rollSide(x, side.current);
      const roll = rollFromMove(side.current, next);
      side.current = next;
      if (roll) tap(roll === 'left' ? 'ArrowLeft' : 'ArrowRight');
    } else {
      setTouchSteer(x, y);
      paint(x, y);
    }
  };

  const move = (e: { clientX: number; clientY: number }) => {
    const el = base.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    stick.current = stickFromOffset(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2), rect.width * KNOB_TRAVEL);
    apply();
  };

  const release = () => {
    pointer.current = null;
    stick.current = { x: 0, y: 0 };
    side.current = '';
    setTouchSteer(0, 0);
    if (base.current) delete base.current.dataset.held;
    paint(0, 0);
  };

  // A change of mode (steer, roll, or switched off for the eating) has to take effect with the
  // thumb still down. Rolling starts disarmed on whatever side the stick is already on, so a stick
  // held over from steering never rolls by itself.
  useEffect(() => {
    if (rolling) side.current = rollSide(stick.current.x, '');
    apply();
  }, [rolling, active]);

  useEffect(() => {
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release);
    window.addEventListener('resize', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      release();
      window.removeEventListener('blur', release);
      window.removeEventListener('resize', release);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const end = (e: React.PointerEvent) => { if (e.pointerId === pointer.current) release(); };
  return (
    <div ref={base} className={`stick${rolling ? ' is-rolling' : ''}${active ? '' : ' is-off'}`} dir="ltr" role="group" aria-label={label}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        if (!mode.current.active || pointer.current !== null) return;
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.dataset.held = '1';
        move(e);
      }}
      onPointerMove={e => { if (e.pointerId === pointer.current) move(e); }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <span className="stick-ring" aria-hidden="true" />
      <span className="stick-dir stick-up" aria-hidden="true">▲</span>
      <span className="stick-dir stick-down" aria-hidden="true">▼</span>
      <span className="stick-dir stick-left" aria-hidden="true">◀</span>
      <span className="stick-dir stick-right" aria-hidden="true">▶</span>
      <div ref={knob} className="stick-knob" aria-hidden="true" />
    </div>
  );
}

export function TouchControls({ lokma, lang, enabled }: { lokma: Lokma; lang: Lang; enabled: boolean }) {
  const held = useRef(new Map<number, string>());
  const t = TRANSLATIONS[lang].touch;
  const stage = biteStage(lokma);
  const step = biteStep(stage);
  const rolling = lokma.shaping || lokma.readyToEat;
  const eating = !!lokma.eating;
  const release = (id: number) => {
    const code = held.current.get(id);
    if (!code) return;
    held.current.delete(id);
    if (![...held.current.values()].includes(code)) key(code, false);
  };
  useEffect(() => {
    const clear = () => { for (const id of [...held.current.keys()]) release(id); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', clear);
    if (!enabled) clear();
    return () => {
      clear();
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', clear);
    };
  }, [enabled]);
  const button = (code: string, className: string, label: string, text: string, disabled: boolean) => (
    <button type="button" className={`touch-key ${className}`} aria-label={label} disabled={!enabled || disabled}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current.set(e.pointerId, code);
        key(code, true);
      }}
      onPointerUp={e => release(e.pointerId)} onPointerCancel={e => release(e.pointerId)}
      onLostPointerCapture={e => release(e.pointerId)}>{text}</button>
  );

  // What the player should do right now. The scoop is the step people lose track of, so each part of
  // it (scooping, enough rice, palm full, let go too early) has its own line, colour and button.
  const dry = stage === 'scooping' && lokma.dry;
  const hint = stage === 'rolling' ? t.hint.rolling(lokma.rolls, lokma.targetRolls) : dry ? t.hint.dry : t.hint[stage];
  const scoopState = stage === 'scooping' ? 'is-scooping' : stage === 'enough' || stage === 'full' ? 'is-enough' : '';
  const scoopText = stage === 'scooping' ? t.scooping : stage === 'enough' || stage === 'full' ? t.letGo : t.scoop;

  return <div className="touch-controls" aria-label={t.controls}>
    <div className={`touch-guide stage-${stage}${dry ? ' is-dry' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <ol className="touch-steps">
        {t.steps.map((name, i) => (
          <li key={i} className={i < step ? 'is-done' : i === step ? 'is-active' : ''} aria-current={i === step ? 'step' : undefined}>
            <b>{i < step ? '✓' : i + 1}</b><span>{name}</span>
          </li>
        ))}
      </ol>
      {/* Keyed by the stage so the line pops each time the player moves on to the next part. Running out of rice under the hand only re-pops it while still scooping, where it changes the message. */}
      <p key={dry ? 'dry' : stage} className="touch-hint" role="status">{hint}</p>
    </div>
    <Joystick rolling={rolling} active={enabled && !eating} label={rolling ? t.joystickRoll : t.joystick} />
    <div className="touch-actions">
      {button('Space', `touch-scoop ${scoopState}`, t.scoopHold, scoopText, rolling || eating)}
      {button('ArrowUp', `touch-eat${lokma.readyToEat && !eating ? ' is-ready' : ''}`, t.eat, t.eat, !lokma.readyToEat || eating)}
    </div>
  </div>;
}
