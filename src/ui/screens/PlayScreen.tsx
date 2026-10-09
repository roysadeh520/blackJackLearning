import { useEffect, useMemo, useRef, useState } from 'react';
import { pickVirtualPlayers } from '../../bots/virtualPlayers';
import { BlackjackEngine, SEAT_COUNT } from '../../engine/game';
import { DEFAULT_RULES } from '../../engine/rules';
import { ACTION_LABEL, formatChips, formatSigned, MODE_LABEL, percent, upName } from '../../i18n/he';
import type { GameMode } from '../../stats/profile';
import { Modal } from '../components/Modal';
import { TableFelt } from '../components/TableFelt';
import {
  ACTION_KEY,
  ActionPanel,
  BettingPanel,
  CoachPanel,
  FeedbackPanel,
  HandSummaryPanel,
  InsurancePanel,
} from '../components/TablePanels';
import { roundHistory, totalText } from '../format';
import { Occupant, SessionStats, useTableController } from '../hooks/useTableController';
import { navigate } from '../router';
import { useStore } from '../store';

const MODES: { id: GameMode; title: string; text: string; icon: string }[] = [
  { id: 'learn', title: MODE_LABEL.learn, text: 'לפני כל החלטה תקבל המלצה והסבר קצר. מתאים למתחילים.', icon: '🎓' },
  { id: 'practice', title: MODE_LABEL.practice, text: 'אתה מחליט לבד, ומקבל משוב מיד אחרי כל בחירה. אפשר לנסות שוב.', icon: '🎯' },
  { id: 'free', title: MODE_LABEL.free, text: 'משחק רגיל בלי הסברים. בסוף המשחק תקבל ניתוח של ההחלטות.', icon: '🃏' },
];

const PLAYER_OPTIONS = ['רק אני', 'אני ועוד שחקן אחד', 'אני ועוד שני שחקנים', 'אני ועוד שלושה שחקנים', 'אני ועוד ארבעה שחקנים', 'אני ועוד חמישה שחקנים', 'אני ועוד שישה שחקנים'];

function isMode(m: string | null): m is GameMode {
  return m === 'learn' || m === 'practice' || m === 'free';
}

export function PlayScreen({ initialMode }: { initialMode: string | null }) {
  const { profile, updateProfile } = useStore();
  const [mode, setMode] = useState<GameMode>(isMode(initialMode) ? initialMode : 'learn');
  const [players, setPlayers] = useState(Math.min(Math.max(profile.lastPlayers, 1), SEAT_COUNT));
  const [step, setStep] = useState<'setup' | 'seat' | 'play'>('setup');
  const [userSeat, setUserSeat] = useState<number | null>(null);
  const [occupants, setOccupants] = useState<Record<number, Occupant>>({});
  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    if (isMode(initialMode)) setMode(initialMode);
  }, [initialMode]);

  const emptySnap = useMemo(() => new BlackjackEngine(DEFAULT_RULES).snapshot(), []);
  const previewSnap = useMemo(() => {
    const e = new BlackjackEngine(DEFAULT_RULES);
    for (const [k, o] of Object.entries(occupants)) e.sit(Number(k), o.kind, o.kind === 'bot' ? o.bot.id : 'me', o.kind === 'bot' ? 1000 : profile.chips);
    return e.snapshot();
  }, [occupants, profile.chips]);

  const pickSeat = (i: number) => {
    const others = Array.from({ length: SEAT_COUNT }, (_, k) => k).filter((k) => k !== i);
    // Spread the virtual players over random free seats.
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, players - 1);
    const bots = pickVirtualPlayers(players - 1);
    const occ: Record<number, Occupant> = { [i]: { kind: 'human' } };
    shuffled.forEach((s, k) => (occ[s] = { kind: 'bot', bot: bots[k] }));
    setUserSeat(i);
    setOccupants(occ);
  };

  if (step === 'setup') {
    return (
      <div className="page narrow">
        <h1 className="page-title">משחק חדש</h1>
        <section className="setup-block" aria-labelledby="mode-h">
          <h2 id="mode-h">בחרו מצב משחק</h2>
          <div className="mode-grid" role="radiogroup" aria-labelledby="mode-h">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                className={`mode-card ${mode === m.id ? 'selected' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span className="mode-icon" aria-hidden="true">{m.icon}</span>
                <strong>{m.title}</strong>
                <span>{m.text}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="setup-block" aria-labelledby="players-h">
          <h2 id="players-h">כמה שחקנים ליד השולחן?</h2>
          <p className="muted">שאר השחקנים הם שחקנים וירטואליים שמשחקים בעצמם.</p>
          <div className="players-grid" role="radiogroup" aria-labelledby="players-h">
            {PLAYER_OPTIONS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={players === i + 1}
                className={`pill ${players === i + 1 ? 'selected' : ''}`}
                onClick={() => setPlayers(i + 1)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-gold btn-lg"
            onClick={() => {
              updateProfile((p) => ({ ...p, lastPlayers: players }));
              setUserSeat(null);
              setOccupants({});
              setStep('seat');
            }}
          >
            המשך לבחירת מקום
          </button>
        </div>
      </div>
    );
  }

  if (step === 'seat') {
    return (
      <div className="page table-page">
        <div className="seat-intro">
          <h1 className="page-title">בחרו מקום ליד השולחן</h1>
          <p>{userSeat === null ? 'לחצו על אחד המקומות הפנויים: ״שב כאן״.' : 'מצוין! זה המקום שלך. השחקנים הווירטואליים התיישבו.'}</p>
        </div>
        <TableFelt
          snap={userSeat === null ? emptySnap : previewSnap}
          stage="seating"
          occupants={occupants}
          userSeat={userSeat}
          dealStagger={0}
          onPickSeat={userSeat === null ? pickSeat : undefined}
        />
        <div className="btn-row btn-row-center">
          {userSeat !== null && (
            <>
              <button type="button" className="btn btn-gold btn-lg" onClick={() => { setGameKey((k) => k + 1); setStep('play'); }} data-autofocus>
                התחל לשחק
              </button>
              <button type="button" className="btn btn-outline" onClick={() => { setUserSeat(null); setOccupants({}); }}>
                החלף מקום
              </button>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => setStep('setup')}>
            חזרה
          </button>
        </div>
      </div>
    );
  }

  return (
    <GameTable
      key={gameKey}
      mode={mode}
      occupants={occupants}
      userSeat={userSeat!}
      onNewGame={() => setStep('setup')}
    />
  );
}

// ---------------------------------------------------------------------------

interface GameTableProps {
  mode: GameMode;
  occupants: Record<number, Occupant>;
  userSeat: number;
  onNewGame: () => void;
}

function GameTable({ mode, occupants, userSeat, onNewGame }: GameTableProps) {
  const { profile, updateSettings } = useStore();
  const settings = profile.settings;
  const c = useTableController(mode, occupants, userSeat);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [gameOver, setGameOver] = useState<(SessionStats & { endChips: number }) | null>(null);
  const [coachDismissed, setCoachDismissed] = useState<string | null>(null);
  const ended = useRef(false);
  const endGameRef = useRef(c.endGame);
  endGameRef.current = c.endGame;
  const handsRef = useRef(0);
  handsRef.current = c.session.hands;

  // Leaving the table mid-session still counts the hands played as a game.
  useEffect(
    () => () => {
      if (!ended.current && handsRef.current > 0) endGameRef.current();
    },
    [],
  );

  const rec = c.recommendation;
  const active = c.snap.active;
  const pointKey = rec && active ? `${c.snap.roundNumber}:${active.hand}:${c.snap.seats[userSeat].hands[active.hand].cards.length}` : '';
  const tipsOn = mode === 'learn' && settings.showRecommendation && !c.hideTipsSession;
  const showCoach =
    !!rec && tipsOn && settings.explanations !== 'none' && !settings.hiddenTips.includes(rec.situation.key) && coachDismissed !== pointKey && !c.feedback?.pending;
  const highlight = tipsOn && rec ? rec.action : null;
  const userHand = active && active.seat === userSeat ? c.snap.seats[userSeat].hands[active.hand] : null;

  // Keyboard shortcuts for actions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (c.stage !== 'userTurn' || c.feedback?.pending || historyOpen || gameOver) return;
      if (e.target instanceof HTMLInputElement || e.altKey || e.ctrlKey || e.metaKey) return;
      const a = (Object.keys(ACTION_KEY) as (keyof typeof ACTION_KEY)[]).find((k) => ACTION_KEY[k] === e.key);
      if (a && c.availableActions.includes(a)) {
        e.preventDefault();
        c.act(a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c, historyOpen, gameOver]);

  const finish = () => {
    ended.current = true;
    setGameOver(c.endGame());
  };

  const betweenHands = c.stage === 'betting' || c.stage === 'summary';
  const per = settings.animations === 'reduced' ? 0 : 230 * { normal: 1, fast: 0.5, veryFast: 0.2 }[settings.speed];
  const history = roundHistory(c.snap.events, userSeat, (c.snap.seats[userSeat]?.hands.length ?? 0) > 1);

  return (
    <div className="page table-page">
      <div className="table-bar">
        <span className={`mode-badge mode-${mode}`}>{MODE_LABEL[mode]}</span>
        <span className="status-line" role="status" aria-live="polite">
          {c.stage !== 'betting' ? c.message : ''}
        </span>
        <div className="table-bar-actions">
          <button type="button" className="btn btn-small btn-outline" onClick={() => setHistoryOpen(true)} disabled={!c.snap.events.length}>
            היסטוריית הסיבוב
          </button>
          <button
            type="button"
            className="btn btn-small btn-outline"
            onClick={finish}
            disabled={!betweenHands}
            title={betweenHands ? undefined : 'אפשר לסיים את המשחק בין ידיים'}
          >
            סיים משחק
          </button>
        </div>
      </div>

      <div className="table-layout">
        <div className="table-main">
          <TableFelt
            snap={c.snap}
            stage={c.stage}
            occupants={occupants}
            userSeat={userSeat}
            dealStagger={per}
            pendingBet={c.pendingBet}
          />

          <div className="controls">
            {c.stage === 'betting' && (
              <BettingPanel
                chips={c.userChips}
                bet={c.pendingBet}
                lastBet={profile.lastBet}
                minBet={DEFAULT_RULES.minBet}
                message={c.message}
                onChip={c.addChip}
                onClear={c.clearBet}
                onRepeat={() => c.setPendingBet(Math.min(profile.lastBet, c.userChips))}
                onConfirm={c.confirmBet}
                onRefill={c.refillChips}
              />
            )}

            {c.stage === 'insurance' && (
              <InsurancePanel
                cost={c.engine.insuranceCost(userSeat)}
                canAfford={c.engine.canTakeInsurance(userSeat)}
                showAdvice={mode === 'learn' && settings.explanations !== 'none'}
                onDecide={c.decideInsurance}
              />
            )}

            {showCoach && rec && userHand && (
              <CoachPanel
                key={pointKey}
                rec={rec}
                available={c.availableActions}
                handTotalText={totalText(userHand.cards)}
                onDismiss={() => setCoachDismissed(pointKey)}
                onNeverForThis={() => {
                  updateSettings({ hiddenTips: [...settings.hiddenTips, rec.situation.key] });
                  setCoachDismissed(pointKey);
                }}
                onHideAll={() => c.setHideTipsSession(true)}
              />
            )}

            {c.feedback && mode !== 'free' && (
              <FeedbackPanel
                key={`${c.feedback.rec.situation.key}-${c.feedback.chosen}-${c.feedback.pending}`}
                feedback={c.feedback}
                explanations={settings.explanations}
                onContinue={c.continueAnyway}
                onRetry={c.retry}
                onClose={c.dismissFeedback}
              />
            )}

            {c.stage === 'userTurn' && !c.feedback?.pending && (
              <ActionPanel
                available={c.availableActions}
                recommended={highlight}
                disabled={false}
                showHelp={mode !== 'free'}
                onAct={c.act}
              />
            )}

            {(c.stage === 'dealing' || c.stage === 'othersTurn' || c.stage === 'dealerTurn') && (
              <div className="panel panel-wait" role="status">
                <span className="spinner" aria-hidden="true" /> {c.message}
              </div>
            )}

            {c.stage === 'summary' && c.summary && (
              <HandSummaryPanel
                summary={c.summary}
                onNext={c.newHand}
                onHistory={() => setHistoryOpen(true)}
                showDecisionDetails={mode !== 'free'}
              />
            )}
          </div>
        </div>

        <aside className="table-side" aria-label="מידע על המשחק">
          <section className="side-card">
            <h2>המשחק הנוכחי</h2>
            <dl className="mini-stats">
              <div><dt>ידיים</dt><dd>{c.session.hands}</dd></div>
              <div><dt>החלטות</dt><dd>{c.session.decisions}</dd></div>
              <div><dt>דיוק</dt><dd>{percent(c.session.correct, c.session.decisions)}</dd></div>
              <div><dt>רווח / הפסד</dt><dd className={c.session.net >= 0 ? 'pos' : 'neg'}>{formatSigned(c.session.net)}</dd></div>
            </dl>
          </section>
          <section className="side-card">
            <h2>היסטוריית הסיבוב</h2>
            {history.length ? (
              <ol className="history-list compact">
                {history.map((l, i) => <li key={i}>{l}</li>)}
              </ol>
            ) : (
              <p className="muted">הסיבוב עוד לא התחיל.</p>
            )}
          </section>
          <section className="side-card">
            <h2>חוקי השולחן</h2>
            <ul className="rules-list">
              <li>{DEFAULT_RULES.decks} חפיסות, ערבוב מחדש אחרי כ־75% מהערימה</li>
              <li>הדילר עוצר על 17 (גם 17 רך)</li>
              <li>בלאק ג׳ק משלם 3 ל־2</li>
              <li>מותר להכפיל אחרי פיצול</li>
              <li>מותר לפרוש בשני הקלפים הראשונים</li>
              <li>ביטוח משלם 2 ל־1</li>
            </ul>
          </section>
        </aside>
      </div>

      {historyOpen && (
        <Modal title="היסטוריית הסיבוב" onClose={() => setHistoryOpen(false)}>
          {history.length ? (
            <ol className="history-list">
              {history.map((l, i) => <li key={i}>{l}</li>)}
            </ol>
          ) : (
            <p>הסיבוב עוד לא התחיל.</p>
          )}
        </Modal>
      )}

      {gameOver && (
        <GameSummaryModal
          mode={mode}
          stats={gameOver}
          onNewGame={onNewGame}
          onClose={() => {
            ended.current = false;
            setGameOver(null);
          }}
        />
      )}
    </div>
  );
}

function GameSummaryModal({
  mode,
  stats,
  onNewGame,
  onClose,
}: {
  mode: GameMode;
  stats: SessionStats & { endChips: number };
  onNewGame: () => void;
  onClose: () => void;
}) {
  const net = stats.endChips - stats.startChips;
  return (
    <Modal
      title="סיכום המשחק"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-gold" onClick={onNewGame} data-autofocus>
            משחק חדש
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/progress')}>
            ההתקדמות שלי
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
            למסך הבית
          </button>
        </>
      }
    >
      <dl className="summary-stats">
        <div><dt>מספר ידיים</dt><dd>{stats.hands}</dd></div>
        <div><dt>מספר החלטות</dt><dd>{stats.decisions}</dd></div>
        <div><dt>החלטות נכונות</dt><dd>{stats.correct}</dd></div>
        <div><dt>החלטות פחות טובות</dt><dd>{stats.minor}</dd></div>
        <div><dt>טעויות</dt><dd>{stats.mistakes}</dd></div>
        <div><dt>אחוז דיוק</dt><dd>{percent(stats.correct, stats.decisions)}</dd></div>
        <div><dt>צ׳יפים בתחילת המשחק</dt><dd>{formatChips(stats.startChips)}</dd></div>
        <div><dt>צ׳יפים בסיום</dt><dd>{formatChips(stats.endChips)}</dd></div>
        <div><dt>רווח או הפסד</dt><dd className={net >= 0 ? 'pos' : 'neg'}>{formatSigned(net)}</dd></div>
      </dl>
      {stats.decisions > 0 && stats.correct === stats.decisions && <p className="advice">🎯 משחק מושלם — כל ההחלטות שלך היו נכונות!</p>}
      {stats.mistakeList.length > 0 && (
        <>
          <h3>{mode === 'free' ? 'ניתוח ההחלטות' : 'החלטות לשיפור'}</h3>
          <ul className="decision-list">
            {stats.mistakeList.map((d, i) => (
              <li key={i}>
                <strong>{d.grade === 'minor' ? 'פחות טובה' : 'טעות'}:</strong> {d.rec.situation.category === 'pair' ? 'זוג' : 'יד'}{' '}
                {d.rec.situation.total} מול {upName(d.rec.situation.up)} — בחרת {ACTION_LABEL[d.chosen]}, מומלץ {ACTION_LABEL[d.rec.action]}.
              </li>
            ))}
          </ul>
          <p className="muted">אפשר לתרגל את המצבים האלה במסך ״ההתקדמות שלי״ ← ״תרגל את הטעויות שלי״.</p>
        </>
      )}
      <p className="muted">תוצאת המשחק תלויה גם במזל. מה שבאמת חשוב לאורך זמן הוא איכות ההחלטות.</p>
    </Modal>
  );
}
