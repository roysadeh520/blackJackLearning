// All user-facing Hebrew vocabulary lives here.

import type { Rank, Suit } from '../engine/cards';
import type { Action, HandOutcome } from '../engine/game';

export const ACTION_LABEL: Record<Action, string> = {
  hit: 'קח קלף',
  stand: 'עצור',
  double: 'הכפל',
  split: 'פצל',
  surrender: 'פרוש',
};

/** Infinitive, for sentences like "מומלץ לקחת קלף". */
export const ACTION_INFINITIVE: Record<Action, string> = {
  hit: 'לקחת קלף',
  stand: 'לעצור',
  double: 'להכפיל',
  split: 'לפצל',
  surrender: 'לפרוש',
};

/** Past tense, second person: "בחרת: ..." is built from ACTION_LABEL; this is "לקחת קלף". */
export const ACTION_PAST_YOU: Record<Action, string> = {
  hit: 'לקחת קלף',
  stand: 'עצרת',
  double: 'הכפלת',
  split: 'פיצלת',
  surrender: 'פרשת',
};

export const ACTION_PAST: Record<'m' | 'f', Record<Action, string>> = {
  m: { hit: 'לקח קלף', stand: 'עצר', double: 'הכפיל', split: 'פיצל', surrender: 'פרש' },
  f: { hit: 'לקחה קלף', stand: 'עצרה', double: 'הכפילה', split: 'פיצלה', surrender: 'פרשה' },
};

export const ACTION_HELP: Record<Action, string> = {
  hit: 'קבלת קלף נוסף ליד שלך. המטרה היא להתקרב ל־21 מבלי לעבור אותו.',
  stand: 'סיום התור עם היד הנוכחית. הדילר ישחק אחריך.',
  double: 'הכפלת ההימור וקבלת קלף נוסף אחד בלבד.',
  split: 'הפיכת זוג לשתי ידיים נפרדות, כל אחת עם הימור משלה.',
  surrender: 'ויתור על היד וקבלת חצי מההימור בחזרה.',
};

export const RANK_NAME: Record<Rank, string> = {
  A: 'אס',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'נסיך',
  Q: 'מלכה',
  K: 'מלך',
};

export const SUIT_NAME: Record<Suit, string> = {
  spades: 'עלה',
  hearts: 'לב',
  diamonds: 'יהלום',
  clubs: 'תלתן',
};

export const OUTCOME_LABEL: Record<HandOutcome, string> = {
  blackjack: 'בלאק ג׳ק!',
  win: 'ניצחון',
  push: 'תיקו',
  lose: 'הפסד',
  bust: 'חריגה מ־21',
  surrender: 'פרישה',
};

/** Dealer up value (2..11) as Hebrew text. */
export function upName(up: number): string {
  return up === 11 ? 'אס' : String(up);
}

export function cardLabel(rank: Rank, suit: Suit): string {
  return `${RANK_NAME[rank]} ${SUIT_NAME[suit]}`;
}

export function formatChips(n: number): string {
  return n.toLocaleString('he-IL', { maximumFractionDigits: 1 });
}

/** Signed amount wrapped in a left-to-right isolate so "−25" never renders as "25−" in RTL text. */
export function formatSigned(n: number): string {
  const body = n > 0 ? `+${formatChips(n)}` : n < 0 ? `−${formatChips(Math.abs(n))}` : '0';
  return `\u2066${body}\u2069`;
}

export function percent(part: number, whole: number): string {
  if (!whole) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

export const SPEED_LABEL = { normal: 'רגילה', fast: 'מהירה', veryFast: 'מהירה מאוד' } as const;
export const EXPLAIN_LABEL = { full: 'מלאים', short: 'קצרים', none: 'ללא הסברים' } as const;
export const MODE_LABEL = { learn: 'מצב לימוד', practice: 'מצב תרגול', free: 'משחק חופשי' } as const;
export const CATEGORY_LABEL = { hard: 'ידיים רגילות', soft: 'ידיים עם אס', pair: 'זוגות' } as const;
