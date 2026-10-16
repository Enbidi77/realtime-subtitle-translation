import {
  ISpeechProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  encodeWav,
} from '@echo-lingo/speech-core';
import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';
import { dotnetBridge, SapiRecognizerItem as DotnetRecognizerItem } from '@echo-lingo/dotnet-bridge';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('WindowsSpeechProvider');

export interface WindowsSpeechConfig {
  preferredCulture?: string;
  /** @deprecated PowerShell fallback has been replaced by native .NET IPC */
  usePowerShellOnly?: boolean;
}

interface SapiRecognitionResult {
  text?: string;
  confidence?: number;
  culture?: string;
  error?: string;
}

export class WindowsSpeechProvider implements ISpeechProvider {
  public readonly id: SpeechEngineType = 'windows-speech';
  public readonly name = 'Windows System Speech (SAPI / Offline)';
  public readonly isLocal = true;

  private preferredCulture?: string;

  constructor(config: WindowsSpeechConfig = {}) {
    if (config.preferredCulture) this.preferredCulture = config.preferredCulture;
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.preferredCulture && typeof config.preferredCulture === 'string') {
      this.preferredCulture = config.preferredCulture;
    }
  }

  public isReady(): boolean {
    return process.platform === 'win32';
  }

  public async transcribe(
    audioSamples: Float32Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResponse> {
    const start = Date.now();

    // Check audio energy / RMS
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

    if (process.platform !== 'win32') {
      return {
        text: '',
        isFinal: true,
        confidence: 0,
        durationMs: Date.now() - start,
      };
    }

    // Encode audio to 16kHz mono WAV format expected by SAPI
    const wavBytes = encodeWav(audioSamples, options.sampleRate || 16000);
    const tempWav = path.join(
      os.tmpdir(),
      `echolingo_sapi_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
    );

    try {
      await fsp.writeFile(tempWav, Buffer.from(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength));

      const targetLang = options.language || this.preferredCulture || '';
      const result = await this.runRecognition(tempWav, targetLang);

      return {
        text: result.text || '',
        isFinal: true,
        confidence: result.confidence ?? 0.85,
        detectedLanguage: result.culture,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error('Transcription error:', errMsg);
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

  public async getModelStatus(): Promise<SpeechModelStatus[]> {
    if (process.platform !== 'win32') {
      return [
        {
          id: 'sapi-unavailable',
          name: 'Windows System Speech (Unavailable on non-Windows)',
          isInstalled: false,
          downloadProgress: 0,
          error: 'Windows Speech Recognition requires Windows 10/11.',
        },
      ];
    }

    try {
      const recognizers = await this.getInstalledRecognizers();
      if (recognizers.length === 0) {
        return [
          {
            id: 'sapi-none',
            name: 'Windows System Speech (No recognizer found)',
            isInstalled: false,
            downloadProgress: 0,
            error: 'No speech recognition engines found in Windows System.Speech.',
          },
        ];
      }

      return recognizers.map((r) => ({
        id: r.culture || r.id,
        name: `Windows SAPI - ${r.description || r.name} (${r.culture})`,
        isInstalled: true,
        downloadProgress: 100,
      }));
    } catch (err) {
      return [
        {
          id: 'sapi-error',
          name: 'Windows System Speech',
          isInstalled: false,
          downloadProgress: 0,
          error: err instanceof Error ? err.message : String(err),
        },
      ];
    }
  }

  private async runRecognition(wavPath: string, targetLang: string): Promise<SapiRecognitionResult> {
    if (!dotnetBridge.isAvailable()) {
      const errMsg = '.NET IPC Bridge (EchoLingo.Ipc) is not available on this system.';
      log.error(errMsg);
      return {
        text: '',
        confidence: 0,
        error: errMsg,
      };
    }

    try {
      const res = await dotnetBridge.speech.transcribe(wavPath, targetLang);
      return {
        text: res.text,
        confidence: res.confidence,
        culture: res.culture,
        error: res.error,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error('DotnetBridge speech recognition failed:', errMsg);
      return {
        text: '',
        confidence: 0,
        error: errMsg,
      };
    }
  }

  private async getInstalledRecognizers(): Promise<DotnetRecognizerItem[]> {
    if (!dotnetBridge.isAvailable()) {
      log.warn('.NET IPC Bridge is not available for listing speech recognizers.');
      return [];
    }

    try {
      return await dotnetBridge.speech.getInstalledRecognizers();
    } catch (err) {
      log.warn('DotnetBridge getInstalledRecognizers failed:', err);
      return [];
    }
  }
}
