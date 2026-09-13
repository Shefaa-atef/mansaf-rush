import React from 'react';
import { type Lokma } from './lokma';
import { type Lang, TRANSLATIONS } from './i18n';

export function LokmaMeter({ lokma, lang = 'en' }: { lokma: Lokma; lang?: Lang }) {
  if (lokma.eating || (lokma.meter === 0 && !lokma.gathering && !lokma.shaping && !lokma.readyToEat)) {
    return null;
  }

  const meter = Math.min(100, Math.max(0, lokma.meter));
  const isPerfect = lokma.meterZone === 'perfect';
  const isOverfilled = lokma.meterZone === 'overfilled';
  const t = TRANSLATIONS[lang].meter;

  return (
    <div className={`lokma-meter-compact ${isPerfect ? 'is-perfect' : ''}`}>
      <div className="meter-bar-track">
        <div className="zone zone-under" style={{ width: '45%' }} />
        <div className="zone zone-green" style={{ width: '35%' }} />
        <div className="zone zone-over" style={{ width: '20%' }} />

        {/* Dynamic Needle */}
        <div className="meter-needle" style={{ left: `${meter}%` }} />
      </div>

      <div className="meter-status">
        {lokma.gathering ? (
          isPerfect ? (
            <span className="badge-release">{t.holdToRoll}</span>
          ) : isOverfilled ? (
            <span className="badge-warning">{t.tooMuchRoll}</span>
          ) : (
            <span className="badge-hold">{t.gatheringRice}</span>
          )
        ) : lokma.shaping ? (
          <span className="badge-hold">
            {t.rollProgress(lokma.rolls, lokma.targetRolls)}
          </span>
        ) : lokma.readyToEat ? (
          isPerfect ? (
            <span className="badge-perfect">{t.perfectRound}</span>
          ) : isOverfilled ? (
            <span className="badge-warning">{t.squashed}</span>
          ) : (
            <span className="badge-under">{t.underfilled}</span>
          )
        ) : null}
      </div>
    </div>
  );
}
