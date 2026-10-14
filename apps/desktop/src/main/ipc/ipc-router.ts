import { ipcMain, app, BrowserWindow, shell } from 'electron';
import {
  IPC_CHANNELS,
  SystemInfo,
  CreateSessionRequestSchema,
  AppSettingsSchema,
  GlossaryEntrySchema,
  SubtitleExportOptionsSchema,
  TranslationRequestSchema,
  ScreenCaptureRegionSchema,
  ScreenTranslateRequestSchema,
  ContinuousOcrConfigSchema,
  OcrRecognizeRequestSchema,
  OcrHistoryQuerySchema,
  FloatingPanelPayloadSchema,
  LogMessageRequestSchema,
} from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { createLogger, getLogDirectory } from '@echo-lingo/logger';
import { exportToSrt, exportToVtt, exportToTxt, exportToJson, parseSubtitles } from '@echo-lingo/subtitle-core';
import { getDatabase } from '@/database/db-instance.js';
import { CredentialsService } from '@/services/credentials-service.js';
import { getTranslationService } from '@/services/translation-service.js';
import { getSpeechService } from '@/services/speech-service.js';
import { getSessionService } from '@/services/session-service.js';
import { getMainWindow, setIsQuitting } from '@/windows/main-window.js';
import { toggleOverlay, setOverlayClickThrough, getOverlayWindow } from '@/windows/overlay-window.js';
import { getScreenCaptureManager } from '@/screen-capture/capture-manager.js';
import { getScreenTranslationService } from '@/services/screen-translation-service.js';
import { closeSelectionOverlay } from '@/windows/selection-window.js';
import { showOcrFloatingPanel, hideOcrFloatingPanel } from '@/windows/ocr-panel-window.js';
import { notifyMinimizedToTray } from '@/services/tray-service.js';

const log = createLogger('IpcRouter');

export function registerIpcHandlers(): void {
  const db = getDatabase();
  const sessionService = getSessionService();
  const translationService = getTranslationService();
  const speechService = getSpeechService();

  // ================= App Window =================
  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, (): SystemInfo => ({
    platform: process.platform as 'win32' | 'darwin' | 'linux',
    arch: process.arch,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron || '',
    nodeVersion: process.versions.node,
    userDataPath: app.getPath('userData'),
  }));

  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.APP_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.on(IPC_CHANNELS.APP_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.on(IPC_CHANNELS.APP_QUIT, () => {
    setIsQuitting(true);
    app.quit();
  });

  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE_TO_TRAY, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.hide();
    notifyMinimizedToTray();
  });

  ipcMain.on(IPC_CHANNELS.APP_MOVE_WINDOW, (event, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isMaximized()) {
      const [x, y] = win.getPosition();
      win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
  });

  // ================= Audio =================
  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_DEVICES, async () => {
    return [
      { id: 'default', label: 'Default System Microphone', kind: 'audioinput', isDefault: true },
      { id: 'communications', label: 'Default Communications Device', kind: 'audioinput' },
    ];
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_START, async (_, options) => {
    // Session is started via SESSION_CREATE, audio streaming is bound to active session
    return { ok: true, options };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_STOP, async () => {
    sessionService.stopSession();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_PAUSE, async () => {
    sessionService.pauseSession();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_RESUME, async () => {
    sessionService.resumeSession();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_PROCESS_CHUNK, async (_, payload: { samples: number[] }) => {
    if (payload?.samples && payload.samples.length > 0) {
      const float32 = new Float32Array(payload.samples);
      sessionService.feedAudioSamples(float32);
    }
  });

  // ================= Speech Models =================
  ipcMain.handle(IPC_CHANNELS.MODELS_LIST, async () => {
    return speechService.getModelStatus();
  });

  ipcMain.handle(IPC_CHANNELS.MODELS_DOWNLOAD, async (_, { modelId }: { modelId: string }) => {
    log.info(`[Models] Requested download for model: ${modelId}`);
    return { ok: true };
  });

  // ================= Translation =================
  ipcMain.handle(IPC_CHANNELS.TRANSLATION_GET_PROVIDERS, async () => {
    return translationService.getCapabilities();
  });

  ipcMain.handle(IPC_CHANNELS.TRANSLATION_TRANSLATE, async (_, req) => {
    const parsed = TranslationRequestSchema.parse(req);
    return translationService.translate(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.TRANSLATION_SET_CREDENTIAL, async (_, { providerId, apiKey }) => {
    CredentialsService.saveCredential(providerId, apiKey);
    translationService.loadSavedCredentials();
    speechService.loadSavedCredentials();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.TRANSLATION_HAS_CREDENTIAL, async (_, { providerId }) => {
    return CredentialsService.hasCredential(providerId);
  });

  ipcMain.handle(IPC_CHANNELS.TRANSLATION_DELETE_CREDENTIAL, async (_, { providerId }) => {
    CredentialsService.deleteCredential(providerId);
    translationService.loadSavedCredentials();
    speechService.loadSavedCredentials();
    return { ok: true };
  });

  // ================= Sessions & Subtitles =================
  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (_, req) => {
    const parsed = CreateSessionRequestSchema.parse(req);
    return sessionService.createSession(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (_, { id }) => {
    return db.getSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
    return db.getAllSessions(100);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_UPDATE, async (_, { id, updates }) => {
    db.updateSession(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_, { id }) => {
    db.deleteSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET_SEGMENTS, async (_, { sessionId }) => {
    return db.getSegmentsBySessionId(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_UPDATE_SEGMENT, async (_, { id, updates }) => {
    db.updateSegment(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE_SEGMENT, async (_, { id }) => {
    db.deleteSegment(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_EXPORT, async (_, { sessionId, options }) => {
    const validOptions = SubtitleExportOptionsSchema.parse(options);
    const segments = db.getSegmentsBySessionId(sessionId);

    switch (validOptions.format) {
      case 'srt':
        return exportToSrt(segments, validOptions);
      case 'vtt':
        return exportToVtt(segments, validOptions);
      case 'txt':
        return exportToTxt(segments, validOptions);
      case 'json':
        return exportToJson(segments);
      default:
        return exportToSrt(segments, validOptions);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_IMPORT, async (_, { content, fileName, sourceLanguage, targetLanguage }) => {
    const segments = parseSubtitles(content, fileName, { sourceLanguage, targetLanguage });
    if (segments.length === 0) {
      throw new Error('No valid subtitle segments found in file');
    }

    const sessionId = 'imported_' + Date.now();
    const session = {
      id: sessionId,
      title: fileName || 'Imported Subtitles',
      status: 'ended' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      durationSeconds: Math.round(segments[segments.length - 1].endTime / 1000),
      sourceLanguage: sourceLanguage || 'en',
      targetLanguages: targetLanguage ? [targetLanguage] : ['vi'],
      segmentCount: segments.length,
      speechProvider: 'imported',
      translationProvider: 'imported',
      audioSourceType: 'file' as const,
    };

    db.createSession(session);
    for (const seg of segments) {
      seg.sessionId = sessionId;
      db.insertSegment(seg);
    }

    return { count: segments.length, sessionId };
  });

  // ================= Glossary =================
  ipcMain.handle(IPC_CHANNELS.GLOSSARY_LIST, async () => {
    return db.getGlossary();
  });

  ipcMain.handle(IPC_CHANNELS.GLOSSARY_ADD, async (_, entry) => {
    const parsed = GlossaryEntrySchema.parse(entry);
    db.addGlossaryEntry(parsed);
    translationService.reloadGlossary();
  });

  ipcMain.handle(IPC_CHANNELS.GLOSSARY_DELETE, async (_, { id }) => {
    db.deleteGlossaryEntry(id);
    translationService.reloadGlossary();
  });

  // ================= Settings =================
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    const raw = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
    const parsed = AppSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, ...raw });
    return parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_, updates) => {
    const current = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
    const merged = { ...DEFAULT_APP_SETTINGS, ...current, ...updates };
    const validated = AppSettingsSchema.parse(merged);
    db.setSetting('app_settings', validated);

    // Broadcast updated settings to all open windows (main and overlay)
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed() && !mainWin.webContents.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, validated);
    }
    const overlayWin = getOverlayWindow();
    if (overlayWin && !overlayWin.isDestroyed() && !overlayWin.webContents.isDestroyed()) {
      overlayWin.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, validated);
    }

    return validated;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async () => {
    db.setSetting('app_settings', DEFAULT_APP_SETTINGS);

    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed() && !mainWin.webContents.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, DEFAULT_APP_SETTINGS);
    }
    const overlayWin = getOverlayWindow();
    if (overlayWin && !overlayWin.isDestroyed() && !overlayWin.webContents.isDestroyed()) {
      overlayWin.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, DEFAULT_APP_SETTINGS);
    }

    return DEFAULT_APP_SETTINGS;
  });

  // ================= Overlay =================
  ipcMain.handle(IPC_CHANNELS.OVERLAY_TOGGLE, async () => {
    return toggleOverlay();
  });

  ipcMain.handle(IPC_CHANNELS.OVERLAY_SET_CLICK_THROUGH, async (_, { clickThrough }) => {
    setOverlayClickThrough(Boolean(clickThrough));
  });

  ipcMain.handle(IPC_CHANNELS.OVERLAY_GET_SEGMENTS, async () => {
    return sessionService.getTimeline().getSegments(true).slice(-5);
  });

  // ================= Screen & Capture =================
  const screenCaptureManager = getScreenCaptureManager();
  const screenTranslationService = getScreenTranslationService();

  ipcMain.on('screen:selection-complete', (_, region) => {
    const parsed = region ? ScreenCaptureRegionSchema.parse(region) : null;
    closeSelectionOverlay(parsed);
  });

  ipcMain.on('screen:selection-cancel', () => {
    closeSelectionOverlay(null);
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_GET_DISPLAYS, async () => {
    return screenCaptureManager.getDisplays();
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_SELECT_REGION, async (_, payload?: { displayId?: number }) => {
    return screenTranslationService.selectRegion(payload?.displayId);
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_CANCEL_CAPTURE, async () => {
    screenTranslationService.cancelSelection();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE_REGION, async (_, { region, preprocessOptions }) => {
    const validRegion = ScreenCaptureRegionSchema.parse(region);
    return screenCaptureManager.captureRegion(validRegion, preprocessOptions);
  });

  // ================= OCR =================
  ipcMain.handle(IPC_CHANNELS.OCR_GET_PROVIDERS, async () => {
    return screenTranslationService.getOcrCapabilities();
  });

  ipcMain.handle(IPC_CHANNELS.OCR_RECOGNIZE, async (_, req) => {
    const parsed = OcrRecognizeRequestSchema.parse(req);
    return screenTranslationService.getOcrRegistry().recognize(parsed, parsed.providerId);
  });

  // ================= Screen Translation & Continuous =================
  ipcMain.handle(IPC_CHANNELS.SCREEN_TRANSLATE_REGION, async (_, req) => {
    const parsed = ScreenTranslateRequestSchema.parse(req);
    return screenTranslationService.captureAndTranslate(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_CONTINUOUS_START, async (_, config) => {
    const parsed = ContinuousOcrConfigSchema.parse(config);
    screenTranslationService.startContinuous(parsed);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_CONTINUOUS_STOP, async () => {
    screenTranslationService.stopContinuous();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_CONTINUOUS_PAUSE, async () => {
    screenTranslationService.pauseContinuous();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_CONTINUOUS_RESUME, async () => {
    screenTranslationService.resumeContinuous();
    return { ok: true };
  });

  // ================= Floating Result Panel =================
  ipcMain.handle(IPC_CHANNELS.SCREEN_FLOATING_PANEL_SHOW, async (_, payload) => {
    const valid = FloatingPanelPayloadSchema.parse(payload);
    showOcrFloatingPanel(valid);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_FLOATING_PANEL_HIDE, async () => {
    hideOcrFloatingPanel();
    return { ok: true };
  });

  // ================= OCR History =================
  ipcMain.handle(IPC_CHANNELS.OCR_HISTORY_LIST, async (_, query) => {
    const parsed = query ? OcrHistoryQuerySchema.parse(query) : undefined;
    return screenTranslationService.getHistory(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.OCR_HISTORY_GET, async (_, { id }: { id: string }) => {
    return screenTranslationService.getHistoryItem(id);
  });

  ipcMain.handle(IPC_CHANNELS.OCR_HISTORY_DELETE, async (_, { id }: { id: string }) => {
    screenTranslationService.deleteHistoryItem(id);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.OCR_HISTORY_CLEAR, async () => {
    screenTranslationService.clearHistory();
    return { ok: true };
  });

  // ================= Logging & Diagnostics =================
  ipcMain.handle(IPC_CHANNELS.APP_OPEN_LOGS, async () => {
    const logDir = getLogDirectory();
    await shell.openPath(logDir);
    return { ok: true, path: logDir };
  });

  ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, (_, payload) => {
    const parsed = LogMessageRequestSchema.safeParse(payload);
    if (!parsed.success) return;
    const { level, scope, message, args } = parsed.data;
    const rendererLogger = createLogger(scope || 'Renderer');
    const logArgs = args && args.length > 0 ? [message, ...args] : [message];
    if (level === 'error') rendererLogger.error(...logArgs);
    else if (level === 'warn') rendererLogger.warn(...logArgs);
    else if (level === 'debug') rendererLogger.debug(...logArgs);
    else rendererLogger.info(...logArgs);
  });
}

