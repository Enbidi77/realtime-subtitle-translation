import React, { useState, useEffect } from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { Sparkles, Minus, Square, X, ExternalLink } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const { t } = useI18n();
  const isListening = useSessionStore((s) => s.isListening);
  const isPaused = useSessionStore((s) => s.isPaused);
  const activeSession = useSessionStore((s) => s.activeSession);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.overlay?.onVisibilityChange) {
      const unsub = window.electronAPI.overlay.onVisibilityChange((visible) => {
        setIsOverlayOpen(visible);
      });
      return () => {
        unsub();
      };
    }
  }, []);

  const handleMinimize = () => window.electronAPI?.app.minimize();
  const handleMaximize = () => window.electronAPI?.app.maximize();
  const handleClose = () => window.electronAPI?.app.close();
  const handleToggleOverlay = () => window.electronAPI?.overlay.toggle();

  return (
    <header className="app-drag h-10 w-full flex items-center justify-between px-3 bg-background border-b border-border select-none z-50">
      {/* Brand & Status */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs tracking-tight text-foreground">
            EchoLingo
          </span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            v1.0
          </span>
        </div>

        {/* Live session pill */}
        {isListening && (
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span>
              {isPaused ? t('app.status.paused') : t('app.status.listening')}
            </span>
            {activeSession && (
              <span className="text-[10px] opacity-75 hidden md:inline">
                ({activeSession.sourceLanguage} → {activeSession.targetLanguages.join(', ')})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center title / drag space */}
      <div className="flex-1 text-center text-xs text-muted-foreground truncate px-4 pointer-events-none">
        {activeSession?.title || ''}
      </div>

      {/* Right actions & Window controls */}
      <div className="app-no-drag flex items-center gap-1">
        <button
          onClick={handleToggleOverlay}
          title={isOverlayOpen ? 'Hide Subtitle Overlay' : t('live.openOverlay')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-all ${
            isOverlayOpen
              ? 'bg-primary text-primary-foreground shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">
            {isOverlayOpen ? 'Overlay Active' : t('live.openOverlay')}
          </span>
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-destructive rounded transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
