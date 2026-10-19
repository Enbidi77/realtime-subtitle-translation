import React from 'react';
import { useVideoSubtitleStore } from '../stores/video-subtitle-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { Loader2, Captions, Sparkles } from 'lucide-react';

export const VideoTranscribeProgressBar: React.FC = () => {
  const { t } = useI18n();
  const isTranscribing = useVideoSubtitleStore((s) => s.isTranscribing);
  const transcribeProgress = useVideoSubtitleStore((s) => s.transcribeProgress);

  if (!isTranscribing) return null;

  const percent = Math.max(5, Math.min(100, transcribeProgress?.percent ?? 5));

  const phaseTitle =
    transcribeProgress?.phase === 'translating'
      ? t('video.translatingPhase', 'Translating subtitles...')
      : transcribeProgress?.phase === 'extracting'
      ? t('video.extractingPhase', 'Extracting audio track...')
      : t('video.transcribingPhase', 'Transcribing speech with Whisper...');

  return (
    <div className="w-full glass-card p-4 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-background/40 to-indigo-950/20 shadow-xl flex flex-col gap-3 transition-all duration-200">
      {/* Top Header: Phase & Percentage */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          </div>
          <span className="font-semibold text-blue-200 truncate">{phaseTitle}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <span className="font-mono text-sm font-bold text-blue-300">{percent}%</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Live Recognized Subtitle Text with Full Auto-Wrapping */}
      {transcribeProgress?.detail && (
        <div className="w-full bg-black/40 p-3 rounded-xl border border-white/5 flex items-start gap-2.5 shadow-inner">
          <Captions className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-0.5">
              {transcribeProgress.phase === 'translating'
                ? t('video.translatingProgressLabel', 'Current translation batch')
                : t('video.liveRecognitionLabel', 'Live recognized speech')}
            </div>
            <p className="text-xs text-blue-100 font-mono break-words whitespace-normal leading-relaxed select-text">
              {transcribeProgress.detail}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

