import {
  ContinuousOcrConfig,
  ContinuousOcrState,
  ContinuousOcrStats,
  DisplayInfo,
  FloatingPanelPayload,
  IPC_CHANNELS,
  OcrHistoryItem,
  OcrHistoryQuery,
  OcrPreprocessOptions,
  OcrProviderCapability,
  OcrProviderId,
  OcrRecognizeRequest,
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
import {
  showOcrFloatingPanel,
  hideOcrFloatingPanel,
  isOcrFloatingPanelVisible,
  restoreOcrFloatingPanel,
} from '@/windows/ocr-panel-window.js';
import {
  getMainWindow,
  isMainWindowVisible,
  showMainWindow,
  hideMainWindow,
} from '@/windows/main-window.js';
import {
  getOverlayWindow,
  isOverlayVisible,
  showOverlay,
  hideOverlay,
} from '@/windows/overlay-window.js';
import { createLogger, ILogger } from '@echo-lingo/logger';

export class ScreenTranslationService {
  private static instance: ScreenTranslationService | null = null;
  private readonly log: ILogger = createLogger('ScreenTranslationService');

  private ocrRegistry: OcrRegistry;
  private continuousScheduler: ContinuousOcrScheduler | null = null;
  private activeContinuousConfig: ContinuousOcrConfig | null = null;
  private hiddenOverlaysState: {
    wasOcrPanelVisible: boolean;
    wasOverlayVisible: boolean;
    wasMainWindowVisible: boolean;
  } | null = null;
  private autoRestoreTimer: NodeJS.Timeout | null = null;

  public static getInstance(): ScreenTranslationService {
    if (!ScreenTranslationService.instance) {
      ScreenTranslationService.instance = new ScreenTranslationService();
    }
    return ScreenTranslationService.instance;
  }

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

  public async recognize(req: OcrRecognizeRequest): Promise<OcrResponse> {
    try {
      return await this.ocrRegistry.recognize(req, req.providerId);
    } catch (err: any) {
      const requestedId = req.providerId || this.ocrRegistry.getActiveProvider().id;
      if (requestedId === 'windows-native' && this.ocrRegistry.getProvider('tesseract')) {
        this.log.warn(`Windows Native OCR failed (${err?.message}), attempting fallback to Tesseract OCR.`);
        try {
          return await this.ocrRegistry.recognize(req, 'tesseract');
        } catch {
          throw err;
        }
      }
      throw err;
    }
  }

  public getDisplays(): DisplayInfo[] {
    return getScreenCaptureManager().getDisplays();
  }

  public async captureRegion(
    region: ScreenCaptureRegion,
    preprocessOptions?: OcrPreprocessOptions
  ) {
    return getScreenCaptureManager().captureRegion(region, preprocessOptions);
  }

  public showFloatingPanel(payload: FloatingPanelPayload): void {
    showOcrFloatingPanel(payload);
  }

  public hideFloatingPanel(): void {
    hideOcrFloatingPanel();
  }

  public completeSelection(region: ScreenCaptureRegion | null): void {
    closeSelectionOverlay(region);
  }

  private hideOverlaysForCapture(): void {
    const wasOcrPanelVisible = isOcrFloatingPanelVisible();
    const wasOverlayVisible = isOverlayVisible();
    const wasMainWindowVisible = isMainWindowVisible();

    this.hiddenOverlaysState = {
      wasOcrPanelVisible,
      wasOverlayVisible,
      wasMainWindowVisible,
    };

    if (wasOcrPanelVisible) {
      hideOcrFloatingPanel();
    }
    if (wasOverlayVisible) {
      hideOverlay();
    }
    if (wasMainWindowVisible) {
      hideMainWindow();
    }
  }

  public restoreHiddenOverlays(options?: { skipOcrPanel?: boolean; skipMainWindow?: boolean }): void {
    this.clearAutoRestoreFallback();
    if (!this.hiddenOverlaysState) return;

    const { wasOcrPanelVisible, wasOverlayVisible, wasMainWindowVisible } = this.hiddenOverlaysState;
    this.hiddenOverlaysState = null;

    if (wasMainWindowVisible && !options?.skipMainWindow) {
      showMainWindow();
    }
    if (wasOverlayVisible) {
      showOverlay();
    }
    if (wasOcrPanelVisible && !options?.skipOcrPanel) {
      restoreOcrFloatingPanel();
    }
  }

  private scheduleAutoRestoreFallback(skipMainWindow = false): void {
    this.clearAutoRestoreFallback();
    this.autoRestoreTimer = setTimeout(() => {
      this.restoreHiddenOverlays({ skipOcrPanel: false, skipMainWindow });
    }, 400);
  }

  private clearAutoRestoreFallback(): void {
    if (this.autoRestoreTimer) {
      clearTimeout(this.autoRestoreTimer);
      this.autoRestoreTimer = null;
    }
  }

  /**
   * Triggers the interactive region selection overlay.
   * Automatically hides floating overlays/windows while selection is active,
   * and restores them once selection completes or cancels.
   */
  public async selectRegion(displayId?: number): Promise<ScreenCaptureRegion | null> {
    const db = getDatabase();
    const settings = db.getSetting('app_settings', {} as any);
    const shouldHide =
      settings?.overlaySettings?.hideOnCapture !== false &&
      settings?.screenTranslation?.hideOverlayOnCapture !== false;
    const shouldKeepMainWindowHidden = Boolean(
      settings?.screenTranslation?.keepMainWindowHiddenAfterCapture
    );

    if (shouldHide) {
      this.hideOverlaysForCapture();
      // Brief pause to allow OS window manager / compositor to flush frame
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    try {
      const region = await openSelectionOverlay(displayId);

      if (!region) {
        if (shouldHide) {
          this.restoreHiddenOverlays({ skipOcrPanel: false, skipMainWindow: false });
        }
        return null;
      }

      if (shouldHide) {
        this.scheduleAutoRestoreFallback(shouldKeepMainWindowHidden);
      }

      return region;
    } catch (err) {
      if (shouldHide) {
        this.restoreHiddenOverlays({ skipOcrPanel: false, skipMainWindow: false });
      }
      throw err;
    }
  }

  public cancelSelection(): void {
    closeSelectionOverlay(null);
    this.restoreHiddenOverlays({ skipOcrPanel: false, skipMainWindow: false });
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

    const ocrResponse = await this.recognize({
      imageBuffer: new Uint8Array(buffer),
      language: options?.ocrLanguage || 'auto',
      providerId: options?.ocrProviderId,
    });

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
    this.clearAutoRestoreFallback();
    const startMs = Date.now();
    const translationService = getTranslationService();
    const db = getDatabase();

    try {
      // 1. Capture and OCR
      const { ocrResponse, imageDataUrl } = await this.recognizeRegion(req.region, {
        ocrLanguage: req.ocrLanguage,
        ocrProviderId: req.ocrProviderId,
        profile: req.profile,
      });

      const settings = db.getSetting('app_settings', {} as any);
      const shouldKeepHidden =
        req.keepMainWindowHidden ??
        Boolean(settings?.screenTranslation?.keepMainWindowHiddenAfterCapture);

      // Crucial: The screenshot is now captured into memory!
      // Restore MainWindow and OverlayWindow (if they were hidden for capture),
      // respecting keepMainWindowHiddenAfterCapture.
      // Skip OCR panel because we will update it with new translation results below.
      this.restoreHiddenOverlays({ skipOcrPanel: true, skipMainWindow: shouldKeepHidden });

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
    } catch (err) {
      const settings = db.getSetting('app_settings', {} as any);
      const shouldKeepHidden =
        req.keepMainWindowHidden ??
        Boolean(settings?.screenTranslation?.keepMainWindowHiddenAfterCapture);
      // In case of error, restore any remaining hidden windows (including previous OCR floating panel)
      this.restoreHiddenOverlays({ skipOcrPanel: false, skipMainWindow: shouldKeepHidden });
      throw err;
    }
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
          this.log.warn('Continuous capture failed:', err);
          return null;
        }
      },
      onOcr: async (imageData: string) => {
        return this.recognize({
          imageBuffer: imageData,
          language: config.ocrLanguage,
          providerId: config.ocrProviderId,
        });
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

  public isContinuousActive(): boolean {
    if (!this.continuousScheduler) return false;
    const state = this.continuousScheduler.getState();
    return state !== 'idle' && state !== 'stopping';
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
      if (overlayWin && !overlayWin.isDestroyed() && overlayWin.webContents.isDestroyed()) {
        overlayWin.webContents.send(channel, payload);
      }
    } catch (err) {
      this.log.warn('Broadcast error:', err);
    }
  }

  public async dispose(): Promise<void> {
    this.stopContinuous();
    await this.ocrRegistry.dispose();
  }
}

export function getScreenTranslationService(): ScreenTranslationService {
  return ScreenTranslationService.getInstance();
}
