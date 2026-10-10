import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';

export interface TranscriptionOptions {
  sampleRate: number;
  language?: string; // 'en', 'vi', 'auto' etc.
  task?: 'transcribe' | 'translate';
  prompt?: string;
}

export interface TranscriptionResponse {
  text: string;
  isFinal: boolean;
  confidence?: number;
  detectedLanguage?: string;
  durationMs: number;
}

export interface ISpeechProvider {
  readonly id: SpeechEngineType;
  readonly name: string;
  readonly isLocal: boolean;

  initialize(config?: Record<string, unknown>): Promise<void>;
  isReady(): boolean;
  transcribe(
    audioSamples: Float32Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResponse>;
  getModelStatus?(): Promise<SpeechModelStatus[]>;
  dispose?(): Promise<void>;
}
