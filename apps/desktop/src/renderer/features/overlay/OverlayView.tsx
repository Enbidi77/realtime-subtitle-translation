import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SubtitleSegment, AppSettings } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { applyTheme } from '@/stores/settings-store.js';
import { GripHorizontal, MousePointer, X, ZoomIn, ZoomOut, Captions, AlignJustify } from 'lucide-react';

export const OverlayView: React.FC = () => {
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isClickThrough, setIsClickThrough] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // YouTube CC Mode: only display the active sentence, and auto-fade after silence
  const [activeSegment, setActiveSegment] = useState<SubtitleSegment | null>(null);
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(false);
  const [isYouTubeMode, setIsYouTubeMode] = useState(true);

  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 6000);
  }, []);

  // Handle incoming segments and auto-hide timer
  const handleNewSegments = (newSegs: SubtitleSegment[]) => {
    setSegments(newSegs);
    if (!newSegs || newSegs.length === 0) return;

    const latest = newSegs[newSegs.length - 1];
    if (latest && latest.originalText.trim()) {
      setActiveSegment(latest);
      setIsSubtitleVisible(true);

      // Reset auto-fade timer on every new speech chunk (like YouTube CC)
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }

      // Compute display time: min 3.5s, max 6.5s based on text length
      const textLen = latest.originalText.length;
      const readingDurationMs = Math.max(3500, Math.min(6500, textLen * 75));

      fadeTimerRef.current = setTimeout(() => {
        setIsSubtitleVisible(false);
      }, readingDurationMs);
    }
  };

  useEffect(() => {
    resetControlsTimer();

    // Load initial settings and apply theme
    if (window.electronAPI) {
      window.electronAPI.settings.get().then((loaded) => {
        setSettings(loaded);
        applyTheme(loaded.theme);
        if (loaded.overlaySettings?.captionMode === 'history') {
          setIsYouTubeMode(false);
        }
      }).catch(console.error);

      // Subscribe to real-time settings update stream
      const unsubSettings = window.electronAPI.settings.onUpdate?.((updated) => {
        setSettings(updated);
        applyTheme(updated.theme);
        if (updated.overlaySettings?.captionMode) {
          setIsYouTubeMode(updated.overlaySettings.captionMode !== 'history');
        }
      });

      if (window.electronAPI.overlay.getSegments) {
        window.electronAPI.overlay.getSegments().then((segs) => {
          if (segs && segs.length > 0) {
            handleNewSegments(segs);
          }
        }).catch(console.error);
      }

      // Subscribe to real-time subtitle stream
      const unsubSegments = window.electronAPI.overlay.onSegments((newSegs) => {
        handleNewSegments(newSegs);
      });

      // Subscribe to overlay visibility changes (e.g. when unhidden by user)
      const unsubVisibility = window.electronAPI.overlay.onVisibilityChange?.((visible) => {
        if (visible) {
          resetControlsTimer();
        }
      });

      return () => {
        if (unsubSettings) unsubSettings();
        if (unsubSegments) unsubSegments();
        if (unsubVisibility) unsubVisibility();
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      };
    }
  }, [resetControlsTimer]);

  const handleToggleClickThrough = () => {
    const next = !isClickThrough;
    setIsClickThrough(next);
    window.electronAPI?.overlay.setClickThrough(next);
  };

  const handleCloseOverlay = () => {
    window.electronAPI?.overlay.toggle();
  };

  const handleAdjustFontSize = (delta: number) => {
    const currentSize = settings.subtitleAppearance.fontSize;
    const nextSize = Math.max(14, Math.min(48, currentSize + delta));
    const nextSettings = {
      ...settings,
      subtitleAppearance: {
        ...settings.subtitleAppearance,
        fontSize: nextSize,
      },
    };
    setSettings(nextSettings);
    window.electronAPI?.settings.update(nextSettings);
  };

  const handleToggleMode = () => {
    const nextMode = !isYouTubeMode;
    setIsYouTubeMode(nextMode);
    if (nextMode && activeSegment) {
      setIsSubtitleVisible(true);
    }
  };

  const { subtitleAppearance } = settings;
  const recentSegments = segments.slice(-Math.max(1, settings.overlaySettings?.maxLines || 3));

  // Determine active theme colors matching the app's charcoal / light design system
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const isDefaultDarkBg =
    !subtitleAppearance.backgroundColor ||
    subtitleAppearance.backgroundColor === '#0F172A' ||
    subtitleAppearance.backgroundColor === '#1E1F20' ||
    subtitleAppearance.backgroundColor === '#000000';

  const cardBgColor = isDark
    ? (isDefaultDarkBg ? '#1E1F20' : subtitleAppearance.backgroundColor)
    : (isDefaultDarkBg ? '#FFFFFF' : subtitleAppearance.backgroundColor);

  const originalTextColor = isDark
    ? (subtitleAppearance.textColor || '#FFFFFF')
    : (subtitleAppearance.textColor === '#FFFFFF' ? '#1F242D' : subtitleAppearance.textColor || '#1F242D');

  const isDefaultBlue =
    !subtitleAppearance.translatedTextColor ||
    subtitleAppearance.translatedTextColor === '#8AB4F8' ||
    subtitleAppearance.translatedTextColor === '#93C5FD' ||
    subtitleAppearance.translatedTextColor === '#60A5FA' ||
    subtitleAppearance.translatedTextColor === '#FDE047';

  const translatedTextColor = isDark
    ? (isDefaultBlue ? '#8AB4F8' : subtitleAppearance.translatedTextColor)
    : (isDefaultBlue ? '#1A73E8' : subtitleAppearance.translatedTextColor);

  return (
    <div
      onMouseEnter={resetControlsTimer}
      onMouseMove={resetControlsTimer}
      className="w-full h-full flex flex-col justify-end items-center p-3 select-none relative group"
    >
      {/* 1. Overlay Drag & Action Controls (matches app card & border theme) */}
      <div
        className={`app-drag absolute top-1 left-2 right-2 h-7 flex items-center justify-between px-2.5 rounded-lg bg-card/90 border border-border/80 backdrop-blur-md transition-opacity duration-200 z-50 shadow-lg ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-foreground">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold tracking-wide">
            {isYouTubeMode ? 'YouTube Subtitle Mode' : 'History Transcript Mode'}
          </span>
        </div>

        <div className="app-no-drag flex items-center gap-1">
          {/* Toggle YouTube Mode vs History Mode */}
          <button
            onClick={handleToggleMode}
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
              isYouTubeMode
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={isYouTubeMode ? 'Switch to Multi-Line History' : 'Switch to YouTube Single-Caption Mode'}
          >
            {isYouTubeMode ? <Captions className="w-3 h-3" /> : <AlignJustify className="w-3 h-3" />}
            <span>{isYouTubeMode ? 'CC Single' : 'History'}</span>
          </button>

          {/* Font scale buttons */}
          <button
            onClick={() => handleAdjustFontSize(-2)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Decrease font size"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleAdjustFontSize(2)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Increase font size"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Click-through toggle */}
          <button
            onClick={handleToggleClickThrough}
            className={`p-1 rounded transition-colors ${
              isClickThrough ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={isClickThrough ? 'Disable click-through' : 'Enable click-through mode'}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          {/* Close button */}
          <button
            onClick={handleCloseOverlay}
            className="p-1 rounded text-muted-foreground hover:text-destructive-foreground hover:bg-destructive/90 transition-colors"
            title="Close overlay"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Subtitles Container: YouTube Style */}
      {isYouTubeMode ? (
        /* ================= YouTube Subtitle Mode ================= */
        <div
          className={`transition-all duration-300 ease-out max-w-[94%] ${
            isSubtitleVisible && activeSegment
              ? 'opacity-100 scale-100'
              : !activeSegment
              ? 'opacity-100 scale-100'
              : showControls
              ? 'opacity-70 scale-95'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          {activeSegment ? (
            <div
              className="inline-block px-5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md transition-all text-center leading-relaxed border border-border/60"
              style={{
                backgroundColor: cardBgColor,
                opacity: subtitleAppearance.backgroundOpacity ?? 0.88,
              }}
            >
              {/* Original Speech Line */}
              {subtitleAppearance.displayMode !== 'translation-only' && (
                <div
                  style={{
                    fontSize: `${subtitleAppearance.fontSize * 0.75}px`,
                    color: originalTextColor,
                  }}
                  className="font-medium drop-shadow-sm tracking-normal"
                >
                  {activeSegment.originalText}
                </div>
              )}

              {/* Translated Speech Line */}
              {subtitleAppearance.displayMode !== 'original-only' &&
                Boolean(activeSegment.translations && Object.values(activeSegment.translations)[0]) && (
                  <div
                    style={{
                      fontSize: `${subtitleAppearance.fontSize * 0.85}px`,
                      color: translatedTextColor,
                    }}
                    className="font-semibold drop-shadow-sm mt-0.5 tracking-normal"
                  >
                    {activeSegment.translations ? Object.values(activeSegment.translations)[0] : ''}
                  </div>
                )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-card/95 border border-border text-foreground shadow-2xl backdrop-blur-md text-xs select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground">EchoLingo Subtitle Overlay</span>
              <span className="text-muted-foreground text-[11px]">• Ready for speech</span>
            </div>
          )}
        </div>
      ) : (
        /* ================= Multi-Line History Mode ================= */
        <div
          className={`w-full max-w-[94%] rounded-xl p-3 shadow-2xl transition-all duration-150 backdrop-blur-md space-y-1.5 border border-border/60 ${
            recentSegments.length > 0 || showControls ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundColor: cardBgColor,
            opacity: subtitleAppearance.backgroundOpacity ?? 0.88,
            textAlign: subtitleAppearance.textAlignment,
          }}
        >
          {recentSegments.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-1 text-muted-foreground text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-foreground">EchoLingo History Mode</span>
              <span className="text-muted-foreground text-[11px]">• Waiting for speech...</span>
            </div>
          ) : (
            recentSegments.map((seg) => {
              const trans = seg.translations ? (Object.values(seg.translations)[0] || '') : '';
              return (
                <div key={seg.id} className="space-y-0.5 leading-snug">
                  {subtitleAppearance.displayMode !== 'translation-only' && (
                    <div
                      style={{
                        fontSize: `${subtitleAppearance.fontSize * 0.7}px`,
                        color: originalTextColor,
                      }}
                      className="font-medium drop-shadow-sm"
                    >
                      {seg.originalText}
                    </div>
                  )}
                  {subtitleAppearance.displayMode !== 'original-only' && trans && (
                    <div
                      style={{
                        fontSize: `${subtitleAppearance.fontSize * 0.8}px`,
                        color: translatedTextColor,
                      }}
                      className="font-semibold drop-shadow-sm"
                    >
                      {trans}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
