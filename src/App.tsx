import { useEffect, useState } from 'react';
import { loadActiveGame } from './ui/activeGame';
import { Layout } from './ui/components/Layout';
import { useStore } from './ui/store';
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
  // A running game stays mounted (hidden) while other screens are open,
  // so visiting the chart or progress never resets the table.
  const { storage } = useStore();
  const [gameAlive, setGameAlive] = useState(() => !!loadActiveGame(storage));
  const onPlay = path === '/play';

  useEffect(() => {
    const t = TITLES[path];
    document.title = t && path !== '/' ? `${t} · בלאק ג׳ק לומדים` : 'בלאק ג׳ק לומדים';
  }, [path]);

  let screen;
  switch (path) {
    case '/play':
      screen = null;
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
  return (
    <Layout path={path} showResume={gameAlive && !onPlay}>
      {(onPlay || gameAlive) && (
        <div hidden={!onPlay}>
          <PlayScreen
            requestedMode={onPlay ? params.get('mode') : null}
            visible={onPlay}
            endRequested={onPlay && params.get('end') === '1'}
            onGameAliveChange={setGameAlive}
          />
        </div>
      )}
      {screen}
    </Layout>
  );
}
