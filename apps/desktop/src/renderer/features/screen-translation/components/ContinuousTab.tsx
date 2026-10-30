import React from "react";
import { ContinuousOcrStats, OcrHistoryItem } from "@echo-lingo/contracts";
import { GlassButton, GlassCard } from "@/components/ui/index.js";
import { useI18n } from "@/app/i18n/index.js";
import {
  Activity,
  Crop,
  Square,
  Play,
  Pause,
} from "lucide-react";

export interface ContinuousTabProps {
  continuousRegion: any | null;
  continuousState: string;
  continuousStats: ContinuousOcrStats;
  continuousHistory: OcrHistoryItem[];
  intervalMs: number;
  onIntervalMsChange: (interval: number) => void;
  changeThreshold: number;
  onChangeThresholdChange: (threshold: number) => void;
  onSelectRegion: () => void;
  onToggleContinuous: () => void;
  onPauseResumeContinuous: () => void;
}

export const ContinuousTab: React.FC<ContinuousTabProps> = ({
  continuousRegion,
  continuousState,
  continuousStats,
  continuousHistory,
  intervalMs,
  onIntervalMsChange,
  changeThreshold,
  onChangeThresholdChange,
  onSelectRegion,
  onToggleContinuous,
  onPauseResumeContinuous,
}) => {
  const { t } = useI18n();

  const isRunning =
    continuousState !== "idle" && continuousState !== "stopping";

  return (
    <div className="space-y-4">
      <GlassCard variant="subtle" className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span>
                {t("ocr.continuous.title", "Real-Time Screen Text Monitoring")}
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t(
                "ocr.continuous.subtitle",
                "Continuously scans a target region (e.g. video subtitles or game dialogue) and translates only meaningful changes.",
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              variant="glass"
              size="sm"
              icon={<Crop className="w-3.5 h-3.5" />}
              onClick={onSelectRegion}
            >
              {continuousRegion
                ? t("ocr.continuous.changeRegion", "Change Region")
                : t("ocr.continuous.selectRegion", "Select Region")}
            </GlassButton>

            <GlassButton
              variant={isRunning ? "destructive" : "primary"}
              size="sm"
              icon={
                isRunning ? (
                  <Square className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )
              }
              onClick={onToggleContinuous}
            >
              {isRunning
                ? t("ocr.continuous.stopMonitoring", "Stop Monitoring")
                : t("ocr.continuous.startMonitoring", "Start Monitoring")}
            </GlassButton>

            {isRunning && (
              <GlassButton
                variant="glass"
                size="sm"
                icon={
                  continuousState === "paused" ? (
                    <Play className="w-3.5 h-3.5" />
                  ) : (
                    <Pause className="w-3.5 h-3.5" />
                  )
                }
                onClick={onPauseResumeContinuous}
              >
                {continuousState === "paused"
                  ? t("ocr.continuous.resume", "Resume")
                  : t("ocr.continuous.pause", "Pause")}
              </GlassButton>
            )}
          </div>
        </div>

        {/* Sliders for Performance & Deduplication */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-glass-border">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {t("ocr.continuous.interval", "Capture Interval")}
              </span>
              <span className="font-semibold text-foreground">
                {(intervalMs / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={500}
              max={5000}
              step={250}
              value={intervalMs}
              onChange={(e) => onIntervalMsChange(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/75">
              <span>{t("ocr.continuous.fast", "Fast (0.5s)")}</span>
              <span>{t("ocr.continuous.balanced", "Balanced (2.0s)")}</span>
              <span>{t("ocr.continuous.eco", "Eco (5.0s)")}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {t(
                  "ocr.continuous.sensitivity",
                  "Change Sensitivity Threshold",
                )}
              </span>
              <span className="font-semibold text-foreground">
                {Math.round(changeThreshold * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.05}
              value={changeThreshold}
              onChange={(e) => onChangeThresholdChange(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/75">
              <span>{t("ocr.continuous.sensitive", "Sensitive (5%)")}</span>
              <span>{t("ocr.continuous.normal", "Normal (15%)")}</span>
              <span>
                {t("ocr.continuous.distinct", "Distinct Only (50%)")}
              </span>
            </div>
          </div>
        </div>

        {/* Live Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
          <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              {t("ocr.continuous.state", "State")}
            </span>
            <p className="text-sm font-bold text-primary capitalize mt-0.5">
              {t(
                `ocr.continuous.states.${continuousState}`,
                continuousState,
              )}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              {t("ocr.continuous.framesScanned", "Frames Scanned")}
            </span>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {continuousStats.capturedCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              {t("ocr.continuous.translated", "Translated")}
            </span>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">
              {continuousStats.translatedCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              {t("ocr.continuous.duplicatesSkipped", "Duplicates Skipped")}
            </span>
            <p className="text-sm font-bold text-amber-400 mt-0.5">
              {continuousStats.skippedCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-glass border border-glass-border text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              {t("ocr.continuous.avgLatency", "Avg Latency")}
            </span>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {continuousStats.averageDurationMs}ms
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Continuous Live Translation Stream */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground">
          {t("ocr.continuous.streamChanges", "Detected Stream Changes")}
        </h4>
        {continuousHistory.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {continuousHistory.map((item) => (
              <GlassCard
                key={item.id}
                variant="subtle"
                className="p-3 text-xs space-y-1"
              >
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </span>
                  <span>
                    {Math.round(item.confidence * 100)}%{" "}
                    {t("ocr.editor.conf", "Conf")} • {item.durationMs}ms
                  </span>
                </div>
                <p className="text-muted-foreground font-mono text-[11px]">
                  {item.originalText}
                </p>
                <p className="text-foreground font-semibold text-xs text-primary">
                  {item.translatedText}
                </p>
              </GlassCard>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground bg-glass-subtle rounded-xl border border-glass-border">
            {t(
              "ocr.continuous.emptyStream",
              "Start continuous monitoring to view real-time text detections.",
            )}
          </div>
        )}
      </div>
    </div>
  );
};
