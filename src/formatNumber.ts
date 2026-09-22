// One place that decides how numbers look on screen: at most two decimals,
// no trailing zeros, always plain 0-9 digits (the Arabic UI already shows
// scores and percentages that way).

/** Rounds to at most two decimals, e.g. 87.6399999 becomes 87.64. */
export const roundTo2 = (value: number): number => {
  const rounded = Number((Number.isFinite(value) ? value : 0).toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
};

/** Text for any number shown in the UI: 12 -> "12", 3.5 -> "3.5", 2.345 -> "2.35". */
export const formatNumber = (value: number): string => String(roundTo2(value));
