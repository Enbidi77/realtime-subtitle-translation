import { z } from 'zod';
import { AudioSourceTypeSchema } from '@echo-lingo/contracts/audio.js';
import { SpeechEngineTypeSchema } from '@echo-lingo/contracts/speech.js';
import { TranslationProviderIdSchema } from '@echo-lingo/contracts/translation.js';

export const SubtitleAppearanceSchema = z.object({
  fontSize: z.number().min(12).max(72).default(24),
  fontFamily: z.string().default('Inter, -apple-system, BlinkMacSystemFont, sans-serif'),
  textColor: z.string().default('#FFFFFF'),
  translatedTextColor: z.string().default('#60A5FA'),
  backgroundColor: z.string().default('#000000'),
  backgroundOpacity: z.number().min(0).max(1).default(0.75),
  textAlignment: z.enum(['left', 'center', 'right']).default('center'),
  displayMode: z.enum(['both', 'translation-only', 'original-only']).default('both'),
  layout: z.enum(['stacked', 'side-by-side']).default('stacked'),
  showTimestamp: z.boolean().default(false),
  lineHeight: z.number().min(1).max(3).default(1.4),
});
export type SubtitleAppearance = z.infer<typeof SubtitleAppearanceSchema>;

export const OverlaySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  alwaysOnTop: z.boolean().default(true),
  clickThrough: z.boolean().default(false),
  position: z.enum(['bottom', 'top', 'custom']).default('bottom'),
  x: z.number().default(100),
  y: z.number().default(100),
  width: z.number().min(300).max(2560).default(800),
  height: z.number().min(80).max(1440).default(160),
  hideControlsOnIdle: z.boolean().default(true),
  maxLines: z.number().min(1).max(10).default(1),
  captionMode: z.enum(['youtube', 'history']).default('youtube'),
  autoHideTimeoutMs: z.number().min(1000).max(15000).default(4000),
});
export type OverlaySettings = z.infer<typeof OverlaySettingsSchema>;

export const AppSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('dark'),
  glassIntensity: z.enum(['subtle', 'balanced', 'strong']).default('balanced'),
  locale: z.enum(['en', 'vi']).default('en'),
  audioSourceType: AudioSourceTypeSchema.default('microphone'),
  audioDeviceId: z.string().default('default'),
  speechEngine: SpeechEngineTypeSchema.default('whisper-local'),
  localWhisperModel: z.string().default('tiny'),
  translationProvider: TranslationProviderIdSchema.default('google-web'),
  sourceLanguage: z.string().default('auto'),
  targetLanguages: z.array(z.string()).default(['vi']),
  vadSensitivity: z.number().min(0.001).max(0.5).default(0.008),
  speechChunkDurationMs: z.number().min(500).max(5000).default(2000),
  speechChunkOverlapMs: z.number().min(0).max(1000).default(400),
  debounceTranslationMs: z.number().min(100).max(2000).default(350),
  maxHistoryRetentionDays: z.number().min(1).max(365).default(30),
  enableLocalOnlyMode: z.boolean().default(false),
  autoScrollLiveSubtitles: z.boolean().default(true),
  subtitleAppearance: SubtitleAppearanceSchema.default({}),
  overlaySettings: OverlaySettingsSchema.default({}),
  keyboardShortcuts: z.record(z.string(), z.string()).default({
    'toggle-listening': 'CommandOrControl+Shift+Space',
    'pause-listening': 'CommandOrControl+Shift+P',
    'toggle-overlay': 'CommandOrControl+Shift+O',
    'copy-latest': 'CommandOrControl+Shift+C',
  }),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;
