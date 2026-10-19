import { execFile, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { app } from 'electron';
import { createLogger, ILogger } from '@echo-lingo/logger';
import {
  VideoMetadata,
  VideoExportOptions,
  VideoExportProgress,
  SubtitleSegment,
  toMediaProtocolUrl,
} from '@echo-lingo/contracts';
import { generateAssScript } from '@echo-lingo/subtitle-core';
import { parseSrt } from '@echo-lingo/subtitle-core';
import { getSpeechService } from './speech-service.js';
import { getTranslationService } from './translation-service.js';
import { LocalWhisperProvider } from '@echo-lingo/provider-adapters';
import { downloadFile } from '@echo-lingo/shared';

const execFileAsync = promisify(execFile);

export interface ActiveVideoJob {
  jobId: string;
  process: ChildProcess;
  tempFiles: string[];
  cancelled: boolean;
}

export class VideoService {
  private static instance: VideoService | null = null;
  private readonly log: ILogger = createLogger('VideoService');
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
   * Resolve FFmpeg binary from environment, appData, resources, or system PATH
   */
  public resolveFfmpegBinary(): string | null {
    if (this.ffmpegBinaryPath && fs.existsSync(this.ffmpegBinaryPath)) {
      return this.ffmpegBinaryPath;
    }

    const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

    const candidates: string[] = [];

    // 1. Environment variable
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      candidates.push(process.env.FFMPEG_PATH);
    }

    // 2. User data directory (e.g. %APPDATA%/echolingo/bin/ffmpeg.exe)
    try {
      if (app && typeof app.getPath === 'function') {
        candidates.push(path.join(app.getPath('userData'), 'bin', exeName));
      }
    } catch {
      // ignore outside electron
    }
    candidates.push(path.join(os.homedir(), '.echo-lingo', 'bin', exeName));

    // 3. Electron resources directory
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'bin', exeName));
    }

    // 4. node_modules/ffmpeg-static fallback
    candidates.push(path.join(process.cwd(), 'node_modules', 'ffmpeg-static', exeName));
    try {
      if (app && typeof app.getAppPath === 'function') {
        candidates.push(path.join(app.getAppPath(), 'node_modules', 'ffmpeg-static', exeName));
      }
    } catch {
      // ignore
    }

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.ffmpegBinaryPath = p;
        this.log.info(`Resolved FFmpeg binary: ${p}`);
        return p;
      }
    }

    // 4. System PATH check
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of pathDirs) {
      const fullPath = path.join(dir, exeName);
      if (fs.existsSync(fullPath)) {
        this.ffmpegBinaryPath = fullPath;
        this.log.info(`Resolved system FFmpeg binary: ${fullPath}`);
        return fullPath;
      }
    }

    this.log.warn('FFmpeg binary could not be resolved in system or local paths.');
    return null;
  }

  /**
   * Resolve FFprobe binary
   */
  public resolveFfprobeBinary(): string | null {
    if (this.ffprobeBinaryPath && fs.existsSync(this.ffprobeBinaryPath)) {
      return this.ffprobeBinaryPath;
    }

    const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const candidates: string[] = [];

    if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
      candidates.push(process.env.FFPROBE_PATH);
    }

    try {
      if (app && typeof app.getPath === 'function') {
        candidates.push(path.join(app.getPath('userData'), 'bin', exeName));
      }
    } catch {
      // ignore
    }
    candidates.push(path.join(os.homedir(), '.echo-lingo', 'bin', exeName));

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'bin', exeName));
    }

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.ffprobeBinaryPath = p;
        return p;
      }
    }

    const pathDirs = (process.env.PATH || '').split(path.delimiter);
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

  /**
   * Automatically install FFmpeg to EchoLingo bin directory and add to user PATH
   */
  public async downloadAndInstallFfmpeg(
    onProgress?: (progressPercent: number) => void
  ): Promise<{ success: boolean; path: string }> {
    const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    let binDir = path.join(os.homedir(), '.echo-lingo', 'bin');
    try {
      if (app && typeof app.getPath === 'function') {
        binDir = path.join(app.getPath('userData'), 'bin');
      }
    } catch {
      // fallback
    }

    await fsp.mkdir(binDir, { recursive: true });
    const targetExe = path.join(binDir, exeName);

    // 1. Try winget if available on Windows
    if (process.platform === 'win32') {
      try {
        this.log.info('Attempting winget install Gyan.FFmpeg...');
        await execFileAsync('winget', [
          'install',
          '--id',
          'Gyan.FFmpeg',
          '-e',
          '--accept-source-agreements',
          '--accept-package-agreements',
        ]);
        const resolved = this.resolveFfmpegBinary();
        if (resolved) {
          return { success: true, path: resolved };
        }
      } catch (wingetErr) {
        this.log.warn('Winget install skipped or failed, proceeding with direct download:', wingetErr);
      }
    }

    // 2. Direct download of release
    const zipUrl =
      process.platform === 'win32'
        ? 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
        : 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz';

    const tempZip = path.join(binDir, `ffmpeg-download-${Date.now()}.zip`);
    this.log.info(`Downloading FFmpeg from ${zipUrl}...`);

    await downloadFile(zipUrl, tempZip, (pct) => {
      if (onProgress) onProgress(pct);
    });

    if (process.platform === 'win32') {
      const extractDir = path.join(binDir, 'temp_extract');
      await fsp.mkdir(extractDir, { recursive: true });

      const psScript = `
        Expand-Archive -Path '${tempZip.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force
        $ffmpeg = Get-ChildItem -Path '${extractDir.replace(/'/g, "''")}' -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1
        $ffprobe = Get-ChildItem -Path '${extractDir.replace(/'/g, "''")}' -Filter 'ffprobe.exe' -Recurse | Select-Object -First 1
        if ($ffmpeg) { Copy-Item -Path $ffmpeg.FullName -Destination '${binDir.replace(/'/g, "''")}' -Force }
        if ($ffprobe) { Copy-Item -Path $ffprobe.FullName -Destination '${binDir.replace(/'/g, "''")}' -Force }
        Remove-Item -Path '${extractDir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue

        # Add to user PATH permanently
        $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        if ($currentPath -notlike '*${binDir.replace(/'/g, "''")}*') {
          [Environment]::SetEnvironmentVariable('Path', "$currentPath;${binDir.replace(/'/g, "''")}", 'User')
        }
      `;

      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encoded,
      ]);

      await fsp.unlink(tempZip).catch(() => {});
    }

    // Add binDir to current process PATH
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
    this.ffmpegBinaryPath = targetExe;

    return {
      success: fs.existsSync(targetExe),
      path: targetExe,
    };
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
      throw new Error('FFmpeg binary is required to inspect video metadata.');
    }

    // Run ffmpeg -i "<videoPath>" to extract stream headers
    let stderr = '';
    try {
      await execFileAsync(ffmpegBin, ['-i', videoPath]);
    } catch (err: any) {
      // FFmpeg returns exit code 1 when invoked with just -i without output
      stderr = err.stderr || err.message || '';
    }

    // 1. Duration (Duration: 00:01:23.45)
    let durationSeconds = 0;
    const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
    if (durMatch) {
      const hours = parseInt(durMatch[1], 10);
      const mins = parseInt(durMatch[2], 10);
      const secs = parseFloat(durMatch[3]);
      durationSeconds = hours * 3600 + mins * 60 + secs;
    }

    // 2. Video Stream (Video: h264, yuv420p(tv, bt709), 1920x1080 [SAR 1:1 DAR 16:9], 29.97 fps)
    let width = 1920;
    let height = 1080;
    let fps = 30;
    let videoCodec = 'unknown';

    const vidMatch = stderr.match(/Stream\s+#\d+:\d+.*Video:\s*([^,\s]+)[^,]*,\s*[^,]+,\s*(\d+)x(\d+)(?:.*?(\d+(?:\.\d+)?)\s*fps)?/i);
    if (vidMatch) {
      videoCodec = vidMatch[1] || 'unknown';
      width = parseInt(vidMatch[2], 10) || 1920;
      height = parseInt(vidMatch[3], 10) || 1080;
      if (vidMatch[4]) {
        fps = parseFloat(vidMatch[4]);
      }
    }

    // 3. Audio Stream (Audio: aac, 48000 Hz, stereo, fltp, 128 kb/s)
    let hasAudio = false;
    let audioCodec: string | undefined;
    let audioChannels: number | undefined;

    const audMatch = stderr.match(/Stream\s+#\d+:\d+.*Audio:\s*([^,\s]+)[^,]*(?:,\s*(\d+)\s*Hz)?(?:,\s*([^,]+))?/i);
    if (audMatch) {
      hasAudio = true;
      audioCodec = audMatch[1];
      const chanStr = audMatch[3] || '';
      if (chanStr.includes('stereo')) audioChannels = 2;
      else if (chanStr.includes('mono')) audioChannels = 1;
      else if (chanStr.includes('5.1')) audioChannels = 6;
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
  public async extractAudio(videoPath: string, targetWavPath?: string): Promise<string> {
    const ffmpegBin = this.resolveFfmpegBinary();
    if (!ffmpegBin) {
      throw new Error('FFmpeg binary is required to extract audio from video.');
    }

    const meta = await this.probeMetadata(videoPath);
    if (!meta.hasAudio) {
      throw new Error('The selected video does not contain an audio track to extract.');
    }

    const outputPath =
      targetWavPath ||
      path.join(os.tmpdir(), `echolingo_extract_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);

    const args = [
      '-y',
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      outputPath,
    ];

    this.log.info(`Extracting audio: ${ffmpegBin} ${args.join(' ')}`);
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
      onProgress?: (progressPercent: number) => void;
    } = {}
  ): Promise<SubtitleSegment[]> {
    const meta = await this.probeMetadata(videoPath);
    if (!meta.hasAudio) {
      this.log.warn(`Cannot transcribe video "${videoPath}": No audio track found.`);
      throw new Error('The selected video does not contain an audio track to transcribe.');
    }

    const tempWav = await this.extractAudio(videoPath);

    try {
      const speechService = getSpeechService();
      const activeProvider = speechService.getProvider();

      let segments: SubtitleSegment[] = [];

      // Check if local whisper provider is active and has binary
      if (activeProvider instanceof LocalWhisperProvider) {
        const whisperBin = activeProvider.resolveBinaryPath();
        const modelPath = activeProvider.resolveModelPath();

        if (whisperBin && modelPath) {
          // Use whisper.cpp with -osrt to generate full timestamped SRT
          const outPrefix = path.join(os.tmpdir(), `whisper_out_${Date.now()}`);
          const srtFile = `${outPrefix}.srt`;

          const lang = options.sourceLang && options.sourceLang !== 'auto' ? options.sourceLang : 'auto';
          const whisperArgs = [
            '-m', modelPath,
            '-f', tempWav,
            '-l', lang,
            '-osrt',
            '-of', outPrefix,
            '-t', '4',
          ];

          this.log.info(`Transcribing via whisper.cpp CLI: ${whisperBin} ${whisperArgs.join(' ')}`);
          await execFileAsync(whisperBin, whisperArgs);

          if (fs.existsSync(srtFile)) {
            const srtContent = await fsp.readFile(srtFile, 'utf-8');
            segments = parseSrt(srtContent, {
              sourceLanguage: options.sourceLang || 'en',
              targetLanguage: options.targetLang,
            });
            await fsp.unlink(srtFile).catch(() => {});
          }
        }
      }

      // If segments still empty, read WAV as Float32 samples and run provider.transcribe
      if (segments.length === 0) {
        const wavBuffer = await fsp.readFile(tempWav);
        // Skip 44-byte WAV header and convert 16-bit PCM to Float32
        const pcm16 = new Int16Array(
          wavBuffer.buffer,
          wavBuffer.byteOffset + 44,
          (wavBuffer.byteLength - 44) / 2
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
              id: 'seg_' + Date.now(),
              sessionId: 'video_session',
              startTime: 0,
              endTime: durMs,
              originalText: resp.text.trim(),
              translations: {},
              sourceLanguage: options.sourceLang || 'auto',
              targetLanguages: options.targetLang ? [options.targetLang] : [],
              status: 'final',
              speechProvider: activeProvider.name,
              translationProvider: '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ];
        }
      }

      // If target language requested, translate segments
      if (options.targetLang && segments.length > 0) {
        const translationService = getTranslationService();
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          if (seg.originalText.trim()) {
            try {
              const res = await translationService.translate({
                text: seg.originalText,
                sourceLanguage: seg.sourceLanguage || 'auto',
                targetLanguage: options.targetLang,
                priority: 'high',
              });
              seg.translations[options.targetLang] = res.translatedText;
            } catch (err) {
              this.log.error(`Translation error for segment ${seg.id}:`, err);
            }
          }
        }
      }

      return segments;
    } finally {
      await fsp.unlink(tempWav).catch(() => {});
    }
  }

  /**
   * Escape ASS path for FFmpeg filter graph (crucial for Windows C:\ paths)
   */
  public escapeFilterPath(rawPath: string): string {
    return rawPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  }

  /**
   * Burn-in or embed subtitles into video using FFmpeg with real-time progress
   */
  public async exportSubtitledVideo(
    options: VideoExportOptions,
    onProgress: (progress: VideoExportProgress) => void
  ): Promise<{ outputPath: string }> {
    const ffmpegBin = this.resolveFfmpegBinary();
    if (!ffmpegBin) {
      throw new Error('FFmpeg binary is required to export subtitled video.');
    }

    const jobId = 'export_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const tempFiles: string[] = [];

    // Probe metadata for total duration
    const meta = await this.probeMetadata(options.inputVideoPath);
    const totalDurationSeconds = meta.durationSeconds || 1;

    // Generate ASS subtitle script
    onProgress({
      jobId,
      phase: 'generating-ass',
      progressPercent: 5,
      totalDurationSeconds,
    });

    const assScript = generateAssScript(options.segments, options.style, {
      resolution: { width: meta.width, height: meta.height },
      title: meta.fileName,
    });

    const tempAssPath = path.join(
      os.tmpdir(),
      `echolingo_sub_${Date.now()}_${Math.random().toString(36).slice(2)}.ass`
    );
    await fsp.writeFile(tempAssPath, assScript, 'utf-8');
    tempFiles.push(tempAssPath);

    const escapedAss = this.escapeFilterPath(tempAssPath);

    // Build FFmpeg command arguments
    const ffmpegArgs: string[] = ['-y', '-i', options.inputVideoPath];

    if (options.exportMode === 'hardsub-burnin') {
      ffmpegArgs.push('-vf', `ass='${escapedAss}'`);
      ffmpegArgs.push('-c:v', options.videoCodec || 'libx264');
      ffmpegArgs.push('-preset', options.qualityPreset || 'veryfast');
      ffmpegArgs.push('-crf', String(options.crf || 21));
      // Enforce constant frame rate to prevent sync drift on variable frame rate clips
      ffmpegArgs.push('-vsync', 'cfr');
    } else {
      // Softsub muxing mode
      ffmpegArgs.push('-i', tempAssPath);
      ffmpegArgs.push('-c:v', 'copy');
      ffmpegArgs.push('-c:s', 'mov_text');
    }

    // Audio encoding / copy
    if (meta.hasAudio) {
      if (options.audioCodec === 'aac') {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
      } else {
        ffmpegArgs.push('-c:a', 'copy');
      }
    } else {
      // Input video has no audio stream, disable audio stream in output
      ffmpegArgs.push('-an');
    }

    ffmpegArgs.push(options.outputVideoPath);

    this.log.info(`Spawning FFmpeg burn-in process [Job ${jobId}]: ${ffmpegBin} ${ffmpegArgs.join(' ')}`);

    return new Promise<{ outputPath: string }>((resolve, reject) => {
      const child = spawn(ffmpegBin, ffmpegArgs, { windowsHide: true });

      const activeJob: ActiveVideoJob = {
        jobId,
        process: child,
        tempFiles,
        cancelled: false,
      };
      this.activeJobs.set(jobId, activeJob);

      let stderrAccum = '';

      child.stderr.on('data', (chunk: Buffer) => {
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
            Math.max(5, Math.round((currentTimeSeconds / totalDurationSeconds) * 94) + 5)
          );

          const currentFps = fpsMatch ? parseFloat(fpsMatch[1]) : undefined;
          const currentFrame = frameMatch ? parseInt(frameMatch[1], 10) : undefined;

          let estimatedRemaining: number | undefined;
          if (currentTimeSeconds > 2 && progressPercent > 5) {
            const remainingSecs = totalDurationSeconds - currentTimeSeconds;
            if (currentFps && currentFps > 0) {
              const remainingFrames = (meta.fps || 30) * remainingSecs;
              estimatedRemaining = Math.max(1, Math.round(remainingFrames / currentFps));
            }
          }

          onProgress({
            jobId,
            phase: 'encoding',
            progressPercent,
            currentTimeSeconds,
            totalDurationSeconds,
            currentFrame,
            fps: currentFps,
            estimatedSecondsRemaining: estimatedRemaining,
          });
        }
      });

      child.on('error', async (err) => {
        this.log.error(`FFmpeg process spawn error [Job ${jobId}]:`, err);
        await this.cleanupJob(jobId);
        onProgress({
          jobId,
          phase: 'failed',
          progressPercent: 0,
          totalDurationSeconds,
          errorMessage: err.message,
        });
        reject(err);
      });

      child.on('close', async (code) => {
        this.log.info(`FFmpeg process finished with code ${code} [Job ${jobId}]`);
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
            phase: 'cancelled',
            progressPercent: 0,
            totalDurationSeconds,
            errorMessage: 'Export was cancelled by user.',
          });
          reject(new Error('Export was cancelled by user.'));
          return;
        }

        if (code === 0) {
          onProgress({
            jobId,
            phase: 'completed',
            progressPercent: 100,
            totalDurationSeconds,
          });
          resolve({ outputPath: options.outputVideoPath });
        } else {
          const errDetail = stderrAccum.split(/\r?\n/).slice(-10).join('\n');
          this.log.error(`FFmpeg failed with exit code ${code}:\n${errDetail}`);
          onProgress({
            jobId,
            phase: 'failed',
            progressPercent: 0,
            totalDurationSeconds,
            errorMessage: `FFmpeg failed with exit code ${code}.`,
          });
          reject(new Error(`FFmpeg export failed (code ${code}): ${errDetail}`));
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
      if (process.platform === 'win32') {
        execFile('taskkill', ['/pid', String(job.process.pid), '/f', '/t']);
      } else {
        job.process.kill('SIGTERM');
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
