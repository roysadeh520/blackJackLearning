// The table engine: seats, betting, dealing, player actions, dealer play and settlement.
// It is UI-agnostic and language-agnostic; the UI reads snapshots and formats text.

import { Card, Rng, Shoe, ShoeState, handValue, isBlackjack, isPair, rankValue } from './cards';
import { DEFAULT_RULES, TableRules } from './rules';

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender';
export const ALL_ACTIONS: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];

export type HandOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender';

export interface PlayerHand {
  id: number;
  cards: Card[];
  bet: number;
  doubled: boolean;
  surrendered: boolean;
  isSplitHand: boolean;
  splitAces: boolean;
  done: boolean;
  outcome?: HandOutcome;
  /** Chips returned to the player at settlement (stake included). */
  payout?: number;
}

export type SeatKind = 'human' | 'bot';

export type LastAction =
  | { type: 'bet'; amount: number }
  | { type: 'action'; action: Action }
  | { type: 'insurance'; taken: boolean }
  | { type: 'blackjack' }
  | { type: 'bust' }
  | { type: 'result'; net: number };

export interface Seat {
  index: number;
  kind: SeatKind | null;
  playerId: string;
  chips: number;
  hands: PlayerHand[];
  inRound: boolean;
  insuranceBet: number;
  insuranceDecided: boolean;
  insurancePayout: number;
  lastAction?: LastAction;
}

export interface DealerState {
  cards: Card[];
  holeHidden: boolean;
}

export type Phase = 'idle' | 'insurance' | 'playerTurns' | 'dealerTurn' | 'roundOver';

export type RoundEvent =
  | { kind: 'shuffle' }
  | { kind: 'bet'; seat: number; amount: number }
  | { kind: 'initialDeal'; seat: number; cards: Card[] }
  | { kind: 'dealerUp'; card: Card }
  | { kind: 'insurance'; seat: number; taken: boolean; amount: number }
  | { kind: 'peek'; dealerBlackjack: boolean }
  | { kind: 'action'; seat: number; hand: number; action: Action; totalBefore: number }
  | { kind: 'card'; seat: number; hand: number; card: Card; total: number }
  | { kind: 'split'; seat: number; hand: number }
  | { kind: 'dealerReveal'; card: Card; total: number }
  | { kind: 'dealerCard'; card: Card; total: number }
  | { kind: 'dealerFinal'; total: number; bust: boolean; blackjack: boolean }
  | { kind: 'result'; seat: number; hand: number; outcome: HandOutcome; bet: number; payout: number };

export interface ActivePosition {
  seat: number;
  hand: number;
}

export interface TableSnapshot {
  phase: Phase;
  seats: Seat[];
  dealer: DealerState;
  active: ActivePosition | null;
  roundNumber: number;
  shuffledThisRound: boolean;
  events: RoundEvent[];
  shoeRemaining: number;
  shoeTotal: number;
  rules: TableRules;
}

/** Everything needed to rebuild an engine mid-round (e.g. after a page refresh). */
export interface EngineState {
  v: 1;
  seats: Seat[];
  dealer: DealerState;
  phase: Phase;
  active: ActivePosition | null;
  roundNumber: number;
  shuffledThisRound: boolean;
  events: RoundEvent[];
  handIdSeq: number;
  shoe: ShoeState;
}

export const SEAT_COUNT = 7;

export class EngineError extends Error {}

function emptySeat(index: number): Seat {
  return {
    index,
    kind: null,
    playerId: '',
    chips: 0,
    hands: [],
    inRound: false,
    insuranceBet: 0,
    insuranceDecided: true,
    insurancePayout: 0,
  };
}

export class BlackjackEngine {
  readonly rules: TableRules;
  readonly shoe: Shoe;
  private seats: Seat[];
  private dealer: DealerState = { cards: [], holeHidden: true };
  private phase: Phase = 'idle';
  private active: ActivePosition | null = null;
  private roundNumber = 0;
  private shuffledThisRound = false;
  private events: RoundEvent[] = [];
  private handIdSeq = 0;

  constructor(rules: TableRules = DEFAULT_RULES, rng?: Rng) {
    this.rules = rules;
    this.shoe = new Shoe(rules.decks, rules.penetration, rng);
    this.seats = Array.from({ length: SEAT_COUNT }, (_, i) => emptySeat(i));
  }

  // ---------- persistence ----------

  serialize(): EngineState {
    return structuredClone({
      v: 1 as const,
      seats: this.seats,
      dealer: this.dealer,
      phase: this.phase,
      active: this.active,
      roundNumber: this.roundNumber,
      shuffledThisRound: this.shuffledThisRound,
      events: this.events,
      handIdSeq: this.handIdSeq,
      shoe: this.shoe.toState(),
    });
  }

  static restore(state: EngineState, rules: TableRules = DEFAULT_RULES, rng?: Rng): BlackjackEngine {
    if (state?.v !== 1 || !Array.isArray(state.seats) || state.seats.length !== SEAT_COUNT) throw new EngineError('מצב שמור לא תקין');
    const e = new BlackjackEngine(rules, rng);
    const s = structuredClone(state);
    e.shoe.loadState(s.shoe);
    e.seats = s.seats;
    e.dealer = s.dealer;
    e.phase = s.phase;
    e.active = s.active;
    e.roundNumber = s.roundNumber;
    e.shuffledThisRound = s.shuffledThisRound;
    e.events = s.events;
    e.handIdSeq = s.handIdSeq;
    return e;
  }

  // ---------- seating ----------

  sit(index: number, kind: SeatKind, playerId: string, chips: number): void {
    this.assertPhase('idle', 'roundOver');
    const seat = this.seats[index];
    if (!seat) throw new EngineError('אין מושב כזה');
    this.seats[index] = { ...emptySeat(index), kind, playerId, chips };
  }

  leave(index: number): void {
    this.assertPhase('idle', 'roundOver');
    this.seats[index] = emptySeat(index);
  }

  setChips(index: number, chips: number): void {
    this.seats[index].chips = chips;
  }

  // ---------- read model ----------

  snapshot(): TableSnapshot {
    return structuredClone({
      phase: this.phase,
      seats: this.seats,
      dealer: this.dealer,
      active: this.active,
      roundNumber: this.roundNumber,
      shuffledThisRound: this.shuffledThisRound,
      events: this.events,
      shoeRemaining: this.shoe.remaining,
      shoeTotal: this.shoe.total,
      rules: this.rules,
    });
  }

  getPhase(): Phase {
    return this.phase;
  }

  getActive(): ActivePosition | null {
    return this.active ? { ...this.active } : null;
  }

  getSeat(index: number): Readonly<Seat> {
    return this.seats[index];
  }

  dealerUpCard(): Card | undefined {
    return this.dealer.cards[0];
  }

  // ---------- round start ----------

  /** bets: seat index -> amount. Seats without a bet sit the round out. */
  startRound(bets: Record<number, number>): void {
    this.assertPhase('idle', 'roundOver');
    const entries = Object.entries(bets)
      .map(([k, v]) => [Number(k), v] as const)
      .filter(([, v]) => v > 0);
    if (entries.length === 0) throw new EngineError('אין הימורים');
    for (const [i, amount] of entries) {
      const seat = this.seats[i];
      if (!seat || seat.kind === null) throw new EngineError('מושב ריק');
      if (amount > seat.chips) throw new EngineError('אין מספיק צ׳יפים');
    }

    this.roundNumber++;
    this.events = [];
    this.shuffledThisRound = false;
    if (this.shoe.needsShuffle) {
      this.shoe.shuffle();
      this.shuffledThisRound = true;
      this.events.push({ kind: 'shuffle' });
    }

    for (const seat of this.seats) {
      seat.hands = [];
      seat.inRound = false;
      seat.insuranceBet = 0;
      seat.insurancePayout = 0;
      seat.insuranceDecided = true;
    }
    for (const [i, amount] of entries) {
      const seat = this.seats[i];
      seat.chips -= amount;
      seat.inRound = true;
      seat.hands = [this.newHand(amount)];
      seat.lastAction = { type: 'bet', amount };
      this.events.push({ kind: 'bet', seat: i, amount });
    }

    // Two passes around the table, seat order, dealer last. Second dealer card is the hole card.
    this.dealer = { cards: [], holeHidden: true };
    for (let pass = 0; pass < 2; pass++) {
      for (const seat of this.playingSeats()) seat.hands[0].cards.push(this.shoe.draw());
      this.dealer.cards.push(this.shoe.draw());
    }
    for (const seat of this.playingSeats()) {
      this.events.push({ kind: 'initialDeal', seat: seat.index, cards: [...seat.hands[0].cards] });
    }
    this.events.push({ kind: 'dealerUp', card: this.dealer.cards[0] });

    if (this.rules.insurance && this.dealer.cards[0].rank === 'A') {
      for (const seat of this.playingSeats()) seat.insuranceDecided = false;
      this.phase = 'insurance';
      this.active = null;
      return;
    }
    this.afterInsurance();
  }

  private newHand(bet: number, cards: Card[] = []): PlayerHand {
    return {
      id: this.handIdSeq++,
      cards,
      bet,
      doubled: false,
      surrendered: false,
      isSplitHand: false,
      splitAces: false,
      done: false,
    };
  }

  private playingSeats(): Seat[] {
    return this.seats.filter((s) => s.inRound);
  }

  // ---------- insurance ----------

  canTakeInsurance(seatIndex: number): boolean {
    const seat = this.seats[seatIndex];
    return (
      this.phase === 'insurance' &&
      seat.inRound &&
      !seat.insuranceDecided &&
      seat.chips >= seat.hands[0].bet / 2
    );
  }

  insuranceCost(seatIndex: number): number {
    return this.seats[seatIndex].hands[0]?.bet / 2 || 0;
  }

  decideInsurance(seatIndex: number, take: boolean): void {
    this.assertPhase('insurance');
    const seat = this.seats[seatIndex];
    if (!seat.inRound || seat.insuranceDecided) throw new EngineError('אין אפשרות לביטוח');
    if (take) {
      const cost = seat.hands[0].bet / 2;
      if (seat.chips < cost) throw new EngineError('אין מספיק צ׳יפים לביטוח');
      seat.chips -= cost;
      seat.insuranceBet = cost;
    }
    seat.insuranceDecided = true;
    seat.lastAction = { type: 'insurance', taken: take };
    this.events.push({ kind: 'insurance', seat: seatIndex, taken: take, amount: seat.insuranceBet });
    if (this.playingSeats().every((s) => s.insuranceDecided)) this.afterInsurance();
  }

  pendingInsuranceSeats(): number[] {
    return this.playingSeats()
      .filter((s) => !s.insuranceDecided)
      .map((s) => s.index);
  }

  private afterInsurance(): void {
    const up = this.dealer.cards[0];
    const dealerBJ = isBlackjack(this.dealer.cards);
    const peeks = this.rules.dealerPeeks && (up.rank === 'A' || rankValue(up.rank) === 10);
    if (peeks) {
      this.events.push({ kind: 'peek', dealerBlackjack: dealerBJ });
      if (dealerBJ) {
        this.revealHole();
        for (const seat of this.playingSeats()) seat.hands[0].done = true;
        this.settle();
        return;
      }
    }
    for (const seat of this.playingSeats()) {
      const hand = seat.hands[0];
      if (isBlackjack(hand.cards)) {
        hand.done = true;
        seat.lastAction = { type: 'blackjack' };
      }
    }
    this.phase = 'playerTurns';
    this.active = null;
    this.advance();
  }

  // ---------- player turns ----------

  availableActions(pos: ActivePosition | null = this.active): Action[] {
    if (this.phase !== 'playerTurns' || !pos) return [];
    const seat = this.seats[pos.seat];
    const hand = seat.hands[pos.hand];
    if (!hand || hand.done) return [];
    const actions: Action[] = ['hit', 'stand'];
    const firstTwo = hand.cards.length === 2;
    const affordable = seat.chips >= hand.bet;
    if (
      firstTwo &&
      affordable &&
      !hand.splitAces &&
      (!hand.isSplitHand || this.rules.doubleAfterSplit)
    ) {
      actions.push('double');
    }
    if (
      firstTwo &&
      affordable &&
      isPair(hand.cards) &&
      seat.hands.length < this.rules.maxSplitHands &&
      (!hand.splitAces || this.rules.resplitAces)
    ) {
      actions.push('split');
    }
    if (this.rules.surrender && firstTwo && !hand.isSplitHand && seat.hands.length === 1) {
      actions.push('surrender');
    }
    return actions;
  }

  act(action: Action): void {
    this.assertPhase('playerTurns');
    const pos = this.active;
    if (!pos) throw new EngineError('אין יד פעילה');
    if (!this.availableActions(pos).includes(action)) throw new EngineError('הפעולה אינה זמינה');
    const seat = this.seats[pos.seat];
    const hand = seat.hands[pos.hand];
    this.events.push({
      kind: 'action',
      seat: pos.seat,
      hand: pos.hand,
      action,
      totalBefore: handValue(hand.cards).total,
    });
    seat.lastAction = { type: 'action', action };

    switch (action) {
      case 'hit':
        this.dealTo(pos);
        this.autoFinish(pos);
        break;
      case 'stand':
        hand.done = true;
        break;
      case 'double':
        seat.chips -= hand.bet;
        hand.bet *= 2;
        hand.doubled = true;
        this.dealTo(pos);
        hand.done = true;
        if (handValue(hand.cards).isBust) seat.lastAction = { type: 'bust' };
        break;
      case 'surrender':
        hand.surrendered = true;
        hand.done = true;
        break;
      case 'split': {
        seat.chips -= hand.bet;
        const [a, b] = hand.cards;
        const aces = a.rank === 'A';
        hand.cards = [a];
        hand.isSplitHand = true;
        hand.splitAces = aces;
        const second = this.newHand(hand.bet, [b]);
        second.isSplitHand = true;
        second.splitAces = aces;
        seat.hands.splice(pos.hand + 1, 0, second);
        this.events.push({ kind: 'split', seat: pos.seat, hand: pos.hand });
        this.dealTo(pos);
        if (aces && this.rules.oneCardOnSplitAces) {
          // Each split ace receives exactly one card. Resplitting is still offered if allowed.
          if (!(this.rules.resplitAces && isPair(hand.cards))) hand.done = true;
        } else {
          this.autoFinish(pos);
        }
        break;
      }
    }
    this.advance();
  }

  private dealTo(pos: ActivePosition): Card {
    const hand = this.seats[pos.seat].hands[pos.hand];
    const c = this.shoe.draw();
    hand.cards.push(c);
    this.events.push({ kind: 'card', seat: pos.seat, hand: pos.hand, card: c, total: handValue(hand.cards).total });
    return c;
  }

  /** A hand that busts or reaches 21 needs no further decision. */
  private autoFinish(pos: ActivePosition): void {
    const seat = this.seats[pos.seat];
    const hand = seat.hands[pos.hand];
    const v = handValue(hand.cards);
    if (v.isBust) {
      hand.done = true;
      seat.lastAction = { type: 'bust' };
    } else if (v.total === 21) {
      hand.done = true;
    }
  }

  /** Move `active` to the next hand needing a decision, or to the dealer. */
  private advance(): void {
    const order = this.playingSeats();
    let startSeat = 0;
    let startHand = 0;
    if (this.active) {
      startSeat = order.findIndex((s) => s.index === this.active!.seat);
      startHand = this.active.hand;
    }
    for (let si = Math.max(0, startSeat); si < order.length; si++) {
      const seat = order[si];
      for (let hi = si === startSeat ? startHand : 0; hi < seat.hands.length; hi++) {
        const hand = seat.hands[hi];
        if (hand.done) continue;
        const pos = { seat: seat.index, hand: hi };
        // Second hand of a split receives its second card when play reaches it.
        if (hand.cards.length === 1) {
          this.dealTo(pos);
          if (hand.splitAces && this.rules.oneCardOnSplitAces) {
            if (!(this.rules.resplitAces && isPair(hand.cards) && seat.hands.length < this.rules.maxSplitHands)) {
              hand.done = true;
              continue;
            }
          }
          this.autoFinish(pos);
          if (hand.done) continue;
        }
        this.active = pos;
        return;
      }
    }
    this.active = null;
    this.phase = 'dealerTurn';
  }

  // ---------- dealer ----------

  /** True if any player hand is still live, so the dealer must draw. */
  private dealerMustPlay(): boolean {
    return this.playingSeats().some((s) =>
      s.hands.some((h) => !h.surrendered && !handValue(h.cards).isBust && !(isBlackjack(h.cards) && !h.isSplitHand)),
    );
  }

  dealerShouldHit(): boolean {
    const v = handValue(this.dealer.cards);
    if (v.total < 17) return true;
    return v.total === 17 && v.soft && this.rules.dealerHitsSoft17;
  }

  private revealHole(): void {
    if (!this.dealer.holeHidden) return;
    this.dealer.holeHidden = false;
    this.events.push({
      kind: 'dealerReveal',
      card: this.dealer.cards[1],
      total: handValue(this.dealer.cards).total,
    });
  }

  /**
   * Advance the dealer one visible step so the UI can animate:
   * 'reveal' -> hole card turned, 'draw' -> one card drawn, 'settled' -> round over.
   */
  dealerStep(): 'reveal' | 'draw' | 'settled' {
    this.assertPhase('dealerTurn');
    if (this.dealer.holeHidden) {
      this.revealHole();
      return 'reveal';
    }
    if (this.dealerMustPlay() && this.dealerShouldHit()) {
      const c = this.shoe.draw();
      this.dealer.cards.push(c);
      this.events.push({ kind: 'dealerCard', card: c, total: handValue(this.dealer.cards).total });
      return 'draw';
    }
    this.settle();
    return 'settled';
  }

  /** Run the dealer to completion (tests and fast mode). */
  playDealer(): void {
    while (this.phase === 'dealerTurn') this.dealerStep();
  }

  // ---------- settlement ----------

  private settle(): void {
    const dv = handValue(this.dealer.cards);
    const dealerBJ = isBlackjack(this.dealer.cards);
    this.events.push({ kind: 'dealerFinal', total: dv.total, bust: dv.isBust, blackjack: dealerBJ });

    for (const seat of this.playingSeats()) {
      let net = -seat.insuranceBet;
      if (seat.insuranceBet > 0 && dealerBJ) {
        seat.insurancePayout = seat.insuranceBet * 3;
        net += seat.insurancePayout;
      }
      seat.hands.forEach((hand, hi) => {
        const { outcome, payout } = this.resolveHand(hand, dv.total, dv.isBust, dealerBJ);
        hand.outcome = outcome;
        hand.payout = payout;
        hand.done = true;
        net += payout - hand.bet;
        this.events.push({ kind: 'result', seat: seat.index, hand: hi, outcome, bet: hand.bet, payout });
      });
      seat.chips += seat.insurancePayout + seat.hands.reduce((s, h) => s + (h.payout ?? 0), 0);
      seat.lastAction = { type: 'result', net };
    }
    this.active = null;
    this.phase = 'roundOver';
  }

  private resolveHand(
    hand: PlayerHand,
    dealerTotal: number,
    dealerBust: boolean,
    dealerBJ: boolean,
  ): { outcome: HandOutcome; payout: number } {
    if (hand.surrendered) return { outcome: 'surrender', payout: hand.bet / 2 };
    const v = handValue(hand.cards);
    if (v.isBust) return { outcome: 'bust', payout: 0 };
    const natural = isBlackjack(hand.cards) && !hand.isSplitHand;
    if (natural) {
      if (dealerBJ) return { outcome: 'push', payout: hand.bet };
      return { outcome: 'blackjack', payout: hand.bet + hand.bet * this.rules.blackjackPayout };
    }
    if (dealerBJ) return { outcome: 'lose', payout: 0 };
    if (dealerBust || v.total > dealerTotal) return { outcome: 'win', payout: hand.bet * 2 };
    if (v.total === dealerTotal) return { outcome: 'push', payout: hand.bet };
    return { outcome: 'lose', payout: 0 };
  }

  /**
   * Void the round in progress: every stake (bets, doubles, splits, insurance)
   * goes back to its owner and the table returns to betting. Used when a player
   * ends the game in the middle of a hand.
   */
  cancelRound(): void {
    if (this.phase === 'idle' || this.phase === 'roundOver') return;
    for (const seat of this.playingSeats()) {
      seat.chips += seat.hands.reduce((sum, h) => sum + h.bet, 0) + seat.insuranceBet;
      seat.hands = [];
      seat.inRound = false;
      seat.insuranceBet = 0;
      seat.insuranceDecided = true;
      seat.lastAction = undefined;
    }
    this.dealer = { cards: [], holeHidden: true };
    this.active = null;
    this.events = [];
    this.phase = 'idle';
  }

  /** Net chip result of the last round for a seat (after settlement). */
  netForSeat(index: number): number {
    const seat = this.seats[index];
    if (!seat.inRound) return 0;
    const staked = seat.hands.reduce((s, h) => s + h.bet, 0) + seat.insuranceBet;
    const returned = seat.hands.reduce((s, h) => s + (h.payout ?? 0), 0) + seat.insurancePayout;
    return returned - staked;
  }

  private assertPhase(...phases: Phase[]): void {
    if (!phases.includes(this.phase)) throw new EngineError(`שלב לא תקין: ${this.phase}`);
  }
}
