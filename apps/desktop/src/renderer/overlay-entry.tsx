import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayView } from '@/features/overlay/OverlayView.js';
import '@/styles/globals.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class OverlayErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[OverlayErrorBoundary] Caught error in overlay component:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-card/95 text-foreground rounded-xl border border-destructive/50 shadow-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-destructive">EchoLingo Overlay Error</span>
          <span className="text-[10px] text-muted-foreground mt-1 max-w-[90%] truncate">{this.state.errorMessage}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <OverlayErrorBoundary>
        <OverlayView />
      </OverlayErrorBoundary>
    </React.StrictMode>
  );
}
