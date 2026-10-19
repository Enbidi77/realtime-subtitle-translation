import React, { useState } from 'react';
import { useVideoSubtitleStore } from '../stores/video-subtitle-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { GlassModal } from '@/components/ui/GlassModal.js';
import {
  Film,
  Download,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Play,
  Loader2,
  XCircle,
} from 'lucide-react';

export const VideoExportModal: React.FC = () => {
  const { t } = useI18n();

  const isExportModalOpen = useVideoSubtitleStore((s) => s.isExportModalOpen);
  const setExportModalOpen = useVideoSubtitleStore((s) => s.setExportModalOpen);
  const isExporting = useVideoSubtitleStore((s) => s.isExporting);
  const exportProgress = useVideoSubtitleStore((s) => s.exportProgress);
  const exportResult = useVideoSubtitleStore((s) => s.exportResult);
  const exportError = useVideoSubtitleStore((s) => s.exportError);
  const videoMetadata = useVideoSubtitleStore((s) => s.videoMetadata);
  const startExport = useVideoSubtitleStore((s) => s.startExport);
  const cancelExport = useVideoSubtitleStore((s) => s.cancelExport);

  const [videoCodec, setVideoCodec] = useState<'libx264' | 'h264_nvenc'>('libx264');

  if (!isExportModalOpen) return null;

  const handleStart = () => {
    startExport(undefined, videoCodec);
  };

  const handleOpenFolder = () => {
    if (exportResult?.outputPath && window.electronAPI?.app) {
      // open containing path or logs
    }
  };

  return (
    <GlassModal
      isOpen={isExportModalOpen}
      onClose={() => {
        if (!isExporting) setExportModalOpen(false);
      }}
      title={t('video.export.modalTitle', 'Export Subtitled Video')}
    >
      <div className="flex flex-col gap-5 py-2">
        {/* COMPLETED STATE */}
        {exportResult ? (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t('video.export.success', 'Video Subtitles Burned Successfully!')}
              </h3>
              <p className="text-xs text-foreground font-mono break-all bg-muted/60 dark:bg-black/30 p-2 rounded-lg border border-border dark:border-white/5 mt-2">
                {exportResult.outputPath}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md cursor-pointer"
              >
                {t('common.done', 'Done')}
              </button>
            </div>
          </div>
        ) : isExporting ? (
          /* EXPORTING STATE */
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-foreground">
                  {exportProgress?.phase === 'generating-ass'
                    ? 'Preparing Subtitle Styles...'
                    : 'Burning Subtitles into Video (FFmpeg)...'}
                </span>
              </div>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                {exportProgress?.progressPercent || 0}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-border dark:border-white/10 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${exportProgress?.progressPercent || 0}%` }}
              />
            </div>

            {/* Details */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>
                {exportProgress?.currentTimeSeconds
                  ? `Time: ${Math.round(exportProgress.currentTimeSeconds)}s / ${Math.round(
                      exportProgress.totalDurationSeconds
                    )}s`
                  : 'Starting encoding...'}
              </span>
              {exportProgress?.estimatedSecondsRemaining && (
                <span>ETA: ~{exportProgress.estimatedSecondsRemaining}s</span>
              )}
            </div>

            {/* Cancel Button */}
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={cancelExport}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Export</span>
              </button>
            </div>
          </div>
        ) : (
          /* IDLE / SETUP STATE */
          <div className="flex flex-col gap-4">
            {exportError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {t(
                'video.export.description',
                'This will permanently burn your styled subtitles into the video frames using FFmpeg. The output video can be played on any player or shared to social media with subtitles visible.'
              )}
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground font-medium">Video Encoder</label>
                <select
                  value={videoCodec}
                  onChange={(e) => setVideoCodec(e.target.value as any)}
                  className="bg-background/80 dark:bg-glass border border-input dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-blue-500"
                >
                  <option value="libx264">x264 (CPU - Highest Quality & Compatibility)</option>
                  <option value="h264_nvenc">NVIDIA NVENC (Fast Hardware Acceleration)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground font-medium">Subtitle Rendering</label>
                <div className="bg-background/80 dark:bg-glass border border-input dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground">
                  Hardsub (Burn directly on video frames)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-glass border border-transparent transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStart}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Start Burn-In & Export</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  );
};

