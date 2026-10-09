import { card, Rank } from '../src/engine/cards';
import type { Action } from '../src/engine/game';
import { DEFAULT_RULES } from '../src/engine/rules';
import { gradeDecision, recommend } from '../src/strategy/basicStrategy';
import { explain } from '../src/strategy/explanations';

const ALL: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];

function rec(p: Rank[], up: Rank, available: Action[] = ALL, rules = DEFAULT_RULES) {
  const avail = available.filter((a) => a !== 'split' || p[0] === p[1] || (['10', 'J', 'Q', 'K'].includes(p[0]) && ['10', 'J', 'Q', 'K'].includes(p[1])));
  return recommend({ playerCards: p.map((r) => card(r)), dealerUp: card(up), available: avail, rules });
}

describe('basic strategy', () => {
  it.each([
    [['10', '6'], '10', 'surrender'],
    [['10', '6'], '7', 'hit'],
    [['10', '6'], '6', 'stand'],
    [['10', '2'], '3', 'hit'],
    [['10', '2'], '4', 'stand'],
    [['6', '5'], '10', 'double'],
    [['6', '5'], 'A', 'hit'],
    [['5', '4'], '3', 'double'],
    [['5', '4'], '2', 'hit'],
    [['A', '7'], '2', 'stand'],
    [['A', '7'], '6', 'double'],
    [['A', '7'], '9', 'hit'],
    [['A', '2'], '5', 'double'],
    [['A', '8'], '6', 'stand'],
    [['8', '8'], '10', 'split'],
    [['A', 'A'], 'A', 'split'],
    [['K', 'Q'], '6', 'stand'],
    [['9', '9'], '7', 'stand'],
    [['9', '9'], '8', 'split'],
    [['5', '5'], '9', 'double'],
    [['4', '4'], '5', 'split'],
    [['2', '2'], '8', 'hit'],
  ] as [Rank[], Rank, Action][])('%j vs %s -> %s', (p, up, expected) => {
    expect(rec(p, up).action).toBe(expected);
  });

  it('falls back when double or surrender is unavailable', () => {
    expect(rec(['10', '6'], '10', ['hit', 'stand']).action).toBe('hit');
    expect(rec(['A', '7'], '4', ['hit', 'stand']).action).toBe('stand');
    expect(rec(['6', '5'], '6', ['hit', 'stand']).action).toBe('hit');
  });

  it('three-card hands use totals', () => {
    const r = recommend({ playerCards: [card('5'), card('4'), card('3')], dealerUp: card('6'), available: ['hit', 'stand'], rules: DEFAULT_RULES });
    expect(r.action).toBe('stand');
    expect(r.situation.key).toBe('hard:12:6');
  });

  it('respects H17 differences', () => {
    const h17 = { ...DEFAULT_RULES, dealerHitsSoft17: true };
    expect(rec(['6', '5'], 'A', ALL, h17).action).toBe('double');
  });

  it('grades fallback choices as minor and others as mistakes', () => {
    const r = rec(['6', '5'], '6');
    expect(gradeDecision(r, 'double')).toBe('correct');
    expect(gradeDecision(r, 'hit')).toBe('minor');
    expect(gradeDecision(r, 'stand')).toBe('mistake');
  });

  it('produces Hebrew explanations matching the situation', () => {
    const e = explain(rec(['10', '6'], '10', ['hit', 'stand']));
    expect(e.short).toContain('16');
    expect(e.short).toContain('10');
    expect(e.headline).toBe('מומלץ לקחת קלף');
    expect(e.short).not.toMatch(/[a-zA-Z]/);
    expect(e.detailed).not.toMatch(/[a-zA-Z]/);
  });

  it('explanations never contain English for any situation', () => {
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    for (const a of ranks) for (const b of ranks) for (const up of ranks) {
      const e = explain(rec([a, b], up));
      expect(e.short + e.detailed + e.headline).not.toMatch(/[a-zA-Z]/);
    }
  });
});
