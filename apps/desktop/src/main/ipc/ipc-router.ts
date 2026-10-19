import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as fsp from 'node:fs/promises';
import {
  IPC_CHANNELS,
  CreateSessionRequestSchema,
  GlossaryEntrySchema,
  SubtitleExportOptionsSchema,
  SaveExportFileRequestSchema,
  TranslationRequestSchema,
  ScreenCaptureRegionSchema,
  ScreenTranslateRequestSchema,
  ContinuousOcrConfigSchema,
  OcrRecognizeRequestSchema,
  OcrHistoryQuerySchema,
  FloatingPanelPayloadSchema,
  VideoExportOptionsSchema,
} from '@echo-lingo/contracts';
import {
  getAppService,
  getCredentialsService,
  getTranslationService,
  getSpeechService,
  getSessionService,
  getScreenTranslationService,
  getSettingsService,
  getSearchService,
  getVideoService,
} from '@/services/index.js';

export function registerIpcHandlers(): void {
  const appService = getAppService();
  const sessionService = getSessionService();
  const translationService = getTranslationService();
  const speechService = getSpeechService();
  const credentialsService = getCredentialsService();
  const screenTranslationService = getScreenTranslationService();
  const settingsService = getSettingsService();
  const searchService = getSearchService();
  const videoService = getVideoService();

  // ================= App Window =================
  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, () => appService.getSystemInfo());

  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE, (event) => {
    appService.minimizeWindow(event.sender);
  });

  ipcMain.on(IPC_CHANNELS.APP_MAXIMIZE, (event) => {
    appService.maximizeWindow(event.sender);
  });

  ipcMain.on(IPC_CHANNELS.APP_CLOSE, (event) => {
    appService.closeWindow(event.sender);
  });

  ipcMain.on(IPC_CHANNELS.APP_QUIT, () => {
    appService.quit();
  });

  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE_TO_TRAY, (event) => {
    appService.minimizeToTray(event.sender);
  });

  ipcMain.on(IPC_CHANNELS.APP_MOVE_WINDOW, (event, payload: { deltaX: number; deltaY: number }) => {
    appService.moveWindow(event.sender, payload?.deltaX, payload?.deltaY);
  });

  // ================= Audio =================
  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_DEVICES, async () => {
    return sessionService.getAudioDevices();
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
    sessionService.feedAudioChunk(payload?.samples);
  });

  // ================= Speech Models =================
  ipcMain.handle(IPC_CHANNELS.MODELS_LIST, async () => {
    return speechService.getModelStatus();
  });

  ipcMain.handle(IPC_CHANNELS.MODELS_DOWNLOAD, async (event, { modelId }: { modelId: string }) => {
    return speechService.downloadModelWithProgress(modelId, (status) => {
      try {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.MODELS_STATUS_STREAM, status);
        }
      } catch {
        // ignore
      }
    });
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
    credentialsService.setCredential(providerId, apiKey);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.TRANSLATION_HAS_CREDENTIAL, async (_, { providerId }) => {
    return credentialsService.hasCredential(providerId);
  });

  ipcMain.handle(IPC_CHANNELS.TRANSLATION_DELETE_CREDENTIAL, async (_, { providerId }) => {
    credentialsService.removeCredential(providerId);
    return { ok: true };
  });

  // ================= Sessions & Subtitles =================
  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (_, req) => {
    const parsed = CreateSessionRequestSchema.parse(req);
    return sessionService.createSession(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (_, { id }) => {
    return sessionService.getSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
    return sessionService.listSessions();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_UPDATE, async (_, { id, updates }) => {
    sessionService.updateSession(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_, { id }) => {
    sessionService.deleteSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET_SEGMENTS, async (_, { sessionId }) => {
    return sessionService.getSegments(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_UPDATE_SEGMENT, async (_, { id, updates }) => {
    sessionService.updateSegment(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE_SEGMENT, async (_, { id }) => {
    sessionService.deleteSegment(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_EXPORT, async (_, { sessionId, options }) => {
    const validOptions = SubtitleExportOptionsSchema.parse(options);
    return sessionService.exportSession(sessionId, validOptions);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_SAVE_EXPORT_FILE, async (event, payload) => {
    const parsed = SaveExportFileRequestSchema.parse(payload);
    const win = BrowserWindow.fromWebContents(event.sender);
    const ext = parsed.format || 'srt';
    const filters =
      ext === 'vtt'
        ? [
            { name: 'WebVTT Subtitles (*.vtt)', extensions: ['vtt'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ]
        : ext === 'txt'
        ? [
            { name: 'Text Document (*.txt)', extensions: ['txt'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ]
        : ext === 'json'
        ? [
            { name: 'JSON Document (*.json)', extensions: ['json'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ]
        : [
            { name: 'SubRip Subtitles (*.srt)', extensions: ['srt'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ];

    const result = await dialog.showSaveDialog(win || (undefined as any), {
      title: 'Save Subtitle File',
      defaultPath: parsed.defaultName || `subtitles.${ext}`,
      filters,
    });

    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true };
    }

    await fsp.writeFile(result.filePath, parsed.content, 'utf-8');
    return { success: true, filePath: result.filePath };
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_IMPORT, async (_, { content, fileName, sourceLanguage, targetLanguage }) => {
    return sessionService.importSession(content, fileName, sourceLanguage, targetLanguage);
  });

  // ================= Glossary =================
  ipcMain.handle(IPC_CHANNELS.GLOSSARY_LIST, async () => {
    return translationService.getGlossary();
  });

  ipcMain.handle(IPC_CHANNELS.GLOSSARY_ADD, async (_, entry) => {
    const parsed = GlossaryEntrySchema.parse(entry);
    translationService.addGlossaryEntry(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.GLOSSARY_DELETE, async (_, { id }) => {
    translationService.deleteGlossaryEntry(id);
  });

  // ================= Settings =================
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsService.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_, updates) => {
    return settingsService.updateSettings(updates);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async () => {
    return settingsService.resetSettings();
  });

  // ================= Overlay =================
  ipcMain.handle(IPC_CHANNELS.OVERLAY_TOGGLE, async () => {
    return appService.toggleOverlay();
  });

  ipcMain.handle(IPC_CHANNELS.OVERLAY_SET_CLICK_THROUGH, async (_, { clickThrough }) => {
    appService.setOverlayClickThrough(Boolean(clickThrough));
  });

  ipcMain.handle(IPC_CHANNELS.OVERLAY_GET_SEGMENTS, async () => {
    return sessionService.getOverlaySegments();
  });

  // ================= Screen & Capture =================
  ipcMain.on('screen:selection-complete', (_, region) => {
    const parsed = region ? ScreenCaptureRegionSchema.parse(region) : null;
    screenTranslationService.completeSelection(parsed);
  });

  ipcMain.on('screen:selection-cancel', () => {
    screenTranslationService.cancelSelection();
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_GET_DISPLAYS, async () => {
    return screenTranslationService.getDisplays();
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
    return screenTranslationService.captureRegion(validRegion, preprocessOptions);
  });

  // ================= OCR =================
  ipcMain.handle(IPC_CHANNELS.OCR_GET_PROVIDERS, async () => {
    return screenTranslationService.getOcrCapabilities();
  });

  ipcMain.handle(IPC_CHANNELS.OCR_RECOGNIZE, async (_, req) => {
    const parsed = OcrRecognizeRequestSchema.parse(req);
    return screenTranslationService.recognize(parsed);
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
    screenTranslationService.showFloatingPanel(valid);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_FLOATING_PANEL_HIDE, async () => {
    screenTranslationService.hideFloatingPanel();
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
    return appService.openLogs();
  });

  ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, (_, payload) => {
    appService.logMessage(payload);
  });

  // ================= Global Search =================
  ipcMain.handle(IPC_CHANNELS.SEARCH_DATABASE, async (_, req) => {
    return searchService.searchDatabase(req);
  });

  // ================= Video Subtitling & Processing =================
  ipcMain.handle(IPC_CHANNELS.VIDEO_CHECK_FFMPEG, () => {
    return videoService.checkFfmpeg();
  });

  ipcMain.handle(IPC_CHANNELS.VIDEO_INSTALL_FFMPEG, async () => {
    return videoService.downloadAndInstallFfmpeg();
  });

  ipcMain.handle(IPC_CHANNELS.VIDEO_OPEN_FILE_DIALOG, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return videoService.openVideoFileDialog(win);
  });

  ipcMain.handle(IPC_CHANNELS.VIDEO_SAVE_FILE_DIALOG, async (event, defaultName?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return videoService.saveVideoFileDialog(win, defaultName);
  });

  ipcMain.handle(IPC_CHANNELS.VIDEO_PROBE_METADATA, async (_, filePath: string) => {
    return videoService.probeMetadata(filePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.VIDEO_EXTRACT_AUDIO,
    async (event, payload: { videoPath: string; sourceLang?: string; targetLang?: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return videoService.transcribeVideo(
        payload.videoPath,
        {
          sourceLang: payload.sourceLang,
          targetLang: payload.targetLang,
        },
        (progress) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.VIDEO_TRANSCRIBE_PROGRESS, progress);
          }
        }
      );
    }
  );

  ipcMain.handle(IPC_CHANNELS.VIDEO_START_EXPORT, async (event, options) => {
    const validOptions = VideoExportOptionsSchema.parse(options);
    const win = BrowserWindow.fromWebContents(event.sender);

    return videoService.exportSubtitledVideo(validOptions, (progress) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.VIDEO_EXPORT_PROGRESS, progress);
      }
    });
  });

  ipcMain.handle(IPC_CHANNELS.VIDEO_CANCEL_EXPORT, async (_, jobId: string) => {
    return videoService.cancelExport(jobId);
  });
}
