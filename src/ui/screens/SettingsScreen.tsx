import { EXPLAIN_LABEL, SPEED_LABEL } from '../../i18n/he';
import type { Settings } from '../../stats/profile';
import { useStore } from '../store';

interface OptionGroupProps<T extends string | boolean> {
  title: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function OptionGroup<T extends string | boolean>({ title, hint, value, options, onChange }: OptionGroupProps<T>) {
  const id = `opt-${title.replace(/\s+/g, '-')}`;
  return (
    <fieldset className="setting">
      <legend id={id}>{title}</legend>
      {hint && <p className="muted">{hint}</p>}
      <div className="seg" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`seg-btn ${value === o.value ? 'selected' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsScreen() {
  const { profile, updateSettings, toast } = useStore();
  const s = profile.settings;
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => {
    updateSettings({ [k]: v } as Partial<Settings>);
    toast('ההגדרות נשמרו', 'success');
  };

  return (
    <div className="page narrow">
      <h1 className="page-title">הגדרות</h1>
      <div className="settings">
        <OptionGroup
          title="הסברים"
          value={s.explanations}
          options={(['full', 'short', 'none'] as const).map((v) => ({ value: v, label: EXPLAIN_LABEL[v] }))}
          onChange={set('explanations')}
        />
        <OptionGroup
          title="הצגת המלצה לפני החלטה"
          hint="במצב לימוד: האם להציג את הפעולה המומלצת לפני שאתה בוחר."
          value={s.showRecommendation}
          options={[
            { value: true, label: 'כן' },
            { value: false, label: 'לא' },
          ]}
          onChange={set('showRecommendation')}
        />
        <OptionGroup
          title="מהירות משחק"
          value={s.speed}
          options={(['normal', 'fast', 'veryFast'] as const).map((v) => ({ value: v, label: SPEED_LABEL[v] }))}
          onChange={set('speed')}
        />
        <OptionGroup
          title="דלג על אנימציות של שחקנים אחרים"
          value={s.skipBotAnimations}
          options={[
            { value: false, label: 'לא' },
            { value: true, label: 'כן' },
          ]}
          onChange={set('skipBotAnimations')}
        />
        <OptionGroup
          title="צלילים"
          value={s.sound}
          options={[
            { value: true, label: 'מופעלים' },
            { value: false, label: 'כבויים' },
          ]}
          onChange={set('sound')}
        />
        <OptionGroup
          title="אנימציות"
          value={s.animations}
          options={[
            { value: 'full', label: 'מופעלות' },
            { value: 'reduced', label: 'מופחתות' },
          ]}
          onChange={set('animations')}
        />
        {s.hiddenTips.length > 0 && (
          <fieldset className="setting">
            <legend>הסברים שהוסתרו</legend>
            <p className="muted">ביקשת לא להציג הסבר עבור {s.hiddenTips.length} מצבים.</p>
            <button type="button" className="btn btn-outline" onClick={() => set('hiddenTips')([])}>
              הצג שוב את כל ההסברים
            </button>
          </fieldset>
        )}
      </div>
    </div>
  );
}
