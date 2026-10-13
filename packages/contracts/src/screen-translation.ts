import { z } from 'zod';
import { OcrProfileSchema, OcrProviderIdSchema } from '@echo-lingo/contracts/ocr.js';
import { TranslationProviderIdSchema } from '@echo-lingo/contracts/translation.js';

export const DisplayInfoSchema = z.object({
  id: z.number(),
  name: z.string(),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  workArea: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  scaleFactor: z.number(),
  isPrimary: z.boolean(),
  rotation: z.number(),
});
export type DisplayInfo = z.infer<typeof DisplayInfoSchema>;

export const ScreenCaptureRegionSchema = z.object({
  displayId: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type ScreenCaptureRegion = z.infer<typeof ScreenCaptureRegionSchema>;

export const ScreenCaptureResultSchema = z.object({
  imageData: z.string(), // base64 data URL
  region: ScreenCaptureRegionSchema,
  displayWidth: z.number(),
  displayHeight: z.number(),
  scaleFactor: z.number(),
});
export type ScreenCaptureResult = z.infer<typeof ScreenCaptureResultSchema>;

export const ContinuousOcrStateSchema = z.enum([
  'idle',
  'preparing',
  'capturing',
  'recognizing',
  'translating',
  'paused',
  'stopping',
  'error',
]);
export type ContinuousOcrState = z.infer<typeof ContinuousOcrStateSchema>;

export const ContinuousOcrConfigSchema = z.object({
  region: ScreenCaptureRegionSchema,
  intervalMs: z.number().min(500).max(10000).default(2000),
  changeThreshold: z.number().min(0).max(1).default(0.15),
  ignoreUnchanged: z.boolean().default(true),
  translateOnlyDiff: z.boolean().default(false),
  ocrProviderId: OcrProviderIdSchema.default('windows-native'),
  ocrLanguage: z.string().default('auto'),
  translationProviderId: TranslationProviderIdSchema.default('google-web'),
  sourceLanguage: z.string().default('auto'),
  targetLanguages: z.array(z.string()).default(['vi']),
  profile: OcrProfileSchema.default('general'),
});
export type ContinuousOcrConfig = z.infer<typeof ContinuousOcrConfigSchema>;

export const ContinuousOcrStatsSchema = z.object({
  state: ContinuousOcrStateSchema,
  capturedCount: z.number().default(0),
  recognizedCount: z.number().default(0),
  translatedCount: z.number().default(0),
  skippedCount: z.number().default(0),
  averageDurationMs: z.number().default(0),
  lastCapturedAt: z.number().optional(),
  errorMessage: z.string().optional(),
});
export type ContinuousOcrStats = z.infer<typeof ContinuousOcrStatsSchema>;

export const OcrHistoryItemSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  ocrProvider: z.string(),
  ocrLanguage: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  originalText: z.string(),
  correctedText: z.string().optional(),
  translatedText: z.string(),
  confidence: z.number(),
  durationMs: z.number(),
  sessionType: z.enum(['single', 'continuous']).default('single'),
  imageData: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type OcrHistoryItem = z.infer<typeof OcrHistoryItemSchema>;

export const FloatingPanelPayloadSchema = z.object({
  originalText: z.string(),
  translatedText: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  confidence: z.number().optional(),
  durationMs: z.number().optional(),
  region: ScreenCaptureRegionSchema.optional(),
  canRetranslate: z.boolean().optional(),
});
export type FloatingPanelPayload = z.infer<typeof FloatingPanelPayloadSchema>;

