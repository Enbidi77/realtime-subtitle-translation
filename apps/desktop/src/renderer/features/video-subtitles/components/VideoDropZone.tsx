import React, { useState } from "react";
import { useVideoSubtitleStore } from "../stores/video-subtitle-store.js";
import { useI18n } from "@/app/i18n/index.js";
import { parseSubtitles } from "@echo-lingo/subtitle-core";
import { toMediaProtocolUrl } from "@echo-lingo/contracts";
import { createRendererLogger } from "@echo-lingo/logger";
import {
  UploadCloud,
  FileVideo,
  Sparkles,
  FileText,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  Loader2,
} from "lucide-react";

const log = createRendererLogger("VideoDropZone");

export const VideoDropZone: React.FC = () => {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);

  const videoMetadata = useVideoSubtitleStore((s) => s.videoMetadata);
  const isTranscribing = useVideoSubtitleStore((s) => s.isTranscribing);
  const transcribeProgress = useVideoSubtitleStore((s) => s.transcribeProgress);
  const transcriptionError = useVideoSubtitleStore((s) => s.transcriptionError);
  const sourceLang = useVideoSubtitleStore((s) => s.sourceLang);
  const targetLang = useVideoSubtitleStore((s) => s.targetLang);

  const openVideoDialog = useVideoSubtitleStore((s) => s.openVideoDialog);
  const startAutoTranscription = useVideoSubtitleStore(
    (s) => s.startAutoTranscription,
  );
  const setSegments = useVideoSubtitleStore((s) => s.setSegments);
  const setLanguages = useVideoSubtitleStore((s) => s.setLanguages);
  const setVideo = useVideoSubtitleStore((s) => s.setVideo);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] as any;
      if (file.path && window.electronAPI?.video) {
        try {
          const meta = await window.electronAPI.video.probeMetadata(file.path);
          setVideo(meta, meta.mediaUrl || toMediaProtocolUrl(file.path));
        } catch (err) {
          log.error("Error probing dropped video", err);
        }
      }
    }
  };

  const handleImportSubtitleFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const segs = parseSubtitles(content, file.name, {
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });
      if (segs.length > 0) {
        setSegments(segs);
      }
    } catch (err) {
      log.error("Failed to parse imported subtitle file", err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (!videoMetadata) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full py-12 px-6 rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
            : "border-white/10 hover:border-white/20 bg-glass-card/40 hover:bg-glass-card/60"
        }`}
        onClick={openVideoDialog}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-white/10 flex items-center justify-center text-blue-400 mb-4 shadow-lg">
          <UploadCloud className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t("video.dropzone.title", "Choose a video or drag it here")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {t(
            "video.dropzone.subtitle",
            "Supports MP4, MKV, MOV, WebM, AVI. Subtitle text will be placed directly in the video.",
          )}
        </p>
        <button
          type="button"
          className="mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600/80 hover:bg-blue-600 text-white transition-all shadow-md flex items-center gap-2"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          {t("video.dropzone.browse", "Browse Video File")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full glass-card p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Video Details */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <FileVideo className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4
              className="text-sm font-semibold text-foreground truncate"
              title={videoMetadata.fileName}
            >
              {videoMetadata.fileName}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span>
                {videoMetadata.width}x{videoMetadata.height}
              </span>
              <span>•</span>
              <span>{videoMetadata.fps.toFixed(0)} FPS</span>
              <span>•</span>
              <span>{formatFileSize(videoMetadata.fileSizeBytes)}</span>
              <span>•</span>
              <span className="uppercase">{videoMetadata.videoCodec}</span>
              {!videoMetadata.hasAudio && (
                <>
                  <span>•</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {t("video.noAudio", "No Audio")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Auto-Transcribe Button */}
          <button
            type="button"
            onClick={startAutoTranscription}
            disabled={isTranscribing || !videoMetadata.hasAudio}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 ${
              isTranscribing
                ? "bg-blue-600 text-white cursor-wait opacity-100"
                : !videoMetadata.hasAudio
                  ? "opacity-40 cursor-not-allowed bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer"
            }`}
            title={
              !videoMetadata.hasAudio
                ? t(
                    "video.noAudioTooltip",
                    "This video does not contain an audio track to transcribe.",
                  )
                : t(
                    "video.autoTranscribeTooltip",
                    "Extract audio and auto-transcribe with Whisper",
                  )
            }
          >
            {isTranscribing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>
                  {transcribeProgress
                    ? `${
                        transcribeProgress.phase === "translating"
                          ? "Translating"
                          : transcribeProgress.phase === "extracting"
                            ? "Extracting"
                            : "Transcribing"
                      } ${transcribeProgress.percent}%`
                    : "Transcribing..."}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Transcribe</span>
              </>
            )}
          </button>

          {/* Import Subtitle File */}
          <label className="px-3 py-1.5 rounded-xl text-xs font-medium bg-glass hover:bg-glass-subtle border border-white/10 hover:border-white/20 text-foreground transition-all flex items-center gap-1.5 cursor-pointer">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Import .SRT/.VTT</span>
            <input
              type="file"
              accept=".srt,.vtt,.txt"
              onChange={handleImportSubtitleFile}
              className="hidden"
            />
          </label>

          {/* Change Video */}
          <button
            type="button"
            onClick={openVideoDialog}
            className="px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-glass border border-transparent hover:border-white/10 transition-all flex items-center gap-1 cursor-pointer"
            title="Choose a different video file"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!videoMetadata.hasAudio && !transcriptionError && (
        <div className="w-full text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 mt-1 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {t(
              "video.noAudioHint",
              'This video does not have an audio track. You can add subtitles manually using "Add Cue Here" or import an existing .SRT / .VTT file.',
            )}
          </span>
        </div>
      )}

      {transcriptionError && (
        <div className="w-full text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mt-1 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{transcriptionError}</span>
        </div>
      )}
    </div>
  );
};
