import React, { useEffect } from 'react';
import { useVideoSubtitleStore } from './stores/video-subtitle-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { VideoDropZone } from './components/VideoDropZone.js';
import { VideoPlayerPreview } from './components/VideoPlayerPreview.js';
import { SubtitleStyleBar } from './components/SubtitleStyleBar.js';
import { SubtitleCueList } from './components/SubtitleCueList.js';
import { VideoExportModal } from './components/VideoExportModal.js';
import {
  Film,
  Download,
  AlertCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react';

export const VideoSubtitlesView: React.FC = () => {
  const { t } = useI18n();

  const videoMetadata = useVideoSubtitleStore((s) => s.videoMetadata);
  const segments = useVideoSubtitleStore((s) => s.segments);
  const ffmpegAvailable = useVideoSubtitleStore((s) => s.ffmpegAvailable);
  const isInstallingFfmpeg = useVideoSubtitleStore((s) => s.isInstallingFfmpeg);
  const installFfmpegError = useVideoSubtitleStore((s) => s.installFfmpegError);
  const installFfmpeg = useVideoSubtitleStore((s) => s.installFfmpeg);
  const checkFfmpeg = useVideoSubtitleStore((s) => s.checkFfmpeg);
  const setExportModalOpen = useVideoSubtitleStore((s) => s.setExportModalOpen);

  useEffect(() => {
    checkFfmpeg();
  }, [checkFfmpeg]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('video.title', 'Video Subtitle Studio')}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              'video.subtitle',
              'Transcribe, translate, customize visual styles, and burn subtitles directly onto video frames.'
            )}
          </p>
        </div>

        {videoMetadata && (
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t('video.exportButton', 'Export Subtitled Video')}</span>
          </button>
        )}
      </div>

      {/* FFmpeg Warning Banner if Missing */}
      {ffmpegAvailable === false && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">
                {t('video.ffmpegMissing.title', 'FFmpeg Not Detected')}
              </p>
              <p className="text-amber-200/80 leading-relaxed max-w-xl">
                {t(
                  'video.ffmpegMissing.desc',
                  'Video audio extraction and subtitle burn-in require FFmpeg. Click Auto-Install to download and configure it to your PATH automatically.'
                )}
              </p>
              {installFfmpegError && (
                <p className="text-rose-400 font-medium text-[11px]">{installFfmpegError}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={installFfmpeg}
            disabled={isInstallingFfmpeg}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isInstallingFfmpeg ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>{t('video.installingFfmpeg', 'Installing FFmpeg...')}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{t('video.autoInstallFfmpeg', 'Auto-Install FFmpeg')}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Drop Zone / Metadata Ingestion */}
      <VideoDropZone />

      {/* Main Studio View when Video is Loaded */}
      {videoMetadata && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Player Preview & Style Controls (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <VideoPlayerPreview />
            <SubtitleStyleBar />
          </div>

          {/* Right Column: Subtitle Timeline Editor (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <SubtitleCueList />
          </div>
        </div>
      )}

      {/* Export Modal */}
      <VideoExportModal />
    </div>
  );
};

