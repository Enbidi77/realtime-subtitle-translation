import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';
import { ISpeechProvider } from '@echo-lingo/speech-core';
import {
  LocalWhisperProvider,
  OpenAIWhisperProvider,
  GroqWhisperProvider,
  MockSpeechProvider,
  WindowsSpeechProvider,
} from '@echo-lingo/provider-adapters';
import { app } from 'electron';
import * as path from 'node:path';
import { createLogger, ILogger } from '@echo-lingo/logger';
import { getCredentialsService } from '@/services/credentials-service.js';
import { getDatabase } from '@/database/db-instance.js';

export class SpeechService {
  private static instance: SpeechService | null = null;
  private readonly log: ILogger = createLogger('SpeechService');
  private providers = new Map<SpeechEngineType, ISpeechProvider>();
  private activeEngine: SpeechEngineType = 'whisper-local';

  public static getInstance(): SpeechService {
    if (!SpeechService.instance) {
      SpeechService.instance = new SpeechService();
    }
    return SpeechService.instance;
  }

  constructor() {
    let modelDirectory: string | undefined;
    try {
      if (app && typeof app.getPath === 'function') {
        modelDirectory = path.join(app.getPath('userData'), 'models', 'whisper');
      }
    } catch {
      // Fallback in non-electron test environments
    }

    const local = new LocalWhisperProvider({ modelDirectory });
    const windows = new WindowsSpeechProvider();
    const openai = new OpenAIWhisperProvider();
    const groq = new GroqWhisperProvider();
    const mock = new MockSpeechProvider();

    this.providers.set('whisper-local', local);
    this.providers.set('windows-speech', windows);
    this.providers.set('openai-whisper', openai);
    this.providers.set('groq-whisper', groq);
    this.providers.set('mock', mock);

    this.loadSavedCredentials();
    getCredentialsService().onCredentialsChange(() => this.loadSavedCredentials());
  }

  public downloadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    const local = this.providers.get('whisper-local') as LocalWhisperProvider;
    if (local && typeof local.downloadModel === 'function') {
      return local.downloadModel(modelId, onProgress);
    }
    return Promise.resolve();
  }

  public async downloadModelWithProgress(
    modelId: string,
    onProgress: (status: { id: string; name: string; isInstalled: boolean; downloadProgress: number; error?: string }) => void
  ): Promise<{ ok: boolean }> {
    this.log.info(`[Models] Requested download for model: ${modelId}`);
    try {
      await this.downloadModel(modelId, (progress) => {
        onProgress({
          id: modelId,
          name: `Whisper ${modelId.toUpperCase()}`,
          isInstalled: progress >= 100,
          downloadProgress: progress,
        });
      });
      return { ok: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.log.error(`[Models] Download failed for ${modelId}:`, errMsg);
      onProgress({
        id: modelId,
        name: `Whisper ${modelId.toUpperCase()}`,
        isInstalled: false,
        downloadProgress: 0,
        error: errMsg,
      });
      throw err;
    }
  }

  public loadSavedCredentials(): void {
    const credentialsService = getCredentialsService();
    const openaiKey = credentialsService.getCredential('openai-whisper');
    const openai = this.providers.get('openai-whisper') as OpenAIWhisperProvider;
    if (openai && openaiKey) openai.setApiKey(openaiKey);

    const groqKey = credentialsService.getCredential('groq-whisper');
    const groq = this.providers.get('groq-whisper') as GroqWhisperProvider;
    if (groq && groqKey) groq.setApiKey(groqKey);
  }

  public getProvider(engine?: SpeechEngineType): ISpeechProvider {
    this.loadSavedCredentials();
    const selected = engine || this.activeEngine;
    if (selected === 'whisper-local') {
      try {
        const settings = getDatabase().getSetting<any>('app_settings', null);
        const local = this.providers.get('whisper-local') as LocalWhisperProvider;
        if (local && settings?.localWhisperModel) {
          local.setModelName(settings.localWhisperModel);
        }
      } catch {
        // ignore
      }
    }
    const provider = this.providers.get(selected);
    if (!provider) {
      return this.providers.get('whisper-local')!;
    }
    return provider;
  }

  public setActiveEngine(engine: SpeechEngineType): void {
    if (this.providers.has(engine)) {
      this.activeEngine = engine;
    }
  }

  public async getModelStatus(engine?: SpeechEngineType): Promise<SpeechModelStatus[]> {
    const selected = engine || this.activeEngine;
    const provider = this.providers.get(selected);
    if (provider && provider.getModelStatus) {
      return provider.getModelStatus();
    }

    const res: SpeechModelStatus[] = [];
    const windows = this.providers.get('windows-speech');
    if (windows?.getModelStatus) {
      res.push(...(await windows.getModelStatus()));
    }
    const local = this.providers.get('whisper-local');
    if (local?.getModelStatus) {
      res.push(...(await local.getModelStatus()));
    }
    return res;
  }
}

export function getSpeechService(): SpeechService {
  return SpeechService.getInstance();
}
