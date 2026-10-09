// Hebrew explanations generated from the decision engine's output.
// Kept separate from basicStrategy.ts so the logic stays language-free.

import type { Action } from '../engine/game';
import { ACTION_INFINITIVE, ACTION_LABEL, upName } from '../i18n/he';
import type { DecisionGrade, Recommendation, SituationInfo } from './basicStrategy';

export interface Explanation {
  /** One-line headline, e.g. "מומלץ לקחת קלף". */
  headline: string;
  /** Short reasoning tailored to the situation. */
  short: string;
  /** Longer reasoning with numbers. */
  detailed: string;
}

/** Approximate dealer bust probability by up-card (multi-deck, stands on soft 17). */
const DEALER_BUST: Record<number, number> = { 2: 35, 3: 37, 4: 40, 5: 42, 6: 42, 7: 26, 8: 24, 9: 23, 10: 21, 11: 17 };

/** Chance the next card busts a hard total (ignoring card removal). */
function bustChance(total: number): number {
  const safe = 21 - total;
  if (safe >= 10) return 0;
  // Cards worth more than `safe`: values safe+1..10, where 10 has 4 ranks.
  let bad = 0;
  for (let v = safe + 1; v <= 10; v++) bad += v === 10 ? 4 : 1;
  return Math.round((bad / 13) * 100);
}

const isWeak = (up: number) => up >= 2 && up <= 6;

function handName(s: SituationInfo): string {
  if (s.category === 'pair') {
    const p = s.pairValue === 11 ? 'אסים' : s.pairValue === 10 ? 'עשיריות' : `${s.pairValue}`;
    return s.pairValue === 11 || s.pairValue === 10 ? `זוג ${p}` : `זוג ${p}-${p}`;
  }
  if (s.category === 'soft') return `${s.total} רך (יד עם אס)`;
  return `${s.total} נקודות`;
}

function opening(s: SituationInfo): string {
  return `יש לך ${handName(s)} והדילר מציג ${upName(s.up)}.`;
}

function dealerLine(up: number): string {
  const p = DEALER_BUST[up];
  return isWeak(up)
    ? `${upName(up)} הוא קלף חלש לדילר: הוא יחרוג מ־21 בערך ב־${p}% מהמקרים.`
    : `${upName(up)} הוא קלף חזק לדילר: הוא יחרוג מ־21 רק בערך ב־${p}% מהמקרים, ולרוב יגיע ל־17 ומעלה.`;
}

const LUCK_NOTE = 'זכרו: החלטה נכונה לא מבטיחה ניצחון ביד הנוכחית — היא משפרת את התוצאות לאורך זמן.';

function reason(rec: Recommendation): string {
  const s = rec.situation;
  const up = upName(s.up);
  const t = s.total;
  const a = rec.action;

  if (s.category === 'pair' && a === 'split') {
    if (s.pairValue === 11)
      return 'תמיד מפצלים זוג אסים: כל אס הוא התחלה מצוינת ליד חדשה, ואילו שני אסים יחד שווים רק 12.';
    if (s.pairValue === 8)
      return '16 היא היד הגרועה ביותר בבלאק ג׳ק. פיצול של 8-8 הופך אותה לשתי ידיים שמתחילות מ־8 — מצב טוב בהרבה.';
    if (isWeak(s.up))
      return `מול ${up} החלש של הדילר כדאי להכניס יותר צ׳יפים לשולחן: פיצול הופך יד בינונית לשתי ידיים עם סיכוי טוב.`;
    return `פיצול נותן כאן שתי ידיים שכל אחת מהן מתחילה טוב יותר מהיד המקורית.`;
  }
  if (s.category === 'pair' && s.pairValue === 10 && a === 'stand')
    return '20 היא יד חזקה מאוד. אל תפרק אותה בפיצול — עצור.';
  if (s.category === 'pair' && s.pairValue === 9 && a === 'stand')
    return s.up === 7
      ? '18 מנצח את 17 שהדילר צפוי להגיע אליו מול 7, ולכן עדיף לעצור ולא לפצל.'
      : `מול ${up} הדילר חזק מדי, ופיצול יפרק 18 טוב לשתי ידיים מסוכנות. עצור.`;
  if (s.category === 'pair' && s.pairValue === 5)
    return 'זוג חמישיות שווה 10 — יד מצוינת להכפלה או לקבלת קלף, לא לפיצול.';
  if (s.category === 'pair' && a !== 'split' && a !== 'surrender')
    return `פיצול מול ${up} יוצר שתי ידיים חלשות מול דילר חזק. עדיף לשחק את היד כ־${t} ו${ACTION_INFINITIVE[a]}.`;

  if (a === 'surrender')
    return `${t} מול ${up} היא אחת הידיים הקשות ביותר: בממוצע תפסיד כאן יותר ממחצית ההימור. פרישה מחזירה לך חצי מההימור, ולכן לאורך זמן היא הבחירה המשתלמת. אם אין אפשרות לפרוש — ${ACTION_INFINITIVE[rec.fallback ?? 'hit']}.`;

  if (s.category === 'soft') {
    if (a === 'double')
      return `יד רכה לא יכולה לחרוג מ־21 בקלף אחד, כי האס יכול לרדת לערך 1. מול ${up} החלש של הדילר כדאי לנצל את ההזדמנות ולהכפיל.`;
    if (a === 'hit')
      return t === 18
        ? `18 רך נשמע טוב, אבל מול ${up} של הדילר הוא מפסיד לעיתים קרובות. קלף נוסף לא יכול לגרום לחריגה, אז כדאי לנסות לשפר.`
        : `ביד רכה אין סיכון לחרוג בקלף הבא — האס יהפוך ל־1 אם צריך. ${t} לבדו לא מספיק חזק, ולכן קח קלף.`;
    return `${t} רך היא יד טובה. מול ${up} עדיף לשמור עליה ולעצור.`;
  }

  // hard totals
  if (a === 'double')
    return `${t} היא נקודת פתיחה מצוינת: קלף בשווי 10 ייתן לך יד חזקה מאוד. מול ${up} של הדילר כדאי להכפיל את ההימור ולקבל קלף אחד בלבד.`;
  if (a === 'hit' && t <= 11)
    return t <= 8
      ? `עם ${t} נקודות אין שום סיכון לחרוג מ־21 בקלף הבא, ולכן תמיד כדאי לקחת קלף.`
      : `עם ${t} אין סיכון לחריגה, אבל מול ${up} של הדילר היתרון לא מספיק גדול כדי להכפיל. קח קלף.`;
  if (a === 'hit')
    return `במצב הזה מומלץ לקחת קלף. למרות שקיים סיכון לעבור את 21, עצירה על ${t} מול ${up} של הדילר נחשבת בדרך כלל להחלטה פחות טובה — הדילר צפוי להגיע ל־17 ומעלה.`;
  if (a === 'stand' && t >= 17) return `עם ${t} הסיכוי לחרוג מ־21 בקלף נוסף גבוה מאוד. עצור.`;
  return `עם ${t} יש סיכון ממשי לחרוג אם תיקח קלף. הדילר מציג ${up} — קלף חלש — ויש לו סיכוי טוב לחרוג בעצמו. עדיף לעצור ולתת לדילר להסתכן.`;
}

function details(rec: Recommendation): string {
  const s = rec.situation;
  const lines: string[] = [dealerLine(s.up)];
  if (s.category === 'hard' && s.total >= 12 && s.total <= 17) {
    lines.push(`הסיכוי שקלף נוסף יגרום לך לחרוג מ־21 עם ${s.total} הוא בערך ${bustChance(s.total)}%.`);
  }
  if (s.category === 'soft') lines.push('ביד עם אס, האס נספר כ־11 כל עוד זה לא מעביר אותך את 21, ואחר כך יורד אוטומטית ל־1.');
  if (rec.action === 'double') lines.push('בהכפלה ההימור גדל פי שניים ומקבלים קלף אחד בלבד — לכן מכפילים רק כשהיתרון לטובתך.');
  if (rec.fallback && rec.action !== rec.fallback)
    lines.push(`אם ${ACTION_LABEL[rec.action]} אינה אפשרית, הבחירה הבאה היא: ${ACTION_LABEL[rec.fallback]}.`);
  lines.push(LUCK_NOTE);
  return lines.join(' ');
}

export function explain(rec: Recommendation): Explanation {
  return {
    headline: `מומלץ ${ACTION_INFINITIVE[rec.action]}`,
    short: `${opening(rec.situation)} ${reason(rec)}`,
    detailed: details(rec),
  };
}

export function feedbackHeadline(grade: DecisionGrade, rec: Recommendation): string {
  if (grade === 'correct') return 'מצוין. זו הפעולה המומלצת.';
  if (grade === 'minor')
    return `החלטה סבירה, אבל יש כאן אפשרות טובה יותר. במצב הזה היה עדיף ${ACTION_INFINITIVE[rec.action]}.`;
  return `יש כאן אפשרות טובה יותר. במצב הזה היה עדיף ${ACTION_INFINITIVE[rec.action]}.`;
}

export const INSURANCE_TEXT = {
  what: 'ביטוח הוא הימור נוסף נגד האפשרות שלדילר יש בלאק ג׳ק.',
  advice: 'בדרך כלל ביטוח אינו נחשב להחלטה טובה לאורך זמן.',
  detail:
    'הביטוח עולה חצי מההימור ומשלם 2 ל־1 אם לדילר יש בלאק ג׳ק. אבל רק כ־4 מכל 13 קלפים שווים 10, כך שהדילר משלים בלאק ג׳ק בפחות משליש מהמקרים — והתשלום לא מכסה את זה.',
};

export function explainChosen(chosen: Action): string {
  return `בחרת: ${ACTION_LABEL[chosen]}.`;
}
