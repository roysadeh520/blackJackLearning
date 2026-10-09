import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './ui/store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
