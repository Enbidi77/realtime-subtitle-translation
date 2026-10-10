import React, { useEffect, useState, useRef } from 'react';
import { SubtitleSegment, AppSettings } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
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

    // Load initial settings and existing segments
    if (window.electronAPI) {
      window.electronAPI.settings.get().then((loaded) => {
        setSettings(loaded);
        if (loaded.overlaySettings?.captionMode === 'history') {
          setIsYouTubeMode(false);
        }
      }).catch(console.error);

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

  return (
    <div
      onMouseEnter={resetControlsTimer}
      onMouseMove={resetControlsTimer}
      className="w-full h-full flex flex-col justify-end items-center p-3 select-none relative group"
    >
      {/* 1. Overlay Drag & Action Controls (appears on open and on hover) */}
      <div
        className={`app-drag absolute top-1 left-2 right-2 h-7 flex items-center justify-between px-2.5 rounded-lg bg-slate-900/90 border border-white/15 backdrop-blur-md transition-opacity duration-200 z-50 shadow-xl ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-white/90">
          <GripHorizontal className="w-3.5 h-3.5 text-white/60" />
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
                ? 'bg-primary text-primary-foreground'
                : 'text-white/80 hover:text-white hover:bg-white/20'
            }`}
            title={isYouTubeMode ? 'Switch to Multi-Line History' : 'Switch to YouTube Single-Caption Mode'}
          >
            {isYouTubeMode ? <Captions className="w-3 h-3" /> : <AlignJustify className="w-3 h-3" />}
            <span>{isYouTubeMode ? 'CC Single' : 'History'}</span>
          </button>

          {/* Font scale buttons */}
          <button
            onClick={() => handleAdjustFontSize(-2)}
            className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20"
            title="Decrease font size"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleAdjustFontSize(2)}
            className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20"
            title="Increase font size"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Click-through toggle */}
          <button
            onClick={handleToggleClickThrough}
            className={`p-1 rounded transition-colors ${
              isClickThrough ? 'bg-primary text-white' : 'text-white/80 hover:text-white hover:bg-white/20'
            }`}
            title={isClickThrough ? 'Disable click-through' : 'Enable click-through mode'}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          {/* Close button */}
          <button
            onClick={handleCloseOverlay}
            className="p-1 rounded text-white/80 hover:text-white hover:bg-destructive/80"
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
              className="inline-block px-5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md transition-all text-center leading-relaxed"
              style={{
                backgroundColor: subtitleAppearance.backgroundColor || '#0F172A',
                opacity: subtitleAppearance.backgroundOpacity ?? 0.85,
              }}
            >
              {/* Original Speech Line */}
              {subtitleAppearance.displayMode !== 'translation-only' && (
                <div
                  style={{
                    fontSize: `${subtitleAppearance.fontSize * 0.75}px`,
                    color: subtitleAppearance.textColor || '#FFFFFF',
                  }}
                  className="font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tracking-normal"
                >
                  {activeSegment.originalText}
                </div>
              )}

              {/* Translated Speech Line */}
              {subtitleAppearance.displayMode !== 'original-only' &&
                (Object.values(activeSegment.translations)[0] || '') && (
                  <div
                    style={{
                      fontSize: `${subtitleAppearance.fontSize * 0.85}px`,
                      color: subtitleAppearance.translatedTextColor || '#FDE047',
                    }}
                    className="font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] mt-0.5 tracking-normal"
                  >
                    {Object.values(activeSegment.translations)[0]}
                  </div>
                )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/90 border border-white/20 text-white shadow-2xl backdrop-blur-md text-xs select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white/95">EchoLingo Subtitle Overlay</span>
              <span className="text-white/60 text-[11px]">• Ready for speech</span>
            </div>
          )}
        </div>
      ) : (
        /* ================= Multi-Line History Mode ================= */
        <div
          className={`w-full max-w-[94%] rounded-xl p-3 shadow-2xl transition-all duration-150 backdrop-blur-sm space-y-1.5 ${
            recentSegments.length > 0 || showControls ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundColor: subtitleAppearance.backgroundColor || '#0F172A',
            opacity: subtitleAppearance.backgroundOpacity ?? 0.85,
            textAlign: subtitleAppearance.textAlignment,
          }}
        >
          {recentSegments.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-1 text-white/70 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium">EchoLingo History Mode</span>
              <span className="text-white/50">• Waiting for speech...</span>
            </div>
          ) : (
            recentSegments.map((seg) => {
              const trans = Object.values(seg.translations)[0] || '';
              return (
                <div key={seg.id} className="space-y-0.5 leading-snug">
                  {subtitleAppearance.displayMode !== 'translation-only' && (
                    <div
                      style={{
                        fontSize: `${subtitleAppearance.fontSize * 0.7}px`,
                        color: subtitleAppearance.textColor || '#FFFFFF',
                      }}
                      className="font-medium drop-shadow-md"
                    >
                      {seg.originalText}
                    </div>
                  )}
                  {subtitleAppearance.displayMode !== 'original-only' && trans && (
                    <div
                      style={{
                        fontSize: `${subtitleAppearance.fontSize * 0.8}px`,
                        color: subtitleAppearance.translatedTextColor || '#FDE047',
                      }}
                      className="font-semibold drop-shadow-md"
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
