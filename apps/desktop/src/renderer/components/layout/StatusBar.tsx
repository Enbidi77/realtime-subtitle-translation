import React from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { Mic, Radio, Cpu, Globe, Zap } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const isListening = useSessionStore((s) => s.isListening);
  const isPaused = useSessionStore((s) => s.isPaused);
  const audioRms = useSessionStore((s) => s.audioRms);
  const pipelineLatencyMs = useSessionStore((s) => s.pipelineLatencyMs);
  const speechEngine = useSettingsStore((s) => s.settings.speechEngine);
  const translationProvider = useSettingsStore((s) => s.settings.translationProvider);
  const audioSourceType = useSettingsStore((s) => s.settings.audioSourceType);

  return (
    <footer className="glass-toolbar border-t border-glass-border h-8 w-full flex items-center justify-between px-4 select-none text-[11px] text-muted-foreground relative z-20 pointer-events-auto">
      {/* Left: Audio source & live RMS signal */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-glass-subtle border border-glass-border/40 text-foreground/80 font-medium">
          {audioSourceType === 'system' ? (
            <Radio className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-primary" />
          )}
          <span className="capitalize">{audioSourceType}</span>
        </div>

        {isListening && (
          <>
            <div className="h-3 w-[1px] bg-glass-border" />
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-mono text-[10px] select-none transition-colors ${
                isPaused
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                  : 'bg-glass-subtle border-glass-border/40 text-muted-foreground'
              }`}
              title={`RMS: ${(audioRms * 100).toFixed(0)}%`}
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isPaused ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    isPaused ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span>RMS:</span>
              <span
                className={`font-semibold tabular-nums ${
                  isPaused ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {(audioRms * 100).toFixed(0)}%
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Providers & Performance Latency */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-glass-subtle border border-glass-border/40 font-mono text-[10px]">
          <Cpu className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium text-foreground/80">
            {speechEngine === 'groq-whisper' ? '⚡ Groq Whisper' : speechEngine}
          </span>
        </div>

        <div className="h-3 w-[1px] bg-glass-border" />

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-glass-subtle border border-glass-border/40 font-mono text-[10px]">
          <Globe className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium text-foreground/80">{translationProvider}</span>
        </div>

        {pipelineLatencyMs > 0 && (
          <>
            <div className="h-3 w-[1px] bg-glass-border" />
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[10px] font-medium">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>{pipelineLatencyMs}ms</span>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};
