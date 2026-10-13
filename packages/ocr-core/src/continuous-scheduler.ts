import {
  ContinuousOcrConfig,
  ContinuousOcrState,
  ContinuousOcrStats,
  OcrResponse,
  TranslationResult,
} from '@echo-lingo/contracts';
import { isMeaningfulChange, extractAddedLines } from '@echo-lingo/ocr-core/text-deduplicator.js';

export interface ContinuousOcrCallbacks {
  onCaptureRegion: () => Promise<string | null>; // Returns base64 image data or null if capture failed
  onOcr: (imageData: string) => Promise<OcrResponse>;
  onTranslate: (text: string, targetLanguage: string) => Promise<TranslationResult>;
  onResult: (result: {
    recognizedText: string;
    translatedText: string;
    confidence: number;
    durationMs: number;
    isChange: boolean;
  }) => void;
  onStateChange: (state: ContinuousOcrState, stats: ContinuousOcrStats) => void;
  onError?: (error: Error) => void;
}

export class ContinuousOcrScheduler {
  private config: ContinuousOcrConfig;
  private callbacks: ContinuousOcrCallbacks;
  private state: ContinuousOcrState = 'idle';
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private lastRecognizedText = '';
  private stats: ContinuousOcrStats = {
    state: 'idle',
    capturedCount: 0,
    recognizedCount: 0,
    translatedCount: 0,
    skippedCount: 0,
    averageDurationMs: 0,
  };

  constructor(config: ContinuousOcrConfig, callbacks: ContinuousOcrCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  public getState(): ContinuousOcrState {
    return this.state;
  }

  public getStats(): ContinuousOcrStats {
    return { ...this.stats, state: this.state };
  }

  public updateConfig(updates: Partial<ContinuousOcrConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public start(): void {
    if (this.state === 'capturing' || this.state === 'recognizing' || this.state === 'translating') {
      return;
    }

    this.setState('preparing');
    this.lastRecognizedText = '';
    this.stats = {
      state: 'capturing',
      capturedCount: 0,
      recognizedCount: 0,
      translatedCount: 0,
      skippedCount: 0,
      averageDurationMs: 0,
      lastCapturedAt: Date.now(),
    };

    this.setState('capturing');
    this.scheduleNextTick(0);
  }

  public stop(): void {
    this.setState('stopping');
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isProcessing = false;
    this.setState('idle');
  }

  public pause(): void {
    if (this.state === 'capturing' || this.state === 'recognizing' || this.state === 'translating') {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.setState('capturing');
      this.scheduleNextTick(100);
    }
  }

  private setState(state: ContinuousOcrState, errorMsg?: string): void {
    this.state = state;
    this.stats.state = state;
    if (errorMsg) {
      this.stats.errorMessage = errorMsg;
    }
    this.callbacks.onStateChange(this.state, this.getStats());
  }

  private scheduleNextTick(delayMs: number): void {
    if (this.state !== 'capturing' && this.state !== 'recognizing' && this.state !== 'translating') {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.processTick().catch((err) => {
        console.error('[ContinuousOcrScheduler] Error in processTick:', err);
        if (this.callbacks.onError) this.callbacks.onError(err);
      });
    }, delayMs);
  }

  private async processTick(): Promise<void> {
    if (this.state === 'idle' || this.state === 'paused' || this.state === 'stopping') {
      return;
    }

    // Backpressure guard: skip tick if previous capture is still in flight
    if (this.isProcessing) {
      this.stats.skippedCount++;
      this.scheduleNextTick(this.config.intervalMs);
      return;
    }

    this.isProcessing = true;
    const startMs = Date.now();

    try {
      this.setState('capturing');
      this.stats.capturedCount++;
      this.stats.lastCapturedAt = Date.now();

      // 1. Capture screen region
      const imageData = await this.callbacks.onCaptureRegion();
      if (!imageData) {
        this.stats.skippedCount++;
        this.scheduleNextTick(this.config.intervalMs);
        return;
      }

      // 2. OCR recognition
      this.setState('recognizing');
      const ocrResult = await this.callbacks.onOcr(imageData);
      this.stats.recognizedCount++;

      const recognizedText = ocrResult.text.trim();

      // 3. Deduplication and Change Detection
      if (!recognizedText) {
        this.stats.skippedCount++;
        this.scheduleNextTick(this.config.intervalMs);
        return;
      }

      const hasChanged = isMeaningfulChange(
        this.lastRecognizedText,
        recognizedText,
        this.config.changeThreshold
      );

      if (this.config.ignoreUnchanged && !hasChanged) {
        this.stats.skippedCount++;
        this.scheduleNextTick(this.config.intervalMs);
        return;
      }

      // 4. Translate meaningful changes
      this.setState('translating');
      let textToTranslate = recognizedText;

      if (this.config.translateOnlyDiff && this.lastRecognizedText) {
        const addedLines = extractAddedLines(this.lastRecognizedText, recognizedText);
        if (addedLines.length > 0) {
          textToTranslate = addedLines.join('\n');
        }
      }

      const targetLang = this.config.targetLanguages[0] || 'vi';
      const translationResult = await this.callbacks.onTranslate(textToTranslate, targetLang);
      this.stats.translatedCount++;

      this.lastRecognizedText = recognizedText;
      const totalDuration = Date.now() - startMs;

      // Update rolling average duration
      const prevTotal = this.stats.averageDurationMs * (this.stats.translatedCount - 1);
      this.stats.averageDurationMs = Math.round((prevTotal + totalDuration) / this.stats.translatedCount);

      // 5. Emit successful result
      this.callbacks.onResult({
        recognizedText,
        translatedText: translationResult.translatedText,
        confidence: ocrResult.confidence,
        durationMs: totalDuration,
        isChange: hasChanged,
      });
    } catch (err: any) {
      console.error('[ContinuousOcrScheduler] Tick failed:', err);
      this.setState('error', err?.message || 'Processing tick failed');
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
    } finally {
      this.isProcessing = false;
      const curState = this.state as ContinuousOcrState;
      if (curState !== 'idle' && curState !== 'paused' && curState !== 'stopping') {
        this.setState('capturing');
        this.scheduleNextTick(this.config.intervalMs);
      }
    }
  }
}
