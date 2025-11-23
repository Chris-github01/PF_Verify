import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('[Contextify]') ||
      message.includes('running source code in new context') ||
      message.includes('preloaded using link preload but not used')) {
    return;
  }
  originalWarn.apply(console, args);
};

const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('chmln') ||
      message.includes('messo') ||
      message.includes('fetch-worker')) {
    console.warn('External script error suppressed:', message);
    return;
  }
  originalError.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
