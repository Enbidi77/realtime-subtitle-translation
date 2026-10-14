import { contextBridge, ipcRenderer } from 'electron';
import {
  AppSettings,
  AudioDeviceInfo,
  AudioLevelEvent,
  AudioPipelineStatus,
  GlossaryEntry,
  IPC_CHANNELS,
  SessionMetadata,
  SpeechModelStatus,
  SubtitleSegment,
  SystemInfo,
  TranscriptionEvent,
  TranslationCapability,
  TranslationRequest,
  TranslationResult,
  CreateSessionRequest,
  SubtitleExportOptions,
  DisplayInfo,
  ScreenCaptureRegion,
  OcrPreprocessOptions,
  OcrProviderCapability,
  OcrRecognizeRequest,
  OcrResponse,
  ScreenTranslateRequest,
  ContinuousOcrConfig,
  ContinuousOcrState,
  ContinuousOcrStats,
  OcrHistoryItem,
  OcrHistoryQuery,
  FloatingPanelPayload,
} from '@echo-lingo/contracts';

const api = {
  app: {
    getSystemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO),
    minimize: () => ipcRenderer.send(IPC_CHANNELS.APP_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC_CHANNELS.APP_MAXIMIZE),
    close: () => ipcRenderer.send(IPC_CHANNELS.APP_CLOSE),
    quit: () => ipcRenderer.send(IPC_CHANNELS.APP_QUIT),
    minimizeToTray: () => ipcRenderer.send(IPC_CHANNELS.APP_MINIMIZE_TO_TRAY),
    moveWindow: (deltaX: number, deltaY: number) =>
      ipcRenderer.send(IPC_CHANNELS.APP_MOVE_WINDOW, { deltaX, deltaY }),
    onNavigate: (callback: (page: string) => void) => {
      const handler = (_: unknown, page: string) => callback(page);
      ipcRenderer.on(IPC_CHANNELS.APP_NAVIGATE_TO, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_NAVIGATE_TO, handler);
    },
    openLogs: (): Promise<{ ok: boolean; path: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_LOGS),
    onRequestCloseConfirm: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.APP_REQUEST_CLOSE_CONFIRM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_REQUEST_CLOSE_CONFIRM, handler);
    },
  },

  log: {
    debug: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(IPC_CHANNELS.LOG_MESSAGE, { level: 'debug', message, args }),
    info: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(IPC_CHANNELS.LOG_MESSAGE, { level: 'info', message, args }),
    warn: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(IPC_CHANNELS.LOG_MESSAGE, { level: 'warn', message, args }),
    error: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(IPC_CHANNELS.LOG_MESSAGE, { level: 'error', message, args }),
  },

  audio: {
    getDevices: (): Promise<AudioDeviceInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_GET_DEVICES),
    start: (options?: { sourceType: string; deviceId?: string }): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_START, options),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_STOP),
    pause: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_PAUSE),
    resume: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_RESUME),
    processChunk: (samples: number[], isSpeech: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_PROCESS_CHUNK, { samples, isSpeech }),
    onLevel: (callback: (evt: AudioLevelEvent) => void) => {
      const handler = (_: unknown, evt: AudioLevelEvent) => callback(evt);
      ipcRenderer.on(IPC_CHANNELS.AUDIO_LEVEL_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_LEVEL_STREAM, handler);
    },
    onStatus: (callback: (status: AudioPipelineStatus) => void) => {
      const handler = (_: unknown, status: AudioPipelineStatus) => callback(status);
      ipcRenderer.on(IPC_CHANNELS.AUDIO_STATUS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_STATUS, handler);
    },
  },

  speech: {
    onTranscription: (callback: (evt: TranscriptionEvent) => void) => {
      const handler = (_: unknown, evt: TranscriptionEvent) => callback(evt);
      ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_EVENT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPTION_EVENT, handler);
    },
    getModels: (): Promise<SpeechModelStatus[]> => ipcRenderer.invoke(IPC_CHANNELS.MODELS_LIST),
    downloadModel: (modelId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODELS_DOWNLOAD, { modelId }),
    onModelProgress: (callback: (status: SpeechModelStatus) => void) => {
      const handler = (_: unknown, status: SpeechModelStatus) => callback(status);
      ipcRenderer.on(IPC_CHANNELS.MODELS_STATUS_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MODELS_STATUS_STREAM, handler);
    },
  },

  translation: {
    getProviders: (): Promise<TranslationCapability[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.TRANSLATION_GET_PROVIDERS),
    translate: (request: TranslationRequest): Promise<TranslationResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.TRANSLATION_TRANSLATE, request),
    setCredential: (providerId: string, apiKey: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.TRANSLATION_SET_CREDENTIAL, { providerId, apiKey }),
    hasCredential: (providerId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.TRANSLATION_HAS_CREDENTIAL, { providerId }),
    deleteCredential: (providerId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.TRANSLATION_DELETE_CREDENTIAL, { providerId }),
  },

  sessions: {
    create: (req: CreateSessionRequest): Promise<SessionMetadata> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, req),
    get: (id: string): Promise<SessionMetadata | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET, { id }),
    list: (): Promise<SessionMetadata[]> => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST),
    update: (id: string, updates: Partial<SessionMetadata>): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_UPDATE, { id, updates }),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, { id }),
    getSegments: (sessionId: string): Promise<SubtitleSegment[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET_SEGMENTS, { sessionId }),
    updateSegment: (id: string, updates: Partial<SubtitleSegment>): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_UPDATE_SEGMENT, { id, updates }),
    deleteSegment: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE_SEGMENT, { id }),
    export: (sessionId: string, options: SubtitleExportOptions): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_EXPORT, { sessionId, options }),
    import: (content: string, fileName: string, sourceLang?: string, targetLang?: string): Promise<{ count: number; sessionId: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_IMPORT, { content, fileName, sourceLanguage: sourceLang, targetLanguage: targetLang }),
  },

  glossary: {
    list: (): Promise<GlossaryEntry[]> => ipcRenderer.invoke(IPC_CHANNELS.GLOSSARY_LIST),
    add: (entry: GlossaryEntry): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.GLOSSARY_ADD, entry),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.GLOSSARY_DELETE, { id }),
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (updates: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, updates),
    reset: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
    onUpdate: (callback: (settings: AppSettings) => void) => {
      const handler = (_: unknown, s: AppSettings) => callback(s);
      ipcRenderer.on(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, handler);
    },
  },

  overlay: {
    toggle: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_TOGGLE),
    setClickThrough: (clickThrough: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SET_CLICK_THROUGH, { clickThrough }),
    getSegments: (): Promise<SubtitleSegment[]> => ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_GET_SEGMENTS),
    onSegments: (callback: (segments: SubtitleSegment[]) => void) => {
      const handler = (_: unknown, segments: SubtitleSegment[]) => callback(segments);
      ipcRenderer.on(IPC_CHANNELS.OVERLAY_SEGMENTS_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.OVERLAY_SEGMENTS_STREAM, handler);
    },
    onVisibilityChange: (callback: (visible: boolean) => void) => {
      const handler = (_: unknown, visible: boolean) => callback(visible);
      ipcRenderer.on(IPC_CHANNELS.OVERLAY_VISIBILITY_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.OVERLAY_VISIBILITY_STREAM, handler);
    },
  },

  screenTranslation: {
    getDisplays: (): Promise<DisplayInfo[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_GET_DISPLAYS),
    selectRegion: (displayId?: number): Promise<ScreenCaptureRegion | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_SELECT_REGION, { displayId }),
    cancelCapture: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CANCEL_CAPTURE),
    captureRegion: (region: ScreenCaptureRegion, preprocessOptions?: OcrPreprocessOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CAPTURE_REGION, { region, preprocessOptions }),
    getOcrProviders: (): Promise<OcrProviderCapability[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_GET_PROVIDERS),
    recognize: (req: OcrRecognizeRequest): Promise<OcrResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_RECOGNIZE, req),
    translateRegion: (req: ScreenTranslateRequest): Promise<{
      ocrResult: OcrResponse;
      translationResult: TranslationResult;
      historyItem: OcrHistoryItem;
    }> => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_TRANSLATE_REGION, req),
    startContinuous: (config: ContinuousOcrConfig): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CONTINUOUS_START, config),
    stopContinuous: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CONTINUOUS_STOP),
    pauseContinuous: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CONTINUOUS_PAUSE),
    resumeContinuous: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CONTINUOUS_RESUME),
    onContinuousStatus: (callback: (data: { state: ContinuousOcrState; stats: ContinuousOcrStats }) => void) => {
      const handler = (_: unknown, data: { state: ContinuousOcrState; stats: ContinuousOcrStats }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.SCREEN_CONTINUOUS_STATUS_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SCREEN_CONTINUOUS_STATUS_STREAM, handler);
    },
    onContinuousEvent: (callback: (data: { historyItem: OcrHistoryItem; isChange: boolean }) => void) => {
      const handler = (_: unknown, data: { historyItem: OcrHistoryItem; isChange: boolean }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.SCREEN_CONTINUOUS_EVENT_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SCREEN_CONTINUOUS_EVENT_STREAM, handler);
    },
    showFloatingPanel: (payload: FloatingPanelPayload): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_FLOATING_PANEL_SHOW, payload),
    hideFloatingPanel: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCREEN_FLOATING_PANEL_HIDE),
    onFloatingPanelData: (callback: (payload: FloatingPanelPayload) => void) => {
      const handler = (_: unknown, payload: FloatingPanelPayload) => callback(payload);
      ipcRenderer.on(IPC_CHANNELS.SCREEN_FLOATING_PANEL_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SCREEN_FLOATING_PANEL_STREAM, handler);
    },
    completeSelection: (region: ScreenCaptureRegion | null) => {
      ipcRenderer.send('screen:selection-complete', region);
    },
    cancelSelectionWindow: () => {
      ipcRenderer.send('screen:selection-cancel');
    },
    getHistory: (query?: OcrHistoryQuery): Promise<OcrHistoryItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_HISTORY_LIST, query),
    getHistoryItem: (id: string): Promise<OcrHistoryItem | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_HISTORY_GET, { id }),
    deleteHistoryItem: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_HISTORY_DELETE, { id }),
    clearHistory: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_HISTORY_CLEAR),
  },
};

export type ElectronAPI = typeof api;

contextBridge.exposeInMainWorld('electronAPI', api);
