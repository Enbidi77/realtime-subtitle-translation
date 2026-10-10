import {
  ISpeechProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  encodeWav,
} from '@echo-lingo/speech-core';
import { SpeechEngineType } from '@echo-lingo/contracts';

export class GroqWhisperProvider implements ISpeechProvider {
  public readonly id: SpeechEngineType = 'groq-whisper';
  public readonly name = 'Groq Cloud Whisper (Ultra-Fast)';
  public readonly isLocal = false;
  private apiKey = '';
  private model = 'whisper-large-v3-turbo';

  constructor(apiKey = '', model = 'whisper-large-v3-turbo') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.apiKey && typeof config.apiKey === 'string') {
      this.apiKey = config.apiKey.trim();
    }
  }

  public isReady(): boolean {
    return this.apiKey.length > 0;
  }

  public async transcribe(
    audioSamples: Float32Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResponse> {
    if (!this.apiKey) {
      throw new Error('Groq API Key is not configured');
    }

    const start = Date.now();
    const wavBytes = encodeWav(audioSamples, options.sampleRate || 16000);

    const formData = new FormData();
    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', this.model);

    if (options.language && options.language !== 'auto') {
      formData.append('language', options.language);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[GroqWhisper] API error (${response.status}):`, errText);
      throw new Error(`Groq Whisper error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as { text?: string };
    const text = (json.text || '').trim();
    if (text) {
      console.log(`[GroqWhisper] Transcribed in ${Date.now() - start}ms: "${text}"`);
    }

    return {
      text,
      isFinal: true,
      confidence: 0.98,
      durationMs: Date.now() - start,
    };
  }
}
