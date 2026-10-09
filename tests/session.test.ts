import { card, seededRng } from '../src/engine/cards';
import { BlackjackEngine } from '../src/engine/game';
import { DEFAULT_RULES } from '../src/engine/rules';
import { addHandResult, addRefill, emptySession, sessionResult } from '../src/stats/session';

describe('session chip accounting', () => {
  it('a refill is never counted as profit', () => {
    let s = emptySession(1000);
    s = addHandResult(s, -600);
    s = addHandResult(s, -400); // bankroll now 0
    s = addRefill(s, 0, 1000); // free chips
    s = addHandResult(s, 100); // bankroll 1100
    expect(s.net).toBe(-900);
    expect(s.chipsAdded).toBe(1000);
    expect(sessionResult(s, 1100)).toBe(-900);
  });

  it('several refills from a partial bankroll', () => {
    let s = emptySession(500);
    s = addHandResult(s, -497); // 3 left
    s = addRefill(s, 3, 1000);
    s = addHandResult(s, -998); // 2 left
    s = addRefill(s, 2, 1000);
    s = addHandResult(s, 37.5); // 1037.5
    expect(s.chipsAdded).toBe(997 + 998);
    expect(sessionResult(s, 1037.5)).toBe(s.net);
    expect(s.net).toBe(-497 - 998 + 37.5);
  });

  it('matches the engine over many random rounds with refills', () => {
    const e = new BlackjackEngine({ ...DEFAULT_RULES, decks: 2 }, seededRng(11));
    e.sit(0, 'human', 'me', 100);
    let s = emptySession(100);
    for (let r = 0; r < 400; r++) {
      if (e.getSeat(0).chips < 25) {
        const before = e.getSeat(0).chips;
        e.setChips(0, 1000);
        s = addRefill(s, before, 1000);
      }
      e.startRound({ 0: 25 });
      while (e.getPhase() === 'insurance') e.decideInsurance(0, r % 3 === 0 && e.canTakeInsurance(0));
      while (e.getPhase() === 'playerTurns') {
        const a = e.availableActions();
        e.act(a[r % a.length]);
      }
      if (e.getPhase() === 'dealerTurn') e.playDealer();
      s = addHandResult(s, e.netForSeat(0));
    }
    expect(s.refills).toBeGreaterThan(0);
    expect(sessionResult(s, e.getSeat(0).chips)).toBeCloseTo(s.net);
  });
});

describe('saving a game in progress', () => {
  it('restores mid-round and plays on identically', () => {
    const play = (e: BlackjackEngine) => {
      while (e.getPhase() === 'playerTurns') e.act('hit');
      e.playDealer();
      return e.snapshot();
    };
    const a = new BlackjackEngine(DEFAULT_RULES, seededRng(3));
    a.sit(2, 'human', 'me', 1000);
    a.sit(5, 'bot', 'b', 1000);
    a.shoe.stack([card('5'), card('6'), card('9'), card('4'), card('7'), card('8')]);
    a.startRound({ 2: 50, 5: 10 });
    a.act('hit');
    const saved = JSON.parse(JSON.stringify(a.serialize()));
    const b = BlackjackEngine.restore(saved);
    expect(b.getActive()).toEqual(a.getActive());
    const ra = play(a);
    const rb = play(b);
    expect(rb.seats).toEqual(ra.seats);
    expect(rb.dealer).toEqual(ra.dealer);
    expect(rb.events).toEqual(ra.events);
  });

  it('rejects a corrupt save', () => {
    expect(() => BlackjackEngine.restore({ v: 2 } as never)).toThrow();
  });
});
