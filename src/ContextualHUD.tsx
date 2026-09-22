import React from 'react';
import { type Lokma, MIN_SCOOP } from './lokma';
import { LokmaMeter } from './LokmaMeter';
import { type Lang, TRANSLATIONS } from './i18n';

export function KeyCap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <span className={`key-cap ${wide ? 'key-cap-wide' : ''}`}>{children}</span>;
}

export function ContextualHUD({
  lokma,
  feedback,
  showFeedback,
  lang = 'en',
}: {
  lokma: Lokma;
  feedback: string;
  showFeedback: boolean;
  lang?: Lang;
}) {
  // Enough rice in the palm to roll it. Scooping has no gauge, only this "enough" cue.
  const enoughRice = lokma.gathering && lokma.amount >= MIN_SCOOP;
  const t = TRANSLATIONS[lang].hud;
  const space = TRANSLATIONS[lang].keys.space;

  return (
    <div className="contextual-hud-container">
      {/* Micro feedback toast */}
      {showFeedback && feedback && (
        <div className="hud-feedback-toast">{feedback}</div>
      )}

      {/* Roundness gauge, only while the rice is being rolled into a circle */}
      <LokmaMeter lokma={lokma} lang={lang} />

      {/* Floating gameplay assistant panel */}
      <div
        className={`hud-floating-panel ${
          enoughRice || (lokma.readyToEat && lokma.meterZone === 'round') ? 'is-target-hit' : ''
        }`}
      >
        {lokma.eating ? (
          <div className="hud-state-fade">
            <span className="hud-label-primary">{t.eating}</span>
          </div>
        ) : lokma.readyToEat ? (
          <div className="hud-state-fade">
            <div className="release-target-badge">{t.lokmaReadyBadge}</div>
            <KeyCap>↑</KeyCap>
            <span className="hud-label-action">{t.eatAction}</span>
          </div>
        ) : lokma.shaping ? (
          <div className="hud-state-fade">
            <div className="key-action-group">
              <KeyCap wide>{space}</KeyCap>
              <span className="hud-dot-sep">+</span>
              <KeyCap>←</KeyCap>
              <KeyCap>→</KeyCap>
            </div>
            <span className="hud-label-primary">
              {t.rollProgress(lokma.rolls, lokma.targetRolls)}
            </span>
          </div>
        ) : lokma.gathering ? (
          <div className="hud-state-fade">
            {enoughRice ? (
              <div className="release-target-badge">{t.enoughBadge}</div>
            ) : lokma.dry ? (
              <span className="hud-label-primary">{t.dry}</span>
            ) : (
              <div className="hud-hold-row">
                <span className="hud-label-sub">{t.hold}</span>
                <KeyCap wide>{space}</KeyCap>
                <span className="hud-label-sub">{t.toScoop}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="hud-state-fade">
            <div className="key-action-group">
              <div className="arrows-group">
                <KeyCap>←</KeyCap>
                <KeyCap>↑</KeyCap>
                <KeyCap>↓</KeyCap>
                <KeyCap>→</KeyCap>
              </div>
              <span className="hud-label-sub">{t.move}</span>
            </div>

            <span className="hud-dot-sep">•</span>

            <div className="key-action-group">
              <KeyCap wide>{space}</KeyCap>
              <span className="hud-label-sub">{t.scoop}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
