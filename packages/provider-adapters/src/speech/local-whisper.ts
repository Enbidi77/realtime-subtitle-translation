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
import { normalizeWhisperLanguage } from './whisper-utils.js';

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

    if (process.platform === 'win32') {
      this.ensureWindowsBinariesSigned().catch(() => {});
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
   * Resolve path to whisper executable (whisper-cli.exe or main.exe)
   */
  public resolveBinaryPath(): string | null {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      return this.binaryPath;
    }

    const candidates: string[] = [];

    // 1. Packaged Electron resources (Store MSIX / production bundle)
    const resourcesPath = (process as any).resourcesPath;
    if (resourcesPath) {
      candidates.push(
        path.join(resourcesPath, 'bin', 'whisper-cli.exe'),
        path.join(resourcesPath, 'bin', 'main.exe'),
        path.join(resourcesPath, 'resources', 'bin', 'whisper-cli.exe'),
        path.join(resourcesPath, 'resources', 'bin', 'main.exe'),
        path.join(resourcesPath, 'whisper-cli.exe'),
        path.join(resourcesPath, 'main.exe')
      );
    }

    // 2. Development / workspace paths
    const cwd = process.cwd();
    candidates.push(
      path.join(cwd, 'apps', 'desktop', 'resources', 'bin', 'whisper-cli.exe'),
      path.join(cwd, 'apps', 'desktop', 'resources', 'bin', 'main.exe'),
      path.join(cwd, 'resources', 'bin', 'whisper-cli.exe'),
      path.join(cwd, 'resources', 'bin', 'main.exe')
    );

    // 3. User model directory
    candidates.push(
      path.join(this.modelDirectory, 'bin', 'whisper-cli.exe'),
      path.join(this.modelDirectory, 'bin', 'main.exe'),
      path.join(this.modelDirectory, 'whisper-cli.exe'),
      path.join(this.modelDirectory, 'main.exe')
    );

    // 4. Standard AppData location
    candidates.push(
      path.join(os.homedir(), 'AppData', 'Roaming', 'echolingo', 'models', 'whisper', 'bin', 'whisper-cli.exe'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'echolingo', 'models', 'whisper', 'bin', 'main.exe')
    );

    // 5. Test temp directory
    candidates.push(
      path.join(os.tmpdir(), 'whisper-bin-test', 'whisper-cli.exe'),
      path.join(os.tmpdir(), 'whisper-bin-test', 'main.exe')
    );

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

    // Check packaged electron resources (Store MSIX / production bundle)
    const resourcesPath = (process as any).resourcesPath;
    if (resourcesPath) {
      const packagedBinModel = path.join(resourcesPath, 'bin', `ggml-${target}.bin`);
      if (fs.existsSync(packagedBinModel)) return packagedBinModel;
      const packagedModelsFolder = path.join(resourcesPath, 'models', `ggml-${target}.bin`);
      if (fs.existsSync(packagedModelsFolder)) return packagedModelsFolder;
    }

    // Check development resources
    const cwd = process.cwd();
    const devBinModel = path.join(cwd, 'apps', 'desktop', 'resources', 'bin', `ggml-${target}.bin`);
    if (fs.existsSync(devBinModel)) return devBinModel;

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
   * On Windows, unblocks binaries by clearing NTFS Mark of the Web (Zone.Identifier)
   * natively without spawning PowerShell or generating untrusted certificates.
   */
  public async ensureWindowsBinariesSigned(targetDir?: string): Promise<boolean> {
    if (process.platform !== 'win32') return true;

    const dir =
      targetDir ||
      (this.binaryPath ? path.dirname(this.binaryPath) : path.join(this.modelDirectory, 'bin'));
    if (!fs.existsSync(dir)) return false;

    try {
      const files = await fsp.readdir(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        await fsp.unlink(`${fullPath}:Zone.Identifier`).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
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

      const lang = normalizeWhisperLanguage(options.language);

      const args = [
        '-m', model,
        '-f', tempWav,
        '-l', lang,
        '-nt', // no timestamps
        '-t', '4', // use 4 computation threads
        '--no-fallback',
      ];

      let stdout: string;
      try {
        const res = await execFileAsync(binary, args, { cwd: path.dirname(binary) });
        stdout = res.stdout;
      } catch (execErr: unknown) {
        const msg = String((execErr as Error)?.message || execErr);
        log.warn('Local Whisper execution error:', msg);
        return {
          text: '[Local Whisper: Speech recognition blocked by Windows security policy or missing dependencies. Switch to Windows Speech in Settings > Providers.]',
          isFinal: true,
          confidence: 0,
          durationMs: Date.now() - start,
        };
      }

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

    // Step 1: Ensure binary runner exists (on Windows, download only if missing from resources and disk)
    if (process.platform === 'win32' && !this.resolveBinaryPath()) {
      const binDir = path.join(this.modelDirectory, 'bin');
      await fsp.mkdir(binDir, { recursive: true });
      const zipPath = path.join(this.modelDirectory, 'whisper-bin-x64.zip');

      log.info('Downloading whisper.cpp Windows binaries...');
      await downloadFile(WHISPER_BIN_WINDOWS_URL, zipPath);

      // Extract archive cleanly using built-in tar.exe without invoking PowerShell
      try {
        await execFileAsync('tar.exe', ['-xf', zipPath, '-C', binDir]);
      } catch (tarErr) {
        log.warn('Could not extract using tar.exe:', tarErr);
      }

      await fsp.unlink(zipPath).catch(() => {});

      // Safely unblock extracted files
      await this.ensureWindowsBinariesSigned(binDir);

      // Create whisper-cli.exe alias if main.exe exists
      const mainExe = path.join(binDir, 'main.exe');
      const cliExe = path.join(binDir, 'whisper-cli.exe');
      if (fs.existsSync(mainExe) && !fs.existsSync(cliExe)) {
        await fsp.copyFile(mainExe, cliExe).catch(() => {});
      }

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
