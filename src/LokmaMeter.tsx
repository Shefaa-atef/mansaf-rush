import React from 'react';
import { type Lokma, GREEN_FROM, RED_FROM } from './lokma';
import { type Lang, TRANSLATIONS } from './i18n';

/**
 * The gauge belongs to the roll, not the scoop. It shows how round the circle is: yellow is still
 * loose, green is a proper circle, and red means it was rolled too long and squashed. It only
 * appears while the rice is being rolled and once the circle is ready.
 */
export function LokmaMeter({ lokma, lang = 'en' }: { lokma: Lokma; lang?: Lang }) {
  if (lokma.eating || !(lokma.shaping || lokma.readyToEat)) {
    return null;
  }

  const meter = Math.min(100, Math.max(0, lokma.meter));
  const isRound = lokma.meterZone === 'round';
  const isSquashed = lokma.meterZone === 'squashed';
  const t = TRANSLATIONS[lang].meter;
  const looseWidth = `${GREEN_FROM}%`, roundWidth = `${RED_FROM - GREEN_FROM}%`, squashedWidth = `${100 - RED_FROM}%`;

  return (
    <div className={`lokma-meter-compact ${isRound ? 'is-perfect' : ''} ${isSquashed ? 'is-squashed' : ''}`}>
      <div className="meter-bar-track">
        <div className="zone zone-under" style={{ width: looseWidth }} />
        <div className="zone zone-green" style={{ width: roundWidth }} />
        <div className="zone zone-over" style={{ width: squashedWidth }} />

        {/* Dynamic Needle */}
        <div className="meter-needle" style={{ left: `${meter}%` }} />
      </div>

      <div className="meter-zone-labels" aria-hidden="true">
        <span className="label-under" style={{ width: looseWidth }}>{t.zoneLoose}</span>
        <span className="label-green" style={{ width: roundWidth }}>{t.zoneRound}</span>
        <span className="label-over" style={{ width: squashedWidth }}>{t.zoneSquashed}</span>
      </div>

      <div className="meter-status">
        {lokma.shaping ? (
          <span className="badge-hold">
            {t.rollProgress(lokma.rolls, lokma.targetRolls)}
          </span>
        ) : isSquashed ? (
          <span className="badge-warning">{t.squashed}</span>
        ) : (
          <span className="badge-perfect">{t.perfectRound}</span>
        )}
      </div>
    </div>
  );
}
