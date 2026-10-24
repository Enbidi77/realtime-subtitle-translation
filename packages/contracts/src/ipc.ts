import { z } from 'zod';
import {
  AudioDeviceInfoSchema,
  AudioLevelEventSchema,
  AudioPipelineStatusSchema,
} from '@echo-lingo/contracts/audio.js';
import {
  SpeechModelStatusSchema,
  TranscriptionEventSchema,
} from '@echo-lingo/contracts/speech.js';
import {
  GlossaryEntrySchema,
  TranslationCapabilitySchema,
  TranslationRequestSchema,
  TranslationResultSchema,
  TranslationProviderIdSchema,
} from '@echo-lingo/contracts/translation.js';
import {
  SubtitleExportFormatSchema,
  SubtitleExportOptionsSchema,
  SubtitleSegmentSchema,
} from '@echo-lingo/contracts/subtitle.js';
import {
  CreateSessionRequestSchema,
  SessionMetadataSchema,
} from '@echo-lingo/contracts/session.js';
import {
  AppSettingsSchema,
  OverlaySettingsSchema,
} from '@echo-lingo/contracts/settings.js';
import {
  OcrProviderIdSchema,
  OcrProfileSchema,
  OcrPreprocessOptionsSchema,
} from '@echo-lingo/contracts/ocr.js';
import {
  ScreenCaptureRegionSchema,
  ContinuousOcrConfigSchema,
} from '@echo-lingo/contracts/screen-translation.js';
import {
  VideoMetadataSchema,
  VideoExportOptionsSchema,
  VideoExportProgressSchema,
  SubtitleStyleOptionsSchema,
} from '@echo-lingo/contracts/video.js';

export const IPC_CHANNELS = {
  // App
  APP_GET_INFO: 'app:get-info',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_CLOSE: 'app:close',
  APP_QUIT: 'app:quit',
  APP_MINIMIZE_TO_TRAY: 'app:minimize-to-tray',
  APP_MOVE_WINDOW: 'app:move-window',
  APP_RESIZE_WINDOW: 'app:resize-window',
  APP_NAVIGATE_TO: 'app:navigate-to',
  APP_REQUEST_CLOSE_CONFIRM: 'app:request-close-confirm',
  APP_OPEN_LOGS: 'app:open-logs',
  LOG_MESSAGE: 'log:message',
  SPLASH_STATUS_STREAM: 'splash:status-stream',

  // Audio & Devices
  AUDIO_GET_DEVICES: 'audio:get-devices',
  AUDIO_START: 'audio:start',
  AUDIO_STOP: 'audio:stop',
  AUDIO_PAUSE: 'audio:pause',
  AUDIO_RESUME: 'audio:resume',
  AUDIO_PROCESS_CHUNK: 'audio:process-chunk',
  AUDIO_LEVEL_STREAM: 'audio:level-stream',
  AUDIO_STATUS: 'audio:status',

  // Transcription & Models
  TRANSCRIPTION_EVENT: 'transcription:event',
  MODELS_LIST: 'models:list',
  MODELS_DOWNLOAD: 'models:download',
  MODELS_STATUS_STREAM: 'models:status-stream',

  // Translation
  TRANSLATION_GET_PROVIDERS: 'translation:get-providers',
  TRANSLATION_TRANSLATE: 'translation:translate',
  TRANSLATION_SET_CREDENTIAL: 'translation:set-credential',
  TRANSLATION_HAS_CREDENTIAL: 'translation:has-credential',
  TRANSLATION_DELETE_CREDENTIAL: 'translation:delete-credential',

  // Subtitles & Sessions
  SESSION_CREATE: 'session:create',
  SESSION_GET: 'session:get',
  SESSION_LIST: 'session:list',
  SESSION_UPDATE: 'session:update',
  SESSION_DELETE: 'session:delete',
  SESSION_GET_SEGMENTS: 'session:get-segments',
  SESSION_UPDATE_SEGMENT: 'session:update-segment',
  SESSION_DELETE_SEGMENT: 'session:delete-segment',
  SESSION_EXPORT: 'session:export',
  SESSION_SAVE_EXPORT_FILE: 'session:save-export-file',
  SESSION_IMPORT: 'session:import',
  SESSION_QUICK_START: 'session:quick-start',

  // Glossary
  GLOSSARY_LIST: 'glossary:list',
  GLOSSARY_ADD: 'glossary:add',
  GLOSSARY_UPDATE: 'glossary:update',
  GLOSSARY_DELETE: 'glossary:delete',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_UPDATE_STREAM: 'settings:update-stream',

  // Overlay
  OVERLAY_TOGGLE: 'overlay:toggle',
  OVERLAY_SET_CLICK_THROUGH: 'overlay:set-click-through',
  OVERLAY_UPDATE_BOUNDS: 'overlay:update-bounds',
  OVERLAY_SEGMENTS_STREAM: 'overlay:segments-stream',
  OVERLAY_GET_SEGMENTS: 'overlay:get-segments',
  OVERLAY_VISIBILITY_STREAM: 'overlay:visibility-stream',

  // Screen & Capture
  SCREEN_GET_DISPLAYS: 'screen:get-displays',
  SCREEN_SELECT_REGION: 'screen:select-region',
  SCREEN_CAPTURE_REGION: 'screen:capture-region',
  SCREEN_CANCEL_CAPTURE: 'screen:cancel-capture',
  SCREEN_SELECTION_COMPLETE: 'screen:selection-complete',
  SCREEN_SELECTION_CANCEL: 'screen:selection-cancel',

  // OCR
  OCR_GET_PROVIDERS: 'ocr:get-providers',
  OCR_GET_LANGUAGES: 'ocr:get-languages',
  OCR_RECOGNIZE: 'ocr:recognize',

  // Screen Translation & Continuous
  SCREEN_TRANSLATE_REGION: 'screen-translate:region',
  SCREEN_CONTINUOUS_START: 'screen-translate:continuous-start',
  SCREEN_CONTINUOUS_STOP: 'screen-translate:continuous-stop',
  SCREEN_CONTINUOUS_PAUSE: 'screen-translate:continuous-pause',
  SCREEN_CONTINUOUS_RESUME: 'screen-translate:continuous-resume',
  SCREEN_CONTINUOUS_STATUS_STREAM: 'screen-translate:continuous-status-stream',
  SCREEN_CONTINUOUS_EVENT_STREAM: 'screen-translate:continuous-event-stream',

  // Floating Result Panel
  SCREEN_FLOATING_PANEL_SHOW: 'screen-translate:floating-panel-show',
  SCREEN_FLOATING_PANEL_HIDE: 'screen-translate:floating-panel-hide',
  SCREEN_FLOATING_PANEL_STREAM: 'screen-translate:floating-panel-stream',

  // OCR History
  OCR_HISTORY_LIST: 'ocr-history:list',
  OCR_HISTORY_GET: 'ocr-history:get',
  OCR_HISTORY_INSERT: 'ocr-history:insert',
  OCR_HISTORY_DELETE: 'ocr-history:delete',
  OCR_HISTORY_CLEAR: 'ocr-history:clear',
  OCR_HISTORY_SEARCH: 'ocr-history:search',

  // Global Search
  SEARCH_DATABASE: 'search:database',
  SEARCH_TOGGLE: 'search:toggle',

  // Video Subtitling & Processing
  VIDEO_OPEN_FILE_DIALOG: 'video:open-file-dialog',
  VIDEO_SAVE_FILE_DIALOG: 'video:save-file-dialog',
  VIDEO_PROBE_METADATA: 'video:probe-metadata',
  VIDEO_EXTRACT_AUDIO: 'video:extract-audio',
  VIDEO_START_EXPORT: 'video:start-export',
  VIDEO_CANCEL_EXPORT: 'video:cancel-export',
  VIDEO_EXPORT_PROGRESS: 'video:export-progress',
  VIDEO_CHECK_FFMPEG: 'video:check-ffmpeg',
  VIDEO_INSTALL_FFMPEG: 'video:install-ffmpeg',
  VIDEO_TRANSCRIBE_PROGRESS: 'video:transcribe-progress',

  // Radial / Global Context Menu
  RADIAL_MENU_SHOW: 'radial-menu:show',
  RADIAL_MENU_HIDE: 'radial-menu:hide',
  RADIAL_MENU_TOGGLE: 'radial-menu:toggle',
  RADIAL_MENU_EXECUTE_ACTION: 'radial-menu:execute-action',
  RADIAL_MENU_GET_STATE: 'radial-menu:get-state',
  RADIAL_MENU_STATE_STREAM: 'radial-menu:state-stream',
  RADIAL_MENU_OPENED: 'radial-menu:opened',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// System Info
export const SystemInfoSchema = z.object({
  platform: z.enum(['win32', 'darwin', 'linux']),
  arch: z.string(),
  appVersion: z.string(),
  electronVersion: z.string(),
  nodeVersion: z.string(),
  userDataPath: z.string(),
});
export type SystemInfo = z.infer<typeof SystemInfoSchema>;

// IPC Request & Response Schemas
export const SetCredentialRequestSchema = z.object({
  providerId: z.string(),
  apiKey: z.string(),
});

export const HasCredentialRequestSchema = z.object({
  providerId: z.string(),
});

export const ExportSessionRequestSchema = z.object({
  sessionId: z.string(),
  options: SubtitleExportOptionsSchema,
});

export const SaveExportFileRequestSchema = z.object({
  content: z.string(),
  defaultName: z.string(),
  format: SubtitleExportFormatSchema,
});
export type SaveExportFileRequest = z.infer<typeof SaveExportFileRequestSchema>;

export const ImportSubtitlesRequestSchema = z.object({
  content: z.string(),
  fileName: z.string(),
  sourceLanguage: z.string().default('en'),
  targetLanguage: z.string().default('vi'),
});

export const ScreenCaptureRegionRequestSchema = z.object({
  displayId: z.number().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  preprocessOptions: OcrPreprocessOptionsSchema.optional(),
});

export const ScreenTranslateRequestSchema = z.object({
  region: ScreenCaptureRegionSchema,
  ocrLanguage: z.string().optional(),
  targetLanguages: z.array(z.string()).optional(),
  sourceLanguage: z.string().optional(),
  ocrProviderId: OcrProviderIdSchema.optional(),
  translationProviderId: TranslationProviderIdSchema.optional(),
  profile: OcrProfileSchema.optional(),
  skipPreview: z.boolean().optional(),
  keepMainWindowHidden: z.boolean().optional(),
});
export type ScreenTranslateRequest = z.infer<typeof ScreenTranslateRequestSchema>;

export const OcrHistoryQuerySchema = z.object({
  query: z.string().optional(),
  limit: z.number().min(1).max(500).optional(),
  offset: z.number().min(0).optional(),
});
export type OcrHistoryQuery = z.infer<typeof OcrHistoryQuerySchema>;

export const LogMessageRequestSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  scope: z.string().optional().default('Renderer'),
  message: z.string(),
  args: z.array(z.unknown()).optional(),
});
export type LogMessageRequest = z.infer<typeof LogMessageRequestSchema>;

export const SplashStatusEventSchema = z.object({
  message: z.string(),
  step: z.number().int().nonnegative().optional(),
  totalSteps: z.number().int().positive().optional(),
  progress: z.number().min(0).max(100).optional(),
});
export type SplashStatusEvent = z.infer<typeof SplashStatusEventSchema>;

export const RadialMenuActionIdSchema = z.enum([
  'toggle-listening',
  'pause-listening',
  'capture-translate',
  'continuous-ocr',
  'translate-clipboard',
  'toggle-overlay',
  'toggle-click-through',
  'show-ocr-panel',
  'clear-subtitles',
  'copy-last',
  'open-settings',
  'open-app',
]);
export type RadialMenuActionId = z.infer<typeof RadialMenuActionIdSchema>;

export const RadialMenuStateSchema = z.object({
  isListening: z.boolean(),
  isPaused: z.boolean(),
  isOverlayVisible: z.boolean(),
  isClickThrough: z.boolean(),
  isContinuousOcr: z.boolean(),
  isOcrPanelVisible: z.boolean(),
  sourceLanguage: z.string(),
  targetLanguages: z.array(z.string()),
  lastSubtitleText: z.string().optional(),
});
export type RadialMenuState = z.infer<typeof RadialMenuStateSchema>;

export const RadialMenuExecuteRequestSchema = z.object({
  actionId: RadialMenuActionIdSchema,
});
export type RadialMenuExecuteRequest = z.infer<typeof RadialMenuExecuteRequestSchema>;

export const MoveWindowSchema = z.object({
  deltaX: z.number(),
  deltaY: z.number(),
});
export type MoveWindowRequest = z.infer<typeof MoveWindowSchema>;

export const ResizeWindowDirectionSchema = z.enum([
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]);
export type ResizeWindowDirection = z.infer<typeof ResizeWindowDirectionSchema>;

export const ResizeWindowSchema = z.object({
  deltaX: z.number().default(0),
  deltaY: z.number().default(0),
  direction: ResizeWindowDirectionSchema.optional(),
  deltaWidth: z.number().optional(),
  deltaHeight: z.number().optional(),
});
export type ResizeWindowRequest = z.infer<typeof ResizeWindowSchema>;




