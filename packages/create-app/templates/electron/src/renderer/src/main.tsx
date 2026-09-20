import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
// The library's tokens must exist before anything paints with them, so its
// stylesheet is imported before the app's own.
import '@rindra/desktop/styles.css';
import '@rindra/desktop/print.css';
import './styles/app.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
