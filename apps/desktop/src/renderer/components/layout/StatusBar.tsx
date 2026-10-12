import React from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { Mic, Radio, Cpu, Globe, Zap } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const isListening = useSessionStore((s) => s.isListening);
  const audioRms = useSessionStore((s) => s.audioRms);
  const pipelineLatencyMs = useSessionStore((s) => s.pipelineLatencyMs);
  const { speechEngine, translationProvider, audioSourceType } = useSettingsStore(
    (s) => s.settings
  );

  // Normalize RMS to 5 visual meter bars
  const bars = [0.01, 0.03, 0.06, 0.12, 0.2];

  return (
    <footer className="h-7 w-full flex items-center justify-between px-3 bg-card border-t border-border select-none text-[11px] text-muted-foreground z-40">
      {/* Left: Audio signal meter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {audioSourceType === 'system' ? (
            <Radio className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-primary" />
          )}
          <span className="capitalize">{audioSourceType}</span>
        </div>

        {/* Live RMS bars */}
        {isListening && (
          <div className="flex items-end gap-0.5 h-3.5 px-1 py-0.5">
            {bars.map((threshold, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  audioRms >= threshold
                    ? 'h-full bg-emerald-500'
                    : 'h-1 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: Providers & Performance Latency */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-muted-foreground" />
          <span>{speechEngine}</span>
        </div>

        <div className="h-3 w-[1px] bg-border" />

        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3 text-muted-foreground" />
          <span>{translationProvider}</span>
        </div>

        {isListening && pipelineLatencyMs > 0 && (
          <>
            <div className="h-3 w-[1px] bg-border" />
            <div className="flex items-center gap-1 text-emerald-500 font-medium">
              <Zap className="w-3 h-3" />
              <span>{pipelineLatencyMs}ms</span>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};
