import { calculateRms } from "@echo-lingo/speech-core/resampler.js";

export interface VadConfig {
  threshold: number; // energy threshold (default 0.02)
  minSpeechDurationMs: number; // minimum speech duration (default 400ms)
  silenceTimeoutMs: number; // silence duration to declare speech ended (default 800ms)
  maxChunkDurationMs: number; // maximum chunk duration before cutting (default 3000ms)
  sampleRate: number; // sample rate in Hz (default 16000)
}

export interface VadChunkEvent {
  samples: Float32Array;
  durationMs: number;
  isSpeech: boolean;
  isFinal: boolean;
  timestamp: number;
}

export class VoiceActivityDetector {
  private config: VadConfig;
  private isSpeaking = false;
  private speechBuffer: number[] = [];
  private silenceDurationMs = 0;
  private currentSpeechDurationMs = 0;
  private lastChunkTime = 0;

  constructor(config: Partial<VadConfig> = {}) {
    this.config = {
      threshold: config.threshold ?? 0.008,
      minSpeechDurationMs: config.minSpeechDurationMs ?? 400,
      silenceTimeoutMs: config.silenceTimeoutMs ?? 800,
      maxChunkDurationMs: config.maxChunkDurationMs ?? 5000,
      sampleRate: config.sampleRate ?? 16000,
    };
  }

  public setThreshold(threshold: number): void {
    this.config.threshold = Math.max(0.001, Math.min(0.5, threshold));
  }

  /**
   * Process a small slice of audio samples (e.g. 512 samples) and emit chunk events if ready
   */
  public processFrame(frame: Float32Array): VadChunkEvent | null {
    const rms = calculateRms(frame);
    const frameDurationMs = (frame.length / this.config.sampleRate) * 1000;
    const now = Date.now();
    const isAboveThreshold = rms >= this.config.threshold;

    if (isAboveThreshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.currentSpeechDurationMs = 0;
        this.lastChunkTime = now;
      }
      this.silenceDurationMs = 0;
      this.currentSpeechDurationMs += frameDurationMs;

      for (let i = 0; i < frame.length; i++) {
        this.speechBuffer.push(frame[i]);
      }

      // Check if maximum chunk duration reached during continuous speech
      if (this.currentSpeechDurationMs >= this.config.maxChunkDurationMs) {
        const chunkSamples = new Float32Array(this.speechBuffer);
        const event: VadChunkEvent = {
          samples: chunkSamples,
          durationMs: this.currentSpeechDurationMs,
          isSpeech: true,
          isFinal: false,
          timestamp: now,
        };

        // Keep 200ms overlap for continuity
        const overlapSamples = Math.floor(
          (200 / 1000) * this.config.sampleRate,
        );
        this.speechBuffer = this.speechBuffer.slice(-overlapSamples);
        this.currentSpeechDurationMs = 200;
        return event;
      }
    } else {
      if (this.isSpeaking) {
        this.silenceDurationMs += frameDurationMs;
        this.currentSpeechDurationMs += frameDurationMs;

        for (let i = 0; i < frame.length; i++) {
          this.speechBuffer.push(frame[i]);
        }

        // Silence timeout: finalize segment
        if (this.silenceDurationMs >= this.config.silenceTimeoutMs) {
          this.isSpeaking = false;

          if (this.currentSpeechDurationMs >= this.config.minSpeechDurationMs) {
            const chunkSamples = new Float32Array(this.speechBuffer);
            const event: VadChunkEvent = {
              samples: chunkSamples,
              durationMs: this.currentSpeechDurationMs,
              isSpeech: true,
              isFinal: true,
              timestamp: now,
            };
            this.speechBuffer = [];
            this.currentSpeechDurationMs = 0;
            this.silenceDurationMs = 0;
            return event;
          } else {
            // Speech was too short (click/noise), discard
            this.speechBuffer = [];
            this.currentSpeechDurationMs = 0;
            this.silenceDurationMs = 0;
          }
        }
      }
    }

    return null;
  }

  /**
   * Flush any remaining speech buffer
   */
  public flush(): VadChunkEvent | null {
    if (this.speechBuffer.length > 0 && this.currentSpeechDurationMs >= 300) {
      const chunkSamples = new Float32Array(this.speechBuffer);
      const event: VadChunkEvent = {
        samples: chunkSamples,
        durationMs: this.currentSpeechDurationMs,
        isSpeech: true,
        isFinal: true,
        timestamp: Date.now(),
      };
      this.reset();
      return event;
    }
    this.reset();
    return null;
  }

  public reset(): void {
    this.isSpeaking = false;
    this.speechBuffer = [];
    this.silenceDurationMs = 0;
    this.currentSpeechDurationMs = 0;
  }

  public get isSpeechActive(): boolean {
    return this.isSpeaking;
  }
}
