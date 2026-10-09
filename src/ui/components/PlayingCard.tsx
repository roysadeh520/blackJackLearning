import { CSSProperties, useEffect, useRef, useState } from 'react';
import type { Card } from '../../engine/cards';
import { cardLabel } from '../../i18n/he';

const SUIT_SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;

interface Props {
  card?: Pick<Card, 'rank' | 'suit'>;
  hidden?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Delay (ms) before the deal-in animation starts. */
  delay?: number;
  className?: string;
}

export function PlayingCard({ card, hidden, size = 'md', delay = 0, className = '' }: Props) {
  const wasHidden = useRef(hidden);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (wasHidden.current && !hidden) {
      setRevealing(true);
      const t = window.setTimeout(() => setRevealing(false), 500);
      wasHidden.current = hidden;
      return () => window.clearTimeout(t);
    }
    wasHidden.current = hidden;
  }, [hidden]);

  const style = { animationDelay: `${delay}ms` } as CSSProperties;
  if (hidden || !card) {
    return (
      <div className={`pcard pcard-${size} pcard-back deal-in ${className}`} style={style} role="img" aria-label="קלף מוסתר">
        <div className="pcard-back-pattern" />
      </div>
    );
  }
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const sym = SUIT_SYMBOL[card.suit];
  return (
    <div
      className={`pcard pcard-${size} ${red ? 'red' : 'black'} deal-in ${revealing ? 'reveal' : ''} ${className}`}
      style={style}
      role="img"
      aria-label={cardLabel(card.rank, card.suit)}
    >
      {/* Card indices are printed left-to-right like a physical card. */}
      <span className="pcard-corner top" dir="ltr" aria-hidden="true">
        <span className="pcard-rank">{card.rank}</span>
        <span className="pcard-suit">{sym}</span>
      </span>
      <span className="pcard-center" aria-hidden="true">
        {sym}
      </span>
      <span className="pcard-corner bottom" dir="ltr" aria-hidden="true">
        <span className="pcard-rank">{card.rank}</span>
        <span className="pcard-suit">{sym}</span>
      </span>
    </div>
  );
}
