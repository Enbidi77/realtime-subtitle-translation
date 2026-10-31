import React, { useState } from 'react';
import { useVideoSubtitleStore } from '../stores/video-subtitle-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { GlassModal } from '@/components/ui/GlassModal.js';
import { GlassCheckbox } from '@/components/ui/index.js';
import {
  Film,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  FileText,
  Check,
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
  const segments = useVideoSubtitleStore((s) => s.segments);
  const startExport = useVideoSubtitleStore((s) => s.startExport);
  const cancelExport = useVideoSubtitleStore((s) => s.cancelExport);
  const exportSubtitleFile = useVideoSubtitleStore((s) => s.exportSubtitleFile);

  const [activeTab, setActiveTab] = useState<'burn-in' | 'subtitle-file'>('burn-in');
  const [videoCodec, setVideoCodec] = useState<'libx264' | 'h264_nvenc'>('libx264');
  const [subtitleFormat, setSubtitleFormat] = useState<'srt' | 'vtt' | 'txt'>('srt');
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [fileExportSuccess, setFileExportSuccess] = useState<string | null>(null);

  if (!isExportModalOpen) return null;

  const handleStartBurnIn = () => {
    startExport(undefined, videoCodec);
  };

  const handleSaveSubtitleFile = async () => {
    setIsSavingFile(true);
    setFileExportSuccess(null);
    try {
      const ok = await exportSubtitleFile(subtitleFormat, includeOriginal);
      if (ok) {
        setFileExportSuccess(
          t('video.export.exportFileSuccess', 'Subtitle file saved successfully!')
        );
        setTimeout(() => setFileExportSuccess(null), 4000);
      }
    } finally {
      setIsSavingFile(false);
    }
  };

  const hasCues = segments.length > 0;

  return (
    <GlassModal
      isOpen={isExportModalOpen}
      onClose={() => {
        if (!isExporting) setExportModalOpen(false);
      }}
      title={t('video.export.modalTitle', 'Export Subtitles & Video')}
    >
      <div className="flex flex-col gap-4 py-2">
        {/* COMPLETED BURN-IN STATE */}
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
                    ? t('video.export.preparingStyles', 'Preparing Subtitle Styles...')
                    : t('video.export.burningSubtitles', 'Burning Subtitles into Video (FFmpeg)...')}
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
                  : t('video.export.startingEncoding', 'Starting encoding...')}
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
                <span>{t('video.export.cancelExport', 'Cancel Export')}</span>
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

            {!hasCues && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {t(
                    'video.export.noCuesWarning',
                    'No subtitle cues found in this video. Please auto-transcribe or add cues before exporting.'
                  )}
                </span>
              </div>
            )}

            {/* Mode Switch Tabs */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 border border-border dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('burn-in')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'burn-in'
                    ? 'bg-white dark:bg-white/15 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('video.export.modeBurnIn', 'Burn into Video (.MP4)')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subtitle-file')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'subtitle-file'
                    ? 'bg-white dark:bg-white/15 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t('video.export.modeFile', 'Subtitle File (.SRT / .VTT / .TXT)')}</span>
              </button>
            </div>

            {/* TAB 1: BURN-IN */}
            {activeTab === 'burn-in' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {t(
                    'video.export.modeBurnInDesc',
                    'Permanently burn styled subtitles into video frames using FFmpeg. Playable on any device.'
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-medium">
                      {t('video.export.encoderLabel', 'Video Encoder')}
                    </label>
                    <select
                      value={videoCodec}
                      onChange={(e) => setVideoCodec(e.target.value as any)}
                      className="bg-background/80 dark:bg-glass border border-input dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    >
                      <option value="libx264">
                        {t('video.export.codecCpu', 'x264 (CPU - Highest Quality & Compatibility)')}
                      </option>
                      <option value="h264_nvenc">
                        {t('video.export.codecNvenc', 'NVIDIA NVENC (Fast Hardware Acceleration)')}
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-medium">
                      {t('video.export.renderingLabel', 'Subtitle Rendering')}
                    </label>
                    <div className="bg-background/80 dark:bg-glass border border-input dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground">
                      {t('video.export.renderingHardsub', 'Hardsub (Burn directly on video frames)')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {t('video.export.cuesReady', '{count} subtitle cues ready').replace(
                      '{count}',
                      String(segments.length)
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-border dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setExportModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-glass border border-transparent transition-all cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartBurnIn}
                    disabled={!hasCues}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('video.export.startBurnIn', 'Start Burn-In & Export')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: STANDALONE SUBTITLE FILE */}
            {activeTab === 'subtitle-file' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {t(
                    'video.export.modeFileDesc',
                    'Export subtitles as standard files for VLC, media players, or video editors.'
                  )}
                </p>

                {fileExportSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{fileExportSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-medium">
                      {t('video.export.formatLabel', 'Subtitle File Format')}
                    </label>
                    <select
                      value={subtitleFormat}
                      onChange={(e) => setSubtitleFormat(e.target.value as any)}
                      className="bg-background/80 dark:bg-glass border border-input dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    >
                      <option value="srt">
                        {t('video.export.formatSrt', 'SRT - SubRip (.srt, Standard Player Format)')}
                      </option>
                      <option value="vtt">
                        {t('video.export.formatVtt', 'VTT - WebVTT (.vtt, HTML5 & Modern Web)')}
                      </option>
                      <option value="txt">
                        {t('video.export.formatTxt', 'TXT - Plain Text Transcript (.txt)')}
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="p-2 rounded-lg bg-background/80 dark:bg-glass border border-input dark:border-white/10 text-xs text-foreground">
                      <GlassCheckbox
                        checked={includeOriginal}
                        onChange={(e) => setIncludeOriginal(e.target.checked)}
                        size="sm"
                        label={t(
                          'video.export.includeOriginal',
                          'Include original language (Bilingual dual subtitles)'
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {t('video.export.cuesReady', '{count} subtitle cues ready').replace(
                      '{count}',
                      String(segments.length)
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-border dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setExportModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-glass border border-transparent transition-all cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSubtitleFile}
                    disabled={!hasCues || isSavingFile}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSavingFile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{t('video.export.exportFileButton', 'Save Subtitle File')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassModal>
  );
};

