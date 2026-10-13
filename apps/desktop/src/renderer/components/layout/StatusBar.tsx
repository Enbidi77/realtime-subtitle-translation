import React from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { Mic, Radio, Cpu, Globe, Zap } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const isListening = useSessionStore((s) => s.isListening);
  const audioRms = useSessionStore((s) => s.audioRms);
  const pipelineLatencyMs = useSessionStore((s) => s.pipelineLatencyMs);
  const speechEngine = useSettingsStore((s) => s.settings.speechEngine);
  const translationProvider = useSettingsStore((s) => s.settings.translationProvider);
  const audioSourceType = useSettingsStore((s) => s.settings.audioSourceType);

  // Normalize RMS to 5 visual meter bars
  const bars = [0.01, 0.03, 0.06, 0.12, 0.2];

  return (
    <footer className="glass-toolbar border-t border-glass-border h-8 w-full flex items-center justify-between px-4 select-none text-[11px] text-muted-foreground relative z-20 pointer-events-auto">
      {/* Left: Audio signal meter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-glass-subtle border border-glass-border/50 text-foreground/80 font-medium">
          {audioSourceType === 'system' ? (
            <Radio className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-primary" />
          )}
          <span className="capitalize">{audioSourceType}</span>
        </div>

        {/* Live RMS bars */}
        {isListening && (
          <div className="flex items-end gap-1 h-3.5 px-2 py-0.5 rounded-lg bg-glass-subtle border border-glass-border/40">
            {bars.map((threshold, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  audioRms >= threshold
                    ? 'h-full bg-gradient-to-t from-emerald-500 to-cyan-400 shadow-xs'
                    : 'h-1 bg-muted-foreground/25'
                }`}
              />
            ))}
            <span className="text-[10px] ml-1 font-mono text-emerald-400">
              {(audioRms * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Right: Providers & Performance Latency */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-glass-subtle border border-glass-border/40">
          <Cpu className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium text-foreground/80">{speechEngine}</span>
        </div>

        <div className="h-3 w-[1px] bg-glass-border" />

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-glass-subtle border border-glass-border/40">
          <Globe className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium text-foreground/80">{translationProvider}</span>
        </div>

        {isListening && pipelineLatencyMs > 0 && (
          <>
            <div className="h-3 w-[1px] bg-glass-border" />
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-medium">
              <Zap className="w-3 h-3" />
              <span>{pipelineLatencyMs}ms</span>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};
