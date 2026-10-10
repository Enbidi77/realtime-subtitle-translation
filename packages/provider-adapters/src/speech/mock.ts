import {
  ISpeechProvider,
  TranscriptionOptions,
  TranscriptionResponse,
} from '@echo-lingo/speech-core';
import { SpeechEngineType, SpeechModelStatus } from '@echo-lingo/contracts';

export class MockSpeechProvider implements ISpeechProvider {
  public readonly id: SpeechEngineType = 'mock';
  public readonly name = 'Mock Speech Engine (Test)';
  public readonly isLocal = true;

  private samplePhrases = [
    'Hello and welcome to EchoLingo.',
    'Real-time speech recognition is now processing audio.',
    'Subtitles are automatically translated and displayed.',
    'You can float this overlay on top of any video or meeting.',
    'Today we are demonstrating live multi-language captioning.',
    'Speech recognition pipeline is working at low latency.',
    'All translation is synchronized with the video playback.',
  ];
  private phraseIndex = 0;

  public async initialize(): Promise<void> {}

  public isReady(): boolean {
    return true;
  }

  public async transcribe(
    audioSamples: Float32Array,
    _options: TranscriptionOptions
  ): Promise<TranscriptionResponse> {
    if (audioSamples.length === 0) {
      return {
        text: '',
        isFinal: true,
        confidence: 0,
        durationMs: 5,
      };
    }

    const text = this.samplePhrases[this.phraseIndex % this.samplePhrases.length];
    this.phraseIndex++;

    return {
      text,
      isFinal: true,
      confidence: 0.96,
      durationMs: 25,
    };
  }

  public async getModelStatus(): Promise<SpeechModelStatus[]> {
    return [
      {
        id: 'mock-model',
        name: 'Mock Speech Model',
        isInstalled: true,
        downloadProgress: 100,
        sizeBytes: 1024,
      },
    ];
  }
}
