// Chip and decision accounting for one game at the table.
//
// The result of a game is what the hands won or lost. Free chips taken when the
// bankroll runs dry are tracked separately (chipsAdded) and never count as profit.

import type { Action } from '../engine/game';
import type { DecisionGrade, Recommendation } from '../strategy/basicStrategy';

export interface RoundDecision {
  rec: Recommendation;
  chosen: Action;
  grade: DecisionGrade;
  cards: string[];
  dealerUp: string;
}

export interface SessionStats {
  /** Chips the player had when the game started. */
  startChips: number;
  /** Free virtual chips taken during the game (not profit). */
  chipsAdded: number;
  refills: number;
  hands: number;
  decisions: number;
  correct: number;
  minor: number;
  mistakes: number;
  /** Sum of every hand's result. */
  net: number;
  mistakeList: RoundDecision[];
}

export function emptySession(startChips: number): SessionStats {
  return { startChips, chipsAdded: 0, refills: 0, hands: 0, decisions: 0, correct: 0, minor: 0, mistakes: 0, net: 0, mistakeList: [] };
}

export function addHandResult(s: SessionStats, net: number): SessionStats {
  return { ...s, hands: s.hands + 1, net: s.net + net };
}

export function addRefill(s: SessionStats, chipsBefore: number, chipsAfter: number): SessionStats {
  return { ...s, chipsAdded: s.chipsAdded + (chipsAfter - chipsBefore), refills: s.refills + 1 };
}

export function addDecision(s: SessionStats, d: RoundDecision): SessionStats {
  return {
    ...s,
    decisions: s.decisions + 1,
    correct: s.correct + (d.grade === 'correct' ? 1 : 0),
    minor: s.minor + (d.grade === 'minor' ? 1 : 0),
    mistakes: s.mistakes + (d.grade === 'mistake' ? 1 : 0),
    mistakeList: d.grade === 'correct' ? s.mistakeList : [...s.mistakeList, d],
  };
}

export function addInsuranceDecision(s: SessionStats, took: boolean): SessionStats {
  return { ...s, decisions: s.decisions + 1, correct: s.correct + (took ? 0 : 1), mistakes: s.mistakes + (took ? 1 : 0) };
}

/** Profit or loss of the game from the chip counts; equals `net` by construction. */
export function sessionResult(s: SessionStats, endChips: number): number {
  return endChips - s.startChips - s.chipsAdded;
}
