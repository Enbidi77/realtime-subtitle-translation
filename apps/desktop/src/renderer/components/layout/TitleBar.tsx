import React, { useState, useEffect } from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { GlassButton } from '@/components/ui/GlassButton.js';
import {
  Sparkles,
  Minus,
  Square,
  X,
  ExternalLink,
  Sun,
  Moon,
} from 'lucide-react';

export const TitleBar: React.FC = () => {
  const { t } = useI18n();
  const isListening = useSessionStore((s) => s.isListening);
  const isPaused = useSessionStore((s) => s.isPaused);
  const activeSession = useSessionStore((s) => s.activeSession);
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
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

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

  return (
    <header className="glass-toolbar h-11 w-full flex items-center justify-between px-3.5 select-none z-50">
      {/* Brand & Status */}
      <div className="app-no-drag flex items-center gap-2.5">
        {/* Luminous prism logo icon inspired by reference */}
        <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 text-white shadow-sm shadow-indigo-500/25 border border-white/25">
          <Sparkles className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs tracking-tight text-foreground">
            EchoLingo
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-glass-subtle border border-glass-border text-muted-foreground hidden sm:inline">
            v1.0
          </span>
        </div>

        {/* Live session status pill */}
        {isListening && (
          <div className="flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-xs">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span>
              {isPaused ? t('app.status.paused') : t('app.status.listening')}
            </span>
            {activeSession && (
              <span className="text-[10px] opacity-75 hidden md:inline font-mono">
                ({activeSession.sourceLanguage} → {activeSession.targetLanguages.join(', ')})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center title / dedicated drag space */}
      <div className="app-drag flex-1 h-full flex items-center justify-center text-center text-xs text-muted-foreground font-medium truncate px-4 cursor-default">
        {activeSession?.title || ''}
      </div>

      {/* Right actions & Window controls */}
      <div className="app-no-drag flex items-center gap-1.5">
        {/* Floating Subtitle Overlay Toggle Button */}
        <button
          type="button"
          onClick={handleToggleOverlay}
          title={isOverlayOpen ? 'Hide Subtitle Overlay' : t('live.openOverlay')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xl cursor-pointer transition-all duration-150 border ${
            isOverlayOpen
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-white/20 shadow-sm shadow-primary/20 font-medium'
              : 'bg-glass-subtle text-muted-foreground hover:text-foreground hover:bg-glass border-glass-border'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">
            {isOverlayOpen ? 'Overlay Active' : t('live.openOverlay')}
          </span>
        </button>

        {/* Quick Theme Switcher */}
        <button
          type="button"
          onClick={handleToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer bg-glass-subtle text-muted-foreground hover:text-foreground hover:bg-glass border border-glass-border transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
          )}
        </button>

        <div className="h-4 w-[1px] bg-glass-border mx-1" />

        {/* Window controls */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-glass rounded-lg border border-transparent hover:border-glass-border transition-colors"
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-glass rounded-lg border border-transparent hover:border-glass-border transition-colors"
          title="Maximize"
          aria-label="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-white hover:bg-destructive/90 rounded-lg transition-colors"
          title="Close"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
