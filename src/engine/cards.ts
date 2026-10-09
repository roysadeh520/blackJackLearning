// Card model, hand evaluation and a real multi-deck shoe.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  rank: Rank;
  suit: Suit;
  /** Unique id inside the shoe, used as a React key and for animation. */
  id: string;
}

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Blackjack value of a single rank; aces count as 1 here (soft handled in handValue). */
export function rankValue(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export interface HandValue {
  total: number;
  /** True when an ace is currently counted as 11. */
  soft: boolean;
  isBust: boolean;
}

export function handValue(cards: readonly Pick<Card, 'rank'>[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  // Promote at most one ace from 1 to 11 when it does not bust the hand.
  const soft = aces > 0 && total + 10 <= 21;
  if (soft) total += 10;
  return { total, soft, isBust: total > 21 };
}

export function isBlackjack(cards: readonly Pick<Card, 'rank'>[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Two cards of equal blackjack value (10-J-Q-K count as a pair of tens). */
export function isPair(cards: readonly Pick<Card, 'rank'>[]): boolean {
  return cards.length === 2 && rankValue(cards[0].rank) === rankValue(cards[1].rank);
}

export type Rng = () => number;

export function shuffleInPlace<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Small deterministic PRNG for tests and reproducible shuffles. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDecks(deckCount: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ rank, suit, id: `${d}-${suit}-${rank}` });
    }
  }
  return cards;
}

/**
 * A logical shoe: decks are built, shuffled once, and cards are drawn in order.
 * When the cut card is reached the shoe asks to be reshuffled before the next round.
 */
export class Shoe {
  private cards: Card[] = [];
  private position = 0;
  private cutIndex = 0;
  private shuffleCount = 0;

  constructor(
    readonly deckCount: number,
    /** Fraction of the shoe dealt before reshuffling (0..1). */
    readonly penetration: number,
    private readonly rng: Rng = Math.random,
  ) {
    this.shuffle();
  }

  shuffle(): void {
    this.cards = shuffleInPlace(buildDecks(this.deckCount), this.rng).map((c) => ({
      ...c,
      id: `${c.id}#${this.shuffleCount}`,
    }));
    this.shuffleCount++;
    this.position = 0;
    this.cutIndex = Math.floor(this.cards.length * this.penetration);
  }

  /** Deal the next card. If the shoe is somehow exhausted mid-round it reshuffles. */
  draw(): Card {
    if (this.position >= this.cards.length) this.shuffle();
    return this.cards[this.position++];
  }

  get needsShuffle(): boolean {
    return this.position >= this.cutIndex;
  }

  get remaining(): number {
    return this.cards.length - this.position;
  }

  get total(): number {
    return this.cards.length;
  }

  /** Test helper: put specific cards on top of the shoe, in draw order. */
  stack(top: Card[]): void {
    this.cards.splice(this.position, 0, ...top);
  }
}

let manualId = 0;
/** Convenience for tests and practice scenarios. */
export function card(rank: Rank, suit: Suit = 'spades'): Card {
  return { rank, suit, id: `m${manualId++}-${rank}-${suit}` };
}
