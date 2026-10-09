import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action } from '../../engine/game';
import { DEFAULT_RULES } from '../../engine/rules';
import { ACTION_LABEL, percent, upName } from '../../i18n/he';
import { DecisionGrade, gradeDecision, recommend } from '../../strategy/basicStrategy';
import { explain, feedbackHeadline } from '../../strategy/explanations';
import { randomScenario, Scenario, scenarioFromMistake } from '../../strategy/scenarios';
import { mistakesToPractice, recordDecision, recordSession } from '../../stats/profile';
import { PlayingCard } from '../components/PlayingCard';
import { totalText } from '../format';
import { useStore } from '../store';

const OPTIONS: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];

export function QuickPracticeScreen({ mistakesMode }: { mistakesMode: boolean }) {
  const { profile, updateStats } = useStore();
  const explanations = profile.settings.explanations;
  // Snapshot the mistake queue when the screen opens so it does not reshuffle mid-practice.
  const [queue, setQueue] = useState(() => (mistakesMode ? mistakesToPractice(profile.stats) : []));
  const [scenario, setScenario] = useState<Scenario>(() =>
    mistakesMode && queue.length ? scenarioFromMistake(queue[0], DEFAULT_RULES) : randomScenario(DEFAULT_RULES),
  );
  const [answer, setAnswer] = useState<{ chosen: Action; grade: DecisionGrade } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [tally, setTally] = useState({ answered: 0, correct: 0 });

  const rec = useMemo(
    () => recommend({ playerCards: scenario.playerCards, dealerUp: scenario.dealerUp, available: scenario.available, rules: DEFAULT_RULES }),
    [scenario],
  );
  const ex = explain(rec);
  const outOfMistakes = mistakesMode && queue.length === 0;

  // Record a session entry when leaving, if anything was answered.
  const tallyRef = useRef(tally);
  tallyRef.current = tally;
  const updateStatsRef = useRef(updateStats);
  updateStatsRef.current = updateStats;
  useEffect(
    () => () => {
      const t = tallyRef.current;
      if (t.answered)
        updateStatsRef.current((s) =>
          recordSession(s, { date: Date.now(), kind: mistakesMode ? 'mistakes' : 'quick', hands: 0, decisions: t.answered, correct: t.correct, net: 0 }),
        );
    },
    [mistakesMode],
  );

  const choose = useCallback(
    (a: Action) => {
      if (answer || !scenario.available.includes(a)) return;
      const grade = gradeDecision(rec, a);
      setAnswer({ chosen: a, grade });
      setShowMore(explanations === 'full' && grade !== 'correct');
      setTally((t) => ({ answered: t.answered + 1, correct: t.correct + (grade === 'correct' ? 1 : 0) }));
      updateStats((s) =>
        recordDecision(s, {
          rec,
          chosen: a,
          grade,
          playerCards: scenario.playerCards.map((c) => c.rank),
          dealerUp: scenario.dealerUp.rank,
          source: 'quick',
        }),
      );
    },
    [answer, scenario, rec, explanations, updateStats],
  );

  const next = useCallback(() => {
    setAnswer(null);
    setShowMore(false);
    if (mistakesMode) {
      // A correctly answered mistake leaves the queue; a wrong one goes to the back.
      const [head, ...rest] = queue;
      const nextQueue = answer?.grade === 'correct' ? rest : [...rest, head];
      setQueue(nextQueue);
      if (nextQueue.length) setScenario(scenarioFromMistake(nextQueue[0], DEFAULT_RULES));
      return;
    }
    setScenario(randomScenario(DEFAULT_RULES));
  }, [mistakesMode, queue, answer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const idx = Number(e.key) - 1;
      if (!answer && idx >= 0 && idx < OPTIONS.length) choose(OPTIONS[idx]);
      else if (answer && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, choose, next]);

  if (outOfMistakes) {
    return (
      <div className="page narrow">
        <h1 className="page-title">תרגל את הטעויות שלי</h1>
        <div className="panel panel-center">
          <p className="big-emoji" aria-hidden="true">🎉</p>
          <h2>{tally.answered ? 'סיימת לתרגל את כל הטעויות!' : 'אין כרגע טעויות לתרגול'}</h2>
          <p>{tally.answered ? `ענית נכון על ${tally.correct} מתוך ${tally.answered}.` : 'שחקו עוד קצת, ומצבים שבהם תטעו יופיעו כאן לתרגול.'}</p>
          <div className="btn-row btn-row-center">
            <a className="btn btn-gold" href="#/quick">תרגול מהיר</a>
            <a className="btn btn-outline" href="#/progress">ההתקדמות שלי</a>
          </div>
        </div>
      </div>
    );
  }

  const handLabel =
    rec.situation.category === 'pair' ? `זוג (${totalText(scenario.playerCards)})` : totalText(scenario.playerCards);

  return (
    <div className="page narrow">
      <h1 className="page-title">{mistakesMode ? 'תרגל את הטעויות שלי' : 'תרגול מהיר'}</h1>
      <p className="muted center">
        {mistakesMode ? `נותרו ${queue.length} מצבים לתרגול · ` : ''}ענית נכון על {tally.correct} מתוך {tally.answered} ({percent(tally.correct, tally.answered)})
      </p>

      <section className="quick-felt" aria-label="המצב לתרגול">
        <div className="quick-side">
          <h2>הדילר מציג: {upName(rec.situation.up)}</h2>
          <div className="hand-cards">
            <PlayingCard card={scenario.dealerUp} size="lg" key={scenario.dealerUp.id} />
            <PlayingCard hidden size="lg" key={`h-${scenario.dealerUp.id}`} />
          </div>
        </div>
        <div className="quick-side">
          <h2>היד שלך: {handLabel}</h2>
          <div className="hand-cards">
            {scenario.playerCards.map((c) => (
              <PlayingCard key={c.id} card={c} size="lg" />
            ))}
          </div>
        </div>
      </section>

      <h2 className="center question">מה היית עושה?</h2>
      <div className="action-row quick-actions" role="group" aria-label="בחירת פעולה">
        {OPTIONS.map((a, i) => {
          const enabled = scenario.available.includes(a);
          const state = answer ? (a === rec.action ? 'is-answer' : a === answer.chosen ? 'is-wrong' : '') : '';
          return (
            <button
              key={a}
              type="button"
              className={`btn btn-action act-${a} ${state}`}
              disabled={!enabled || !!answer}
              onClick={() => choose(a)}
              aria-keyshortcuts={String(i + 1)}
            >
              <span className="act-label">{ACTION_LABEL[a]}</span>
              {state === 'is-answer' && <span className="rec-badge">✓ המומלץ</span>}
              {state === 'is-wrong' && <span className="rec-badge wrong">✗ הבחירה שלך</span>}
            </button>
          );
        })}
      </div>

      {answer && (
        <div className={`panel feedback fb-${answer.grade}`} role="status" aria-live="assertive">
          <p className="fb-head">
            <span className="fb-icon" aria-hidden="true">{answer.grade === 'correct' ? '✓' : answer.grade === 'minor' ? '≈' : '✗'}</span>
            <span>{feedbackHeadline(answer.grade, rec)}</span>
          </p>
          {(explanations !== 'none' || showMore) && <p>{ex.short}</p>}
          {showMore && <p className="muted">{ex.detailed}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn-gold btn-lg" onClick={next} autoFocus>
              {mistakesMode && queue.length <= 1 && answer.grade === 'correct' ? 'סיום' : 'המשך'}
            </button>
            {!showMore && (
              <button type="button" className="btn btn-link" onClick={() => setShowMore(true)}>
                הצג הסבר
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
