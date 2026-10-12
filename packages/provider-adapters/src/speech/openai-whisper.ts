import {
  ISpeechProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  encodeWav,
} from '@echo-lingo/speech-core';
import { SpeechEngineType } from '@echo-lingo/contracts';

export class OpenAIWhisperProvider implements ISpeechProvider {
  public readonly id: SpeechEngineType = 'openai-whisper';
  public readonly name = 'OpenAI Whisper Cloud';
  public readonly isLocal = false;
  private apiKey = '';
  private model = 'whisper-1';

  constructor(apiKey = '', model = 'whisper-1') {
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
      throw new Error('OpenAI API Key is not configured');
    }

    const start = Date.now();
    const wavBytes = encodeWav(audioSamples, options.sampleRate || 16000);

    const formData = new FormData();
    const blob = new Blob([wavBytes as any], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', this.model);

    if (options.language && options.language !== 'auto') {
      formData.append('language', options.language);
    }
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Whisper error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as { text?: string };
    const text = (json.text || '').trim();

    return {
      text,
      isFinal: true,
      confidence: 0.95,
      durationMs: Date.now() - start,
    };
  }
}
