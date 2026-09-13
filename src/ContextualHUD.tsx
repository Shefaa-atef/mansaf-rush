import React from 'react';
import { type Lokma } from './lokma';
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
  const isPerfect = lokma.meterZone === 'perfect';
  const t = TRANSLATIONS[lang].hud;

  return (
    <div className="contextual-hud-container">
      {/* Micro feedback toast */}
      {showFeedback && feedback && (
        <div className="hud-feedback-toast">{feedback}</div>
      )}

      {/* Meter gauge when gathering or shaping */}
      <LokmaMeter lokma={lokma} lang={lang} />

      {/* Floating gameplay assistant panel */}
      <div
        className={`hud-floating-panel ${
          isPerfect && lokma.gathering ? 'is-target-hit' : lokma.readyToEat ? 'is-target-hit' : ''
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
              <KeyCap wide>SPACE</KeyCap>
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
            {isPerfect ? (
              <div className="release-target-badge">{t.greenZoneBadge}</div>
            ) : (
              <div className="hud-hold-row">
                <span className="hud-label-sub">{t.hold}</span>
                <KeyCap wide>SPACE</KeyCap>
                <span className="hud-label-sub">{t.untilGreen}</span>
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
              <KeyCap wide>SPACE</KeyCap>
              <span className="hud-label-sub">{t.scoop}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
