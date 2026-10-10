import React from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayView } from './features/overlay/OverlayView.js';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <OverlayView />
    </React.StrictMode>
  );
}
