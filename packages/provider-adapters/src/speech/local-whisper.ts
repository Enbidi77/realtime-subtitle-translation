import {
  ISpeechProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  encodeWav,
} from '@echo-lingo/speech-core';
import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createLogger } from '@echo-lingo/logger';
import { downloadFile } from '@echo-lingo/shared';

const log = createLogger('LocalWhisperProvider');
const execFileAsync = promisify(execFile);

export interface LocalWhisperConfig {
  modelName?: string;
  modelDirectory?: string;
  binaryPath?: string;
  onDownloadProgress?: (progress: number) => void;
}

export interface WhisperModelDefinition {
  id: string;
  name: string;
  sizeBytes: number;
  url: string;
}

export const WHISPER_MODELS: Record<string, WhisperModelDefinition> = {
  tiny: {
    id: 'tiny',
    name: 'Whisper Tiny (Multilingual ~75MB)',
    sizeBytes: 77691713,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  },
  base: {
    id: 'base',
    name: 'Whisper Base (Multilingual ~142MB)',
    sizeBytes: 147964211,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  },
  small: {
    id: 'small',
    name: 'Whisper Small (Multilingual ~466MB)',
    sizeBytes: 487848411,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  },
};

const WHISPER_BIN_WINDOWS_URL =
  'https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip';

export class LocalWhisperProvider implements ISpeechProvider {
  public readonly id: SpeechEngineType = 'whisper-local';
  public readonly name = 'Whisper Local (whisper.cpp / Offline Neural)';
  public readonly isLocal = true;

  private modelName = 'tiny';
  private modelDirectory = '';
  private binaryPath = '';
  private isModelReady = false;
  private activeDownloads = new Map<string, number>();

  constructor(config: LocalWhisperConfig = {}) {
    if (config.modelName) this.modelName = config.modelName;
    if (config.modelDirectory) {
      this.modelDirectory = config.modelDirectory;
    } else {
      // Default fallback directory
      this.modelDirectory = path.join(os.homedir(), '.echo-lingo', 'models', 'whisper');
    }
    if (config.binaryPath) this.binaryPath = config.binaryPath;
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.modelName && typeof config.modelName === 'string') {
      this.modelName = config.modelName;
    }
    if (config?.modelDirectory && typeof config.modelDirectory === 'string') {
      this.modelDirectory = config.modelDirectory;
    }
    if (config?.binaryPath && typeof config.binaryPath === 'string') {
      this.binaryPath = config.binaryPath;
    }

    try {
      await fsp.mkdir(this.modelDirectory, { recursive: true });
    } catch {
      // ignore
    }

    this.isModelReady = true;
  }

  public isReady(): boolean {
    return this.isModelReady;
  }

  public setModelName(modelName: string): void {
    this.modelName = modelName;
  }

  /**
   * Resolve path to whisper executable (main.exe or whisper-cli.exe)
   */
  public resolveBinaryPath(): string | null {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      return this.binaryPath;
    }

    const candidates = [
      path.join(this.modelDirectory, 'bin', 'main.exe'),
      path.join(this.modelDirectory, 'bin', 'whisper-cli.exe'),
      path.join(this.modelDirectory, 'main.exe'),
      path.join(this.modelDirectory, 'whisper-cli.exe'),
      // Also check standard AppData location if running under electron
      path.join(os.homedir(), 'AppData', 'Roaming', 'echolingo', 'models', 'whisper', 'bin', 'main.exe'),
      path.join(os.tmpdir(), 'whisper-bin-test', 'main.exe'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.binaryPath = p;
        return p;
      }
    }

    return null;
  }

  /**
   * Resolve path to the selected model weights file
   */
  public resolveModelPath(requestedModel?: string): string | null {
    const target = requestedModel || this.modelName;
    const directPath = path.join(this.modelDirectory, `ggml-${target}.bin`);
    if (fs.existsSync(directPath)) return directPath;

    // Check AppData fallback
    const appDataPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'echolingo',
      'models',
      'whisper',
      `ggml-${target}.bin`
    );
    if (fs.existsSync(appDataPath)) return appDataPath;

    // Check temp test fallback
    const tempTestPath = path.join(os.tmpdir(), 'whisper-bin-test', `ggml-${target}.bin`);
    if (fs.existsSync(tempTestPath)) return tempTestPath;

    // Look for any existing ggml model in directory
    try {
      if (fs.existsSync(this.modelDirectory)) {
        const files = fs.readdirSync(this.modelDirectory);
        const binFile = files.find((f) => f.startsWith('ggml-') && f.endsWith('.bin'));
        if (binFile) return path.join(this.modelDirectory, binFile);
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * Transcribe raw 16kHz Float32 audio samples using local whisper.cpp
   */
  public async transcribe(
    audioSamples: Float32Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResponse> {
    const start = Date.now();

    // Check audio RMS energy
    let sum = 0;
    for (let i = 0; i < audioSamples.length; i++) sum += audioSamples[i] * audioSamples[i];
    const rms = Math.sqrt(sum / audioSamples.length);

    if (rms < 0.005) {
      return {
        text: '',
        isFinal: true,
        confidence: 0,
        durationMs: Date.now() - start,
      };
    }

    const binary = this.resolveBinaryPath();
    const model = this.resolveModelPath();

    if (!binary || !model) {
      const missing = !binary ? 'whisper.cpp binary' : `model weights (ggml-${this.modelName}.bin)`;
      log.warn(`Local Whisper is missing ${missing}. Please download it from Providers settings.`);
      return {
        text: `[Local Whisper: Missing ${missing}. Go to Providers tab to download.]`,
        isFinal: true,
        confidence: 0.1,
        durationMs: Date.now() - start,
      };
    }

    // Encode audio to 16kHz mono WAV format expected by whisper.cpp
    const wavBytes = encodeWav(audioSamples, options.sampleRate || 16000);
    const tempWav = path.join(
      os.tmpdir(),
      `echolingo_whisper_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
    );

    try {
      await fsp.writeFile(tempWav, Buffer.from(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength));

      const lang = options.language && options.language !== 'auto' ? options.language : 'auto';

      const args = [
        '-m', model,
        '-f', tempWav,
        '-l', lang,
        '-nt', // no timestamps
        '-t', '4', // use 4 computation threads
        '--no-fallback',
      ];

      const { stdout } = await execFileAsync(binary, args);

      // Clean up stdout lines
      const lines = stdout.split(/\r?\n/);
      const textLines = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith('whisper_')) return false;
        if (trimmed.startsWith('system_info:')) return false;
        if (trimmed.startsWith('main:')) return false;
        return true;
      });

      const recognizedText = textLines.join(' ').replace(/\[.*?\]/g, '').trim();

      return {
        text: recognizedText,
        isFinal: true,
        confidence: 0.95,
        detectedLanguage: options.language,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      log.error('Local Whisper execution error:', err);
      return {
        text: '',
        isFinal: true,
        confidence: 0,
        durationMs: Date.now() - start,
      };
    } finally {
      await fsp.unlink(tempWav).catch(() => {});
    }
  }

  /**
   * Returns current status for all available models
   */
  public async getModelStatus(): Promise<SpeechModelStatus[]> {
    const list: SpeechModelStatus[] = [];

    for (const def of Object.values(WHISPER_MODELS)) {
      const modelPath = path.join(this.modelDirectory, `ggml-${def.id}.bin`);
      const isDownloading = this.activeDownloads.has(def.id);
      const downloadProgress = this.activeDownloads.get(def.id) ?? (fs.existsSync(modelPath) ? 100 : 0);
      const isInstalled = fs.existsSync(modelPath) && !isDownloading;

      let size = def.sizeBytes;
      if (isInstalled) {
        try {
          const stat = fs.statSync(modelPath);
          size = stat.size;
        } catch {
          // ignore
        }
      }

      list.push({
        id: def.id,
        name: def.name,
        isInstalled,
        downloadProgress,
        sizeBytes: size,
        path: isInstalled ? modelPath : undefined,
      });
    }

    return list;
  }

  /**
   * Downloads a Whisper model by ID and ensures binary runner exists
   */
  public async downloadModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const def = WHISPER_MODELS[modelId];
    if (!def) {
      throw new Error(`Unknown model ID: ${modelId}`);
    }

    await fsp.mkdir(this.modelDirectory, { recursive: true });

    // Step 1: Ensure binary runner exists (on Windows, download if missing)
    if (process.platform === 'win32' && !this.resolveBinaryPath()) {
      const binDir = path.join(this.modelDirectory, 'bin');
      await fsp.mkdir(binDir, { recursive: true });
      const zipPath = path.join(this.modelDirectory, 'whisper-bin-x64.zip');

      log.info('Downloading whisper.cpp Windows binaries...');
      await downloadFile(WHISPER_BIN_WINDOWS_URL, zipPath);

      // Unzip using PowerShell on Windows
      const psScript = `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${binDir.replace(/'/g, "''")}' -Force`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encoded,
      ]);

      await fsp.unlink(zipPath).catch(() => {});
      this.resolveBinaryPath();
    }

    // Step 2: Download Model weights
    const targetPath = path.join(this.modelDirectory, `ggml-${modelId}.bin`);
    this.activeDownloads.set(modelId, 0);

    try {
      log.info(`Downloading model ${modelId} from ${def.url}...`);
      await downloadFile(def.url, targetPath, (progress) => {
        this.activeDownloads.set(modelId, progress);
        if (onProgress) onProgress(progress);
      });

      this.activeDownloads.delete(modelId);
      if (onProgress) onProgress(100);
      log.info(`Model ${modelId} downloaded successfully.`);
    } catch (err) {
      this.activeDownloads.delete(modelId);
      await fsp.unlink(targetPath).catch(() => {});
      throw err;
    }
  }
}
