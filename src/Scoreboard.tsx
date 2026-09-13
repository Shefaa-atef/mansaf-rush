import React, { useEffect, useRef, useState } from 'react';
import { Portrait } from './Portrait';
import { type Lang, TRANSLATIONS } from './i18n';

type FloatingScore = {
  id: number;
  playerId: number;
  diff: number;
};

export function Scoreboard({
  scores,
  names,
  colors,
  traits,
  lang = 'en',
}: {
  scores: number[];
  names: string[];
  colors: string[];
  traits: string[];
  lang?: Lang;
}) {
  const prevScores = useRef<number[]>([...scores]);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const t = TRANSLATIONS[lang].scoreboard;

  useEffect(() => {
    scores.forEach((score, i) => {
      const prev = prevScores.current[i];
      if (score > prev) {
        const diff = score - prev;
        const newFloat: FloatingScore = {
          id: Date.now() + Math.random(),
          playerId: i,
          diff,
        };
        setFloatingScores((curr) => [...curr, newFloat]);

        // Remove floating score after 900ms
        setTimeout(() => {
          setFloatingScores((curr) => curr.filter((f) => f.id !== newFloat.id));
        }, 900);
      }
    });
    prevScores.current = [...scores];
  }, [scores]);

  // Compute live rank
  const rankings = names
    .map((_, id) => ({ id, score: scores[id] }))
    .sort((a, b) => b.score - a.score);
  const rankMap = new Map(rankings.map((r, index) => [r.id, index + 1]));

  return (
    <footer className="scoreboard-footer">
      <div className="scoreboard-grid">
        {names.map((name, i) => {
          const isYou = i === 0;
          const rank = rankMap.get(i) || (i + 1);
          const isLeader = rank === 1;
          const playerFloats = floatingScores.filter((f) => f.playerId === i);

          return (
            <div
              key={i}
              className={`player-card ${isYou ? 'is-you' : ''} ${isLeader ? 'is-leader' : ''}`}
              style={{ '--player-color': colors[i] } as React.CSSProperties}
            >
              {/* Rank Pill Badge */}
              <div className={`rank-pill ${isLeader ? 'gold-rank' : ''}`}>
                {isLeader ? (lang === 'ar' ? '👑 #١' : '👑 #1') : (lang === 'ar' ? `#${rank}` : `#${rank}`)}
              </div>

              {/* Floating +N score popups */}
              {playerFloats.map((f) => (
                <div key={f.id} className="score-pop-anim">
                  +{f.diff}
                </div>
              ))}

              <div className="player-avatar-ring">
                <Portrait id={i} />
              </div>

              <div className="player-info">
                <div className="player-name-row">
                  <span className="player-name">{name}</span>
                  {isYou && <span className="you-badge">{t.youBadge}</span>}
                </div>
                <div className="player-trait">{traits[i]}</div>
              </div>

              <div className="player-score-box">
                <strong className="player-score">{scores[i]}</strong>
                <span className="score-pts">{t.pts}</span>
              </div>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
