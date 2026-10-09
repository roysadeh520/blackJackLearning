// Basic strategy decision engine. Pure logic: no UI, no language.
// Covers multi-deck games; adjusts for H17/S17, double-after-split and surrender.

import { Card, Rank, handValue, isPair, rankValue } from '../engine/cards';
import type { Action } from '../engine/game';
import type { TableRules } from '../engine/rules';

/**
 * Chart codes:
 *  H  hit, S stand, P split,
 *  Dh double (otherwise hit), Ds double (otherwise stand),
 *  Rh surrender (otherwise hit), Rs surrender (otherwise stand), Rp surrender (otherwise split)
 */
export type ChartCode = 'H' | 'S' | 'P' | 'Dh' | 'Ds' | 'Rh' | 'Rs' | 'Rp';

export type HandCategory = 'hard' | 'soft' | 'pair';

/** Dealer up-card as a value 2..11 (11 = ace). */
export type UpValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const UP_VALUES: UpValue[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function upValueOf(rank: Rank): UpValue {
  return (rank === 'A' ? 11 : rankValue(rank)) as UpValue;
}

const inRange = (up: number, lo: number, hi: number) => up >= lo && up <= hi;

export function hardCode(total: number, up: UpValue, rules: TableRules): ChartCode {
  const h17 = rules.dealerHitsSoft17;
  if (rules.surrender) {
    if (total === 16 && (up === 9 || up === 10 || up === 11)) return 'Rh';
    if (total === 15 && up === 10) return 'Rh';
    if (h17 && total === 15 && up === 11) return 'Rh';
    if (h17 && total === 17 && up === 11) return 'Rs';
  }
  if (total >= 17) return 'S';
  if (total >= 13) return inRange(up, 2, 6) ? 'S' : 'H';
  if (total === 12) return inRange(up, 4, 6) ? 'S' : 'H';
  if (total === 11) return up === 11 && !h17 ? 'H' : 'Dh';
  if (total === 10) return inRange(up, 2, 9) ? 'Dh' : 'H';
  if (total === 9) return inRange(up, 3, 6) ? 'Dh' : 'H';
  return 'H';
}

/** total is the soft total (13..21), i.e. ace counted as 11. */
export function softCode(total: number, up: UpValue, rules: TableRules): ChartCode {
  const h17 = rules.dealerHitsSoft17;
  if (total >= 20) return 'S';
  if (total <= 12) return 'H'; // A-A that cannot be split
  if (total === 19) return h17 && up === 6 ? 'Ds' : 'S';
  if (total === 18) {
    if (inRange(up, 3, 6)) return 'Ds';
    if (up === 2) return h17 ? 'Ds' : 'S';
    if (up === 7 || up === 8) return 'S';
    return 'H';
  }
  if (total === 17) return inRange(up, 3, 6) ? 'Dh' : 'H';
  if (total === 16 || total === 15) return inRange(up, 4, 6) ? 'Dh' : 'H';
  return inRange(up, 5, 6) ? 'Dh' : 'H'; // soft 13, 14
}

/** pairValue: value of one card of the pair, 2..11 (11 = aces). */
export function pairCode(pairValue: number, up: UpValue, rules: TableRules): ChartCode {
  const das = rules.doubleAfterSplit;
  switch (pairValue) {
    case 11:
      return 'P';
    case 10:
      return 'S';
    case 9:
      return up === 7 || up === 10 || up === 11 ? 'S' : 'P';
    case 8:
      return rules.surrender && rules.dealerHitsSoft17 && up === 11 ? 'Rp' : 'P';
    case 7:
      return inRange(up, 2, 7) ? 'P' : 'H';
    case 6:
      return inRange(up, das ? 2 : 3, 6) ? 'P' : 'H';
    case 5:
      return hardCode(10, up, rules);
    case 4:
      return das && (up === 5 || up === 6) ? 'P' : 'H';
    case 3:
    case 2:
      return inRange(up, das ? 2 : 4, 7) ? 'P' : 'H';
    default:
      return 'H';
  }
}

export interface DecisionContext {
  playerCards: Pick<Card, 'rank'>[];
  dealerUp: Pick<Card, 'rank'>;
  /** Actions the table currently allows. */
  available: Action[];
  rules: TableRules;
}

export interface SituationInfo {
  category: HandCategory;
  total: number;
  soft: boolean;
  /** For pairs: the value of one card (2..11). */
  pairValue?: number;
  up: UpValue;
  /** Stable key used for mistake tracking, e.g. "hard:16:10". */
  key: string;
}

export function describeSituation(ctx: Pick<DecisionContext, 'playerCards' | 'dealerUp' | 'available'>): SituationInfo {
  const v = handValue(ctx.playerCards);
  const up = upValueOf(ctx.dealerUp.rank);
  // Treat as a pair only when splitting is actually on the table.
  if (isPair(ctx.playerCards) && ctx.available.includes('split')) {
    const pv = ctx.playerCards[0].rank === 'A' ? 11 : rankValue(ctx.playerCards[0].rank);
    return { category: 'pair', total: v.total, soft: v.soft, pairValue: pv, up, key: `pair:${pv}:${up}` };
  }
  if (v.soft) return { category: 'soft', total: v.total, soft: true, up, key: `soft:${v.total}:${up}` };
  return { category: 'hard', total: v.total, soft: false, up, key: `hard:${v.total}:${up}` };
}

export function chartCodeFor(info: SituationInfo, rules: TableRules): ChartCode {
  if (info.category === 'pair') return pairCode(info.pairValue!, info.up, rules);
  if (info.category === 'soft') return softCode(info.total, info.up, rules);
  return hardCode(info.total, info.up, rules);
}

/** Resolve a chart code into a concrete action given what is allowed right now. */
export function resolveCode(code: ChartCode, available: Action[], info: SituationInfo, rules: TableRules): {
  best: Action;
  fallback?: Action;
} {
  const can = (a: Action) => available.includes(a);
  // When splitting is not possible, re-evaluate as a regular hand.
  const asTotal = (): ChartCode =>
    info.soft ? softCode(info.total, info.up, rules) : hardCode(info.total, info.up, rules);
  switch (code) {
    case 'H':
      return { best: 'hit' };
    case 'S':
      return { best: 'stand' };
    case 'P':
      return can('split') ? { best: 'split' } : resolveCode(asTotal(), available, { ...info, category: info.soft ? 'soft' : 'hard' }, rules);
    case 'Dh':
      return can('double') ? { best: 'double', fallback: 'hit' } : { best: 'hit' };
    case 'Ds':
      return can('double') ? { best: 'double', fallback: 'stand' } : { best: 'stand' };
    case 'Rh':
      return can('surrender') ? { best: 'surrender', fallback: 'hit' } : { best: 'hit' };
    case 'Rs':
      return can('surrender') ? { best: 'surrender', fallback: 'stand' } : { best: 'stand' };
    case 'Rp':
      return can('surrender') ? { best: 'surrender', fallback: 'split' } : { best: can('split') ? 'split' : 'hit' };
  }
}

export interface Recommendation {
  action: Action;
  /** Second-best action when the best one is a double/surrender refinement. */
  fallback?: Action;
  code: ChartCode;
  situation: SituationInfo;
}

export function recommend(ctx: DecisionContext): Recommendation {
  const situation = describeSituation(ctx);
  const code = chartCodeFor(situation, ctx.rules);
  const { best, fallback } = resolveCode(code, ctx.available, situation, ctx.rules);
  // Guard: never recommend something unavailable.
  const action = ctx.available.includes(best) ? best : ctx.available.includes('hit') ? 'hit' : ctx.available[0];
  return { action, fallback, code, situation };
}

export type DecisionGrade = 'correct' | 'minor' | 'mistake';

/**
 * Grade a chosen action. Choosing the fallback of a refinement (e.g. hitting
 * instead of doubling 11) is a "less good" decision rather than a mistake.
 */
export function gradeDecision(rec: Recommendation, chosen: Action): DecisionGrade {
  if (chosen === rec.action) return 'correct';
  if (rec.fallback && chosen === rec.fallback) return 'minor';
  return 'mistake';
}

/** Insurance is never part of basic strategy. */
export function recommendInsurance(): { take: false } {
  return { take: false };
}
