import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App.js';
import '@/styles/globals.css';

import { ErrorBoundary } from '@/components/ErrorBoundary.js';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary fallbackTitle="EchoLingo Application Error">
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
