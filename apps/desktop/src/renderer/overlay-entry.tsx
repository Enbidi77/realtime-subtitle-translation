import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayView } from '@/features/overlay/OverlayView.js';
import '@/styles/globals.css';

interface ErrorFallbackProps {
  errorMessage: string;
}

const OverlayErrorFallback: React.FC<ErrorFallbackProps> = ({ errorMessage }) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-card/95 text-foreground rounded-xl border border-destructive/50 shadow-2xl backdrop-blur-md">
    <span className="text-xs font-semibold text-destructive">EchoLingo Overlay Error</span>
    <span className="text-[10px] text-muted-foreground mt-1 max-w-[90%] truncate">{errorMessage}</span>
  </div>
);

export const OverlayApp: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('[OverlayApp] Caught error in overlay:', event.error || event.message);
      setErrorMessage(event.error?.message || event.message || 'An unexpected error occurred');
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[OverlayApp] Unhandled rejection in overlay:', event.reason);
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
      setErrorMessage(msg || 'An unhandled promise rejection occurred');
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (errorMessage) {
    return <OverlayErrorFallback errorMessage={errorMessage} />;
  }

  return <OverlayView />;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <OverlayApp />
    </React.StrictMode>
  );
}
