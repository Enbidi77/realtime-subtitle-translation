import { z } from "zod";
import { AudioSourceTypeSchema } from "@echo-lingo/contracts/audio.js";
import { SpeechEngineTypeSchema } from "@echo-lingo/contracts/speech.js";
import { TranslationProviderIdSchema } from "@echo-lingo/contracts/translation.js";
import {
  OcrProviderIdSchema,
  OcrProfileSchema,
} from "@echo-lingo/contracts/ocr.js";

export const SubtitleAppearanceSchema = z.object({
  fontSize: z.number().min(12).max(72).default(24),
  fontFamily: z
    .string()
    .default("Inter, -apple-system, BlinkMacSystemFont, sans-serif"),
  textColor: z.string().default("#FFFFFF"),
  translatedTextColor: z.string().default("#60A5FA"),
  backgroundColor: z.string().default("#000000"),
  backgroundOpacity: z.number().min(0).max(1).default(0.75),
  textAlignment: z.enum(["left", "center", "right"]).default("center"),
  displayMode: z
    .enum(["both", "translation-only", "original-only"])
    .default("both"),
  layout: z.enum(["stacked", "side-by-side"]).default("stacked"),
  showTimestamp: z.boolean().default(false),
  lineHeight: z.number().min(1).max(3).default(1.4),
});
export type SubtitleAppearance = z.infer<typeof SubtitleAppearanceSchema>;

export const OverlaySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  alwaysOnTop: z.boolean().default(true),
  clickThrough: z.boolean().default(false),
  hideOnCapture: z.boolean().default(true),
  position: z.enum(["bottom", "top", "custom"]).default("bottom"),
  x: z.number().default(100),
  y: z.number().default(100),
  width: z.number().min(300).max(2560).default(800),
  height: z.number().min(80).max(1440).default(160),
  hideControlsOnIdle: z.boolean().default(true),
  maxLines: z.number().min(1).max(10).default(1),
  captionMode: z.enum(["youtube", "history"]).default("youtube"),
  autoHideTimeoutMs: z.number().min(1000).max(15000).default(4000),
});
export type OverlaySettings = z.infer<typeof OverlaySettingsSchema>;

export const ScreenTranslationSettingsSchema = z.object({
  ocrProvider: OcrProviderIdSchema.default("windows-native"),
  ocrLanguage: z.string().default("auto"),
  skipPreview: z.boolean().default(false),
  profile: OcrProfileSchema.default("none"),
  continuousIntervalMs: z.number().min(500).max(10000).default(2000),
  changeThreshold: z.number().min(0).max(1).default(0.15),
  ignoreUnchanged: z.boolean().default(true),
  translateOnlyDiff: z.boolean().default(false),
  autoHideFloatingPanel: z.boolean().default(false),
  floatingPanelAutoHideTimeoutMs: z.number().min(1000).max(30000).default(6000),
  floatingPanelAlwaysOnTop: z.boolean().default(true),
  hideOverlayOnCapture: z.boolean().default(true),
  keepMainWindowHiddenAfterCapture: z.boolean().default(false),
  saveHistory: z.boolean().default(true),
  persistScreenshots: z.boolean().default(false),
});
export type ScreenTranslationSettings = z.infer<
  typeof ScreenTranslationSettingsSchema
>;

export const CloseBehaviorSchema = z
  .enum(["minimize-to-tray", "quit", "ask"])
  .default("ask");
export type CloseBehavior = z.infer<typeof CloseBehaviorSchema>;

export const SupportedLocaleSchema = z.enum([
  "en",
  "vi",
  "zh",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "ru",
]);
export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;

export const AppPageSchema = z.enum([
  "dashboard",
  "live-subtitles",
  "video-subtitles",
  "sessions",
  "history",
  "providers",
  "ocr-translate",
  "settings",
]);
export type AppPage = z.infer<typeof AppPageSchema>;

export const FeatureFlagsSchema = z
  .object({
    liveSubtitles: z.boolean().default(true),
    videoSubtitles: z.boolean().default(true),
    screenOcr: z.boolean().default(true),
    sessions: z.boolean().default(true),
    history: z.boolean().default(true),
    providers: z.boolean().default(true),
  })
  .catchall(z.boolean())
  .default({
    liveSubtitles: true,
    videoSubtitles: true,
    screenOcr: true,
    sessions: true,
    history: true,
    providers: true,
  });
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

export const AppSettingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).default("dark"),
  glassIntensity: z.enum(["subtle", "balanced", "strong"]).default("balanced"),
  locale: SupportedLocaleSchema.default("en"),
  enableSplashScreen: z.boolean().default(true),
  closeBehavior: CloseBehaviorSchema,
  audioSourceType: AudioSourceTypeSchema.default("microphone"),
  audioDeviceId: z.string().default("default"),
  speechEngine: SpeechEngineTypeSchema.default("whisper-local"),
  localWhisperModel: z.string().default("tiny"),
  translationProvider: TranslationProviderIdSchema.default("google-web"),
  sourceLanguage: z.string().default("auto"),
  targetLanguages: z.array(z.string()).default(["vi"]),
  vadSensitivity: z.number().min(0.001).max(0.5).default(0.008),
  speechChunkDurationMs: z.number().min(500).max(5000).default(2000),
  speechChunkOverlapMs: z.number().min(0).max(1000).default(400),
  debounceTranslationMs: z.number().min(100).max(2000).default(350),
  maxHistoryRetentionDays: z.number().min(1).max(365).default(30),
  enableLocalOnlyMode: z.boolean().default(false),
  showPaidProviders: z.boolean().default(false),
  autoScrollLiveSubtitles: z.boolean().default(true),
  hasCompletedOnboarding: z.boolean().default(false),
  featureFlags: FeatureFlagsSchema.default({}),
  subtitleAppearance: SubtitleAppearanceSchema.default({}),
  overlaySettings: OverlaySettingsSchema.default({}),
  screenTranslation: ScreenTranslationSettingsSchema.default({}),
  keyboardShortcuts: z.record(z.string(), z.string()).default({
    "open-radial-menu": "CommandOrControl+Shift+Space",
    "toggle-listening": "CommandOrControl+Shift+L",
    "pause-listening": "CommandOrControl+Shift+P",
    "toggle-overlay": "CommandOrControl+Shift+O",
    "copy-latest": "CommandOrControl+Shift+C",
    "capture-and-translate": "CommandOrControl+Shift+T",
    "capture-ocr-only": "CommandOrControl+Shift+X",
    "toggle-continuous-ocr": "CommandOrControl+Shift+R",
    "toggle-ocr-panel": "CommandOrControl+Shift+H",
  }),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;
