import React, { useRef, useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { formatDisplayTime } from '@echo-lingo/subtitle-core';
import {
  Play,
  Pause,
  Square,
  Search,
  Copy,
  ExternalLink,
  Check,
  Zap,
  AlertTriangle,
} from 'lucide-react';

export const LiveSubtitlesView: React.FC = () => {
  const { t } = useI18n();
  const {
    activeSession,
    segments,
    activePartial,
    isListening,
    isPaused,
    audioRms,
    pipelineLatencyMs,
    audioError,
    setAudioError,
    pauseSession,
    resumeSession,
    stopSession,
  } = useSessionStore();

  const {
    subtitleAppearance,
    autoScrollLiveSubtitles,
    audioSourceType,
    speechEngine,
  } = useSettingsStore((s) => s.settings);

  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

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

  // Auto-scroll when new segments arrive unless user manually scrolled up
  useEffect(() => {
    if (!autoScrollLiveSubtitles || userScrolledRef.current) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, activePartial, autoScrollLiveSubtitles]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    userScrolledRef.current = !isAtBottom;
  };

  const handleCopyAll = () => {
    const text = segments
      .map((s) => {
        const trans = Object.values(s.translations)[0] || '';
        return `[${formatDisplayTime(s.startTime)}] ${s.originalText}${trans ? `\n-> ${trans}` : ''}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredSegments = segments.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    if (s.originalText.toLowerCase().includes(q)) return true;
    for (const val of Object.values(s.translations)) {
      if (val.toLowerCase().includes(q)) return true;
    }
    return false;
  });

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-background">
      {/* Top Toolbar */}
      <div className="h-12 px-4 border-b border-border flex items-center justify-between gap-4 bg-card select-none">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          {isListening && (
            <>
              {isPaused ? (
                <button
                  onClick={resumeSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t('live.resume')}</span>
                </button>
              ) : (
                <button
                  onClick={pauseSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-xs font-medium transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>{t('live.pause')}</span>
                </button>
              )}

              <button
                onClick={stopSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t('live.stop')}</span>
              </button>
            </>
          )}

          {/* Audio signal indicator */}
          {isListening && !isPaused && (
            <div className="flex items-center gap-1 ml-2 px-2 py-1 rounded bg-muted/50 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>RMS: {(audioRms * 100).toFixed(0)}%</span>
            </div>
          )}

          {/* Active Engine Badge */}
          {isListening && (
            <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-medium">
              <span>{speechEngine === 'groq-whisper' ? '⚡ Groq Whisper' : speechEngine}</span>
            </div>
          )}
        </div>

        {/* Search within session */}
        <div className="flex-1 max-w-xs relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('live.searchPlaceholder')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {pipelineLatencyMs > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded bg-muted/40">
              <Zap className="w-3 h-3 text-emerald-500" />
              <span>{pipelineLatencyMs}ms</span>
            </div>
          )}

          <button
            onClick={handleCopyAll}
            disabled={segments.length === 0}
            title={t('live.copyTranscript')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-xs text-foreground transition-colors disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{t('live.copyTranscript')}</span>
          </button>

          <button
            onClick={() => window.electronAPI?.overlay.toggle()}
            title={isOverlayOpen ? 'Hide Subtitle Overlay' : t('live.openOverlay')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isOverlayOpen
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isOverlayOpen ? 'Overlay Active' : t('live.openOverlay')}
            </span>
          </button>
        </div>
      </div>

      {/* Audio Error Alert Banner */}
      {audioError && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-destructive" />
            <div>
              <div className="text-xs font-semibold text-destructive">Audio Capture Notice</div>
              <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{audioError}</div>
            </div>
          </div>
          <button
            onClick={() => setAudioError(null)}
            className="text-xs px-2.5 py-1 rounded bg-background/50 hover:bg-background border border-border text-foreground transition-colors flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Timeline Display Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {filteredSegments.length === 0 && !activePartial && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
              <span className="text-2xl">{audioSourceType === 'system' ? '🔊' : '🎙️'}</span>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">{t('live.emptyState')}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isListening
                  ? audioSourceType === 'system'
                    ? 'Listening to system audio. Play your YouTube video or meeting to see live subtitles and translations.'
                    : 'Listening to microphone. Speak into your mic, or switch to System Audio if you are playing video or media.'
                  : 'Start listening to begin real-time speech recognition and subtitle translation.'}
              </p>
            </div>

            {isListening && audioSourceType === 'microphone' && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-left space-y-1.5 w-full">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <span>💡 Watching a YouTube video or meeting?</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Microphone captures your room's voice. To capture YouTube sound cleanly without background noise, choose <strong>System Audio</strong> in the Dashboard.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Finalized Segments */}
        {filteredSegments.map((segment) => {
          const transText =
            Object.values(segment.translations)[0] || '';

          return (
            <div
              key={segment.id}
              className="p-4 rounded-xl bg-card border border-border/70 hover:border-border transition-all shadow-sm space-y-1.5 group"
            >
              {/* Header: timestamp and language badges */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">
                  [{formatDisplayTime(segment.startTime)} - {formatDisplayTime(segment.endTime)}]
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                  {segment.speechProvider}
                </span>
              </div>

              {/* Subtitle Text Content */}
              {subtitleAppearance.displayMode !== 'translation-only' && (
                <div
                  className="text-foreground leading-relaxed"
                  style={{
                    fontSize: `${Math.max(14, subtitleAppearance.fontSize * 0.7)}px`,
                    textAlign: subtitleAppearance.textAlignment,
                  }}
                >
                  {segment.originalText}
                </div>
              )}

              {subtitleAppearance.displayMode !== 'original-only' && transText && (
                <div
                  className="text-primary font-medium leading-relaxed"
                  style={{
                    fontSize: `${Math.max(14, subtitleAppearance.fontSize * 0.75)}px`,
                    textAlign: subtitleAppearance.textAlignment,
                  }}
                >
                  {transText}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Active Partial Stream */}
        {activePartial && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 animate-pulse">
            <div className="text-[11px] text-primary/75 font-mono">
              [Live Partial • {formatDisplayTime(activePartial.startTime)}]
            </div>
            <div
              className="text-foreground/90 italic"
              style={{
                fontSize: `${Math.max(14, subtitleAppearance.fontSize * 0.7)}px`,
                textAlign: subtitleAppearance.textAlignment,
              }}
            >
              {activePartial.originalText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
