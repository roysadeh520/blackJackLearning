// Practice scenario generation for "תרגול מהיר" and "תרגל את הטעויות שלי".

import { Card, Rank, RANKS, SUITS, card, isPair, handValue } from '../engine/cards';
import type { Action } from '../engine/game';
import type { TableRules } from '../engine/rules';

export interface Scenario {
  playerCards: Card[];
  dealerUp: Card;
  available: Action[];
  /** Key of the mistake this scenario retrains, if any. */
  fromMistake?: string;
}

const pick = <T,>(arr: readonly T[], rng: () => number) => arr[Math.floor(rng() * arr.length)];

function withSuit(rank: Rank, rng: () => number): Card {
  return card(rank, pick(SUITS, rng));
}

export function availableFor(cards: Card[], rules: TableRules): Action[] {
  const a: Action[] = ['hit', 'stand', 'double'];
  if (isPair(cards)) a.push('split');
  if (rules.surrender) a.push('surrender');
  return a;
}

/**
 * Random two-card decision, biased away from trivial spots (e.g. 20 or 5)
 * toward the hands people get wrong: 12-16, soft hands, pairs, doubles.
 */
export function randomScenario(rules: TableRules, rng: () => number = Math.random): Scenario {
  for (let tries = 0; tries < 50; tries++) {
    const r = rng();
    let a: Rank;
    let b: Rank;
    if (r < 0.2) {
      a = pick(RANKS, rng);
      b = a; // pair
    } else if (r < 0.4) {
      a = 'A';
      b = pick(['2', '3', '4', '5', '6', '7', '8', '9'] as Rank[], rng);
    } else {
      a = pick(RANKS, rng);
      b = pick(RANKS, rng);
    }
    const cards = [withSuit(a, rng), withSuit(b, rng)];
    const v = handValue(cards);
    if (v.total === 21) continue;
    if (!v.soft && !isPair(cards) && (v.total >= 19 || v.total <= 7) && rng() < 0.85) continue;
    return { playerCards: cards, dealerUp: withSuit(pick(RANKS, rng), rng), available: availableFor(cards, rules) };
  }
  const cards = [card('10'), card('6')];
  return { playerCards: cards, dealerUp: card('10'), available: availableFor(cards, rules) };
}

export function scenarioFromMistake(
  m: { playerCards: Rank[]; dealerUp: Rank; key: string },
  rules: TableRules,
  rng: () => number = Math.random,
): Scenario {
  const cards = m.playerCards.map((r) => withSuit(r, rng));
  // Mistakes on 3+ card hands are retrained with the same cards; double is not allowed then.
  const available: Action[] = cards.length === 2 ? availableFor(cards, rules) : ['hit', 'stand'];
  return { playerCards: cards, dealerUp: withSuit(m.dealerUp, rng), available, fromMistake: m.key };
}
