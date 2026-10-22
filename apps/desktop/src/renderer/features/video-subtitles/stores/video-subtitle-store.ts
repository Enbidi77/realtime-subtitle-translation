import { create } from "zustand";
import {
  VideoMetadata,
  SubtitleSegment,
  SubtitleStyleOptions,
  VideoExportOptions,
  VideoExportMode,
  VideoExportProgress,
  VideoTranscribeProgress,
  toMediaProtocolUrl,
} from "@echo-lingo/contracts";
import {
  exportToSrt,
  exportToVtt,
  exportToTxt,
} from "@echo-lingo/subtitle-core";
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_STYLE_PRESETS,
} from "@echo-lingo/config";
import { createRendererLogger } from "@echo-lingo/logger";

const log = createRendererLogger("VideoSubtitleStore");

interface VideoSubtitleState {
  // Video Ingestion
  videoMetadata: VideoMetadata | null;
  videoFileUrl: string | null;
  duration: number; // in seconds
  currentTime: number; // in seconds
  isPlaying: boolean;

  // Subtitles
  segments: SubtitleSegment[];
  selectedSegmentId: string | null;

  // Languages
  sourceLang: string;
  targetLang: string;

  // Visual Styles
  style: SubtitleStyleOptions;
  selectedPreset: string;

  // Background Operations
  isTranscribing: boolean;
  transcriptionError: string | null;
  transcribeProgress: VideoTranscribeProgress | null;
  isExporting: boolean;
  isExportModalOpen: boolean;
  exportProgress: VideoExportProgress | null;
  exportResult: { outputPath: string } | null;
  exportError: string | null;
  activeJobId: string | null;

  // System Checks
  ffmpegAvailable: boolean | null;
  ffmpegPath: string | null;
  isInstallingFfmpeg: boolean;
  installFfmpegError: string | null;

  // Actions
  installFfmpeg: () => Promise<void>;
  setVideo: (meta: VideoMetadata | null, fileUrl: string | null) => void;
  setCurrentTime: (timeSec: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSegments: (segments: SubtitleSegment[]) => void;
  updateSegment: (id: string, updates: Partial<SubtitleSegment>) => void;
  addSegment: (segment: SubtitleSegment) => void;
  removeSegment: (id: string) => void;
  selectSegment: (id: string | null) => void;
  setStyle: (style: SubtitleStyleOptions) => void;
  updateStyle: (updates: Partial<SubtitleStyleOptions>) => void;
  applyPreset: (presetId: string) => void;
  setLanguages: (sourceLang: string, targetLang: string) => void;
  setExportModalOpen: (open: boolean) => void;
  checkFfmpeg: () => Promise<void>;
  openVideoDialog: () => Promise<void>;
  startAutoTranscription: () => Promise<void>;
  startExport: (
    outputCustomPath?: string,
    videoCodec?: any,
    exportMode?: VideoExportMode,
  ) => Promise<void>;
  exportSubtitleFile: (
    format?: "srt" | "vtt" | "txt",
    includeOriginal?: boolean,
  ) => Promise<boolean>;
  cancelExport: () => Promise<void>;
  reset: () => void;
}

export const useVideoSubtitleStore = create<VideoSubtitleState>((set, get) => ({
  videoMetadata: null,
  videoFileUrl: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,

  segments: [],
  selectedSegmentId: null,

  sourceLang: "auto",
  targetLang: "vi",

  style: { ...DEFAULT_SUBTITLE_STYLE },
  selectedPreset: "default",

  isTranscribing: false,
  transcriptionError: null,
  transcribeProgress: null,
  isExporting: false,
  isExportModalOpen: false,
  exportProgress: null,
  exportResult: null,
  exportError: null,
  activeJobId: null,

  ffmpegAvailable: null,
  ffmpegPath: null,

  setVideo: (meta, fileUrl) => {
    const prevUrl = get().videoFileUrl;
    if (prevUrl && prevUrl.startsWith("blob:")) {
      URL.revokeObjectURL(prevUrl);
    }
    const resolvedUrl =
      fileUrl ||
      meta?.mediaUrl ||
      (meta ? toMediaProtocolUrl(meta.filePath) : null);
    set({
      videoMetadata: meta,
      videoFileUrl: resolvedUrl,
      duration: meta?.durationSeconds || 0,
      currentTime: 0,
      isPlaying: false,
      selectedSegmentId: null,
    });
  },

  setCurrentTime: (timeSec) => set({ currentTime: timeSec }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setSegments: (segments) => set({ segments }),

  updateSegment: (id, updates) => {
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s,
      ),
    }));
  },

  addSegment: (segment) => {
    set((state) => ({
      segments: [...state.segments, segment].sort(
        (a, b) => a.startTime - b.startTime,
      ),
    }));
  },

  removeSegment: (id) => {
    set((state) => ({
      segments: state.segments.filter((s) => s.id !== id),
      selectedSegmentId:
        state.selectedSegmentId === id ? null : state.selectedSegmentId,
    }));
  },

  selectSegment: (id) => set({ selectedSegmentId: id }),

  setStyle: (style) => set({ style }),

  updateStyle: (updates) => {
    set((state) => ({
      style: { ...state.style, ...updates },
      selectedPreset: "custom",
    }));
  },

  applyPreset: (presetId) => {
    const preset = SUBTITLE_STYLE_PRESETS[presetId];
    if (preset) {
      set({
        style: { ...preset.style },
        selectedPreset: presetId,
      });
    }
  },

  setLanguages: (sourceLang, targetLang) => set({ sourceLang, targetLang }),

  setExportModalOpen: (open) => set({ isExportModalOpen: open }),

  isInstallingFfmpeg: false,
  installFfmpegError: null,

  installFfmpeg: async () => {
    if (!window.electronAPI?.video?.installFfmpeg) return;
    set({ isInstallingFfmpeg: true, installFfmpegError: null });
    try {
      const res = await window.electronAPI.video.installFfmpeg();
      if (res.success) {
        set({
          ffmpegAvailable: true,
          ffmpegPath: res.path,
          isInstallingFfmpeg: false,
        });
      } else {
        set({
          isInstallingFfmpeg: false,
          installFfmpegError:
            "Installation completed but FFmpeg was not verified.",
        });
      }
    } catch (err: any) {
      set({
        isInstallingFfmpeg: false,
        installFfmpegError: err.message || "Failed to install FFmpeg",
      });
    }
  },

  checkFfmpeg: async () => {
    if (!window.electronAPI?.video) return;
    try {
      const res = await window.electronAPI.video.checkFfmpeg();
      set({ ffmpegAvailable: res.available, ffmpegPath: res.path });
    } catch {
      set({ ffmpegAvailable: false, ffmpegPath: null });
    }
  },

  openVideoDialog: async () => {
    if (!window.electronAPI?.video) return;
    try {
      const meta = await window.electronAPI.video.openFileDialog();
      if (!meta) return;

      const mediaUrl = meta.mediaUrl || toMediaProtocolUrl(meta.filePath);
      get().setVideo(meta, mediaUrl);
      get().checkFfmpeg();
    } catch (err: any) {
      log.error("Failed to open video", err);
    }
  },

  startAutoTranscription: async () => {
    const { videoMetadata, sourceLang, targetLang } = get();
    if (!videoMetadata || !window.electronAPI?.video) return;

    if (!videoMetadata.hasAudio) {
      set({
        transcriptionError:
          'This video does not contain an audio track. You can add subtitle cues manually using "Add Cue Here" or import an existing .SRT / .VTT file.',
        isTranscribing: false,
      });
      return;
    }

    set({
      isTranscribing: true,
      transcriptionError: null,
      transcribeProgress: {
        phase: "extracting",
        percent: 5,
        detail: "Preparing audio extraction...",
      },
    });

    const unsubscribeProgress = window.electronAPI.video.onTranscribeProgress?.(
      (progress) => {
        set({ transcribeProgress: progress });
      },
    );

    try {
      const segs = await window.electronAPI.video.extractAudio(
        videoMetadata.filePath,
        sourceLang,
        targetLang,
      );
      set({
        segments: segs,
        isTranscribing: false,
        transcribeProgress: null,
      });

      // Preserve video playback position if user is already playing or has scrubbed forward
      if (segs.length > 0) {
        const { currentTime, isPlaying } = get();
        if (!isPlaying && currentTime <= 2) {
          get().setCurrentTime(segs[0].startTime / 1000);
        }
        const currentMs = currentTime * 1000;
        const matchingSeg = segs.find(
          (s) => currentMs >= s.startTime && currentMs <= s.endTime,
        );
        get().selectSegment(matchingSeg ? matchingSeg.id : segs[0].id);
      }
    } catch (err: any) {
      log.error("Transcription error", err);
      let message = err.message || "Transcription failed";
      if (
        message.includes("Output file does not contain any stream") ||
        message.includes("does not contain an audio")
      ) {
        message =
          "The selected video does not contain an audio track to transcribe.";
      }
      set({
        isTranscribing: false,
        transcribeProgress: null,
        transcriptionError: message,
      });
    } finally {
      unsubscribeProgress?.();
    }
  },

  startExport: async (
    outputCustomPath,
    videoCodec,
    exportMode = "hardsub-burnin",
  ) => {
    const { videoMetadata, segments, style } = get();
    if (!videoMetadata || !window.electronAPI?.video) return;

    if (segments.length === 0) {
      set({
        isExportModalOpen: true,
        exportError:
          "No subtitle cues available to export. Please auto-transcribe or add cues first.",
      });
      return;
    }

    let targetOut = outputCustomPath;
    if (!targetOut) {
      const defaultName = `${videoMetadata.fileName.replace(/\.[^/.]+$/, "")}_subtitled.mp4`;
      const picked = await window.electronAPI.video.saveFileDialog(defaultName);
      if (!picked) return;
      targetOut = picked;
    }

    set({
      isExporting: true,
      isExportModalOpen: true,
      exportProgress: {
        jobId: "init",
        phase: "generating-ass",
        progressPercent: 0,
        totalDurationSeconds: videoMetadata.durationSeconds,
      },
      exportResult: null,
      exportError: null,
    });

    // Subscribe to progress
    const unsub = window.electronAPI.video.onExportProgress((p) => {
      set({ exportProgress: p, activeJobId: p.jobId });
      if (p.phase === "completed") {
        set({ isExporting: false, exportResult: { outputPath: targetOut! } });
      } else if (p.phase === "failed") {
        set({
          isExporting: false,
          exportError: p.errorMessage || "Export failed",
        });
      } else if (p.phase === "cancelled") {
        set({ isExporting: false });
      }
    });

    try {
      const options: VideoExportOptions = {
        inputVideoPath: videoMetadata.filePath,
        outputVideoPath: targetOut,
        segments,
        style,
        exportMode,
        videoCodec: videoCodec || "libx264",
        audioCodec: "copy",
        qualityPreset: "veryfast",
        crf: 21,
      };

      const result = await window.electronAPI.video.startExport(options);
      set({ isExporting: false, exportResult: result });
    } catch (err: any) {
      if (err.message !== "Export was cancelled by user.") {
        set({
          isExporting: false,
          exportError: err.message || "Export failed",
        });
      }
    } finally {
      unsub();
    }
  },

  exportSubtitleFile: async (
    format: "srt" | "vtt" | "txt" = "srt",
    includeOriginal = true,
  ) => {
    const { videoMetadata, segments, targetLang } = get();
    if (segments.length === 0) {
      alert("No subtitle cues available to export.");
      return false;
    }

    let content = "";
    if (format === "vtt") {
      content = exportToVtt(segments, {
        includeOriginal,
        targetLanguage: targetLang,
      });
    } else if (format === "txt") {
      content = exportToTxt(segments, {
        includeOriginal,
        targetLanguage: targetLang,
      });
    } else {
      content = exportToSrt(segments, {
        includeOriginal,
        targetLanguage: targetLang,
      });
    }

    const baseName = videoMetadata?.fileName
      ? videoMetadata.fileName.replace(/\.[^/.]+$/, "")
      : "subtitles";
    const defaultName = `${baseName}.${format}`;

    if (window.electronAPI?.sessions?.saveExportFile) {
      const res = await window.electronAPI.sessions.saveExportFile(
        content,
        defaultName,
        format,
      );
      return Boolean(res?.success);
    } else {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    }
  },

  cancelExport: async () => {
    const { activeJobId } = get();
    if (activeJobId && window.electronAPI?.video) {
      await window.electronAPI.video.cancelExport(activeJobId);
      set({ isExporting: false, activeJobId: null });
    }
  },

  reset: () => {
    const prevUrl = get().videoFileUrl;
    if (prevUrl && prevUrl.startsWith("blob:")) {
      URL.revokeObjectURL(prevUrl);
    }
    set({
      videoMetadata: null,
      videoFileUrl: null,
      duration: 0,
      currentTime: 0,
      isPlaying: false,
      segments: [],
      selectedSegmentId: null,
      isTranscribing: false,
      transcriptionError: null,
      isExporting: false,
      exportProgress: null,
      exportResult: null,
      exportError: null,
    });
  },
}));
