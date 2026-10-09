import { useState } from 'react';
import { ACTION_LABEL, CATEGORY_LABEL, formatChips, formatSigned, MODE_LABEL, percent, RANK_NAME, upName } from '../../i18n/he';
import { upValueOf } from '../../strategy/basicStrategy';
import { ACHIEVEMENTS, MistakeEntry, mistakesToPractice, resolvedMistakes, SessionRecord } from '../../stats/profile';
import { Modal } from '../components/Modal';
import { useStore } from '../store';

const KIND_LABEL: Record<SessionRecord['kind'], string> = {
  ...MODE_LABEL,
  quick: 'תרגול מהיר',
  mistakes: 'תרגול טעויות',
};

function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className="meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressScreen() {
  const { profile, resetProgress } = useStore();
  const s = profile.stats;
  const [confirmReset, setConfirmReset] = useState(false);
  const mistakes = mistakesToPractice(s);
  const fixed = resolvedMistakes(s);
  const situation = (m: MistakeEntry) => `${m.playerCards.map((r) => RANK_NAME[r]).join(' ו־')} מול ${upName(upValueOf(m.dealerUp))}`;

  const tiles = [
    { label: 'משחקים', value: s.games },
    { label: 'ידיים', value: s.hands },
    { label: 'החלטות', value: s.decisions },
    { label: 'החלטות נכונות', value: percent(s.correct, s.decisions) },
    { label: 'רצף נוכחי', value: s.streak },
    { label: 'הרצף הטוב ביותר', value: s.bestStreak },
    { label: 'פיצולים נכונים', value: s.splits.correct },
    { label: 'הכפלות נכונות', value: s.doubles.correct },
    { label: 'טעויות', value: s.mistakes },
    { label: 'החלטות פחות טובות', value: s.minor },
  ];

  return (
    <div className="page">
      <h1 className="page-title">ההתקדמות שלי</h1>
      <p className="muted center">הנתונים נשמרים רק במכשיר ובדפדפן הזה. אין צורך בהרשמה.</p>

      <section className="tiles" aria-label="סיכום">
        {tiles.map((t) => (
          <div className="tile" key={t.label}>
            <span className="tile-value">{t.value}</span>
            <span className="tile-label">{t.label}</span>
          </div>
        ))}
      </section>

      <div className="two-col">
        <section className="card-section" aria-labelledby="cat-h">
          <h2 id="cat-h">הצלחה לפי סוג יד</h2>
          {(['hard', 'soft', 'pair'] as const).map((k) => {
            const c = s.byCategory[k];
            return (
              <div className="cat-row" key={k}>
                <div className="cat-head">
                  <span>{CATEGORY_LABEL[k]}</span>
                  <strong>
                    {percent(c.correct, c.decisions)} <span className="muted">({c.correct}/{c.decisions})</span>
                  </strong>
                </div>
                <Meter value={c.decisions ? c.correct / c.decisions : 0} label={`${CATEGORY_LABEL[k]}: ${percent(c.correct, c.decisions)}`} />
              </div>
            );
          })}
          <div className="cat-row">
            <div className="cat-head">
              <span>תרגול מהיר</span>
              <strong>
                {percent(s.quick.correct, s.quick.answered)} <span className="muted">({s.quick.correct}/{s.quick.answered})</span>
              </strong>
            </div>
            <Meter value={s.quick.answered ? s.quick.correct / s.quick.answered : 0} label={`תרגול מהיר: ${percent(s.quick.correct, s.quick.answered)}`} />
          </div>
          <dl className="mini-stats">
            <div><dt>ידיים שניצחת</dt><dd>{s.handsWon}</dd></div>
            <div><dt>ידיים שהפסדת</dt><dd>{s.handsLost}</dd></div>
            <div><dt>תיקו</dt><dd>{s.handsPushed}</dd></div>
            <div><dt>בלאק ג׳ק</dt><dd>{s.blackjacks}</dd></div>
            <div><dt>רווח או הפסד כולל</dt><dd className={s.chipsNet >= 0 ? 'pos' : 'neg'}>{formatSigned(s.chipsNet)}</dd></div>
            <div><dt>צ׳יפים כרגע</dt><dd>{formatChips(profile.chips)}</dd></div>
          </dl>
        </section>

        <section className="card-section" aria-labelledby="mis-h">
          <h2 id="mis-h">הטעויות שלי</h2>
          {mistakes.length ? (
            <>
              <p className="muted">מצבים שעוד צריך לתרגל — מה שטעית בו הכי הרבה מופיע ראשון. מצב שתענה עליו נכון יוצא מהתרגול.</p>
              <ul className="mistake-list">
                {mistakes.slice(0, 8).map((m) => (
                  <li key={m.key}>
                    <span>{situation(m)}</span>
                    <span className="muted">
                      מומלץ: {ACTION_LABEL[m.recommended]} · טעויות: {m.misses}
                    </span>
                  </li>
                ))}
              </ul>
              {mistakes.length > 8 && <p className="muted">ועוד {mistakes.length - 8} מצבים.</p>}
            </>
          ) : (
            <p className="muted">
              {fixed.length ? 'אין כרגע טעויות פתוחות — תיקנת את כולן. 👏' : 'עדיין אין טעויות שמורות. כל מצב שבו תטעו יישמר כאן לתרגול.'}
            </p>
          )}
          <a className={`btn btn-gold btn-lg ${mistakes.length ? '' : 'disabled'}`} href="#/quick?mistakes=1" aria-disabled={!mistakes.length}>
            תרגל את הטעויות שלי{mistakes.length ? ` (${mistakes.length})` : ''}
          </a>
          {fixed.length > 0 && (
            <details className="fixed-mistakes">
              <summary>טעויות שתיקנת ({fixed.length})</summary>
              <ul className="mistake-list">
                {fixed.map((m) => (
                  <li key={m.key} className="is-fixed">
                    <span>
                      <span aria-hidden="true">✓ </span>
                      {situation(m)}
                    </span>
                    <span className="muted">
                      {ACTION_LABEL[m.recommended]} · טעית {m.misses === 1 ? 'פעם אחת' : `${m.misses} פעמים`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <section className="card-section" aria-labelledby="ach-h">
        <h2 id="ach-h">הישגים</h2>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const at = s.achievements[a.id];
            return (
              <li key={a.id} className={at ? 'unlocked' : 'locked'}>
                <span className="ach-icon" aria-hidden="true">{at ? a.icon : '🔒'}</span>
                <div>
                  <strong>{a.title}</strong>
                  <span>{a.description}</span>
                  <span className="ach-state">{at ? `הושג ב־${new Date(at).toLocaleDateString('he-IL')}` : 'עוד לא הושג'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card-section" aria-labelledby="hist-h">
        <h2 id="hist-h">היסטוריית תרגול</h2>
        {s.history.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">תאריך</th>
                  <th scope="col">סוג</th>
                  <th scope="col">ידיים</th>
                  <th scope="col">החלטות</th>
                  <th scope="col">דיוק</th>
                  <th scope="col">צ׳יפים</th>
                </tr>
              </thead>
              <tbody>
                {s.history.map((h, i) => (
                  <tr key={i}>
                    <td>{new Date(h.date).toLocaleDateString('he-IL')}</td>
                    <td>{KIND_LABEL[h.kind]}</td>
                    <td>{h.hands || '—'}</td>
                    <td>{h.decisions}</td>
                    <td>{percent(h.correct, h.decisions)}</td>
                    <td className={h.net >= 0 ? 'pos' : 'neg'}>{h.kind === 'quick' || h.kind === 'mistakes' ? '—' : formatSigned(h.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">עוד אין משחקים שמורים.</p>
        )}
      </section>

      <div className="btn-row btn-row-center">
        <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmReset(true)}>
          איפוס ההתקדמות
        </button>
      </div>

      {confirmReset && (
        <Modal
          title="לאפס את ההתקדמות?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)} data-autofocus>
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  resetProgress();
                  setConfirmReset(false);
                }}
              >
                כן, אפס הכול
              </button>
            </>
          }
        >
          <p>כל הסטטיסטיקות, ההישגים והטעויות השמורות יימחקו, והצ׳יפים יחזרו ל־1,000. ההגדרות יישמרו.</p>
        </Modal>
      )}
    </div>
  );
}
