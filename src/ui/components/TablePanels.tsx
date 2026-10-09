// Panels under the felt: betting, insurance, actions, coaching, feedback and hand summary.

import { useState } from 'react';
import type { Action } from '../../engine/game';
import { ACTION_HELP, ACTION_LABEL, formatChips, formatSigned, upName } from '../../i18n/he';
import type { Recommendation } from '../../strategy/basicStrategy';
import { explain, feedbackHeadline, INSURANCE_TEXT } from '../../strategy/explanations';
import type { Settings } from '../../stats/profile';
import { outcomeHeadline } from '../format';
import type { Feedback, HandSummary } from '../hooks/useTableController';
import { CHIP_VALUES, ChipButton } from './Chip';

const ACTION_ORDER: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];
const ACTION_KEY: Record<Action, string> = { hit: '1', stand: '2', double: '3', split: '4', surrender: '5' };
export { ACTION_KEY };

// ---------- betting ----------

interface BettingProps {
  chips: number;
  bet: number;
  lastBet: number;
  minBet: number;
  message: string;
  onChip: (v: number) => void;
  onClear: () => void;
  onRepeat: () => void;
  onConfirm: () => void;
  onRefill: () => void;
}

export function BettingPanel({ chips, bet, lastBet, minBet, message, onChip, onClear, onRepeat, onConfirm, onRefill }: BettingProps) {
  if (chips < minBet) {
    return (
      <div className="panel panel-center">
        <h3>נגמרו לך הצ׳יפים</h3>
        <p>זה קורה גם לשחקנים טובים — המזל משחק תפקיד בכל יד. הצ׳יפים כאן וירטואליים בלבד.</p>
        <button type="button" className="btn btn-gold btn-lg" onClick={onRefill}>
          קבל 1,000 צ׳יפים וירטואליים
        </button>
      </div>
    );
  }
  return (
    <div className="panel betting-panel">
      <div className="bet-readout">
        <span className="bet-label">הימור</span>
        <strong className="bet-amount" aria-live="polite">
          {formatChips(bet)}
        </strong>
        <span className="bet-chips">מתוך {formatChips(chips)} צ׳יפים</span>
      </div>
      <div className="chip-row" role="group" aria-label="בחירת צ׳יפים להימור">
        {CHIP_VALUES.map((v) => (
          <ChipButton key={v} value={v} disabled={bet + v > chips} onClick={() => onChip(v)} />
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={!bet}>
          נקה הימור
        </button>
        {lastBet > 0 && lastBet !== bet && lastBet <= chips && (
          <button type="button" className="btn btn-ghost" onClick={onRepeat}>
            הימור קודם ({formatChips(lastBet)})
          </button>
        )}
        <button type="button" className="btn btn-gold btn-lg" onClick={onConfirm}>
          אשר הימור
        </button>
      </div>
      {message && <p className="panel-msg" role="status">{message}</p>}
    </div>
  );
}

// ---------- insurance ----------

export function InsurancePanel({
  cost,
  canAfford,
  showAdvice,
  onDecide,
}: {
  cost: number;
  canAfford: boolean;
  showAdvice: boolean;
  onDecide: (take: boolean) => void;
}) {
  const [more, setMore] = useState(false);
  return (
    <div className="panel insurance-panel">
      <h3>הדילר מציג אס — ביטוח?</h3>
      <p>{INSURANCE_TEXT.what}</p>
      {showAdvice && <p className="advice">💡 {INSURANCE_TEXT.advice}</p>}
      {more && <p className="muted">{INSURANCE_TEXT.detail}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-gold btn-lg" onClick={() => onDecide(false)} data-autofocus>
          ללא ביטוח
        </button>
        <button type="button" className="btn btn-outline btn-lg" onClick={() => onDecide(true)} disabled={!canAfford}>
          קח ביטוח ({formatChips(cost)})
        </button>
        {!more && (
          <button type="button" className="btn btn-link" onClick={() => setMore(true)}>
            הסבר נוסף
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- actions ----------

interface ActionProps {
  available: Action[];
  recommended: Action | null;
  disabled: boolean;
  showHelp: boolean;
  /** Short reminder of the situation, so the user need not look back at the table. */
  context?: string;
  onAct: (a: Action) => void;
}

export function ActionPanel({ available, recommended, disabled, showHelp, context, onAct }: ActionProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const shown = ACTION_ORDER.filter((a) => available.includes(a));
  return (
    <div className="panel action-panel">
      {context && <p className="action-context">{context}</p>}
      <div className="action-row" role="group" aria-label="פעולות">
        {shown.map((a) => {
          const isRec = recommended === a;
          return (
            <button
              key={a}
              type="button"
              className={`btn btn-action act-${a} ${isRec ? 'is-recommended' : ''}`}
              onClick={() => onAct(a)}
              disabled={disabled}
              aria-keyshortcuts={ACTION_KEY[a]}
              aria-describedby={showHelp ? `help-${a}` : undefined}
              title={ACTION_HELP[a]}
            >
              <span className="act-label">{ACTION_LABEL[a]}</span>
              {isRec && <span className="rec-badge">מומלץ</span>}
            </button>
          );
        })}
      </div>
      {showHelp && (
        <div className="action-help">
          <button type="button" className="btn btn-link" aria-expanded={helpOpen} onClick={() => setHelpOpen((o) => !o)}>
            {helpOpen ? 'הסתר הסבר על הפעולות' : 'מה כל פעולה עושה?'}
          </button>
          {helpOpen && (
            <dl className="help-list">
              {shown.map((a) => (
                <div key={a} id={`help-${a}`}>
                  <dt>{ACTION_LABEL[a]}</dt>
                  <dd>{ACTION_HELP[a]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      <p className="kbd-hint">
        קיצורי מקלדת:{' '}
        {shown.map((a) => (
          <span key={a}>
            <kbd>{ACTION_KEY[a]}</kbd> {ACTION_LABEL[a]}{' '}
          </span>
        ))}
      </p>
    </div>
  );
}

// ---------- coach (learn mode, before a decision) ----------

interface CoachProps {
  rec: Recommendation;
  available: Action[];
  handTotalText: string;
  onDismiss: () => void;
  onNeverForThis: () => void;
  onHideAll: () => void;
}

export function CoachPanel({ rec, available, handTotalText, onDismiss, onNeverForThis, onHideAll }: CoachProps) {
  const [more, setMore] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const ex = explain(rec);
  return (
    <aside className="panel coach" aria-label="הסבר לפני ההחלטה" aria-live="polite">
      <div className="coach-facts">
        <div>
          <span className="fact-label">היד שלך</span>
          <strong>{handTotalText}</strong>
        </div>
        <div>
          <span className="fact-label">הדילר מציג</span>
          <strong>{upName(rec.situation.up)}</strong>
        </div>
        <div>
          <span className="fact-label">אפשרויות</span>
          <strong className="fact-small">{ACTION_ORDER.filter((a) => available.includes(a)).map((a) => ACTION_LABEL[a]).join(' · ')}</strong>
        </div>
      </div>
      <p className="coach-headline">
        <span aria-hidden="true">💡 </span>
        {ex.headline}: <strong>{ACTION_LABEL[rec.action]}</strong>
      </p>
      <p className={more ? '' : 'coach-short'}>{ex.short}</p>
      {more && <p className="muted">{ex.detailed}</p>}
      <div className="btn-row btn-row-wrap coach-actions">
        <button type="button" className="btn btn-gold" onClick={onDismiss}>
          הבנתי
        </button>
        {!more && (
          <button type="button" className="btn btn-outline" onClick={() => setMore(true)}>
            הסבר נוסף
          </button>
        )}
        {/* On small screens the less common choices fold behind one button. */}
        <button
          type="button"
          className="btn btn-ghost coach-more-btn"
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen((o) => !o)}
        >
          {optionsOpen ? 'פחות אפשרויות' : 'אפשרויות נוספות'}
        </button>
        <div className={`coach-extra ${optionsOpen ? 'open' : ''}`}>
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>
            דלג על ההסבר
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNeverForThis}>
            אל תציג הסבר כזה שוב
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHideAll}>
            המשך בלי הסברים
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------- feedback (after a decision) ----------

interface FeedbackProps {
  feedback: Feedback;
  explanations: Settings['explanations'];
  onContinue: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export function FeedbackPanel({ feedback, explanations, onContinue, onRetry, onClose }: FeedbackProps) {
  const [show, setShow] = useState(explanations === 'full' && feedback.grade !== 'correct');
  const ex = explain(feedback.rec);
  const icon = feedback.grade === 'correct' ? '✓' : feedback.grade === 'minor' ? '≈' : '✗';
  return (
    <aside className={`panel feedback fb-${feedback.grade}`} role="status" aria-live="assertive">
      <p className="fb-head">
        <span className="fb-icon" aria-hidden="true">
          {icon}
        </span>
        <span>
          {feedback.grade !== 'correct' && <>בחרת: {ACTION_LABEL[feedback.chosen]}. </>}
          {feedbackHeadline(feedback.grade, feedback.rec)}
        </span>
      </p>
      {show && (
        <>
          <p>{ex.short}</p>
          {explanations === 'full' && <p className="muted">{ex.detailed}</p>}
        </>
      )}
      <div className="btn-row btn-row-wrap">
        {feedback.pending ? (
          <>
            <button type="button" className="btn btn-gold" onClick={onRetry} data-autofocus>
              נסה שוב
            </button>
            <button type="button" className="btn btn-outline" onClick={onContinue}>
              המשך ({ACTION_LABEL[feedback.chosen]})
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            המשך
          </button>
        )}
        {!show && (
          <button type="button" className="btn btn-link" onClick={() => setShow(true)}>
            הצג הסבר
          </button>
        )}
      </div>
    </aside>
  );
}

// ---------- hand summary ----------

export function HandSummaryPanel({
  summary,
  onNext,
  onHistory,
  showDecisionDetails,
}: {
  summary: HandSummary;
  onNext: () => void;
  onHistory: () => void;
  showDecisionDetails: boolean;
}) {
  const { outcomes, net, decisions } = summary;
  const good = decisions.filter((d) => d.grade === 'correct').length;
  const insuranceMistake = summary.insuranceTaken === true;
  const total = decisions.length + (summary.insuranceTaken !== null ? 1 : 0);
  const correct = good + (summary.insuranceTaken === false ? 1 : 0);
  const won = net > 0;
  const lost = net < 0;

  let quality: string;
  if (total === 0) quality = 'לא נדרשו ממך החלטות ביד הזאת.';
  else if (correct === total)
    quality = lost
      ? 'הפסדת את היד, אבל כל ההחלטות שלך היו נכונות. זה המזל של חלוקת הקלפים.'
      : 'כל ההחלטות שלך היו נכונות.';
  else
    quality = won
      ? `ניצחת, אבל ${correct} מתוך ${total} החלטות היו מיטביות — הפעם המזל עזר.`
      : `${correct} מתוך ${total} החלטות היו מיטביות.`;

  const tone = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
  return (
    <div className={`panel summary-panel sum-${tone}`} role="status" aria-live="polite">
      <div className="summary-grid">
        <div className="summary-box">
          <span className="fact-label">תוצאת היד</span>
          <strong className="summary-headline">{outcomeHeadline(outcomes, net)}</strong>
          <span className={`net net-${tone}`}>{formatSigned(net)} צ׳יפים</span>
        </div>
        <div className="summary-box">
          <span className="fact-label">איכות ההחלטות</span>
          <strong>{total ? `${correct}/${total} נכונות` : '—'}</strong>
          <span>{quality}</span>
        </div>
      </div>
      {showDecisionDetails && (decisions.some((d) => d.grade !== 'correct') || insuranceMistake) && (
        <ul className="decision-list">
          {insuranceMistake && <li>ביטוח: עדיף לוותר על ביטוח.</li>}
          {decisions
            .filter((d) => d.grade !== 'correct')
            .map((d, i) => (
              <li key={i}>
                {d.rec.situation.category === 'pair' ? 'זוג' : 'יד'} {d.rec.situation.total} מול {upName(d.rec.situation.up)}: בחרת{' '}
                {ACTION_LABEL[d.chosen]}, מומלץ {ACTION_LABEL[d.rec.action]}.
              </li>
            ))}
        </ul>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-gold btn-lg" onClick={onNext} data-autofocus>
          יד חדשה
        </button>
        <button type="button" className="btn btn-outline" onClick={onHistory}>
          היסטוריית הסיבוב
        </button>
      </div>
    </div>
  );
}
