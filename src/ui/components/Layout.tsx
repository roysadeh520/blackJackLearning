import { ReactNode } from 'react';
import { formatChips } from '../../i18n/he';
import { useStore } from '../store';

const NAV = [
  { to: '/', label: 'בית', icon: '🏠' },
  { to: '/progress', label: 'ההתקדמות שלי', icon: '📈' },
  { to: '/chart', label: 'טבלת החלטות', icon: '📋' },
  { to: '/settings', label: 'הגדרות', icon: '⚙️' },
];

export function Layout({ children, path, showResume }: { children: ReactNode; path: string; showResume?: boolean }) {
  const { profile, toasts, dismissToast } = useStore();
  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        דלג לתוכן הראשי
      </a>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="בלאק ג׳ק לומדים — מסך הבית">
          <span className="brand-mark" aria-hidden="true">♠</span>
          <span className="brand-text">בלאק ג׳ק <em>לומדים</em></span>
        </a>
        <nav className="topnav" aria-label="ניווט ראשי">
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={path === n.to ? 'active' : ''} aria-current={path === n.to ? 'page' : undefined}>
              <span aria-hidden="true">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="bankroll" aria-label={`צ׳יפים וירטואליים: ${formatChips(profile.chips)}`}>
          <span className="chip chip-mini chip-black" aria-hidden="true" />
          <span>{formatChips(profile.chips)}</span>
        </div>
      </header>
      {showResume && (
        <div className="resume-bar" role="region" aria-label="משחק פעיל">
          <span>
            <span aria-hidden="true">🃏 </span>יש לך משחק פעיל — הוא שמור בדיוק איפה שעצרת.
          </span>
          <span className="resume-actions">
            <a className="btn btn-gold btn-small" href="#/play">
              חזרה למשחק
            </a>
            <a className="btn btn-outline btn-small" href="#/play?end=1">
              סיים משחק
            </a>
          </span>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-foot">
        <p>כל הצ׳יפים באתר וירטואליים בלבד. אין כסף אמיתי, הפקדות או משיכות. ההתקדמות נשמרת רק בדפדפן הזה.</p>
      </footer>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button type="button" key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismissToast(t.id)}>
            {t.text}
          </button>
        ))}
      </div>
    </div>
  );
}
