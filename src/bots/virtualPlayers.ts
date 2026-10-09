// Virtual players. They use the decision engine, bent by a personality.

import { handValue } from '../engine/cards';
import type { Action, BlackjackEngine } from '../engine/game';
import { recommend } from '../strategy/basicStrategy';

export type Personality = 'pro' | 'beginner' | 'cautious' | 'aggressive';

export interface VirtualPlayer {
  id: string;
  name: string;
  gender: 'm' | 'f';
  /** Two-tone avatar colors. */
  color: string;
  emoji: string;
  personality: Personality;
}

const ROSTER: Omit<VirtualPlayer, 'id' | 'personality'>[] = [
  { name: 'יואב', gender: 'm', color: '#2f6fd6', emoji: '🧔' },
  { name: 'רונית', gender: 'f', color: '#c2417a', emoji: '👩' },
  { name: 'דני', gender: 'm', color: '#d9822b', emoji: '👨' },
  { name: 'מיכל', gender: 'f', color: '#8a4fd1', emoji: '👩‍🦰' },
  { name: 'עומר', gender: 'm', color: '#1f9d8b', emoji: '🧑' },
  { name: 'נועה', gender: 'f', color: '#d0473b', emoji: '👱‍♀️' },
  { name: 'איתי', gender: 'm', color: '#5a7d2a', emoji: '👨‍🦱' },
  { name: 'שירה', gender: 'f', color: '#b8892a', emoji: '👩‍🦱' },
  { name: 'אבי', gender: 'm', color: '#4b5bb5', emoji: '👴' },
  { name: 'טל', gender: 'f', color: '#2b8fbf', emoji: '👧' },
];

const PERSONALITIES: Personality[] = ['pro', 'pro', 'beginner', 'cautious', 'aggressive'];

export function pickVirtualPlayers(count: number, rng: () => number = Math.random): VirtualPlayer[] {
  const pool = [...ROSTER];
  const out: VirtualPlayer[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    out.push({
      ...p,
      id: `bot-${p.name}`,
      personality: PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)],
    });
  }
  return out;
}

export const BOT_START_CHIPS = 1000;
const BET_STEPS = [5, 10, 25, 50, 100];

export function chooseBotBet(bot: VirtualPlayer, chips: number, rng: () => number = Math.random): number {
  const base =
    bot.personality === 'cautious' ? [5, 10] : bot.personality === 'aggressive' ? [25, 50, 100] : BET_STEPS.slice(0, 4);
  const bet = base[Math.floor(rng() * base.length)];
  return Math.min(bet, Math.floor(chips / 5) * 5);
}

/** Decide the bot's action for the engine's current active hand. */
export function chooseBotAction(bot: VirtualPlayer, engine: BlackjackEngine, rng: () => number = Math.random): Action {
  const pos = engine.getActive()!;
  const hand = engine.getSeat(pos.seat).hands[pos.hand];
  const available = engine.availableActions();
  const best = recommend({ playerCards: hand.cards, dealerUp: engine.dealerUpCard()!, available, rules: engine.rules }).action;
  const v = handValue(hand.cards);
  const pick = (a: Action) => (available.includes(a) ? a : best);

  switch (bot.personality) {
    case 'pro':
      return best;
    case 'beginner':
      // Mostly right, sometimes "never bust" thinking.
      if (rng() < 0.25) return v.total >= 12 ? pick('stand') : pick('hit');
      return best;
    case 'cautious':
      if (best === 'double' || best === 'split') return v.total >= 12 ? 'stand' : 'hit';
      if (best === 'hit' && v.total >= 13 && !v.soft) return 'stand';
      return best === 'surrender' ? 'surrender' : best;
    case 'aggressive':
      if (best === 'hit' && v.total >= 9 && v.total <= 11 && available.includes('double')) return 'double';
      if (best === 'stand' && v.total <= 13 && rng() < 0.4) return 'hit';
      if (best === 'surrender') return 'hit';
      return best;
  }
}

/** Bots never insure, except the occasional beginner. */
export function botTakesInsurance(bot: VirtualPlayer, rng: () => number = Math.random): boolean {
  return bot.personality === 'beginner' && rng() < 0.4;
}
