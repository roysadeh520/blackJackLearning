// The casino felt: dealer, shoe and the seven seats.

import { useMemo } from 'react';
import { handValue } from '../../engine/cards';
import { Seat, SEAT_COUNT, TableSnapshot } from '../../engine/game';
import { formatChips, OUTCOME_LABEL } from '../../i18n/he';
import { lastActionText, totalText, whoOf } from '../format';
import type { Occupant, Stage } from '../hooks/useTableController';
import { ChipStack } from './Chip';
import { PlayingCard } from './PlayingCard';

interface FeltProps {
  snap: TableSnapshot;
  stage: Stage | 'seating';
  occupants: Record<number, Occupant>;
  userSeat: number | null;
  /** Milliseconds between cards in the opening deal (0 = no stagger). */
  dealStagger: number;
  pendingBet?: number;
  /** Seat picking mode (before the game starts). */
  onPickSeat?: (index: number) => void;
}

/** Initial-deal animation delays, keyed by card id, recomputed each round. */
function useDealDelays(snap: TableSnapshot, stagger: number): Map<string, number> {
  return useMemo(() => {
    const map = new Map<string, number>();
    if (!stagger) return map;
    const deals = snap.events.filter((e) => e.kind === 'initialDeal');
    const n = deals.length;
    deals.forEach((e, order) => {
      if (e.kind !== 'initialDeal') return;
      e.cards.forEach((c, i) => map.set(c.id, (i * (n + 1) + order) * stagger));
    });
    snap.dealer.cards.slice(0, 2).forEach((c, i) => map.set(c.id, (i * (n + 1) + n) * stagger));
    return map;
    // Only the round number matters: later snapshots must not shift the opening delays.
  }, [snap.roundNumber, stagger]);
}

export function TableFelt({ snap, stage, occupants, userSeat, dealStagger, pendingBet = 0, onPickSeat }: FeltProps) {
  const delays = useDealDelays(snap, dealStagger);
  const dealer = snap.dealer;
  const dealerVisible = dealer.holeHidden ? dealer.cards.slice(0, 1) : dealer.cards;
  const dealerTotal = dealer.cards.length ? handValue(dealerVisible) : null;
  const shoePct = Math.round((snap.shoeRemaining / snap.shoeTotal) * 100);

  return (
    <section className={`felt ${stage === 'seating' ? 'seating' : ''}`} aria-label="שולחן בלאק ג׳ק">
      <div className="felt-rail" aria-hidden="true" />
      <div className="dealer-area">
        <div className="shoe" aria-label={`ערימת הקלפים: נותרו ${snap.shoeRemaining} קלפים`} title={`נותרו ${snap.shoeRemaining} קלפים בערימה`}>
          <div className="shoe-box">
            <div className="shoe-cards" style={{ height: `${Math.max(8, shoePct)}%` }} />
          </div>
          <span className="shoe-label">ערימת קלפים</span>
        </div>
        <div className="dealer">
          <div className="dealer-head">
            <span className="dealer-avatar" aria-hidden="true">🎩</span>
            <span className="dealer-name">דילר</span>
            {dealerTotal && dealer.cards.length > 0 && (
              <span className="total-badge" aria-label={`ערך היד של הדילר: ${dealerTotal.total}`}>
                {dealer.holeHidden ? `${totalText(dealerVisible)} + ?` : totalText(dealer.cards)}
              </span>
            )}
          </div>
          <div className="hand-cards dealer-cards" aria-live="polite">
            {dealer.cards.length === 0 && <div className="card-slot" aria-hidden="true" />}
            {dealer.cards.map((c, i) => (
              <PlayingCard key={c.id} card={c} hidden={i === 1 && dealer.holeHidden} size="lg" delay={delays.get(c.id) ?? 0} />
            ))}
          </div>
        </div>
        <div className="discard" aria-hidden="true">
          <div className="discard-stack" />
        </div>
      </div>

      <div className="felt-print" aria-hidden="true">
        <span>בלאק ג׳ק משלם 3 ל־2</span>
        <span className="felt-print-arc">הדילר חייב לעצור על 17 · ביטוח משלם 2 ל־1</span>
      </div>

      <ol className="seats">
        {Array.from({ length: SEAT_COUNT }, (_, i) => (
          <SeatView
            key={i}
            index={i}
            seat={snap.seats[i]}
            occupant={occupants[i]}
            isUser={userSeat === i}
            activeHand={snap.active?.seat === i ? snap.active.hand : null}
            stage={stage}
            delays={delays}
            pendingBet={userSeat === i && stage === 'betting' ? pendingBet : 0}
            onPick={onPickSeat}
          />
        ))}
      </ol>
    </section>
  );
}

interface SeatProps {
  index: number;
  seat: Seat;
  occupant?: Occupant;
  isUser: boolean;
  activeHand: number | null;
  stage: Stage | 'seating';
  delays: Map<string, number>;
  pendingBet: number;
  onPick?: (index: number) => void;
}

function SeatView({ index, seat, occupant, isUser, activeHand, stage, delays, pendingBet, onPick }: SeatProps) {
  const seatNo = index + 1;
  if (!occupant) {
    return (
      <li className="seat seat-empty" style={{ ['--i' as string]: index }}>
        {onPick ? (
          <button type="button" className="seat-pick" onClick={() => onPick(index)} aria-label={`מקום ${seatNo}: מקום פנוי. שב כאן`}>
            <span className="seat-circle" aria-hidden="true">+</span>
            <span className="seat-empty-label">מקום פנוי</span>
            <span className="seat-pick-cta">שב כאן</span>
          </button>
        ) : (
          <div className="seat-vacant" aria-label={`מקום ${seatNo}: מקום פנוי`}>
            <span className="seat-circle" aria-hidden="true" />
            <span className="seat-empty-label">מקום פנוי</span>
          </div>
        )}
      </li>
    );
  }

  const who = whoOf(occupant);
  const name = occupant.kind === 'bot' ? occupant.bot.name : 'אני';
  const isActive = activeHand !== null;
  const action = lastActionText(seat.lastAction, who);

  return (
    <li
      className={`seat ${isUser ? 'seat-user' : 'seat-bot'} ${isActive ? 'seat-active' : ''}`}
      style={{ ['--i' as string]: index }}
      aria-label={`מקום ${seatNo}: ${isUser ? 'זה המקום שלך' : name}`}
      aria-current={isActive ? 'true' : undefined}
    >
      {isUser && <span className="your-seat-tag">זה המקום שלך</span>}
      <div className="seat-hands">
        {seat.hands.map((h, hi) => {
          const v = handValue(h.cards);
          return (
            <div
              key={h.id}
              className={`seat-hand ${activeHand === hi ? 'hand-active' : ''} ${h.outcome ? `outcome-${h.outcome}` : ''}`}
              aria-label={`${seat.hands.length > 1 ? `יד ${hi + 1}: ` : ''}ערך ${v.total}${h.outcome ? `, ${OUTCOME_LABEL[h.outcome]}` : ''}`}
            >
              <div className="hand-cards">
                {h.cards.map((c) => (
                  <PlayingCard key={c.id} card={c} size={isUser ? 'lg' : 'sm'} delay={delays.get(c.id) ?? 0} />
                ))}
              </div>
              <div className="hand-meta">
                {h.cards.length > 0 && <span className="total-badge">{totalText(h.cards)}</span>}
                {h.doubled && <span className="tag">הוכפל</span>}
                {h.outcome && <span className={`outcome-badge ob-${h.outcome}`}>{OUTCOME_LABEL[h.outcome]}</span>}
              </div>
              <ChipStack amount={h.bet} />
            </div>
          );
        })}
        {seat.hands.length === 0 && (
          <div className="bet-spot" aria-hidden={!pendingBet}>
            {pendingBet > 0 ? <ChipStack amount={pendingBet} /> : <span className="bet-spot-ring" />}
          </div>
        )}
      </div>
      {seat.insuranceBet > 0 && <span className="tag tag-gold">ביטוח: {formatChips(seat.insuranceBet)}</span>}
      <div className="seat-player">
        <span
          className="avatar"
          aria-hidden="true"
          style={{ background: occupant.kind === 'bot' ? occupant.bot.color : 'var(--gold)' }}
        >
          {occupant.kind === 'bot' ? occupant.bot.emoji : '⭐'}
        </span>
        <span className="seat-name">{name}</span>
        <span className="seat-chips" aria-label={`צ׳יפים: ${formatChips(seat.chips)}`}>
          {formatChips(seat.chips)}
        </span>
      </div>
      <div className="seat-action" aria-live={isUser ? undefined : 'polite'}>
        {stage !== 'seating' ? action || ' ' : ' '}
      </div>
    </li>
  );
}
