import { useState } from 'react';
import type { Rank } from '../../engine/cards';
import { card } from '../../engine/cards';
import type { Action } from '../../engine/game';
import { DEFAULT_RULES } from '../../engine/rules';
import { ACTION_LABEL, CATEGORY_LABEL, upName } from '../../i18n/he';
import { ChartCode, hardCode, pairCode, recommend, softCode, UP_VALUES } from '../../strategy/basicStrategy';
import { explain } from '../../strategy/explanations';
import { Modal } from '../components/Modal';
import { PlayingCard } from '../components/PlayingCard';

type Tab = 'hard' | 'soft' | 'pair';

const CODE_INFO: Record<ChartCode, { short: string; label: string; cls: string }> = {
  H: { short: 'ק', label: 'קח קלף', cls: 'c-hit' },
  S: { short: 'ע', label: 'עצור', cls: 'c-stand' },
  Dh: { short: 'כ', label: 'הכפל (אם אי אפשר — קח קלף)', cls: 'c-double' },
  Ds: { short: 'כע', label: 'הכפל (אם אי אפשר — עצור)', cls: 'c-double' },
  P: { short: 'פ', label: 'פצל', cls: 'c-split' },
  Rh: { short: 'פר', label: 'פרוש (אם אי אפשר — קח קלף)', cls: 'c-surrender' },
  Rs: { short: 'פר', label: 'פרוש (אם אי אפשר — עצור)', cls: 'c-surrender' },
  Rp: { short: 'פר', label: 'פרוש (אם אי אפשר — פצל)', cls: 'c-surrender' },
};

const LEGEND: ChartCode[] = ['H', 'S', 'Dh', 'Ds', 'P', 'Rh'];

const rankOfValue = (v: number): Rank => (v === 11 ? 'A' : v === 10 ? '10' : (String(v) as Rank));

interface Row {
  label: string;
  cards: Rank[];
  code: (up: (typeof UP_VALUES)[number]) => ChartCode;
}

function rows(tab: Tab): Row[] {
  const r = DEFAULT_RULES;
  if (tab === 'hard')
    return [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((t): Row => {
      // A representative non-pair, non-soft two-card hand for this total.
      const hi = Math.min(10, t - 2);
      const lo = t - hi;
      return { label: t === 17 ? '17+' : String(t), cards: [rankOfValue(hi), rankOfValue(lo)], code: (up) => hardCode(t, up, r) };
    });
  if (tab === 'soft')
    return [2, 3, 4, 5, 6, 7, 8, 9].map((k) => ({
      label: `אס ו־${k}`,
      cards: ['A', rankOfValue(k)],
      code: (up) => softCode(11 + k, up, r),
    }));
  return [11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((v) => ({
    label: v === 11 ? 'אס־אס' : v === 10 ? '10־10' : `${v}־${v}`,
    cards: [rankOfValue(v), rankOfValue(v)],
    code: (up) => pairCode(v, up, r),
  }));
}

export function ChartScreen() {
  const [tab, setTab] = useState<Tab>('hard');
  const [cell, setCell] = useState<{ row: Row; up: (typeof UP_VALUES)[number] } | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'hard', label: 'יד רגילה' },
    { id: 'soft', label: 'יד עם אס' },
    { id: 'pair', label: 'זוגות' },
  ];

  const detail = cell
    ? (() => {
        const playerCards = cell.row.cards.map((rk) => card(rk));
        const available: Action[] = ['hit', 'stand', 'double', 'surrender', ...(tab === 'pair' ? (['split'] as Action[]) : [])];
        const rec = recommend({ playerCards, dealerUp: card(rankOfValue(cell.up)), available, rules: DEFAULT_RULES });
        return { rec, ex: explain(rec), playerCards };
      })()
    : null;

  return (
    <div className="page">
      <h1 className="page-title">טבלת החלטות</h1>
      <p className="muted center">
        אסטרטגיה בסיסית לשולחן של {DEFAULT_RULES.decks} חפיסות, דילר שעוצר על 17, הכפלה אחרי פיצול ופרישה. לחצו על תא כדי לקבל הסבר.
      </p>

      <div className="tabs" role="tablist" aria-label="סוג יד">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="chart-panel"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="legend" aria-label="מקרא">
        {LEGEND.map((c) => (
          <li key={c}>
            <span className={`cell-swatch ${CODE_INFO[c].cls}`}>{CODE_INFO[c].short}</span> {CODE_INFO[c].label}
          </li>
        ))}
      </ul>

      <div className="chart-wrap" id="chart-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <table className="chart">
          <caption className="sr-only">{CATEGORY_LABEL[tab]}: שורות לפי היד שלך, עמודות לפי הקלף הגלוי של הדילר</caption>
          <thead>
            <tr>
              <th scope="col" className="corner">
                <span>היד שלך</span>
                <span>הדילר ←</span>
              </th>
              {UP_VALUES.map((u) => (
                <th scope="col" key={u}>{upName(u)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows(tab).map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {UP_VALUES.map((u) => {
                  const code = row.code(u);
                  const info = CODE_INFO[code];
                  return (
                    <td key={u} className={info.cls}>
                      <button
                        type="button"
                        className="cell-btn"
                        onClick={() => setCell({ row, up: u })}
                        aria-label={`${row.label} מול ${upName(u)}: ${info.label}`}
                      >
                        {info.short}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cell && detail && (
        <Modal title={`${cell.row.label} מול ${upName(cell.up)} של הדילר`} onClose={() => setCell(null)}>
          <div className="chart-detail-cards">
            <div>
              <span className="fact-label">היד שלך</span>
              <div className="hand-cards">
                {detail.playerCards.map((c) => (
                  <PlayingCard key={c.id} card={c} size="md" />
                ))}
              </div>
            </div>
            <div>
              <span className="fact-label">הדילר</span>
              <div className="hand-cards">
                <PlayingCard card={card(rankOfValue(cell.up), 'hearts')} size="md" />
              </div>
            </div>
          </div>
          <p className="coach-headline">
            {CODE_INFO[cell.row.code(cell.up)].label}
          </p>
          <p>{detail.ex.short}</p>
          <p className="muted">{detail.ex.detailed}</p>
          {detail.rec.action !== 'split' && tab === 'pair' && (
            <p className="muted">ההמלצה: {ACTION_LABEL[detail.rec.action]}.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
