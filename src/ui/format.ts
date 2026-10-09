// Formats engine data (last actions, round events, results) into Hebrew text.

import { handValue } from '../engine/cards';
import type { HandOutcome, LastAction, RoundEvent } from '../engine/game';
import { ACTION_LABEL, ACTION_PAST, ACTION_PAST_YOU, formatChips, OUTCOME_LABEL, RANK_NAME } from '../i18n/he';
import type { Occupant } from './hooks/useTableController';

type Who = { you: true } | { you: false; gender: 'm' | 'f' };

export function whoOf(occ: Occupant | undefined): Who {
  return occ?.kind === 'bot' ? { you: false, gender: occ.bot.gender } : { you: true };
}

const g = (who: Who, you: string, m: string, f: string) => (who.you ? you : who.gender === 'f' ? f : m);

export function lastActionText(a: LastAction | undefined, who: Who): string {
  if (!a) return '';
  switch (a.type) {
    case 'bet':
      return g(who, `הימרת ${formatChips(a.amount)}`, `הימר ${formatChips(a.amount)}`, `הימרה ${formatChips(a.amount)}`);
    case 'action':
      return who.you ? ACTION_PAST_YOU[a.action] : ACTION_PAST[who.gender][a.action];
    case 'insurance':
      return a.taken
        ? g(who, 'לקחת ביטוח', 'לקח ביטוח', 'לקחה ביטוח')
        : g(who, 'ויתרת על ביטוח', 'ויתר על ביטוח', 'ויתרה על ביטוח');
    case 'blackjack':
      return 'בלאק ג׳ק!';
    case 'bust':
      return 'חריגה מ־21';
    case 'result':
      if (a.net > 0) return g(who, `זכית ב־${formatChips(a.net)}`, `זכה ב־${formatChips(a.net)}`, `זכתה ב־${formatChips(a.net)}`);
      if (a.net < 0)
        return g(who, `הפסדת ${formatChips(-a.net)}`, `הפסיד ${formatChips(-a.net)}`, `הפסידה ${formatChips(-a.net)}`);
      return 'תיקו';
  }
}

export function totalText(cards: { rank: Parameters<typeof handValue>[0][number]['rank'] }[]): string {
  const v = handValue(cards);
  if (v.isBust) return `${v.total} — חריגה`;
  if (cards.length === 2 && v.total === 21) return 'בלאק ג׳ק';
  // Soft hands show both values, e.g. "7 / 17".
  return v.soft && v.total < 21 ? `${v.total - 10} / ${v.total}` : String(v.total);
}

const join2 = (a: string, b: string) => `${a} ו־${b}`;

/** The user's view of a round, as readable lines (see "היסטוריית הסיבוב"). */
export function roundHistory(events: RoundEvent[], userSeat: number, multiHand: boolean): string[] {
  const out: string[] = [];
  const prefix = (hand: number) => (multiHand ? `יד ${hand + 1}: ` : '');
  for (const e of events) {
    switch (e.kind) {
      case 'shuffle':
        out.push('הקלפים עורבבו מחדש.');
        break;
      case 'bet':
        if (e.seat === userSeat) out.push(`הימור: ${formatChips(e.amount)}`);
        break;
      case 'initialDeal':
        if (e.seat === userSeat) {
          out.push(`קיבלת: ${join2(RANK_NAME[e.cards[0].rank], RANK_NAME[e.cards[1].rank])}`);
          out.push(`ערך היד: ${handValue(e.cards).total}`);
        }
        break;
      case 'dealerUp':
        out.push(`הדילר מציג: ${RANK_NAME[e.card.rank]}`);
        break;
      case 'insurance':
        if (e.seat === userSeat) out.push(e.taken ? `לקחת ביטוח (${formatChips(e.amount)})` : 'ויתרת על ביטוח');
        break;
      case 'peek':
        if (e.dealerBlackjack) out.push('הדילר בדק את הקלף המוסתר: יש לו בלאק ג׳ק.');
        break;
      case 'action':
        if (e.seat === userSeat) out.push(`${prefix(e.hand)}בחרת: ${ACTION_LABEL[e.action]}`);
        break;
      case 'split':
        if (e.seat === userSeat) out.push('היד פוצלה לשתי ידיים');
        break;
      case 'card':
        if (e.seat === userSeat) {
          out.push(`${prefix(e.hand)}קיבלת: ${RANK_NAME[e.card.rank]}`);
          out.push(`${prefix(e.hand)}ערך היד: ${e.total}${e.total > 21 ? ' (חריגה מ־21)' : ''}`);
        }
        break;
      case 'dealerReveal':
        out.push(`הדילר חשף: ${RANK_NAME[e.card.rank]} (ערך: ${e.total})`);
        break;
      case 'dealerCard':
        out.push(`הדילר קיבל: ${RANK_NAME[e.card.rank]} (ערך: ${e.total})`);
        break;
      case 'dealerFinal':
        out.push(`הדילר: ${e.blackjack ? 'בלאק ג׳ק' : e.bust ? `${e.total} — חריגה מ־21` : e.total}`);
        break;
      case 'result':
        if (e.seat === userSeat) out.push(`${prefix(e.hand)}תוצאה: ${OUTCOME_LABEL[e.outcome]}`);
        break;
    }
  }
  return out;
}

export function outcomeHeadline(outcomes: HandOutcome[], net: number): string {
  if (outcomes.length === 1) {
    switch (outcomes[0]) {
      case 'blackjack':
        return 'בלאק ג׳ק! ניצחת!';
      case 'win':
        return 'ניצחת!';
      case 'push':
        return 'תיקו';
      case 'bust':
        return 'חרגת מ־21 — הפסדת את היד';
      case 'surrender':
        return 'פרשת מהיד';
      case 'lose':
        return 'הפסדת את היד';
    }
  }
  const wins = outcomes.filter((o) => o === 'win' || o === 'blackjack').length;
  const base = `ניצחת ב־${wins} ידיים מתוך ${outcomes.length}`;
  return net > 0 ? `${base} — סיימת ברווח` : net < 0 ? `${base} — סיימת בהפסד` : `${base} — מאוזן`;
}
