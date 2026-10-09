import { ReactNode, useEffect, useRef, useState } from 'react';
import { card, Rank, Suit } from '../../engine/cards';
import { PlayingCard } from '../components/PlayingCard';
import { useStore } from '../store';

const C = (r: Rank, s: Suit = 'spades') => card(r, s);

function Hand({ cards, label }: { cards: ReturnType<typeof C>[]; label?: string }) {
  return (
    <figure className="lesson-hand">
      <div className="hand-cards">
        {cards.map((c) => (
          <PlayingCard key={c.id} card={c} size="md" />
        ))}
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}

interface Step {
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'מטרת המשחק',
    body: (
      <>
        <p>בבלאק ג׳ק משחקים נגד הדילר, לא נגד שאר השחקנים. המטרה: להגיע לסכום קלפים גבוה מזה של הדילר — בלי לעבור את 21.</p>
        <div className="lesson-row">
          <Hand cards={[C('10', 'hearts'), C('9')]} label="אתה: 19" />
          <span className="vs">מול</span>
          <Hand cards={[C('K'), C('7', 'diamonds')]} label="הדילר: 17" />
        </div>
        <p className="advice">19 גבוה מ־17 — ניצחת!</p>
      </>
    ),
  },
  {
    title: 'ערכי הקלפים',
    body: (
      <>
        <ul className="bullets">
          <li>קלפים 2 עד 10 שווים את המספר שעליהם.</li>
          <li>נסיך, מלכה ומלך שווים 10.</li>
          <li>אס שווה 11 או 1 — מה שטוב יותר ליד.</li>
        </ul>
        <div className="lesson-row">
          <Hand cards={[C('J', 'clubs')]} label="10" />
          <Hand cards={[C('Q', 'hearts')]} label="10" />
          <Hand cards={[C('K', 'diamonds')]} label="10" />
          <Hand cards={[C('A')]} label="1 או 11" />
        </div>
      </>
    ),
  },
  {
    title: 'חריגה מ־21',
    body: (
      <>
        <p>אם סכום הקלפים שלך עובר את 21 — זו חריגה מ־21, ואתה מפסיד מיד, גם אם הדילר יחרוג אחר כך.</p>
        <div className="lesson-row">
          <Hand cards={[C('10'), C('6', 'hearts'), C('8', 'clubs')]} label="24 — חריגה מ־21" />
        </div>
        <p>
          יד עם אס שנספר כ־11 נקראת <strong>יד רכה</strong>: היא לא יכולה לחרוג בקלף אחד, כי האס פשוט יורד ל־1.
        </p>
        <div className="lesson-row">
          <Hand cards={[C('A', 'hearts'), C('6')]} label="17 רך" />
          <span className="vs">+ 9 =</span>
          <Hand cards={[C('A', 'hearts'), C('6'), C('9', 'diamonds')]} label="16 (האס עבר לערך 1)" />
        </div>
      </>
    ),
  },
  {
    title: 'חוקי הדילר',
    body: (
      <>
        <p>הדילר מקבל קלף אחד גלוי וקלף אחד מוסתר. אחרי שכל השחקנים סיימו, הוא חושף את הקלף המוסתר.</p>
        <ul className="bullets">
          <li>עם 16 או פחות — הדילר חייב לקחת קלף.</li>
          <li>עם 17 ומעלה — הדילר חייב לעצור.</li>
        </ul>
        <p>לדילר אין בחירה ואין אסטרטגיה — הוא פועל לפי החוקים. לכן הקלף הגלוי שלו מספר לך הרבה: קלפים 2–6 חלשים לדילר, 7 עד אס חזקים.</p>
      </>
    ),
  },
  {
    title: 'קח קלף',
    body: (
      <>
        <p>
          <strong>קח קלף</strong> — קבלת קלף נוסף ליד שלך. המטרה היא להתקרב ל־21 מבלי לעבור אותו. אפשר לקחת כמה קלפים שרוצים.
        </p>
        <div className="lesson-row">
          <Hand cards={[C('7'), C('5', 'hearts')]} label="12" />
          <span className="vs">+</span>
          <Hand cards={[C('8', 'clubs')]} label="= 20" />
        </div>
        <p className="muted">כלל אצבע: עם 11 ומטה תמיד כדאי לקחת קלף — אי אפשר לחרוג.</p>
      </>
    ),
  },
  {
    title: 'עצור',
    body: (
      <>
        <p>
          <strong>עצור</strong> — סיום התור עם היד הנוכחית. עוצרים כשהיד חזקה מספיק, או כשהדילר צפוי לחרוג בעצמו.
        </p>
        <div className="lesson-row">
          <Hand cards={[C('10'), C('3', 'diamonds')]} label="13" />
          <span className="vs">מול</span>
          <Hand cards={[C('6', 'hearts')]} label="הדילר מציג 6" />
        </div>
        <p className="muted">מול 6 של הדילר עדיף לעצור על 13: לדילר יש סיכוי גבוה לחרוג.</p>
      </>
    ),
  },
  {
    title: 'הכפל',
    body: (
      <>
        <p>
          <strong>הכפל</strong> — הכפלת ההימור וקבלת קלף נוסף אחד בלבד. מתאים כשהיתרון לטובתך, למשל 10 או 11 מול קלף חלש של הדילר.
        </p>
        <div className="lesson-row">
          <Hand cards={[C('6'), C('5', 'hearts')]} label="11" />
          <span className="vs">מול</span>
          <Hand cards={[C('5', 'clubs')]} label="הדילר מציג 5" />
        </div>
        <p className="muted">מכפילים רק על שני הקלפים הראשונים.</p>
      </>
    ),
  },
  {
    title: 'פצל',
    body: (
      <>
        <p>
          <strong>פצל</strong> — כשיש לך זוג, אפשר להפוך אותו לשתי ידיים נפרדות. שמים הימור נוסף בגובה ההימור המקורי, וכל יד משוחקת לחוד.
        </p>
        <div className="lesson-row">
          <Hand cards={[C('8'), C('8', 'hearts')]} label="זוג 8" />
          <span className="vs">←</span>
          <Hand cards={[C('8'), C('3', 'clubs')]} label="יד 1" />
          <Hand cards={[C('8', 'hearts'), C('10', 'diamonds')]} label="יד 2" />
        </div>
        <p className="muted">תמיד מפצלים אסים ושמיניות. אף פעם לא מפצלים עשיריות או חמישיות.</p>
      </>
    ),
  },
  {
    title: 'בלאק ג׳ק',
    body: (
      <>
        <p>אס וקלף בשווי 10 בשני הקלפים הראשונים — זה בלאק ג׳ק, היד הטובה ביותר. הוא משלם 3 ל־2: על הימור של 10 תקבל 15.</p>
        <div className="lesson-row">
          <Hand cards={[C('A'), C('K', 'hearts')]} label="בלאק ג׳ק!" />
        </div>
        <p className="muted">אם גם לדילר יש בלאק ג׳ק — זה תיקו. 21 אחרי פיצול אינו נחשב בלאק ג׳ק.</p>
      </>
    ),
  },
  {
    title: 'ביטוח',
    body: (
      <>
        <p>כשהדילר מציג אס, תוצע לך אפשרות ביטוח.</p>
        <p>
          <strong>ביטוח הוא הימור נוסף נגד האפשרות שלדילר יש בלאק ג׳ק.</strong> הוא עולה חצי מההימור ומשלם 2 ל־1.
        </p>
        <p className="advice">בדרך כלל ביטוח אינו נחשב להחלטה טובה לאורך זמן.</p>
        <p>וזהו! עכשיו הכי טוב ללמוד תוך כדי משחק. במצב לימוד תקבל המלצה והסבר לפני כל החלטה.</p>
      </>
    ),
  },
];

export function LessonScreen() {
  const { profile, updateProfile } = useStore();
  const [i, setI] = useState(() => {
    const firstOpen = STEPS.findIndex((_, k) => !profile.lessonsDone.includes(k));
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = STEPS[i];

  useEffect(() => {
    updateProfile((p) => (p.lessonsDone.includes(i) ? p : { ...p, lessonsDone: [...p.lessonsDone, i] }));
    headingRef.current?.focus();
  }, [i, updateProfile]);

  return (
    <div className="page narrow">
      <p className="muted center">שיעור למתחילים · אין חובה לסיים לפני שמשחקים</p>
      <ol className="steps" aria-label="שלבי השיעור">
        {STEPS.map((s, k) => (
          <li key={s.title}>
            <button
              type="button"
              className={`step-dot ${k === i ? 'current' : ''} ${profile.lessonsDone.includes(k) ? 'done' : ''}`}
              onClick={() => setI(k)}
              aria-label={`שלב ${k + 1}: ${s.title}`}
              aria-current={k === i ? 'step' : undefined}
            >
              {k + 1}
            </button>
          </li>
        ))}
      </ol>
      <article className="lesson-card" aria-live="polite">
        <h1 ref={headingRef} tabIndex={-1}>
          <span className="step-num">{i + 1}.</span> {step.title}
        </h1>
        {step.body}
      </article>
      <div className="btn-row btn-row-between">
        <button type="button" className="btn btn-outline" onClick={() => setI(i - 1)} disabled={i === 0}>
          → הקודם
        </button>
        {i < STEPS.length - 1 ? (
          <button type="button" className="btn btn-gold btn-lg" onClick={() => setI(i + 1)}>
            הבא ←
          </button>
        ) : (
          <a className="btn btn-gold btn-lg" href="#/play?mode=learn">
            בואו נשחק במצב לימוד
          </a>
        )}
      </div>
      <p className="center">
        <a href="#/play?mode=learn" className="btn btn-link">
          דלג ישר למשחק
        </a>
      </p>
    </div>
  );
}
