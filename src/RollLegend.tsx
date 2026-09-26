import { type Lang, TRANSLATIONS } from './i18n';

/**
 * The three zones of the roll gauge as a small colour key for the how-to cards, with the same colours
 * and words as the gauge in the game (see LokmaMeter): loose, then round (stop here and eat), then
 * squashed if the rice is rolled too long.
 */
export function RollLegend({ lang }: { lang: Lang }) {
  const t = TRANSLATIONS[lang].meter;
  return (
    <div className="roll-legend" role="img" aria-label={`${t.zoneLoose}, ${t.zoneRound}, ${t.zoneSquashed}`}>
      <span className="is-loose">{t.zoneLoose}</span>
      <span className="is-round">{t.zoneRound}</span>
      <span className="is-squashed">{t.zoneSquashed}</span>
    </div>
  );
}
