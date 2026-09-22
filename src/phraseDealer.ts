// Deals indexes 0..size-1 like a shuffled deck of cards: every index comes up
// once before any of them repeats, and a fresh shuffle never opens with the
// index that just closed the previous one. Used so the bots' table-talk
// doesn't say the same thing twice in a row (or twice in a round).

export function createDealer(size: number, random: () => number = Math.random) {
  let deck: number[] = [];
  let last = -1;

  const refill = () => {
    deck = Array.from({ length: size }, (_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    // next() deals from the END of the deck, so keep that card off `last`.
    const end = deck.length - 1;
    if (size > 1 && deck[end] === last) [deck[0], deck[end]] = [deck[end], deck[0]];
  };

  return {
    next(): number {
      if (size <= 0) return 0;
      if (deck.length === 0) refill();
      last = deck.pop()!;
      return last;
    },
  };
}
