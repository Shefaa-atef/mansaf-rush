export function Portrait({ id }: { id: number }) {
  const skin = id === 3 ? '#c98d63' : '#dca57a';
  return <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
    <defs><clipPath id={`portrait-${id}`}><circle cx="32" cy="32" r="29" /></clipPath><pattern id={`scarf-${id}`} width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#eac8af"/><path d="M0 1 3 4 6 1M0 5 3 8 6 5" stroke="#b3433d" strokeWidth="2" fill="none"/></pattern></defs>
    <g clipPath={`url(#portrait-${id})`}>
      <rect width="64" height="64" fill={['#8473ba','#914839','#548aa3','#536b42'][id]}/>
      <ellipse cx="32" cy="65" rx="24" ry="23" fill={id === 1 ? '#e5d9c4' : '#2d3030'}/>
      {id < 3 && <path d="M10 46V23Q10 4 32 4T54 23V49L45 54H18Z" fill={id === 0 ? '#3b3b46' : id === 1 ? `url(#scarf-${id})` : '#ece2ce'}/>}
      <ellipse cx="32" cy="32" rx="17" ry="22" fill={skin}/>
      {id === 3 ? <path d="M12 25Q3 11 16 9Q16 1 27 5Q35-2 42 7Q56 5 53 18Q59 26 48 28L43 19Q29 25 19 17Z" fill="#30241f"/> : <path d="M12 23Q9 5 31 5Q55 4 52 23Q32 16 12 23" fill={id === 0 ? '#343440' : id === 1 ? `url(#scarf-${id})` : '#f1e5d3'}/>}
      {id === 1 || id === 2 ? <path d="M12 17Q31 26 52 17" stroke="#292521" strokeWidth="5" fill="none"/> : null}
      <path d="M21 29L27 28M37 28L43 29" stroke="#443026" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="24" cy="35" rx="2.1" ry="3.5" fill="#2d241e"/><ellipse cx="40" cy="35" rx="2.1" ry="3.5" fill="#2d241e"/>
      <path d="M30 41Q32 43 34 41" stroke="#b37851" strokeWidth="1.5" fill="none"/>
      {id === 2 && <path d="M17 42Q31 50 47 42Q45 56 32 56Q19 55 17 42" fill="#3e2c22"/>}
      <path d="M27 46Q32 49 37 46" stroke={id === 2 ? '#dba579' : '#80513a'} strokeWidth="2" fill="none" strokeLinecap="round"/>
    </g>
  </svg>;
}
