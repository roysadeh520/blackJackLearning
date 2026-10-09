import { useEffect } from 'react';
import { Layout } from './ui/components/Layout';
import { useRoute } from './ui/router';
import { ChartScreen } from './ui/screens/ChartScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { LessonScreen } from './ui/screens/LessonScreen';
import { PlayScreen } from './ui/screens/PlayScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { QuickPracticeScreen } from './ui/screens/QuickPracticeScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

const TITLES: Record<string, string> = {
  '/': 'בלאק ג׳ק לומדים',
  '/play': 'שולחן משחק',
  '/quick': 'תרגול מהיר',
  '/chart': 'טבלת החלטות',
  '/progress': 'ההתקדמות שלי',
  '/settings': 'הגדרות',
  '/lesson': 'איך משחקים?',
};

export function App() {
  const { path, params } = useRoute();

  useEffect(() => {
    const t = TITLES[path];
    document.title = t && path !== '/' ? `${t} · בלאק ג׳ק לומדים` : 'בלאק ג׳ק לומדים';
  }, [path]);

  let screen;
  switch (path) {
    case '/play':
      screen = <PlayScreen key={params.get('mode') ?? ''} initialMode={params.get('mode')} />;
      break;
    case '/quick': {
      const mistakes = params.get('mistakes') === '1';
      screen = <QuickPracticeScreen key={mistakes ? 'm' : 'q'} mistakesMode={mistakes} />;
      break;
    }
    case '/chart':
      screen = <ChartScreen />;
      break;
    case '/progress':
      screen = <ProgressScreen />;
      break;
    case '/settings':
      screen = <SettingsScreen />;
      break;
    case '/lesson':
      screen = <LessonScreen />;
      break;
    default:
      screen = <HomeScreen />;
  }
  return <Layout path={path}>{screen}</Layout>;
}
