import React, { useRef, useEffect, useState, useMemo } from "react";
import { useVideoSubtitleStore } from "../stores/video-subtitle-store.js";
import { formatDisplayTime } from "@echo-lingo/subtitle-core";
import { toMediaProtocolUrl } from "@echo-lingo/contracts";
import { createRendererLogger } from "@echo-lingo/logger";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  AlertCircle,
} from "lucide-react";

const log = createRendererLogger("VideoPlayerPreview");

export const VideoPlayerPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const videoFileUrl = useVideoSubtitleStore((s) => s.videoFileUrl);
  const videoMetadata = useVideoSubtitleStore((s) => s.videoMetadata);
  const currentTime = useVideoSubtitleStore((s) => s.currentTime);
  const duration = useVideoSubtitleStore((s) => s.duration);
  const isPlaying = useVideoSubtitleStore((s) => s.isPlaying);
  const segments = useVideoSubtitleStore((s) => s.segments);
  const style = useVideoSubtitleStore((s) => s.style);

  const setCurrentTime = useVideoSubtitleStore((s) => s.setCurrentTime);
  const setIsPlaying = useVideoSubtitleStore((s) => s.setIsPlaying);

  const [videoError, setVideoError] = useState<string | null>(null);

  // Compute URL guaranteed to use custom echolingo-media:// protocol with range seeking
  const effectiveVideoUrl = useMemo(() => {
    if (!videoFileUrl) return "";
    if (videoFileUrl.startsWith("file://")) {
      const rawPath = decodeURIComponent(
        videoFileUrl.replace(/^file:\/\/\/?/, ""),
      );
      return toMediaProtocolUrl(rawPath);
    }
    if (!videoFileUrl.includes("://")) {
      return toMediaProtocolUrl(videoFileUrl);
    }
    return videoFileUrl;
  }, [videoFileUrl]);

  useEffect(() => {
    setVideoError(null);
  }, [effectiveVideoUrl]);

  const handleVideoError = (
    e: React.SyntheticEvent<HTMLVideoElement, Event>,
  ) => {
    const mediaError = (e.target as HTMLVideoElement).error;
    let message = "Failed to load video preview.";
    if (mediaError) {
      switch (mediaError.code) {
        case mediaError.MEDIA_ERR_ABORTED:
          message = "Video playback aborted.";
          break;
        case mediaError.MEDIA_ERR_NETWORK:
          message = "Network error while loading video stream.";
          break;
        case mediaError.MEDIA_ERR_DECODE:
          message = "Video decoding failed or codec unsupported by browser.";
          break;
        case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = "Video format or codec not supported in HTML5 preview.";
          break;
        default:
          message = mediaError.message || "Unable to play video.";
      }
    }
    log.error("Video preview error", mediaError, effectiveVideoUrl);
    setVideoError(message);
  };

  // Sync external seek with video element
  useEffect(() => {
    if (
      videoRef.current &&
      Math.abs(videoRef.current.currentTime - currentTime) > 0.5
    ) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Find active segment for current playback time (in ms)
  const currentMs = currentTime * 1000;
  const activeSegment = segments.find(
    (s) => currentMs >= s.startTime && currentMs <= s.endTime,
  );

  // Build CSS text stroke / shadow to mirror ASS outline
  const outlinePx = style.outlineWidth || 0;
  const outlineColor = style.outlineColor || "#000000";
  const shadowPx = style.shadowDistance || 0;
  const shadowColor = style.shadowColor || "transparent";

  let textShadowCss = "none";
  if (outlinePx > 0 && !style.backgroundBox) {
    textShadowCss = `
      -${outlinePx}px -${outlinePx}px 0 ${outlineColor},
       ${outlinePx}px -${outlinePx}px 0 ${outlineColor},
      -${outlinePx}px  ${outlinePx}px 0 ${outlineColor},
       ${outlinePx}px  ${outlinePx}px 0 ${outlineColor},
       ${shadowPx}px ${shadowPx}px ${shadowPx * 2}px ${shadowColor}
    `;
  }

  // Position alignment mapping
  const alignmentClass =
    style.alignment === "top-center"
      ? "top-4 left-1/2 -translate-x-1/2 text-center"
      : style.alignment === "top-left"
        ? "top-4 left-6 text-left"
        : style.alignment === "middle-center"
          ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
          : style.alignment === "bottom-left"
            ? "bottom-16 left-6 text-left"
            : style.alignment === "bottom-right"
              ? "bottom-16 right-6 text-right"
              : "bottom-16 left-1/2 -translate-x-1/2 text-center";

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black/90 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col group select-none"
    >
      {/* HTML5 Video Element */}
      {effectiveVideoUrl ? (
        <video
          ref={videoRef}
          src={effectiveVideoUrl}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
          <p className="text-sm font-medium text-slate-300">No video loaded</p>
          <p className="text-xs text-slate-500 mt-1">
            Select a video file to begin subtitling
          </p>
        </div>
      )}

      {/* Video Decode Error Banner */}
      {videoError && (
        <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-2 animate-pulse" />
          <p className="text-sm font-semibold text-white">{videoError}</p>
          <p className="text-xs text-slate-300 mt-1 max-w-md">
            The video could not be decoded by the browser preview.
            Auto-transcription and FFmpeg subtitle export will still function
            normally.
          </p>
        </div>
      )}

      {/* Styled Subtitle Preview Overlay */}
      {activeSegment && effectiveVideoUrl && !videoError && (
        <div
          className={`absolute pointer-events-none transition-all duration-75 max-w-[85%] z-20 ${alignmentClass}`}
          style={{
            bottom: style.alignment.startsWith("bottom")
              ? `${style.verticalMargin}px`
              : undefined,
            top: style.alignment.startsWith("top")
              ? `${style.verticalMargin}px`
              : undefined,
          }}
        >
          <div
            className={`inline-block transition-all duration-100 ${
              style.backgroundBox ? "px-4 py-2 rounded-xl backdrop-blur-md" : ""
            }`}
            style={{
              backgroundColor: style.backgroundBox
                ? style.backgroundColor
                : "transparent",
              fontFamily: style.fontFamily,
              fontWeight: style.bold ? "bold" : "normal",
              fontStyle: style.italic ? "italic" : "normal",
              textShadow: textShadowCss,
            }}
          >
            {/* Bilingual Mode */}
            {style.layoutMode === "bilingual-stacked" &&
            style.showOriginal &&
            style.showTranslation &&
            activeSegment.originalText &&
            Object.values(activeSegment.translations)[0] ? (
              <div className="space-y-1 max-w-full text-center">
                <div
                  className="break-words whitespace-pre-wrap max-w-full"
                  style={{
                    color: style.primaryColor,
                    fontSize: `${style.fontSize}px`,
                    lineHeight: 1.25,
                  }}
                >
                  {activeSegment.originalText}
                </div>
                <div
                  className="break-words whitespace-pre-wrap max-w-full"
                  style={{
                    color: style.secondaryColor,
                    fontSize: `${Math.round(style.fontSize * 0.85)}px`,
                    lineHeight: 1.25,
                  }}
                >
                  {activeSegment.translations[
                    style.translationLanguage || ""
                  ] || Object.values(activeSegment.translations)[0]}
                </div>
              </div>
            ) : (
              /* Single Line Mode */
              <div
                className="break-words whitespace-pre-wrap max-w-full text-center"
                style={{
                  color: style.primaryColor,
                  fontSize: `${style.fontSize}px`,
                  lineHeight: 1.25,
                }}
              >
                {style.showTranslation &&
                Object.values(activeSegment.translations)[0]
                  ? activeSegment.translations[
                      style.translationLanguage || ""
                    ] || Object.values(activeSegment.translations)[0]
                  : activeSegment.originalText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Controls Bar */}
      {effectiveVideoUrl && !videoError && (
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex flex-col gap-2 z-30">
          {/* Progress / Seek bar */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/20 hover:bg-white/30 rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all"
          />

          <div className="flex items-center justify-between text-xs text-white/90">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
              </button>

              <span className="font-mono text-[11px] text-white/80">
                {formatDisplayTime(currentTime * 1000)} /{" "}
                {formatDisplayTime(duration * 1000)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {videoMetadata && (
                <span className="text-[10px] text-white/50 hidden sm:inline-block">
                  {videoMetadata.width}x{videoMetadata.height} •{" "}
                  {videoMetadata.fps.toFixed(0)}fps
                </span>
              )}
              <button
                type="button"
                onClick={toggleFullScreen}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
