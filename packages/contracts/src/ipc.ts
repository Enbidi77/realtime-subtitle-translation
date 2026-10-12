import { z } from 'zod';
import {
  AudioDeviceInfoSchema,
  AudioLevelEventSchema,
  AudioPipelineStatusSchema,
} from './audio.js';
import {
  SpeechModelStatusSchema,
  TranscriptionEventSchema,
} from './speech.js';
import {
  GlossaryEntrySchema,
  TranslationCapabilitySchema,
  TranslationRequestSchema,
  TranslationResultSchema,
} from './translation.js';
import {
  SubtitleExportOptionsSchema,
  SubtitleSegmentSchema,
} from './subtitle.js';
import {
  CreateSessionRequestSchema,
  SessionMetadataSchema,
} from './session.js';
import {
  AppSettingsSchema,
  OverlaySettingsSchema,
} from './settings.js';

export const IPC_CHANNELS = {
  // App
  APP_GET_INFO: 'app:get-info',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_CLOSE: 'app:close',

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
