import { BlackjackEngine } from '../src/engine/game';
import { Shoe, card, handValue, isBlackjack, isPair, seededRng, Rank } from '../src/engine/cards';
import { DEFAULT_RULES } from '../src/engine/rules';

const c = (r: Rank) => card(r);

/** Engine with one human seat (index 3) and the given cards on top of the shoe. */
function setup(top: Rank[], opts: { chips?: number; extraSeats?: number[] } = {}) {
  const e = new BlackjackEngine(DEFAULT_RULES, seededRng(42));
  e.sit(3, 'human', 'me', opts.chips ?? 1000);
  for (const s of opts.extraSeats ?? []) e.sit(s, 'bot', `bot${s}`, 1000);
  e.shoe.stack(top.map(c));
  return e;
}

describe('cards', () => {
  it('counts aces as 11 then 1', () => {
    expect(handValue([c('A'), c('6')])).toEqual({ total: 17, soft: true, isBust: false });
    expect(handValue([c('A'), c('6'), c('9')])).toEqual({ total: 16, soft: false, isBust: false });
    expect(handValue([c('A'), c('A'), c('9')])).toEqual({ total: 21, soft: true, isBust: false });
    expect(handValue([c('K'), c('Q'), c('5')]).isBust).toBe(true);
  });
  it('detects blackjack and pairs', () => {
    expect(isBlackjack([c('A'), c('K')])).toBe(true);
    expect(isBlackjack([c('7'), c('7'), c('7')])).toBe(false);
    expect(isPair([c('K'), c('Q')])).toBe(true);
    expect(isPair([c('8'), c('9')])).toBe(false);
  });
  it('shoe deals every card once and flags reshuffle at the cut card', () => {
    const shoe = new Shoe(1, 0.5, seededRng(1));
    const seen = new Set<string>();
    for (let i = 0; i < 26; i++) seen.add(shoe.draw().id);
    expect(seen.size).toBe(26);
    expect(shoe.needsShuffle).toBe(true);
    shoe.shuffle();
    expect(shoe.remaining).toBe(52);
  });
});

describe('engine rounds', () => {
  it('player stands and wins', () => {
    // player 10, dealer 9 ; player 9, dealer 8 -> player 19 vs dealer 17
    const e = setup(['10', '9', '9', '8']);
    e.startRound({ 3: 100 });
    expect(e.getPhase()).toBe('playerTurns');
    e.act('stand');
    e.playDealer();
    const s = e.snapshot();
    expect(s.seats[3].hands[0].outcome).toBe('win');
    expect(s.seats[3].chips).toBe(1100);
  });

  it('push returns the bet', () => {
    const e = setup(['10', '10', '8', '8']);
    e.startRound({ 3: 50 });
    e.act('stand');
    e.playDealer();
    expect(e.snapshot().seats[3].hands[0].outcome).toBe('push');
    expect(e.snapshot().seats[3].chips).toBe(1000);
  });

  it('bust loses immediately and dealer does not draw', () => {
    // player 10+6, dealer 10+5 (hole) -> player hits K -> bust
    const e = setup(['10', '10', '6', '5', 'K']);
    e.startRound({ 3: 25 });
    e.act('hit');
    expect(e.getPhase()).toBe('dealerTurn');
    e.playDealer();
    const s = e.snapshot();
    expect(s.dealer.cards).toHaveLength(2);
    expect(s.seats[3].hands[0].outcome).toBe('bust');
    expect(s.seats[3].chips).toBe(975);
  });

  it('pays blackjack 3:2', () => {
    const e = setup(['A', '9', 'K', '7']);
    e.startRound({ 3: 10 });
    expect(e.getPhase()).toBe('dealerTurn');
    e.playDealer();
    const s = e.snapshot();
    expect(s.seats[3].hands[0].outcome).toBe('blackjack');
    expect(s.seats[3].chips).toBe(1015);
  });

  it('dealer blackjack with ten up ends the round after the peek', () => {
    const e = setup(['10', 'K', '9', 'A']);
    e.startRound({ 3: 20 });
    expect(e.getPhase()).toBe('roundOver');
    const s = e.snapshot();
    expect(s.dealer.holeHidden).toBe(false);
    expect(s.seats[3].hands[0].outcome).toBe('lose');
    expect(s.seats[3].chips).toBe(980);
  });

  it('player and dealer blackjack push', () => {
    const e = setup(['A', 'K', 'Q', 'A']);
    e.startRound({ 3: 20 });
    expect(e.getPhase()).toBe('roundOver');
    expect(e.snapshot().seats[3].hands[0].outcome).toBe('push');
    expect(e.snapshot().seats[3].chips).toBe(1000);
  });

  it('insurance pays 2:1 when dealer has blackjack', () => {
    const e = setup(['10', 'A', '9', 'K']);
    e.startRound({ 3: 20 });
    expect(e.getPhase()).toBe('insurance');
    e.decideInsurance(3, true);
    expect(e.getPhase()).toBe('roundOver');
    // lost 20 main bet, insurance 10 returns 30 -> net 0
    expect(e.snapshot().seats[3].chips).toBe(1000);
    expect(e.netForSeat(3)).toBe(0);
  });

  it('insurance is lost when dealer has no blackjack', () => {
    const e = setup(['10', 'A', '9', '6', '5']);
    e.startRound({ 3: 20 });
    e.decideInsurance(3, true);
    expect(e.getPhase()).toBe('playerTurns');
    e.act('stand');
    e.playDealer(); // dealer A+6 = soft 17, stands (S17) ; player 19 wins
    const s = e.snapshot();
    expect(s.seats[3].hands[0].outcome).toBe('win');
    expect(s.seats[3].chips).toBe(1000 - 10 + 20);
  });

  it('double takes exactly one card and doubles the bet', () => {
    // player 6+5=11, dealer 10+7, double gets 10 -> 21
    const e = setup(['6', '10', '5', '7', '10']);
    e.startRound({ 3: 50 });
    expect(e.availableActions()).toContain('double');
    e.act('double');
    expect(e.getPhase()).toBe('dealerTurn');
    e.playDealer();
    const s = e.snapshot();
    expect(s.seats[3].hands[0].bet).toBe(100);
    expect(s.seats[3].hands[0].cards).toHaveLength(3);
    expect(s.seats[3].chips).toBe(1100);
  });

  it('split creates two hands, each played separately', () => {
    // player 8,8 ; dealer 10,7 ; split: first hand gets 3 (11) -> stand ; second gets 10 (18) -> stand
    const e = setup(['8', '10', '8', '7', '3', '10']);
    e.startRound({ 3: 10 });
    expect(e.availableActions()).toContain('split');
    e.act('split');
    let s = e.snapshot();
    expect(s.seats[3].hands).toHaveLength(2);
    expect(s.active).toEqual({ seat: 3, hand: 0 });
    e.act('stand');
    s = e.snapshot();
    expect(s.active).toEqual({ seat: 3, hand: 1 });
    expect(s.seats[3].hands[1].cards).toHaveLength(2);
    e.act('stand');
    e.playDealer();
    s = e.snapshot();
    expect(s.seats[3].hands.map((h) => h.outcome)).toEqual(['lose', 'win']);
    expect(s.seats[3].chips).toBe(1000);
  });

  it('split aces get one card each and 21 is not blackjack', () => {
    const e = setup(['A', '9', 'A', '8', 'K', '5']);
    e.startRound({ 3: 10 });
    e.act('split');
    expect(e.getPhase()).toBe('dealerTurn');
    e.playDealer();
    const s = e.snapshot();
    // A+K = 21 (paid 1:1), A+5 = 16 vs dealer 17 -> lose
    expect(s.seats[3].hands.map((h) => h.outcome)).toEqual(['win', 'lose']);
    expect(s.seats[3].chips).toBe(1000);
  });

  it('double after split is allowed', () => {
    const e = setup(['4', '10', '4', '6', '7', '2']);
    e.startRound({ 3: 10 });
    e.act('split');
    expect(e.availableActions()).toContain('double');
    expect(e.availableActions()).not.toContain('surrender');
  });

  it('surrender returns half the bet', () => {
    const e = setup(['10', '10', '6', '7']);
    e.startRound({ 3: 50 });
    e.act('surrender');
    e.playDealer();
    expect(e.snapshot().seats[3].hands[0].outcome).toBe('surrender');
    expect(e.snapshot().seats[3].chips).toBe(975);
  });

  it('soft hand turns hard after an ace switches from 11 to 1', () => {
    const e = setup(['A', '10', '6', '8', '9', '4']);
    e.startRound({ 3: 10 });
    e.act('hit'); // A+6+9 = 16 hard
    const h = e.snapshot().seats[3].hands[0];
    expect(handValue(h.cards)).toEqual({ total: 16, soft: false, isBust: false });
    e.act('hit'); // +4 = 20
    expect(e.getPhase()).toBe('playerTurns');
  });

  it('cannot double or split without enough chips, cannot bet more than chips', () => {
    const e = setup(['8', '10', '8', '7'], { chips: 15 });
    e.startRound({ 3: 10 });
    expect(e.availableActions()).toEqual(['hit', 'stand', 'surrender']);
    const e2 = setup([], { chips: 5 });
    expect(() => e2.startRound({ 3: 10 })).toThrow();
  });

  it('plays seats in order with several players', () => {
    // seats 0,3,6 ; deal order: s0,s3,s6,dealer x2
    const e = setup(['10', '10', '10', '10', '7', '8', '9', '7'], { extraSeats: [0, 6] });
    e.startRound({ 0: 10, 3: 10, 6: 10 });
    expect(e.getActive()).toEqual({ seat: 0, hand: 0 });
    e.act('stand');
    expect(e.getActive()).toEqual({ seat: 3, hand: 0 });
    e.act('stand');
    expect(e.getActive()).toEqual({ seat: 6, hand: 0 });
    e.act('stand');
    e.playDealer();
    const s = e.snapshot();
    expect(s.phase).toBe('roundOver');
    // 17 lose, 18 push... dealer 17: seat0 17 push, seat3 18 win, seat6 19 win
    expect(s.seats[0].hands[0].outcome).toBe('push');
    expect(s.seats[3].hands[0].outcome).toBe('win');
    expect(s.seats[6].hands[0].outcome).toBe('win');
  });

  it('runs many random rounds without breaking chip accounting', () => {
    const e = new BlackjackEngine({ ...DEFAULT_RULES, decks: 2 }, seededRng(7));
    for (const i of [0, 2, 3, 5]) e.sit(i, i === 3 ? 'human' : 'bot', `p${i}`, 100000);
    let shuffles = 0;
    for (let r = 0; r < 500; r++) {
      const before = [0, 2, 3, 5].map((i) => e.getSeat(i).chips);
      e.startRound({ 0: 10, 2: 10, 3: 10, 5: 10 });
      if (e.snapshot().shuffledThisRound) shuffles++;
      while (e.getPhase() === 'insurance') e.decideInsurance(e.pendingInsuranceSeats()[0], false);
      while (e.getPhase() === 'playerTurns') {
        const acts = e.availableActions();
        e.act(acts[r % acts.length]);
      }
      if (e.getPhase() === 'dealerTurn') e.playDealer();
      expect(e.getPhase()).toBe('roundOver');
      [0, 2, 3, 5].forEach((i, k) => expect(e.getSeat(i).chips).toBeCloseTo(before[k] + e.netForSeat(i)));
    }
    expect(shuffles).toBeGreaterThan(5);
  });
});
