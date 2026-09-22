import { useEffect, useRef } from 'react';
import type { Lang } from './i18n';
import { MIN_SCOOP, type Lokma } from './lokma';

// Feed the same input path as the keyboard so both controls share the game rules.
const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));

export function TouchControls({ lokma, lang, enabled }: { lokma: Lokma; lang: Lang; enabled: boolean }) {
  const held = useRef(new Map<number, string>());
  const latest = useRef(lokma);
  latest.current = lokma;
  const ar = lang === 'ar';
  const rolling = lokma.shaping || lokma.readyToEat;
  const release = (id: number) => {
    const code = held.current.get(id);
    if (!code) return;
    held.current.delete(id);
    if (![...held.current.values()].includes(code)) key(code, false);
  };
  useEffect(() => {
    const clear = () => { for (const id of held.current.keys()) release(id); };
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
  const button = (code: string, label: string, symbol: string, disabled = false) => (
    <button type="button" className={`touch-key touch-${code}`} aria-label={label} disabled={!enabled || disabled}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current.set(e.pointerId, code);
        const l = latest.current;
        // Older keyboard rules require Space during a roll. Keep that detail out of touch play.
        const roll = (code === 'ArrowLeft' || code === 'ArrowRight') && (l.shaping || l.readyToEat);
        if (roll) key('Space', true);
        key(code, true);
        if (roll) key('Space', false);
      }}
      onPointerUp={e => release(e.pointerId)} onPointerCancel={e => release(e.pointerId)}
      onLostPointerCapture={e => release(e.pointerId)}>{symbol}</button>
  );
  const hint = lokma.eating ? (ar ? 'صحتين!' : 'Enjoy!') : lokma.readyToEat ? (ar ? 'اضغط كُل' : 'Tap Eat') : rolling ? (ar ? 'اضغط يمين ويسار لتدوير اللقمة' : 'Tap left / right to roll') : lokma.gathering && lokma.amount >= MIN_SCOOP ? (ar ? 'اترك زر الجمع، ثم دوّر' : 'Release Scoop, then roll') : (ar ? 'حرّك يدك واضغط مطولاً على جمع' : 'Move + hold Scoop');
  return <div className="touch-controls" aria-label={ar ? 'أزرار اللعب' : 'Game controls'}>
    <p className="touch-hint">{hint}</p>
    <div className="touch-wheel" dir="ltr">
      <div className="wheel-rim" aria-hidden="true" />
      {button('ArrowUp', ar ? 'للأمام' : 'Move forward', '↑', rolling || !!lokma.eating)}
      {button('ArrowLeft', ar ? 'يسار' : 'Turn left / roll left', '‹', !!lokma.eating)}
      {button('ArrowDown', ar ? 'للخلف' : 'Move back', '↓', rolling || !!lokma.eating)}
      {button('ArrowRight', ar ? 'يمين' : 'Turn right / roll right', '›', !!lokma.eating)}
      <span className="wheel-hub" aria-hidden="true">✦</span>
    </div>
    <div className="touch-actions">
      {button('Space', ar ? 'اضغط مطولاً للجمع' : 'Hold to scoop', ar ? 'جمع' : 'Scoop', rolling || !!lokma.eating)}
      {button('ArrowUp', ar ? 'كُل' : 'Eat', ar ? 'كُل' : 'Eat', !lokma.readyToEat || !!lokma.eating)}
    </div>
  </div>;
}
