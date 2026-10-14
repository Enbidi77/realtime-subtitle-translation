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

export const IPC_CHANNELS = {
  // App
  APP_GET_INFO: 'app:get-info',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_CLOSE: 'app:close',
  APP_QUIT: 'app:quit',
  APP_MINIMIZE_TO_TRAY: 'app:minimize-to-tray',
  APP_MOVE_WINDOW: 'app:move-window',
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
  SESSION_IMPORT: 'session:import',

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


