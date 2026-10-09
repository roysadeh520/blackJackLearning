// Anonymous local profile: settings, chips, statistics, mistakes, achievements.
// All updates are pure functions so they are easy to test and persist.

import type { Rank } from '../engine/cards';
import type { Action, HandOutcome } from '../engine/game';
import type { DecisionGrade, HandCategory, Recommendation } from '../strategy/basicStrategy';

export type Level = 'never' | 'few' | 'rules' | 'practice';
export type GameMode = 'learn' | 'practice' | 'free';

export interface Settings {
  explanations: 'full' | 'short' | 'none';
  speed: 'normal' | 'fast' | 'veryFast';
  skipBotAnimations: boolean;
  sound: boolean;
  animations: 'full' | 'reduced';
  showRecommendation: boolean;
  /** Situation keys the user asked not to explain again. */
  hiddenTips: string[];
}

export interface CategoryStat {
  decisions: number;
  correct: number;
}

export interface MistakeEntry {
  key: string;
  category: HandCategory;
  playerCards: Rank[];
  dealerUp: Rank;
  recommended: Action;
  lastChosen: Action;
  misses: number;
  /** Correct answers given later for the same situation. */
  fixes: number;
  lastSeen: number;
  /**
   * True once the situation was answered correctly after the mistake: it leaves
   * the practice queue but stays in the history. A new mistake reopens it.
   */
  resolved?: boolean;
  resolvedAt?: number;
}

export interface SessionRecord {
  date: number;
  kind: GameMode | 'quick' | 'mistakes';
  hands: number;
  decisions: number;
  correct: number;
  net: number;
}

export interface Stats {
  games: number;
  hands: number;
  decisions: number;
  correct: number;
  minor: number;
  mistakes: number;
  streak: number;
  bestStreak: number;
  byCategory: Record<HandCategory, CategoryStat>;
  splits: { recommended: number; correct: number };
  doubles: { recommended: number; correct: number };
  handsWon: number;
  handsLost: number;
  handsPushed: number;
  blackjacks: number;
  chipsNet: number;
  quick: { answered: number; correct: number };
  insurance: { offered: number; declined: number };
  perfectGames: number;
  mistakesBank: Record<string, MistakeEntry>;
  history: SessionRecord[];
  achievements: Record<string, number>;
}

export interface Profile {
  version: 1;
  /** Anonymous random id; never shown, never sent anywhere. */
  id: string;
  createdAt: number;
  level?: Level;
  chips: number;
  lastBet: number;
  lastPlayers: number;
  settings: Settings;
  stats: Stats;
  lessonsDone: number[];
}

export const START_CHIPS = 1000;

export const DEFAULT_SETTINGS: Settings = {
  explanations: 'full',
  speed: 'normal',
  skipBotAnimations: false,
  sound: true,
  animations: 'full',
  showRecommendation: true,
  hiddenTips: [],
};

export function emptyStats(): Stats {
  return {
    games: 0,
    hands: 0,
    decisions: 0,
    correct: 0,
    minor: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
    byCategory: { hard: { decisions: 0, correct: 0 }, soft: { decisions: 0, correct: 0 }, pair: { decisions: 0, correct: 0 } },
    splits: { recommended: 0, correct: 0 },
    doubles: { recommended: 0, correct: 0 },
    handsWon: 0,
    handsLost: 0,
    handsPushed: 0,
    blackjacks: 0,
    chipsNet: 0,
    quick: { answered: 0, correct: 0 },
    insurance: { offered: 0, declined: 0 },
    perfectGames: 0,
    mistakesBank: {},
    history: [],
    achievements: {},
  };
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export function newProfile(): Profile {
  return {
    version: 1,
    id: randomId(),
    createdAt: Date.now(),
    chips: START_CHIPS,
    lastBet: 25,
    lastPlayers: 3,
    settings: { ...DEFAULT_SETTINGS },
    stats: emptyStats(),
    lessonsDone: [],
  };
}

/** Merge stored data over defaults so older saves keep working when fields are added. */
export function normalizeProfile(raw: Partial<Profile> | undefined): Profile {
  const base = newProfile();
  if (!raw || typeof raw !== 'object') return base;
  const stats = { ...emptyStats(), ...(raw.stats ?? {}) } as Stats;
  stats.byCategory = { ...emptyStats().byCategory, ...(raw.stats?.byCategory ?? {}) };
  // Older saves had no `resolved` flag: a mistake answered correctly since then counts as fixed.
  for (const m of Object.values(stats.mistakesBank ?? {})) {
    if (m.resolved === undefined) m.resolved = m.fixes > 0;
  }
  return {
    ...base,
    ...raw,
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    stats,
    chips: typeof raw.chips === 'number' && isFinite(raw.chips) ? raw.chips : START_CHIPS,
  };
}

// ---------- decision recording ----------

export interface DecisionRecord {
  rec: Recommendation;
  chosen: Action;
  grade: DecisionGrade;
  playerCards: Rank[];
  dealerUp: Rank;
  source: 'table' | 'quick';
}

export function recordDecision(stats: Stats, d: DecisionRecord): Stats {
  const s = structuredClone(stats);
  const ok = d.grade === 'correct';
  s.decisions++;
  if (ok) s.correct++;
  else if (d.grade === 'minor') s.minor++;
  else s.mistakes++;
  s.streak = ok ? s.streak + 1 : 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  const cat = s.byCategory[d.rec.situation.category];
  cat.decisions++;
  if (ok) cat.correct++;
  if (d.rec.action === 'split') {
    s.splits.recommended++;
    if (ok) s.splits.correct++;
  }
  if (d.rec.action === 'double') {
    s.doubles.recommended++;
    if (ok) s.doubles.correct++;
  }
  if (d.source === 'quick') {
    s.quick.answered++;
    if (ok) s.quick.correct++;
  }

  const key = d.rec.situation.key;
  const existing = s.mistakesBank[key];
  if (!ok) {
    s.mistakesBank[key] = {
      key,
      category: d.rec.situation.category,
      playerCards: d.playerCards,
      dealerUp: d.dealerUp,
      recommended: d.rec.action,
      lastChosen: d.chosen,
      misses: (existing?.misses ?? 0) + 1,
      fixes: existing?.fixes ?? 0,
      lastSeen: Date.now(),
      resolved: false,
    };
  } else if (existing) {
    existing.fixes++;
    existing.lastSeen = Date.now();
    if (!existing.resolved) {
      existing.resolved = true;
      existing.resolvedAt = Date.now();
    }
  }
  return s;
}

export function recordInsurance(stats: Stats, took: boolean): Stats {
  const s = structuredClone(stats);
  s.insurance.offered++;
  if (!took) s.insurance.declined++;
  s.decisions++;
  if (!took) {
    s.correct++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.mistakes++;
    s.streak = 0;
  }
  return s;
}

export function recordHandResult(stats: Stats, outcomes: HandOutcome[], net: number): Stats {
  const s = structuredClone(stats);
  s.hands++;
  s.chipsNet += net;
  for (const o of outcomes) {
    if (o === 'blackjack') s.blackjacks++;
    if (o === 'win' || o === 'blackjack') s.handsWon++;
    else if (o === 'push') s.handsPushed++;
    else s.handsLost++;
  }
  return s;
}

export function recordSession(stats: Stats, rec: SessionRecord): Stats {
  const s = structuredClone(stats);
  if (rec.kind === 'learn' || rec.kind === 'practice' || rec.kind === 'free') {
    s.games++;
    if (rec.hands >= 5 && rec.decisions > 0 && rec.correct === rec.decisions) s.perfectGames++;
  }
  s.history = [rec, ...s.history].slice(0, 30);
  return s;
}

/** Open mistakes, the ones missed most (and most recently) first. */
export function mistakesToPractice(stats: Stats): MistakeEntry[] {
  return Object.values(stats.mistakesBank)
    .filter((m) => !m.resolved)
    .sort((a, b) => b.misses - a.misses || b.lastSeen - a.lastSeen);
}

/** Mistakes the user has since answered correctly, newest first. */
export function resolvedMistakes(stats: Stats): MistakeEntry[] {
  return Object.values(stats.mistakesBank)
    .filter((m) => m.resolved)
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
}

export function accuracy(stats: Pick<Stats, 'decisions' | 'correct'>): number {
  return stats.decisions ? stats.correct / stats.decisions : 0;
}

// ---------- achievements ----------

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (s: Stats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'good-start', title: 'התחלה טובה', description: '10 החלטות נכונות.', icon: '🌱', check: (s) => s.correct >= 10 },
  { id: 'fast-learner', title: 'לומד מהר', description: '10 החלטות נכונות ברצף.', icon: '⚡', check: (s) => s.bestStreak >= 10 },
  { id: 'no-mistakes', title: 'בלי טעויות', description: 'משחק (5 ידיים לפחות) עם 100% החלטות נכונות.', icon: '🎯', check: (s) => s.perfectGames >= 1 },
  { id: 'split-expert', title: 'מומחה לפיצולים', description: '10 פיצולים נכונים.', icon: '✂️', check: (s) => s.splits.correct >= 10 },
  { id: 'double-expert', title: 'מומחה להכפלות', description: '10 הכפלות נכונות.', icon: '💎', check: (s) => s.doubles.correct >= 10 },
  { id: 'first-blackjack', title: 'בלאק ג׳ק ראשון', description: 'קיבלת בלאק ג׳ק בפעם הראשונה.', icon: '🎉', check: (s) => s.blackjacks >= 1 },
  { id: 'quick-50', title: 'מתאמן מתמיד', description: '50 שאלות בתרגול מהיר.', icon: '⏱️', check: (s) => s.quick.answered >= 50 },
  { id: 'streak-25', title: 'רצף מרשים', description: '25 החלטות נכונות ברצף.', icon: '🔥', check: (s) => s.bestStreak >= 25 },
  {
    id: 'master',
    title: 'מאסטר בלאק ג׳ק',
    description: '100 ידיים עם דיוק של 90% ומעלה.',
    icon: '👑',
    check: (s) => s.hands >= 100 && s.decisions > 0 && s.correct / s.decisions >= 0.9,
  },
];

/** Returns updated stats plus the achievements unlocked by this update. */
export function unlockAchievements(stats: Stats): { stats: Stats; unlocked: AchievementDef[] } {
  const unlocked = ACHIEVEMENTS.filter((a) => !stats.achievements[a.id] && a.check(stats));
  if (!unlocked.length) return { stats, unlocked };
  const s = structuredClone(stats);
  for (const a of unlocked) s.achievements[a.id] = Date.now();
  return { stats: s, unlocked };
}
