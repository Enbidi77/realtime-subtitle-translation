import React, { useRef, useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { formatDisplayTime } from '@echo-lingo/subtitle-core';
import { GlassCard } from '@/components/ui/GlassCard.js';
import { GlassButton } from '@/components/ui/GlassButton.js';
import { GlassInput } from '@/components/ui/GlassInput.js';
import { GlassBadge } from '@/components/ui/GlassBadge.js';
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
  Radio,
  Mic,
  Activity,
  Sparkles,
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
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-transparent">
      {/* Top Glass Toolbar */}
      <header className="glass-toolbar h-13 px-4 flex items-center justify-between gap-3 select-none shrink-0 z-20">
        {/* Playback Controls & Status */}
        <div className="flex items-center gap-2">
          {isListening && (
            <>
              {isPaused ? (
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={resumeSession}
                  icon={<Play className="w-3.5 h-3.5 fill-current" />}
                >
                  {t('live.resume')}
                </GlassButton>
              ) : (
                <GlassButton
                  variant="glass"
                  size="sm"
                  onClick={pauseSession}
                  icon={<Pause className="w-3.5 h-3.5 fill-current" />}
                >
                  {t('live.pause')}
                </GlassButton>
              )}

              <GlassButton
                variant="destructive"
                size="sm"
                onClick={stopSession}
                icon={<Square className="w-3.5 h-3.5 fill-current" />}
              >
                {t('live.stop')}
              </GlassButton>
            </>
          )}

          {/* Audio signal indicator */}
          {isListening && !isPaused && (
            <GlassBadge variant="live" pulse className="ml-1 hidden sm:inline-flex">
              RMS: {(audioRms * 100).toFixed(0)}%
            </GlassBadge>
          )}

          {/* Active Engine Badge */}
          {isListening && (
            <GlassBadge variant="accent" className="hidden md:inline-flex font-mono text-[10px]">
              {speechEngine === 'groq-whisper' ? '⚡ Groq Whisper' : speechEngine}
            </GlassBadge>
          )}
        </div>

        {/* Search within session */}
        <div className="flex-1 max-w-xs">
          <GlassInput
            type="text"
            placeholder={t('live.searchPlaceholder')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            onClear={() => setSearchFilter('')}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {pipelineLatencyMs > 0 && (
            <GlassBadge variant="neutral" className="hidden lg:inline-flex text-emerald-400 font-mono">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>{pipelineLatencyMs}ms</span>
            </GlassBadge>
          )}

          <GlassButton
            variant="glass"
            size="sm"
            onClick={handleCopyAll}
            disabled={segments.length === 0}
            title={t('live.copyTranscript')}
            icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          >
            <span className="hidden sm:inline">{t('live.copyTranscript')}</span>
          </GlassButton>

          <button
            onClick={() => window.electronAPI?.overlay.toggle()}
            title={isOverlayOpen ? 'Hide Subtitle Overlay' : t('live.openOverlay')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 border ${
              isOverlayOpen
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-white/20 shadow-sm shadow-primary/20 font-semibold'
                : 'bg-glass-subtle text-foreground hover:bg-glass border-glass-border hover:border-glass-border-elevated'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isOverlayOpen ? 'Overlay Active' : t('live.openOverlay')}
            </span>
          </button>
        </div>
      </header>

      {/* Audio Error Alert Banner */}
      {audioError && (
        <div className="mx-6 mt-4">
          <GlassCard
            variant="elevated"
            className="p-4 bg-destructive/15 border-destructive/30 text-destructive flex items-start justify-between gap-3 animate-fade-in"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-destructive" />
              <div>
                <div className="text-xs font-semibold text-destructive">Audio Capture Notice</div>
                <div className="text-xs mt-1 text-foreground/90 leading-relaxed">{audioError}</div>
              </div>
            </div>
            <GlassButton
              variant="glass"
              size="xs"
              onClick={() => setAudioError(null)}
              className="shrink-0"
            >
              Dismiss
            </GlassButton>
          </GlassCard>
        </div>
      )}

      {/* Live Timeline Display Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-3.5"
      >
        {/* Empty State */}
        {filteredSegments.length === 0 && !activePartial && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md mx-auto">
            <GlassCard variant="elevated" className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg border-white/25">
              <span className="text-3xl">{audioSourceType === 'system' ? '🔊' : '🎙️'}</span>
            </GlassCard>

            <div className="space-y-1.5">
              <div className="text-base font-semibold text-foreground tracking-tight">
                {t('live.emptyState')}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isListening
                  ? audioSourceType === 'system'
                    ? 'Listening to system audio. Play your YouTube video, call, or media to see live subtitles and translations.'
                    : 'Listening to microphone. Speak clearly into your mic, or switch to System Audio in Dashboard if watching video.'
                  : 'Start listening to begin real-time speech recognition and subtitle translation.'}
              </p>
            </div>

            {isListening && audioSourceType === 'microphone' && (
              <GlassCard variant="subtle" className="p-3.5 text-xs text-left space-y-1.5 w-full">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Watching a YouTube video or meeting?</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Microphone captures ambient room acoustics. For pristine direct audio without room echo, select <strong>System Audio</strong> on the Dashboard.
                </p>
              </GlassCard>
            )}
          </div>
        )}

        {/* Finalized Segments List */}
        {filteredSegments.map((segment) => {
          const transText = Object.values(segment.translations)[0] || '';

          return (
            <GlassCard
              key={segment.id}
              variant="default"
              className="p-4 space-y-2 group transition-all duration-150 hover:border-glass-border-elevated"
            >
              {/* Header: timestamp and speech provider */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono px-2 py-0.5 rounded-md bg-glass-subtle border border-glass-border/40 text-[10px]">
                  {formatDisplayTime(segment.startTime)} - {formatDisplayTime(segment.endTime)}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground/75 font-mono">
                  {segment.speechProvider}
                </span>
              </div>

              {/* Subtitle Content (Source Text) */}
              {subtitleAppearance.displayMode !== 'translation-only' && (
                <div
                  className="text-foreground font-normal leading-relaxed selection:bg-primary/20"
                  style={{
                    fontSize: `${Math.max(14, subtitleAppearance.fontSize * 0.7)}px`,
                    textAlign: subtitleAppearance.textAlignment,
                  }}
                >
                  {segment.originalText}
                </div>
              )}

              {/* Subtitle Content (Translated Text) */}
              {subtitleAppearance.displayMode !== 'original-only' && transText && (
                <div
                  className="font-semibold leading-relaxed selection:bg-primary/20"
                  style={{
                    fontSize: `${Math.max(15, subtitleAppearance.fontSize * 0.78)}px`,
                    textAlign: subtitleAppearance.textAlignment,
                    color: subtitleAppearance.translatedTextColor || undefined,
                  }}
                >
                  {transText}
                </div>
              )}
            </GlassCard>
          );
        })}

        {/* Live Active Interim Stream */}
        {activePartial && (
          <GlassCard
            variant="elevated"
            className="p-4 space-y-2 border-primary/30 shadow-glass-glow animate-pulse-subtle"
          >
            <div className="flex items-center gap-2 text-[10px] font-mono text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span>[Live Speech Stream • {formatDisplayTime(activePartial.startTime)}]</span>
            </div>
            <div
              className="text-foreground/90 italic leading-relaxed"
              style={{
                fontSize: `${Math.max(14, subtitleAppearance.fontSize * 0.7)}px`,
                textAlign: subtitleAppearance.textAlignment,
              }}
            >
              {activePartial.originalText}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
};
