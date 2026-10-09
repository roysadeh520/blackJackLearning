import { formatChips } from '../../i18n/he';

export const CHIP_VALUES = [5, 10, 25, 50, 100] as const;

const CHIP_CLASS: Record<number, string> = { 5: 'chip-red', 10: 'chip-blue', 25: 'chip-green', 50: 'chip-orange', 100: 'chip-black' };

export function chipClass(value: number): string {
  return CHIP_CLASS[value] ?? 'chip-black';
}

interface ChipButtonProps {
  value: number;
  disabled?: boolean;
  onClick: () => void;
}

export function ChipButton({ value, disabled, onClick }: ChipButtonProps) {
  return (
    <button
      type="button"
      className={`chip chip-btn ${chipClass(value)}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={`הוסף ${value} צ׳יפים להימור`}
    >
      <span>{value}</span>
    </button>
  );
}

/** Break an amount into a short visual stack of chips. */
export function chipBreakdown(amount: number): number[] {
  const out: number[] = [];
  let left = Math.floor(amount);
  for (const v of [...CHIP_VALUES].reverse()) {
    while (left >= v && out.length < 6) {
      out.push(v);
      left -= v;
    }
  }
  return out;
}

export function ChipStack({ amount, label }: { amount: number; label?: string }) {
  if (amount <= 0) return null;
  const chips = chipBreakdown(amount);
  return (
    <div className="chip-stack chip-in" aria-label={label ?? `הימור: ${formatChips(amount)}`}>
      <div className="chip-stack-chips" aria-hidden="true">
        {chips.map((v, i) => (
          <span key={i} className={`chip chip-mini ${chipClass(v)}`} style={{ bottom: `${i * 4}px` }} />
        ))}
      </div>
      <span className="chip-stack-amount">{formatChips(amount)}</span>
    </div>
  );
}
