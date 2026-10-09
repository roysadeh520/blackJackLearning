import { card } from '../src/engine/cards';
import { DEFAULT_RULES } from '../src/engine/rules';
import { gradeDecision, recommend } from '../src/strategy/basicStrategy';
import {
  emptyStats,
  mistakesToPractice,
  normalizeProfile,
  recordDecision,
  recordHandResult,
  recordSession,
  resolvedMistakes,
  unlockAchievements,
} from '../src/stats/profile';
import { MemoryStorageAdapter } from '../src/storage/storage';

const sixteenVsTen = recommend({ playerCards: [card('10'), card('6')], dealerUp: card('10'), available: ['hit', 'stand'], rules: DEFAULT_RULES });
const elevenVsSix = recommend({ playerCards: [card('6'), card('5')], dealerUp: card('6'), available: ['hit', 'stand', 'double'], rules: DEFAULT_RULES });

const dec = (rec = sixteenVsTen, chosen: 'hit' | 'stand' | 'double' = 'hit') => ({
  rec,
  chosen,
  grade: gradeDecision(rec, chosen),
  playerCards: rec === sixteenVsTen ? (['10', '6'] as const) : (['6', '5'] as const),
  dealerUp: rec === sixteenVsTen ? ('10' as const) : ('6' as const),
  source: 'table' as const,
});

describe('profile statistics', () => {
  it('counts decisions, streaks and categories', () => {
    let s = emptyStats();
    s = recordDecision(s, { ...dec(), playerCards: ['10', '6'], dealerUp: '10' });
    s = recordDecision(s, { ...dec(elevenVsSix, 'double'), playerCards: ['6', '5'], dealerUp: '6' });
    s = recordDecision(s, { ...dec(sixteenVsTen, 'stand'), playerCards: ['10', '6'], dealerUp: '10' });
    expect(s.decisions).toBe(3);
    expect(s.correct).toBe(2);
    expect(s.mistakes).toBe(1);
    expect(s.bestStreak).toBe(2);
    expect(s.streak).toBe(0);
    expect(s.doubles.correct).toBe(1);
    expect(s.byCategory.hard).toEqual({ decisions: 3, correct: 2 });
  });

  it('drops a mistake from practice once it is answered correctly, and keeps it in history', () => {
    let s = emptyStats();
    s = recordDecision(s, { ...dec(sixteenVsTen, 'stand'), playerCards: ['10', '6'], dealerUp: '10' });
    s = recordDecision(s, { ...dec(sixteenVsTen, 'stand'), playerCards: ['10', '6'], dealerUp: '10' });
    expect(mistakesToPractice(s)).toHaveLength(1);
    s = recordDecision(s, { ...dec(), playerCards: ['10', '6'], dealerUp: '10' });
    expect(mistakesToPractice(s)).toHaveLength(0);
    expect(resolvedMistakes(s)).toHaveLength(1);
    expect(resolvedMistakes(s)[0].misses).toBe(2);
    // a new mistake on the same situation reopens it
    s = recordDecision(s, { ...dec(sixteenVsTen, 'stand'), playerCards: ['10', '6'], dealerUp: '10' });
    expect(mistakesToPractice(s)).toHaveLength(1);
  });

  it('treats old saved mistakes that were answered correctly as fixed', () => {
    const p = normalizeProfile({
      stats: {
        mistakesBank: {
          a: { key: 'a', category: 'hard', playerCards: ['10', '6'], dealerUp: '10', recommended: 'hit', lastChosen: 'stand', misses: 2, fixes: 1, lastSeen: 1 },
          b: { key: 'b', category: 'hard', playerCards: ['10', '2'], dealerUp: '3', recommended: 'hit', lastChosen: 'stand', misses: 1, fixes: 0, lastSeen: 1 },
        },
      } as never,
    });
    expect(mistakesToPractice(p.stats).map((m) => m.key)).toEqual(['b']);
  });

  it('records hands, sessions and achievements', () => {
    let s = emptyStats();
    s = recordHandResult(s, ['blackjack'], 15);
    s = recordSession(s, { date: 1, kind: 'free', hands: 5, decisions: 4, correct: 4, net: 15 });
    const { stats, unlocked } = unlockAchievements(s);
    expect(stats.games).toBe(1);
    expect(stats.perfectGames).toBe(1);
    expect(unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['first-blackjack', 'no-mistakes']));
    expect(unlockAchievements(stats).unlocked).toHaveLength(0);
  });

  it('round-trips through a storage adapter and repairs partial data', () => {
    const store = new MemoryStorageAdapter();
    store.save('profile', { chips: 420, settings: { sound: false } });
    const p = normalizeProfile(store.load('profile'));
    expect(p.chips).toBe(420);
    expect(p.settings.sound).toBe(false);
    expect(p.settings.explanations).toBe('full');
    expect(p.stats.byCategory.pair.decisions).toBe(0);
  });
});
