import { TranscriptionSegment } from '@echo-lingo/contracts';
import { VoiceActivityDetector, VadChunkEvent } from '@echo-lingo/speech-core/vad.js';
import { BoundedAudioQueue } from '@echo-lingo/speech-core/buffer.js';
import { ISpeechProvider } from '@echo-lingo/speech-core/provider.interface.js';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('SpeechPipeline');

export interface SpeechPipelineConfig {
  sessionId: string;
  sourceLanguage: string;
  provider: ISpeechProvider;
  onTranscription: (segment: TranscriptionSegment, latencyMs: number) => void | Promise<void>;
  onError?: (error: Error) => void;
  sampleRate?: number;
  vadThreshold?: number;
}

export class SpeechPipeline {
  private config: SpeechPipelineConfig;
  private vad: VoiceActivityDetector;
  private queue = new BoundedAudioQueue<VadChunkEvent>(15);
  private isProcessing = false;
  private isRunning = false;
  private sessionStartTime = 0;
  private currentSegmentIndex = 0;

  constructor(config: SpeechPipelineConfig) {
    this.config = config;
    this.vad = new VoiceActivityDetector({
      threshold: config.vadThreshold ?? 0.008,
      sampleRate: config.sampleRate ?? 16000,
    });
  }

  public start(): void {
    this.isRunning = true;
    this.sessionStartTime = Date.now();
    this.vad.reset();
    this.queue.clear();
  }

  public stop(): void {
    const remaining = this.vad.flush();
    if (remaining) {
      this.queue.push(remaining);
    }
    this.isRunning = false;
    this.processQueue();
  }

  public setVadThreshold(threshold: number): void {
    this.vad.setThreshold(threshold);
  }

  public setLanguage(lang: string): void {
    this.config.sourceLanguage = lang;
  }

  public setProvider(provider: ISpeechProvider): void {
    this.config.provider = provider;
  }

  /**
   * Feed a frame of 16kHz mono audio samples into the pipeline
   */
  public feedAudio(samples: Float32Array): void {
    if (!this.isRunning) return;

    const chunkEvent = this.vad.processFrame(samples);
    if (chunkEvent) {
      this.queue.push(chunkEvent);
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.pop();
        if (!item) break;

        const startInference = Date.now();
        const startMs = Math.max(0, item.timestamp - this.sessionStartTime - item.durationMs);
        const endMs = startMs + item.durationMs;

        try {
          const res = await this.config.provider.transcribe(item.samples, {
            sampleRate: 16000,
            language: this.config.sourceLanguage === 'auto' ? undefined : this.config.sourceLanguage,
          });

          const latencyMs = Date.now() - startInference;
          const text = res.text.trim();

          if (text.length > 0) {
            const segmentId = `seg_${this.config.sessionId}_${++this.currentSegmentIndex}`;
            const segment: TranscriptionSegment = {
              id: segmentId,
              sessionId: this.config.sessionId,
              text,
              isFinal: item.isFinal || res.isFinal,
              startMs,
              endMs,
              confidence: res.confidence ?? 0.9,
              language: res.detectedLanguage || this.config.sourceLanguage,
              provider: this.config.provider.id,
              createdAt: Date.now(),
            };

            try {
              const resCallback = this.config.onTranscription(segment, latencyMs);
              if (resCallback && typeof (resCallback as any).catch === 'function') {
                (resCallback as any).catch((cbErr: unknown) => {
                  log.error('onTranscription async error:', cbErr);
                });
              }
            } catch (cbErr) {
              log.error('onTranscription sync error:', cbErr);
            }
          }
        } catch (err) {
          if (this.config.onError && err instanceof Error) {
            this.config.onError(err);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public get queueLength(): number {
    return this.queue.length;
  }

  public get queueFillRatio(): number {
    return this.queue.fillRatio;
  }

  public get isSpeaking(): boolean {
    return this.vad.isSpeechActive;
  }
}
