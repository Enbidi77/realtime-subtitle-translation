import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';
import { ISpeechProvider } from '@echo-lingo/speech-core';
import {
  LocalWhisperProvider,
  OpenAIWhisperProvider,
  GroqWhisperProvider,
  MockSpeechProvider,
  WindowsSpeechProvider,
} from '@echo-lingo/provider-adapters';
import { CredentialsService } from '@/services/credentials-service.js';

export class SpeechService {
  private providers = new Map<SpeechEngineType, ISpeechProvider>();
  private activeEngine: SpeechEngineType = 'whisper-local';

  constructor() {
    const local = new LocalWhisperProvider();
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
  }

  public loadSavedCredentials(): void {
    const openaiKey = CredentialsService.getCredential('openai-whisper');
    const openai = this.providers.get('openai-whisper') as OpenAIWhisperProvider;
    if (openai && openaiKey) openai.setApiKey(openaiKey);

    const groqKey = CredentialsService.getCredential('groq-whisper');
    const groq = this.providers.get('groq-whisper') as GroqWhisperProvider;
    if (groq && groqKey) groq.setApiKey(groqKey);
  }

  public getProvider(engine?: SpeechEngineType): ISpeechProvider {
    this.loadSavedCredentials();
    const selected = engine || this.activeEngine;
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

let speechServiceInstance: SpeechService | null = null;
export function getSpeechService(): SpeechService {
  if (!speechServiceInstance) {
    speechServiceInstance = new SpeechService();
  }
  return speechServiceInstance;
}
