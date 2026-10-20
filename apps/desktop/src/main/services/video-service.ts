import { execFile, spawn, ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { app, BrowserWindow, dialog } from "electron";
import { createLogger, ILogger } from "@echo-lingo/logger";
import {
  VideoMetadata,
  VideoExportOptions,
  VideoExportProgress,
  VideoTranscribeProgress,
  SubtitleSegment,
  SubtitleStyleOptions,
  toMediaProtocolUrl,
} from "@echo-lingo/contracts";
import { generateAssScript } from "@echo-lingo/subtitle-core";
import { parseSrt } from "@echo-lingo/subtitle-core";
import { getSpeechService } from "./speech-service.js";
import { getTranslationService } from "./translation-service.js";
import { LocalWhisperProvider } from "@echo-lingo/provider-adapters";
import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export interface ActiveVideoJob {
  jobId: string;
  process: ChildProcess;
  tempFiles: string[];
  cancelled: boolean;
}

export class VideoService {
  private static instance: VideoService | null = null;
  private readonly log: ILogger = createLogger("VideoService");
  private ffmpegBinaryPath: string | null = null;
  private ffprobeBinaryPath: string | null = null;
  private activeJobs = new Map<string, ActiveVideoJob>();

  public static getInstance(): VideoService {
    if (!VideoService.instance) {
      VideoService.instance = new VideoService();
    }
    return VideoService.instance;
  }

  constructor() {
    this.resolveFfmpegBinary();
    this.resolveFfprobeBinary();
  }

  /**
   * Resolve FFmpeg binary from environment, ffmpeg-static package, resources, or system PATH
   */
  public resolveFfmpegBinary(): string | null {
    if (this.ffmpegBinaryPath && fs.existsSync(this.ffmpegBinaryPath)) {
      return this.ffmpegBinaryPath;
    }

    const exeName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const candidates: string[] = [];

    // 1. Environment variable override
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      candidates.push(process.env.FFMPEG_PATH);
    }

    // 2. ffmpeg-static bundled package binary
    try {
      const staticPath = (
        typeof ffmpegStatic === "string"
          ? ffmpegStatic
          : (ffmpegStatic as any)?.default
      ) as string | null;
      if (staticPath) {
        // In packaged Electron apps, unpacked binaries reside in app.asar.unpacked
        const unpackedStatic = staticPath.replace(
          "app.asar",
          "app.asar.unpacked",
        );
        candidates.push(unpackedStatic);
        candidates.push(staticPath);
      }
    } catch {
      // ignore
    }

    // 3. Electron resources directory
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "bin", exeName));
      candidates.push(path.join(process.resourcesPath, exeName));
    }

    // 4. User data / local echo-lingo bin directory
    try {
      if (app && typeof app.getPath === "function") {
        candidates.push(path.join(app.getPath("userData"), "bin", exeName));
      }
    } catch {
      // ignore outside electron
    }
    candidates.push(path.join(os.homedir(), ".echo-lingo", "bin", exeName));

    for (const p of candidates) {
      if (p && fs.existsSync(p)) {
        this.ffmpegBinaryPath = p;
        this.log.info(`Resolved FFmpeg binary: ${p}`);
        return p;
      }
    }

    // 5. System PATH check
    const pathDirs = (process.env.PATH || "").split(path.delimiter);
    for (const dir of pathDirs) {
      const fullPath = path.join(dir, exeName);
      if (fs.existsSync(fullPath)) {
        this.ffmpegBinaryPath = fullPath;
        this.log.info(`Resolved system FFmpeg binary: ${fullPath}`);
        return fullPath;
      }
    }

    this.log.warn(
      "FFmpeg binary could not be resolved in static package or local/system paths.",
    );
    return null;
  }

  /**
   * Resolve FFprobe binary
   */
  public resolveFfprobeBinary(): string | null {
    if (this.ffprobeBinaryPath && fs.existsSync(this.ffprobeBinaryPath)) {
      return this.ffprobeBinaryPath;
    }

    const exeName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const candidates: string[] = [];

    if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
      candidates.push(process.env.FFPROBE_PATH);
    }

    try {
      if (app && typeof app.getPath === "function") {
        candidates.push(path.join(app.getPath("userData"), "bin", exeName));
      }
    } catch {
      // ignore
    }
    candidates.push(path.join(os.homedir(), ".echo-lingo", "bin", exeName));

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "bin", exeName));
    }

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.ffprobeBinaryPath = p;
        return p;
      }
    }

    const pathDirs = (process.env.PATH || "").split(path.delimiter);
    for (const dir of pathDirs) {
      const fullPath = path.join(dir, exeName);
      if (fs.existsSync(fullPath)) {
        this.ffprobeBinaryPath = fullPath;
        return fullPath;
      }
    }

    return null;
  }

  public isFfmpegAvailable(): boolean {
    return !!this.resolveFfmpegBinary();
  }

  public checkFfmpeg(): { available: boolean; path: string | null } {
    return {
      available: this.isFfmpegAvailable(),
      path: this.resolveFfmpegBinary(),
    };
  }

  public async openVideoFileDialog(
    win?: BrowserWindow | null,
  ): Promise<VideoMetadata | null> {
    const result = await dialog.showOpenDialog(win || (undefined as any), {
      title: "Select Video File",
      properties: ["openFile"],
      filters: [
        {
          name: "Video Files",
          extensions: ["mp4", "mkv", "mov", "webm", "avi", "wmv", "flv"],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    try {
      return await this.probeMetadata(filePath);
    } catch (err: any) {
      this.log.error("Failed to probe video metadata:", err);
      throw err;
    }
  }

  public async saveVideoFileDialog(
    win?: BrowserWindow | null,
    defaultName?: string,
  ): Promise<string | null> {
    const result = await dialog.showSaveDialog(win || (undefined as any), {
      title: "Save Subtitled Video",
      defaultPath: defaultName || "subtitled_video.mp4",
      filters: [
        { name: "MP4 Video", extensions: ["mp4"] },
        { name: "MKV Video", extensions: ["mkv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    return result.canceled ? null : result.filePath;
  }

  /**
   * Verify and resolve FFmpeg binary provided statically via ffmpeg-static or environment
   */
  public async downloadAndInstallFfmpeg(
    onProgress?: (progressPercent: number) => void,
  ): Promise<{ success: boolean; path: string }> {
    const resolved = this.resolveFfmpegBinary();
    if (resolved) {
      if (onProgress) onProgress(100);
      return { success: true, path: resolved };
    }
    throw new Error(
      "FFmpeg binary could not be found. Please ensure ffmpeg-static is installed or set FFMPEG_PATH.",
    );
  }

  /**
   * Inspect video metadata (resolution, duration, FPS, codecs, audio tracks)
   */
  public async probeMetadata(videoPath: string): Promise<VideoMetadata> {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file does not exist: ${videoPath}`);
    }

    const stats = await fsp.stat(videoPath);
    const fileName = path.basename(videoPath);
    const ffmpegBin = this.resolveFfmpegBinary();

    if (!ffmpegBin) {
      throw new Error("FFmpeg binary is required to inspect video metadata.");
    }

    // Run ffmpeg -i "<videoPath>" to extract stream headers
    let stderr = "";
    try {
      await execFileAsync(ffmpegBin, ["-i", videoPath]);
    } catch (err: any) {
      // FFmpeg returns exit code 1 when invoked with just -i without output
      stderr = err.stderr || err.message || "";
    }

    // 1. Duration (Duration: 00:01:23.45)
    let durationSeconds = 0;
    const durMatch = stderr.match(
      /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i,
    );
    if (durMatch) {
      const hours = parseInt(durMatch[1], 10);
      const mins = parseInt(durMatch[2], 10);
      const secs = parseFloat(durMatch[3]);
      durationSeconds = hours * 3600 + mins * 60 + secs;
    }

    // 2. Video Stream (e.g. Video: h264 (Main) (avc1), yuv420p(tv, bt709, progressive), 640x360 [SAR 1:1 DAR 16:9], 29.97 fps)
    let width = 1920;
    let height = 1080;
    let fps = 30;
    let videoCodec = "unknown";

    const vidLineMatch = stderr.match(/Video:\s*([^\n\r]+)/i);
    if (vidLineMatch) {
      const vidLine = vidLineMatch[1];
      const codecMatch = vidLine.split(/[\s,]+/)[0];
      if (codecMatch) videoCodec = codecMatch;
      const resMatch = vidLine.match(/\b(\d{2,5})x(\d{2,5})\b/);
      if (resMatch) {
        width = parseInt(resMatch[1], 10) || 1920;
        height = parseInt(resMatch[2], 10) || 1080;
      }
      const fpsMatch = vidLine.match(/(\d+(?:\.\d+)?)\s*fps/i);
      if (fpsMatch) {
        fps = parseFloat(fpsMatch[1]) || 30;
      }
    }

    // 3. Audio Stream (e.g. Audio: aac (LC) (mp4a), 48000 Hz, stereo, fltp, 128 kb/s)
    let hasAudio = false;
    let audioCodec: string | undefined;
    let audioChannels: number | undefined;

    const audLineMatch = stderr.match(/Audio:\s*([^\n\r]+)/i);
    if (audLineMatch) {
      hasAudio = true;
      const audLine = audLineMatch[1];
      audioCodec = audLine.split(/[\s,]+/)[0];
      if (audLine.includes("stereo")) audioChannels = 2;
      else if (audLine.includes("mono")) audioChannels = 1;
      else if (audLine.includes("5.1")) audioChannels = 6;
      else audioChannels = 2;
    }

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const aspectRatio = `${width / divisor}:${height / divisor}`;

    return {
      filePath: videoPath,
      mediaUrl: toMediaProtocolUrl(videoPath),
      fileName,
      fileSizeBytes: stats.size,
      durationSeconds,
      width,
      height,
      aspectRatio,
      fps,
      videoCodec,
      audioCodec,
      audioChannels,
      hasAudio,
    };
  }

  /**
   * Extract audio from video as a 16kHz mono WAV suitable for speech transcription
   */
  public async extractAudio(
    videoPath: string,
    targetWavPath?: string,
  ): Promise<string> {
    const ffmpegBin = this.resolveFfmpegBinary();
    if (!ffmpegBin) {
      throw new Error("FFmpeg binary is required to extract audio from video.");
    }

    const meta = await this.probeMetadata(videoPath);
    if (!meta.hasAudio) {
      throw new Error(
        "The selected video does not contain an audio track to extract.",
      );
    }

    const outputPath =
      targetWavPath ||
      path.join(
        os.tmpdir(),
        `echolingo_extract_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`,
      );

    const args = [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      outputPath,
    ];

    this.log.info(`Extracting audio: ${ffmpegBin} ${args.join(" ")}`);
    await execFileAsync(ffmpegBin, args);

    return outputPath;
  }

  /**
   * Transcribe video audio using available speech engine and optional translation
   */
  public async transcribeVideo(
    videoPath: string,
    options: {
      sourceLang?: string;
      targetLang?: string;
    } = {},
    onProgress?: (progress: VideoTranscribeProgress) => void,
  ): Promise<SubtitleSegment[]> {
    const meta = await this.probeMetadata(videoPath);
    if (!meta.hasAudio) {
      this.log.warn(
        `Cannot transcribe video "${videoPath}": No audio track found.`,
      );
      throw new Error(
        "The selected video does not contain an audio track to transcribe.",
      );
    }

    onProgress?.({
      phase: "extracting",
      percent: 5,
      detail: "Extracting audio from video...",
    });

    const tempWav = await this.extractAudio(videoPath);

    try {
      const speechService = getSpeechService();
      const activeProvider = speechService.getProvider();

      let segments: SubtitleSegment[] = [];

      // Check if local whisper provider is available (either active or registered)
      let whisperProvider: LocalWhisperProvider | null = null;
      if (activeProvider instanceof LocalWhisperProvider) {
        whisperProvider = activeProvider;
      } else {
        const local = speechService.getProvider("whisper-local");
        if (local instanceof LocalWhisperProvider) {
          whisperProvider = local;
        } else {
          whisperProvider = new LocalWhisperProvider();
        }
      }

      const whisperBin = whisperProvider?.resolveBinaryPath?.();
      const modelPath = whisperProvider?.resolveModelPath?.();

      if (whisperBin && modelPath) {
        // Use whisper.cpp with -osrt to generate full timestamped SRT
        const outPrefix = path.join(os.tmpdir(), `whisper_out_${Date.now()}`);
        const srtFile = `${outPrefix}.srt`;

        const lang =
          options.sourceLang && options.sourceLang !== "auto"
            ? options.sourceLang
            : "auto";
        const threads = Math.min(8, Math.max(2, (os.cpus()?.length || 4) - 2));
        const whisperArgs = [
          "-m",
          modelPath,
          "-f",
          tempWav,
          "-l",
          lang,
          "-osrt",
          "-of",
          outPrefix,
          "-t",
          String(threads),
          "-bo",
          "1",
          "-bs",
          "1",
          "-pp",
        ];

        this.log.info(
          `Transcribing video via whisper.cpp CLI: ${whisperBin} ${whisperArgs.join(" ")}`,
        );

        onProgress?.({
          phase: "transcribing",
          percent: 10,
          detail: "Starting Whisper speech recognition...",
        });

        await new Promise<void>((resolve, reject) => {
          const child = spawn(whisperBin, whisperArgs, {
            windowsHide: true,
          });

          let stderrData = "";
          let lastDetail = "Recognizing speech...";
          let lastWhisperPct = 0;

          const parseOutput = (chunk: Buffer) => {
            const str = chunk.toString();
            // Accumulate output for debugging / error reporting if whisper.cpp exits with error
            stderrData += str;

            // Process output line-by-line to parse progress indicators and live transcription cues
            const lines = str.split(/\r?\n/);
            for (const line of lines) {
              // 1. Parse progress percentage printed by whisper.cpp with "-pp" flag (e.g. "progress = 45%")
              const progMatch = line.match(/progress\s*=\s*(\d+)%/i);
              if (progMatch) {
                lastWhisperPct = parseInt(progMatch[1], 10);
                // Scale progress: allocate 10%-75% if subsequent translation is required, or 10%-95% otherwise
                const maxRange = options.targetLang ? 65 : 85;
                const totalPct =
                  10 + Math.round((lastWhisperPct / 100) * maxRange);
                onProgress?.({
                  phase: "transcribing",
                  percent: Math.min(95, totalPct),
                  detail: lastDetail,
                });
              }

              // 2. Parse timestamped subtitle cues: [hh:mm:ss.mmm --> hh:mm:ss.mmm] <recognized text>
              const tsMatch = line.match(
                /\[(\d\d:\d\d:\d\d\.\d\d\d)\s*-->\s*(\d\d:\d\d:\d\d\.\d\d\d)\]\s*(.*)/,
              );
              if (tsMatch && tsMatch[3]?.trim()) {
                const cueText = tsMatch[3].trim();
                // Format detail text as "[mm:ss] text" for a live preview on the UI
                lastDetail = `[${tsMatch[1].slice(3, 8)}] ${cueText}`;
                const maxRange = options.targetLang ? 65 : 85;
                const totalPct =
                  10 + Math.round((lastWhisperPct / 100) * maxRange);
                onProgress?.({
                  phase: "transcribing",
                  percent: Math.min(95, totalPct),
                  detail: lastDetail,
                });
              }
            }
          };

          child.stdout?.on("data", parseOutput);
          child.stderr?.on("data", parseOutput);

          child.on("error", reject);
          child.on("close", (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(
                new Error(
                  `whisper.cpp exited with code ${code}: ${stderrData.slice(-500)}`,
                ),
              );
            }
          });
        });

        if (fs.existsSync(srtFile)) {
          const srtContent = await fsp.readFile(srtFile, "utf-8");
          segments = parseSrt(srtContent, {
            sourceLanguage: options.sourceLang || "en",
            targetLanguage: options.targetLang,
            isBilingual: false,
          });
          await fsp.unlink(srtFile).catch(() => {});
        }
      } else if (activeProvider.id !== "windows-speech") {
        // Fall back to active cloud provider if segments still empty
        onProgress?.({
          phase: "transcribing",
          percent: 20,
          detail: "Transcribing via cloud speech provider...",
        });

        const wavBuffer = await fsp.readFile(tempWav);
        const pcm16 = new Int16Array(
          wavBuffer.buffer,
          wavBuffer.byteOffset + 44,
          (wavBuffer.byteLength - 44) / 2,
        );
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }

        const resp = await activeProvider.transcribe(float32, {
          language: options.sourceLang,
          sampleRate: 16000,
        });

        if (resp.text.trim()) {
          const durMs = Math.round((float32.length / 16000) * 1000);
          segments = [
            {
              id: "seg_" + Date.now(),
              sessionId: "video_session",
              startTime: 0,
              endTime: durMs,
              originalText: resp.text.trim(),
              translations: {},
              sourceLanguage: options.sourceLang || "auto",
              targetLanguages: options.targetLang ? [options.targetLang] : [],
              status: "final",
              speechProvider: activeProvider.name,
              translationProvider: "",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ];
        }
      } else {
        throw new Error(
          "Whisper model is required to generate timestamped subtitles for videos. Please install a Whisper model or select a cloud provider.",
        );
      }

      // If target language requested, translate segments in concurrent batches
      if (options.targetLang && segments.length > 0) {
        onProgress?.({
          phase: "translating",
          percent: 75,
          detail: `Translating ${segments.length} cues to ${options.targetLang.toUpperCase()}...`,
        });

        const translationService = getTranslationService();
        const CHUNK_SIZE = 10;
        for (let i = 0; i < segments.length; i += CHUNK_SIZE) {
          const slice = segments.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            slice.map(async (seg) => {
              if (seg.originalText.trim()) {
                try {
                  const res = await translationService.translate({
                    text: seg.originalText,
                    sourceLanguage: seg.sourceLanguage || "auto",
                    targetLanguage: options.targetLang!,
                    priority: "high",
                  });
                  seg.translations[options.targetLang!] = res.translatedText;
                } catch (err) {
                  this.log.error(
                    `Translation error for segment ${seg.id}:`,
                    err,
                  );
                }
              }
            }),
          );
          const doneCount = Math.min(segments.length, i + CHUNK_SIZE);
          const transPercent =
            75 + Math.round((doneCount / segments.length) * 23);
          onProgress?.({
            phase: "translating",
            percent: Math.min(98, transPercent),
            detail: `Translated ${doneCount} of ${segments.length} cues (${transPercent}%)`,
          });
        }
      }

      onProgress?.({
        phase: "completed",
        percent: 100,
        detail: `Completed! ${segments.length} cues generated.`,
      });

      return segments;
    } finally {
      await fsp.unlink(tempWav).catch(() => {});
    }
  }

  /**
   * Escape ASS path for FFmpeg filter graph (crucial for Windows C:\ paths)
   */
  public escapeFilterPath(rawPath: string): string {
    return rawPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  }

  /**
   * Burn-in or embed subtitles into video using FFmpeg with real-time progress
   */
  public async exportSubtitledVideo(
    options: VideoExportOptions,
    onProgress: (progress: VideoExportProgress) => void,
  ): Promise<{ outputPath: string }> {
    const ffmpegBin = this.resolveFfmpegBinary();
    if (!ffmpegBin) {
      throw new Error("FFmpeg binary is required to export subtitled video.");
    }

    const jobId =
      "export_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const tempFiles: string[] = [];

    // Probe metadata for total duration
    const meta = await this.probeMetadata(options.inputVideoPath);
    const totalDurationSeconds = meta.durationSeconds || 1;

    // Generate ASS subtitle script
    onProgress({
      jobId,
      phase: "generating-ass",
      progressPercent: 5,
      totalDurationSeconds,
    });

    // Subtitle preview styles are calibrated to a 360px reference height (standard 16:9 preview container).
    // Scale style parameters proportionally to the target video resolution so that the exported subtitles
    // match the exact size, stroke, and position seen in the video preview.
    const scaleFactor = meta.height > 0 ? meta.height / 360 : 1;
    const scaledStyle: SubtitleStyleOptions = {
      ...options.style,
      fontSize: Math.max(14, Math.round(options.style.fontSize * scaleFactor)),
      verticalMargin: Math.round(options.style.verticalMargin * scaleFactor),
      horizontalMargin: Math.round(
        options.style.horizontalMargin * scaleFactor,
      ),
      outlineWidth:
        options.style.outlineWidth > 0
          ? Math.max(
              1,
              Math.round(options.style.outlineWidth * scaleFactor * 10) / 10,
            )
          : 0,
      shadowDistance:
        options.style.shadowDistance > 0
          ? Math.max(1, Math.round(options.style.shadowDistance * scaleFactor))
          : 0,
    };

    const assScript = generateAssScript(options.segments, scaledStyle, {
      resolution: { width: meta.width, height: meta.height },
      title: meta.fileName,
    });

    const tempAssPath = path.join(
      os.tmpdir(),
      `echolingo_sub_${Date.now()}_${Math.random().toString(36).slice(2)}.ass`,
    );
    await fsp.writeFile(tempAssPath, assScript, "utf-8");
    tempFiles.push(tempAssPath);

    const escapedAss = this.escapeFilterPath(tempAssPath);

    // Build FFmpeg command arguments
    const ffmpegArgs: string[] = ["-y", "-i", options.inputVideoPath];

    if (options.exportMode === "hardsub-burnin") {
      ffmpegArgs.push("-vf", `ass='${escapedAss}'`);
      ffmpegArgs.push("-c:v", options.videoCodec || "libx264");
      ffmpegArgs.push("-preset", options.qualityPreset || "veryfast");
      ffmpegArgs.push("-crf", String(options.crf || 21));
      // Enforce constant frame rate to prevent sync drift on variable frame rate clips
      ffmpegArgs.push("-vsync", "cfr");
    } else {
      // Softsub muxing mode
      ffmpegArgs.push("-i", tempAssPath);
      ffmpegArgs.push("-c:v", "copy");
      ffmpegArgs.push("-c:s", "mov_text");
    }

    // Audio encoding / copy
    if (meta.hasAudio) {
      if (options.audioCodec === "aac") {
        ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
      } else {
        ffmpegArgs.push("-c:a", "copy");
      }
    } else {
      // Input video has no audio stream, disable audio stream in output
      ffmpegArgs.push("-an");
    }

    ffmpegArgs.push(options.outputVideoPath);

    this.log.info(
      `Spawning FFmpeg burn-in process [Job ${jobId}]: ${ffmpegBin} ${ffmpegArgs.join(" ")}`,
    );

    return new Promise<{ outputPath: string }>((resolve, reject) => {
      const child = spawn(ffmpegBin, ffmpegArgs, { windowsHide: true });

      const activeJob: ActiveVideoJob = {
        jobId,
        process: child,
        tempFiles,
        cancelled: false,
      };
      this.activeJobs.set(jobId, activeJob);

      let stderrAccum = "";

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderrAccum += text;

        // Parse time=HH:MM:SS.xx or time=00:01:23.45
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
        const fpsMatch = text.match(/fps=\s*(\d+(?:\.\d+)?)/i);
        const frameMatch = text.match(/frame=\s*(\d+)/i);

        if (timeMatch) {
          const curHours = parseInt(timeMatch[1], 10);
          const curMins = parseInt(timeMatch[2], 10);
          const curSecs = parseFloat(timeMatch[3]);
          const currentTimeSeconds = curHours * 3600 + curMins * 60 + curSecs;

          const progressPercent = Math.min(
            99,
            Math.max(
              5,
              Math.round((currentTimeSeconds / totalDurationSeconds) * 94) + 5,
            ),
          );

          const currentFps = fpsMatch ? parseFloat(fpsMatch[1]) : undefined;
          const currentFrame = frameMatch
            ? parseInt(frameMatch[1], 10)
            : undefined;

          let estimatedRemaining: number | undefined;
          if (currentTimeSeconds > 2 && progressPercent > 5) {
            const remainingSecs = totalDurationSeconds - currentTimeSeconds;
            if (currentFps && currentFps > 0) {
              const remainingFrames = (meta.fps || 30) * remainingSecs;
              estimatedRemaining = Math.max(
                1,
                Math.round(remainingFrames / currentFps),
              );
            }
          }

          onProgress({
            jobId,
            phase: "encoding",
            progressPercent,
            currentTimeSeconds,
            totalDurationSeconds,
            currentFrame,
            fps: currentFps,
            estimatedSecondsRemaining: estimatedRemaining,
          });
        }
      });

      child.on("error", async (err) => {
        this.log.error(`FFmpeg process spawn error [Job ${jobId}]:`, err);
        await this.cleanupJob(jobId);
        onProgress({
          jobId,
          phase: "failed",
          progressPercent: 0,
          totalDurationSeconds,
          errorMessage: err.message,
        });
        reject(err);
      });

      child.on("close", async (code) => {
        this.log.info(
          `FFmpeg process finished with code ${code} [Job ${jobId}]`,
        );
        await this.cleanupJob(jobId);

        if (activeJob.cancelled) {
          // Delete partial output file if cancelled
          try {
            if (fs.existsSync(options.outputVideoPath)) {
              await fsp.unlink(options.outputVideoPath);
            }
          } catch {
            // ignore
          }

          onProgress({
            jobId,
            phase: "cancelled",
            progressPercent: 0,
            totalDurationSeconds,
            errorMessage: "Export was cancelled by user.",
          });
          reject(new Error("Export was cancelled by user."));
          return;
        }

        if (code === 0) {
          onProgress({
            jobId,
            phase: "completed",
            progressPercent: 100,
            totalDurationSeconds,
          });
          resolve({ outputPath: options.outputVideoPath });
        } else {
          const errDetail = stderrAccum.split(/\r?\n/).slice(-10).join("\n");
          this.log.error(`FFmpeg failed with exit code ${code}:\n${errDetail}`);
          onProgress({
            jobId,
            phase: "failed",
            progressPercent: 0,
            totalDurationSeconds,
            errorMessage: `FFmpeg failed with exit code ${code}.`,
          });
          reject(
            new Error(`FFmpeg export failed (code ${code}): ${errDetail}`),
          );
        }
      });
    });
  }

  /**
   * Cancel an ongoing export job
   */
  public async cancelExport(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    job.cancelled = true;
    this.log.info(`Cancelling export job ${jobId}`);

    try {
      if (process.platform === "win32") {
        execFile("taskkill", ["/pid", String(job.process.pid), "/f", "/t"]);
      } else {
        job.process.kill("SIGTERM");
      }
    } catch (err) {
      this.log.error(`Error terminating process for job ${jobId}:`, err);
    }

    await this.cleanupJob(jobId);
    return true;
  }

  private async cleanupJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job) {
      for (const tempFile of job.tempFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            await fsp.unlink(tempFile);
          }
        } catch {
          // ignore
        }
      }
      this.activeJobs.delete(jobId);
    }
  }
}

export function getVideoService(): VideoService {
  return VideoService.getInstance();
}
