// Drives a table session: betting, pacing, virtual players, dealer, decision
// grading and statistics. Rendering lives in TableView; game rules live in the engine.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { botTakesInsurance, BOT_START_CHIPS, chooseBotAction, chooseBotBet, VirtualPlayer } from '../../bots/virtualPlayers';
import { handValue } from '../../engine/cards';
import { Action, BlackjackEngine, HandOutcome, TableSnapshot } from '../../engine/game';
import { DEFAULT_RULES } from '../../engine/rules';
import { playSound } from '../../media/sound';
import { DecisionGrade, gradeDecision, recommend, Recommendation } from '../../strategy/basicStrategy';
import {
  GameMode,
  recordDecision,
  recordHandResult,
  recordInsurance,
  recordSession,
  START_CHIPS,
} from '../../stats/profile';
import { useStore } from '../store';

export type Occupant = { kind: 'human' } | { kind: 'bot'; bot: VirtualPlayer };

export type Stage = 'betting' | 'dealing' | 'insurance' | 'userTurn' | 'othersTurn' | 'dealerTurn' | 'summary';

export interface Feedback {
  grade: DecisionGrade;
  rec: Recommendation;
  chosen: Action;
  /** Practice mode: the action is held until the user continues or retries. */
  pending: boolean;
}

export interface RoundDecision {
  rec: Recommendation;
  chosen: Action;
  grade: DecisionGrade;
  cards: string[];
  dealerUp: string;
}

export interface HandSummary {
  outcomes: HandOutcome[];
  net: number;
  decisions: RoundDecision[];
  insuranceTaken: boolean | null;
}

export interface SessionStats {
  startChips: number;
  hands: number;
  decisions: number;
  correct: number;
  minor: number;
  mistakes: number;
  net: number;
  mistakeList: RoundDecision[];
}

const SPEED_FACTOR = { normal: 1, fast: 0.5, veryFast: 0.2 } as const;
const BASE = { dealCard: 230, bot: 850, dealer: 750, settle: 350 };

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function emptySession(startChips: number): SessionStats {
  return { startChips, hands: 0, decisions: 0, correct: 0, minor: 0, mistakes: 0, net: 0, mistakeList: [] };
}

export function useTableController(mode: GameMode, occupants: Record<number, Occupant>, userSeat: number) {
  const { profile, updateProfile, updateStats, toast } = useStore();
  const settings = profile.settings;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const engineRef = useRef<BlackjackEngine>(null as unknown as BlackjackEngine);
  if (!engineRef.current) {
    const e = new BlackjackEngine(DEFAULT_RULES);
    for (const [k, occ] of Object.entries(occupants)) {
      const i = Number(k);
      if (occ.kind === 'human') e.sit(i, 'human', 'me', profile.chips);
      else e.sit(i, 'bot', occ.bot.id, BOT_START_CHIPS);
    }
    engineRef.current = e;
  }
  const engine = engineRef.current;

  const [snap, setSnap] = useState<TableSnapshot>(() => engine.snapshot());
  const [stage, setStage] = useState<Stage>('betting');
  const [pendingBet, setPendingBet] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [summary, setSummary] = useState<HandSummary | null>(null);
  const [session, setSession] = useState<SessionStats>(() => emptySession(profile.chips));
  const [message, setMessage] = useState('בחרו סכום הימור ולחצו על ״אשר הימור״.');
  const [hideTipsSession, setHideTipsSession] = useState(false);

  const alive = useRef(true);
  const busy = useRef(false);
  const roundDecisions = useRef<RoundDecision[]>([]);
  const insuranceTaken = useRef<boolean | null>(null);
  /** Decision points already graded (practice retries are not double counted). */
  const gradedPoints = useRef(new Set<string>());

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(() => alive.current && setSnap(engine.snapshot()), [engine]);

  const delay = useCallback((kind: keyof typeof BASE, isBot = false) => {
    const s = settingsRef.current;
    if (isBot && s.skipBotAnimations) return 60;
    return BASE[kind] * SPEED_FACTOR[s.speed];
  }, []);

  const userChips = snap.seats[userSeat]?.chips ?? 0;

  // ---------- recommendation for the user's active hand ----------

  const recommendation = useMemo<Recommendation | null>(() => {
    if (stage !== 'userTurn' || !snap.active || snap.active.seat !== userSeat) return null;
    const hand = snap.seats[userSeat].hands[snap.active.hand];
    return recommend({
      playerCards: hand.cards,
      dealerUp: snap.dealer.cards[0],
      available: engine.availableActions(),
      rules: engine.rules,
    });
  }, [stage, snap, userSeat, engine]);

  const availableActions = stage === 'userTurn' ? engine.availableActions() : [];

  // ---------- round flow ----------

  const finishRound = useCallback(() => {
    const s = engine.snapshot();
    const seat = s.seats[userSeat];
    const outcomes = seat.hands.map((h) => h.outcome!).filter(Boolean);
    const net = engine.netForSeat(userSeat);
    const decisions = roundDecisions.current;
    setSummary({ outcomes, net, decisions, insuranceTaken: insuranceTaken.current });
    setStage('summary');
    setMessage('');
    updateProfile((p) => ({ ...p, chips: seat.chips }));
    updateStats((st) => recordHandResult(st, outcomes, net));
    setSession((ss) => ({ ...ss, hands: ss.hands + 1, net: ss.net + net }));
    if (outcomes.includes('blackjack')) playSound('blackjack');
    else if (net > 0) playSound('win');
    else if (net < 0) playSound('lose');
    // Refill virtual players who ran dry so the table stays full.
    for (const [k, occ] of Object.entries(occupants)) {
      const i = Number(k);
      if (occ.kind === 'bot' && engine.getSeat(i).chips < DEFAULT_RULES.minBet) engine.setChips(i, BOT_START_CHIPS);
    }
    refresh();
  }, [engine, userSeat, updateProfile, updateStats, occupants, refresh]);

  const runUntilUser = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (alive.current) {
        const phase = engine.getPhase();
        if (phase === 'insurance') {
          for (const i of engine.pendingInsuranceSeats()) {
            const occ = occupants[i];
            if (occ?.kind === 'bot') engine.decideInsurance(i, engine.canTakeInsurance(i) && botTakesInsurance(occ.bot));
          }
          if (engine.getPhase() === 'insurance') {
            setStage('insurance');
            setMessage('הדילר מציג אס. האם לקחת ביטוח?');
            refresh();
            return;
          }
          continue;
        }
        if (phase === 'playerTurns') {
          const active = engine.getActive()!;
          if (active.seat === userSeat) {
            setStage('userTurn');
            setMessage(engine.getSeat(userSeat).hands.length > 1 ? `התור שלך — יד ${active.hand + 1}` : 'התור שלך. מה תעשה?');
            refresh();
            return;
          }
          const occ = occupants[active.seat];
          setStage('othersTurn');
          setMessage(occ?.kind === 'bot' ? `תורו של ${occ.bot.name}...` : '');
          refresh();
          await sleep(delay('bot', true));
          if (!alive.current) return;
          const action = occ?.kind === 'bot' ? chooseBotAction(occ.bot, engine) : 'stand';
          engine.act(action);
          if (action !== 'stand' && action !== 'surrender') playSound('card');
          refresh();
          continue;
        }
        if (phase === 'dealerTurn') {
          setStage('dealerTurn');
          setMessage('תור הדילר');
          refresh();
          await sleep(delay('dealer'));
          if (!alive.current) return;
          const step = engine.dealerStep();
          playSound(step === 'reveal' ? 'flip' : step === 'draw' ? 'card' : 'chip');
          refresh();
          continue;
        }
        if (phase === 'roundOver') {
          setStage('dealerTurn'); // waiting state: no input accepted while settling
          await sleep(delay('settle'));
          if (alive.current) finishRound();
          return;
        }
        return;
      }
    } finally {
      busy.current = false;
    }
  }, [engine, occupants, userSeat, delay, refresh, finishRound]);

  // ---------- betting ----------

  const addChip = useCallback(
    (v: number) => {
      if (stage !== 'betting') return;
      setPendingBet((b) => {
        const next = Math.min(b + v, engine.getSeat(userSeat).chips, DEFAULT_RULES.maxBet);
        return next;
      });
      playSound('chip');
    },
    [stage, engine, userSeat],
  );

  const clearBet = useCallback(() => setPendingBet(0), []);

  const confirmBet = useCallback(async () => {
    if (stage !== 'betting' || busy.current) return;
    if (pendingBet <= 0) {
      setMessage('הוסף צ׳יפים להימור כדי להתחיל.');
      return;
    }
    if (pendingBet > engine.getSeat(userSeat).chips) {
      setMessage('אין לך מספיק צ׳יפים להימור הזה.');
      return;
    }
    const bets: Record<number, number> = { [userSeat]: pendingBet };
    for (const [k, occ] of Object.entries(occupants)) {
      const i = Number(k);
      if (occ.kind === 'bot') {
        const b = chooseBotBet(occ.bot, engine.getSeat(i).chips);
        if (b > 0) bets[i] = b;
      }
    }
    roundDecisions.current = [];
    insuranceTaken.current = null;
    gradedPoints.current.clear();
    setSummary(null);
    setFeedback(null);
    updateProfile((p) => ({ ...p, lastBet: pendingBet }));
    engine.startRound(bets);
    const s = engine.snapshot();
    if (s.shuffledThisRound) {
      toast('הקלפים עורבבו מחדש.');
      playSound('shuffle');
    }
    setStage('dealing');
    setMessage('מחלקים קלפים...');
    setSnap(s);
    const cardsDealt = Object.keys(bets).length * 2 + 2;
    const per = settingsRef.current.animations === 'reduced' ? 0 : delay('dealCard');
    for (let i = 0; i < cardsDealt; i++) window.setTimeout(() => alive.current && playSound('card'), i * per);
    await sleep(cardsDealt * per + 300 * SPEED_FACTOR[settingsRef.current.speed]);
    if (!alive.current) return;
    void runUntilUser();
  }, [stage, pendingBet, engine, userSeat, occupants, updateProfile, toast, delay, runUntilUser]);

  const newHand = useCallback(() => {
    setSummary(null);
    setFeedback(null);
    setStage('betting');
    const chips = engine.getSeat(userSeat).chips;
    setPendingBet(Math.min(profile.lastBet, Math.floor(chips / 5) * 5));
    setMessage(chips < DEFAULT_RULES.minBet ? 'נגמרו לך הצ׳יפים.' : 'בחרו סכום הימור ולחצו על ״אשר הימור״.');
  }, [engine, userSeat, profile.lastBet]);

  const refillChips = useCallback(() => {
    const added = START_CHIPS - engine.getSeat(userSeat).chips;
    engine.setChips(userSeat, START_CHIPS);
    updateProfile((p) => ({ ...p, chips: START_CHIPS }));
    // Count the refill as starting chips so the session result stays honest.
    setSession((ss) => ({ ...ss, startChips: ss.startChips + added }));
    setPendingBet(Math.min(profile.lastBet, START_CHIPS));
    setMessage('קיבלת 1,000 צ׳יפים וירטואליים חדשים.');
    refresh();
  }, [engine, userSeat, updateProfile, refresh, profile.lastBet]);

  // ---------- insurance ----------

  const decideInsurance = useCallback(
    (take: boolean) => {
      if (stage !== 'insurance' || !engine.pendingInsuranceSeats().includes(userSeat)) return;
      insuranceTaken.current = take;
      setStage('dealing');
      engine.decideInsurance(userSeat, take);
      updateStats((s) => recordInsurance(s, take));
      setSession((ss) => ({
        ...ss,
        decisions: ss.decisions + 1,
        correct: ss.correct + (take ? 0 : 1),
        mistakes: ss.mistakes + (take ? 1 : 0),
      }));
      if (take) playSound('chip');
      refresh();
      void runUntilUser();
    },
    [stage, engine, userSeat, updateStats, refresh, runUntilUser],
  );

  // ---------- user actions ----------

  const applyAction = useCallback(
    (action: Action) => {
      engine.act(action);
      if (action === 'hit' || action === 'double' || action === 'split') playSound('card');
      if (action === 'double' || action === 'split') playSound('chip');
      refresh();
      void runUntilUser();
    },
    [engine, refresh, runUntilUser],
  );

  const act = useCallback(
    (action: Action) => {
      if (stage !== 'userTurn' || busy.current || !recommendation) return;
      if (engine.getPhase() !== 'playerTurns' || engine.getActive()?.seat !== userSeat) return;
      if (!engine.availableActions().includes(action)) return;
      const active = engine.getActive()!;
      const hand = engine.getSeat(userSeat).hands[active.hand];
      const point = `${snap.roundNumber}:${active.hand}:${hand.cards.length}`;
      const grade = gradeDecision(recommendation, action);

      if (!gradedPoints.current.has(point)) {
        gradedPoints.current.add(point);
        const record: RoundDecision = {
          rec: recommendation,
          chosen: action,
          grade,
          cards: hand.cards.map((c) => c.rank),
          dealerUp: engine.dealerUpCard()!.rank,
        };
        roundDecisions.current = [...roundDecisions.current, record];
        updateStats((s) =>
          recordDecision(s, {
            rec: recommendation,
            chosen: action,
            grade,
            playerCards: hand.cards.map((c) => c.rank),
            dealerUp: engine.dealerUpCard()!.rank,
            source: 'table',
          }),
        );
        setSession((ss) => ({
          ...ss,
          decisions: ss.decisions + 1,
          correct: ss.correct + (grade === 'correct' ? 1 : 0),
          minor: ss.minor + (grade === 'minor' ? 1 : 0),
          mistakes: ss.mistakes + (grade === 'mistake' ? 1 : 0),
          mistakeList: grade === 'correct' ? ss.mistakeList : [...ss.mistakeList, record],
        }));
      }

      if (mode === 'practice' && grade !== 'correct') {
        // Hold the action: the user may continue anyway or try again.
        setFeedback({ grade, rec: recommendation, chosen: action, pending: true });
        return;
      }
      setFeedback(mode === 'free' ? null : { grade, rec: recommendation, chosen: action, pending: false });
      applyAction(action);
    },
    [stage, recommendation, engine, userSeat, snap.roundNumber, mode, updateStats, applyAction],
  );

  const continueAnyway = useCallback(() => {
    if (!feedback?.pending || engine.getActive()?.seat !== userSeat) return;
    const a = feedback.chosen;
    setFeedback({ ...feedback, pending: false });
    applyAction(a);
  }, [feedback, applyAction, engine, userSeat]);

  const retry = useCallback(() => setFeedback(null), []);
  const dismissFeedback = useCallback(() => setFeedback(null), []);

  // ---------- session end ----------

  const endGame = useCallback(() => {
    updateStats((s) =>
      recordSession(s, {
        date: Date.now(),
        kind: mode,
        hands: session.hands,
        decisions: session.decisions,
        correct: session.correct,
        net: session.net,
      }),
    );
    return { ...session, endChips: engine.getSeat(userSeat).chips };
  }, [updateStats, mode, session, engine, userSeat]);

  const userHandTotals = (snap.seats[userSeat]?.hands ?? []).map((h) => handValue(h.cards));

  return {
    engine,
    snap,
    stage,
    message,
    pendingBet,
    userChips,
    recommendation,
    availableActions,
    feedback,
    summary,
    session,
    hideTipsSession,
    userHandTotals,
    setHideTipsSession,
    addChip,
    clearBet,
    setPendingBet,
    confirmBet,
    newHand,
    refillChips,
    decideInsurance,
    act,
    continueAnyway,
    retry,
    dismissFeedback,
    endGame,
  };
}

export type TableController = ReturnType<typeof useTableController>;
