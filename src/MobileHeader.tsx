import React from 'react';
import { formatNumber } from './formatNumber';
import { Portrait } from './Portrait';

export function MobileHeader({ scores, names, remaining, onMenu }: { scores: number[]; names: string[]; remaining: number; onMenu: () => void }) {
  return <div className="mobile-header" dir="ltr">
    <button className="mobile-header-menu" onClick={onMenu} aria-label="Open menu">☰</button>
    <div className="mobile-header-brand"><span>MANSAF</span><strong>RUSH</strong></div>
    <div className="mobile-header-remaining"><small>MANSAF</small><b>{formatNumber(remaining)}%</b></div>
    <div className="mobile-header-players">
      {names.map((name, i) => <div className={`mobile-header-player ${i === 0 ? 'is-you' : ''}`} key={name}>
        <Portrait id={i} name={name} /><span>{formatNumber(scores[i])}</span>
      </div>)}
    </div>
  </div>;
}
