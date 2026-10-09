import { card } from '../../engine/cards';
import { percent } from '../../i18n/he';
import type { Level } from '../../stats/profile';
import { Modal } from '../components/Modal';
import { PlayingCard } from '../components/PlayingCard';
import { navigate } from '../router';
import { useStore } from '../store';

const HERO_CARDS = [card('A', 'spades'), card('K', 'hearts')];

const PRIMARY = [
  { to: '/play?mode=learn', title: 'התחל ללמוד', text: 'משחק עם המלצה והסבר לפני כל החלטה', icon: '🎓', cls: 'primary' },
  { to: '/play?mode=practice', title: 'תרגול', text: 'אתה מחליט, ואנחנו בודקים', icon: '🎯' },
  { to: '/play?mode=free', title: 'משחק חופשי', text: 'שולחן רגיל, ניתוח בסוף', icon: '🃏' },
  { to: '/quick', title: 'תרגול מהיר', text: 'מצב אחד, החלטה אחת, משוב מיד', icon: '⚡' },
  { to: '/lesson', title: 'איך משחקים?', text: 'שיעור קצר למתחילים ב־10 צעדים', icon: '📖' },
];

const LEVELS: { id: Level; label: string; to: string; note: string }[] = [
  { id: 'never', label: 'אף פעם לא שיחקתי', to: '/lesson', note: 'נתחיל בשיעור קצר' },
  { id: 'few', label: 'שיחקתי כמה פעמים', to: '/play?mode=learn', note: 'נשחק עם הסברים' },
  { id: 'rules', label: 'אני מכיר את החוקים', to: '/play?mode=practice', note: 'נתרגל עם משוב' },
  { id: 'practice', label: 'אני רוצה רק לתרגל החלטות', to: '/quick', note: 'ישר לתרגול מהיר' },
];

export function HomeScreen() {
  const { profile, updateProfile, updateSettings } = useStore();
  const s = profile.stats;

  const chooseLevel = (l: (typeof LEVELS)[number]) => {
    updateProfile((p) => ({ ...p, level: l.id }));
    // Beginners get full explanations; experienced players get them shorter.
    updateSettings({ explanations: l.id === 'never' || l.id === 'few' ? 'full' : 'short' });
    navigate(l.to);
  };

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-text">
          <h1>בואו ללמוד בלאק ג׳ק</h1>
          <p className="hero-sub">למדו את המשחק, תרגלו החלטות ושחקו כמו בשולחן אמיתי.</p>
          <a className="btn btn-gold btn-xl" href="#/play?mode=learn">
            התחל ללמוד
          </a>
        </div>
        <div className="hero-cards" aria-hidden="true">
          <PlayingCard card={HERO_CARDS[0]} size="lg" className="hero-card-1" />
          <PlayingCard card={HERO_CARDS[1]} size="lg" className="hero-card-2" />
          <span className="chip chip-black hero-chip" />
          <span className="chip chip-red hero-chip-2" />
        </div>
      </section>

      <nav className="home-grid" aria-label="מצבי משחק">
        {PRIMARY.map((b) => (
          <a key={b.to} href={`#${b.to}`} className={`home-card ${b.cls ?? ''}`}>
            <span className="home-icon" aria-hidden="true">{b.icon}</span>
            <strong>{b.title}</strong>
            <span>{b.text}</span>
          </a>
        ))}
      </nav>

      <nav className="home-secondary" aria-label="קישורים נוספים">
        <a href="#/progress" className="pill">📈 ההתקדמות שלי</a>
        <a href="#/chart" className="pill">📋 טבלת החלטות</a>
        <a href="#/settings" className="pill">⚙️ הגדרות</a>
      </nav>

      {s.decisions > 0 && (
        <section className="home-stats" aria-label="ההתקדמות שלך בקצרה">
          <div><strong>{s.hands}</strong><span>ידיים</span></div>
          <div><strong>{percent(s.correct, s.decisions)}</strong><span>החלטות נכונות</span></div>
          <div><strong>{s.bestStreak}</strong><span>רצף שיא</span></div>
          <div><strong>{Object.keys(s.achievements).length}</strong><span>הישגים</span></div>
        </section>
      )}

      <section className="home-note">
        <p>
          <strong>חשוב לדעת:</strong> גם החלטה נכונה יכולה להסתיים בהפסד בגלל המזל שבחלוקת הקלפים. כאן אנחנו מודדים את איכות ההחלטות שלך — לא רק
          את התוצאה. כל הצ׳יפים וירטואליים בלבד.
        </p>
      </section>

      {!profile.level && (
        <Modal title="מה רמת ההיכרות שלך עם בלאק ג׳ק?" onClose={() => updateProfile((p) => ({ ...p, level: 'few' }))}>
          <p className="muted">נתאים לך את נקודת ההתחלה. אין צורך בהרשמה או בפרטים אישיים.</p>
          <div className="level-list">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" className="level-btn" onClick={() => chooseLevel(l)}>
                <strong>{l.label}</strong>
                <span>{l.note}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
