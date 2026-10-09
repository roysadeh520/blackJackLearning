// Table rules. The first version uses DEFAULT_RULES, but the engine and the
// decision engine read everything from this object so rules can vary later.

export interface TableRules {
  decks: number;
  /** Dealer hits soft 17 (H17) when true, stands on all 17s (S17) when false. */
  dealerHitsSoft17: boolean;
  doubleAfterSplit: boolean;
  /** Late surrender: allowed on the first two cards, after the dealer checks for blackjack. */
  surrender: boolean;
  /** Blackjack payout ratio, e.g. 1.5 for 3:2, 1.2 for 6:5. */
  blackjackPayout: number;
  maxSplitHands: number;
  resplitAces: boolean;
  /** Split aces receive exactly one card each. */
  oneCardOnSplitAces: boolean;
  insurance: boolean;
  /** Dealer checks the hole card for blackjack when showing an ace or a ten. */
  dealerPeeks: boolean;
  /** Fraction of the shoe dealt before the cut card. */
  penetration: number;
  minBet: number;
  maxBet: number;
}

export const DEFAULT_RULES: TableRules = {
  decks: 6,
  dealerHitsSoft17: false,
  doubleAfterSplit: true,
  surrender: true,
  blackjackPayout: 1.5,
  maxSplitHands: 4,
  resplitAces: false,
  oneCardOnSplitAces: true,
  insurance: true,
  dealerPeeks: true,
  penetration: 0.75,
  minBet: 5,
  maxBet: 500,
};
