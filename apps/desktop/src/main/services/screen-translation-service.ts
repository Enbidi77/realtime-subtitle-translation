import {
  ContinuousOcrConfig,
  ContinuousOcrState,
  ContinuousOcrStats,
  FloatingPanelPayload,
  IPC_CHANNELS,
  OcrHistoryItem,
  OcrHistoryQuery,
  OcrProviderCapability,
  OcrProviderId,
  OcrResponse,
  ScreenCaptureRegion,
  ScreenTranslateRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import {
  ContinuousOcrScheduler,
  OcrRegistry,
} from '@echo-lingo/ocr-core';
import {
  WindowsNativeOcrProvider,
  TesseractOcrProvider,
  MockOcrProvider,
} from '@echo-lingo/provider-adapters';
import { getDatabase } from '@/database/db-instance.js';
import { getTranslationService } from '@/services/translation-service.js';
import { getScreenCaptureManager } from '@/screen-capture/capture-manager.js';
import { openSelectionOverlay, closeSelectionOverlay } from '@/windows/selection-window.js';
import { showOcrFloatingPanel, hideOcrFloatingPanel } from '@/windows/ocr-panel-window.js';
import { getMainWindow } from '@/windows/main-window.js';
import { getOverlayWindow } from '@/windows/overlay-window.js';

export class ScreenTranslationService {
  private ocrRegistry: OcrRegistry;
  private continuousScheduler: ContinuousOcrScheduler | null = null;
  private activeContinuousConfig: ContinuousOcrConfig | null = null;

  constructor() {
    this.ocrRegistry = new OcrRegistry();

    // Register local providers
    this.ocrRegistry.register(new WindowsNativeOcrProvider());
    this.ocrRegistry.register(new TesseractOcrProvider());
    this.ocrRegistry.register(new MockOcrProvider());

    // Prefer Windows Native on Windows, otherwise Tesseract
    if (process.platform === 'win32') {
      this.ocrRegistry.setActiveProvider('windows-native');
    } else {
      this.ocrRegistry.setActiveProvider('tesseract');
    }
  }

  public getOcrRegistry(): OcrRegistry {
    return this.ocrRegistry;
  }

  public getOcrCapabilities(): OcrProviderCapability[] {
    return this.ocrRegistry.getAllCapabilities();
  }

  public setOcrProvider(id: OcrProviderId): boolean {
    return this.ocrRegistry.setActiveProvider(id);
  }

  /**
   * Triggers the interactive region selection overlay.
   */
  public async selectRegion(displayId?: number): Promise<ScreenCaptureRegion | null> {
    return openSelectionOverlay(displayId);
  }

  public cancelSelection(): void {
    closeSelectionOverlay(null);
  }

  /**
   * Recognizes text from a screen region or raw image data.
   */
  public async recognizeRegion(
    region: ScreenCaptureRegion,
    options?: {
      ocrLanguage?: string;
      ocrProviderId?: OcrProviderId;
      profile?: any;
    }
  ): Promise<{ ocrResponse: OcrResponse; imageDataUrl: string }> {
    const captureMgr = getScreenCaptureManager();
    const { buffer, dataUrl } = await captureMgr.captureRegion(region, {
      profile: options?.profile || 'general',
      grayscale: true,
      contrastStretch: true,
      binarize: false,
      invert: false,
      scale: 1,
    });

    const ocrResponse = await this.ocrRegistry.recognize(
      {
        imageBuffer: new Uint8Array(buffer),
        language: options?.ocrLanguage || 'auto',
      },
      options?.ocrProviderId
    );

    return { ocrResponse, imageDataUrl: dataUrl };
  }

  /**
   * Captures a region, runs OCR, translates the text, optionally shows floating panel,
   * and persists the result to history.
   */
  public async captureAndTranslate(req: ScreenTranslateRequest): Promise<{
    ocrResult: OcrResponse;
    translationResult: TranslationResult;
    historyItem: OcrHistoryItem;
  }> {
    const startMs = Date.now();
    const translationService = getTranslationService();
    const db = getDatabase();

    // 1. Capture and OCR
    const { ocrResponse, imageDataUrl } = await this.recognizeRegion(req.region, {
      ocrLanguage: req.ocrLanguage,
      ocrProviderId: req.ocrProviderId,
      profile: req.profile,
    });

    const recognizedText = ocrResponse.text.trim();
    if (!recognizedText) {
      throw new Error('No text was recognized in the selected region. Please try selecting a clearer area or adjust the preprocessing preset.');
    }

    // 2. Translate using existing translation service
    const targetLang = (req.targetLanguages && req.targetLanguages[0]) || 'vi';
    const translationResult = await translationService.translate(
      {
        text: recognizedText,
        sourceLanguage: req.sourceLanguage || 'auto',
        targetLanguage: targetLang,
        priority: 'high',
      },
      req.translationProviderId
    );

    const totalDuration = Date.now() - startMs;

    // 3. Persist to database history (respecting privacy: screenshots only saved if explicitly opted in)
    const settings = db.getSetting('app_settings', {} as any);
    const shouldPersistScreenshot = Boolean(settings?.screenTranslation?.persistScreenshots);

    const historyItem: OcrHistoryItem = {
      id: 'ocr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: Date.now(),
      ocrProvider: ocrResponse.providerId,
      ocrLanguage: req.ocrLanguage || 'auto',
      sourceLanguage: translationResult.detectedSourceLanguage || req.sourceLanguage || 'auto',
      targetLanguage: targetLang,
      originalText: recognizedText,
      translatedText: translationResult.translatedText,
      confidence: ocrResponse.confidence,
      durationMs: totalDuration,
      sessionType: 'single',
      imageData: shouldPersistScreenshot ? imageDataUrl : undefined,
    };

    if (settings?.screenTranslation?.saveHistory !== false) {
      db.insertOcrHistoryItem(historyItem);
    }

    // 4. Show floating result panel if requested or skipPreview enabled
    const panelPayload: FloatingPanelPayload = {
      originalText: recognizedText,
      translatedText: translationResult.translatedText,
      sourceLanguage: historyItem.sourceLanguage,
      targetLanguage: targetLang,
      confidence: ocrResponse.confidence,
      durationMs: totalDuration,
      region: req.region,
      canRetranslate: true,
    };

    showOcrFloatingPanel(panelPayload);

    return {
      ocrResult: ocrResponse,
      translationResult,
      historyItem,
    };
  }

  /**
   * Starts continuous screen OCR monitoring loop.
   */
  public startContinuous(config: ContinuousOcrConfig): void {
    if (this.continuousScheduler) {
      this.continuousScheduler.stop();
    }

    this.activeContinuousConfig = config;
    const captureMgr = getScreenCaptureManager();
    const translationService = getTranslationService();
    const db = getDatabase();

    this.continuousScheduler = new ContinuousOcrScheduler(config, {
      onCaptureRegion: async () => {
        try {
          const { buffer } = await captureMgr.captureRegion(config.region);
          return buffer.toString('base64');
        } catch (err) {
          console.warn('[ScreenTranslationService] Continuous capture failed:', err);
          return null;
        }
      },
      onOcr: async (imageData: string) => {
        return this.ocrRegistry.recognize(
          {
            imageBuffer: imageData,
            language: config.ocrLanguage,
          },
          config.ocrProviderId
        );
      },
      onTranslate: async (text: string, targetLanguage: string) => {
        return translationService.translate(
          {
            text,
            sourceLanguage: config.sourceLanguage,
            targetLanguage,
            priority: 'high',
          },
          config.translationProviderId
        );
      },
      onResult: (result) => {
        // Save to database
        const historyItem: OcrHistoryItem = {
          id: 'cont_' + Date.now(),
          createdAt: Date.now(),
          ocrProvider: config.ocrProviderId,
          ocrLanguage: config.ocrLanguage,
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguages[0] || 'vi',
          originalText: result.recognizedText,
          translatedText: result.translatedText,
          confidence: result.confidence,
          durationMs: result.durationMs,
          sessionType: 'continuous',
        };

        db.insertOcrHistoryItem(historyItem);

        // Update floating panel
        showOcrFloatingPanel({
          originalText: result.recognizedText,
          translatedText: result.translatedText,
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguages[0] || 'vi',
          confidence: result.confidence,
          durationMs: result.durationMs,
          region: config.region,
        });

        // Broadcast to main window and overlay
        this.broadcastEvent(IPC_CHANNELS.SCREEN_CONTINUOUS_EVENT_STREAM, {
          historyItem,
          isChange: result.isChange,
        });
      },
      onStateChange: (state, stats) => {
        this.broadcastEvent(IPC_CHANNELS.SCREEN_CONTINUOUS_STATUS_STREAM, { state, stats });
      },
    });

    this.continuousScheduler.start();
  }

  public stopContinuous(): void {
    if (this.continuousScheduler) {
      this.continuousScheduler.stop();
      this.continuousScheduler = null;
    }
    this.activeContinuousConfig = null;
  }

  public pauseContinuous(): void {
    this.continuousScheduler?.pause();
  }

  public resumeContinuous(): void {
    this.continuousScheduler?.resume();
  }

  public getContinuousStats(): ContinuousOcrStats {
    if (this.continuousScheduler) {
      return this.continuousScheduler.getStats();
    }
    return {
      state: 'idle',
      capturedCount: 0,
      recognizedCount: 0,
      translatedCount: 0,
      skippedCount: 0,
      averageDurationMs: 0,
    };
  }

  // ================= History =================
  public getHistory(query?: OcrHistoryQuery): OcrHistoryItem[] {
    const db = getDatabase();
    if (query?.query) {
      return db.searchOcrHistory(query.query, query.limit, query.offset);
    }
    return db.getAllOcrHistory(query?.limit ?? 50, query?.offset ?? 0);
  }

  public getHistoryItem(id: string): OcrHistoryItem | null {
    return getDatabase().getOcrHistoryItem(id);
  }

  public deleteHistoryItem(id: string): void {
    getDatabase().deleteOcrHistoryItem(id);
  }

  public clearHistory(): void {
    getDatabase().clearAllOcrHistory();
  }

  private broadcastEvent(channel: string, payload: unknown): void {
    try {
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed() && !mainWin.webContents.isDestroyed()) {
        mainWin.webContents.send(channel, payload);
      }
      const overlayWin = getOverlayWindow();
      if (overlayWin && !overlayWin.isDestroyed() && !overlayWin.webContents.isDestroyed()) {
        overlayWin.webContents.send(channel, payload);
      }
    } catch (err) {
      console.warn('[ScreenTranslationService] Broadcast error:', err);
    }
  }

  public async dispose(): Promise<void> {
    this.stopContinuous();
    await this.ocrRegistry.dispose();
  }
}

let screenTranslationServiceInstance: ScreenTranslationService | null = null;
export function getScreenTranslationService(): ScreenTranslationService {
  if (!screenTranslationServiceInstance) {
    screenTranslationServiceInstance = new ScreenTranslationService();
  }
  return screenTranslationServiceInstance;
}
