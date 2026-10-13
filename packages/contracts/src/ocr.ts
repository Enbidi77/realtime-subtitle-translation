import { z } from 'zod';

export const OcrProviderIdSchema = z.enum([
  'windows-native',
  'tesseract',
  'mock',
  'google-vision',
]);
export type OcrProviderId = z.infer<typeof OcrProviderIdSchema>;

export const OcrBoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type OcrBoundingBox = z.infer<typeof OcrBoundingBoxSchema>;

export const OcrWordSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).default(1),
  boundingBox: OcrBoundingBoxSchema.optional(),
});
export type OcrWord = z.infer<typeof OcrWordSchema>;

export const OcrLineSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).default(1),
  words: z.array(OcrWordSchema).default([]),
  boundingBox: OcrBoundingBoxSchema.optional(),
});
export type OcrLine = z.infer<typeof OcrLineSchema>;

export const OcrBlockSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).default(1),
  lines: z.array(OcrLineSchema).default([]),
  boundingBox: OcrBoundingBoxSchema.optional(),
});
export type OcrBlock = z.infer<typeof OcrBlockSchema>;

export const OcrResponseSchema = z.object({
  text: z.string(),
  blocks: z.array(OcrBlockSchema).default([]),
  lines: z.array(OcrLineSchema).default([]),
  confidence: z.number().min(0).max(1).default(1),
  language: z.string().optional(),
  durationMs: z.number().nonnegative().default(0),
  providerId: z.string(),
});
export type OcrResponse = z.infer<typeof OcrResponseSchema>;

export const OcrProfileSchema = z.enum([
  'general',
  'game-subtitles',
  'small-ui',
  'high-contrast',
  'cjk',
  'none',
]);
export type OcrProfile = z.infer<typeof OcrProfileSchema>;

export const OcrPreprocessOptionsSchema = z.object({
  profile: OcrProfileSchema.default('general'),
  grayscale: z.boolean().default(true),
  contrastStretch: z.boolean().default(false),
  binarize: z.boolean().default(false),
  invert: z.boolean().default(false),
  scale: z.number().min(1).max(4).default(1),
});
export type OcrPreprocessOptions = z.infer<typeof OcrPreprocessOptionsSchema>;

export const OcrLanguageInfoSchema = z.object({
  code: z.string(),
  name: z.string(),
  nativeName: z.string().optional(),
});
export type OcrLanguageInfo = z.infer<typeof OcrLanguageInfoSchema>;

export const OcrProviderCapabilitySchema = z.object({
  id: OcrProviderIdSchema,
  name: z.string(),
  description: z.string(),
  isLocal: z.boolean(),
  isAvailable: z.boolean(),
  supportedLanguages: z.array(OcrLanguageInfoSchema),
});
export type OcrProviderCapability = z.infer<typeof OcrProviderCapabilitySchema>;

export const OcrRecognizeRequestSchema = z.object({
  imageBuffer: z.string().or(z.instanceof(Uint8Array)).optional(),
  language: z.string().optional().default('auto'),
  preprocessOptions: OcrPreprocessOptionsSchema.optional(),
  providerId: OcrProviderIdSchema.optional(),
});
export type OcrRecognizeRequest = z.infer<typeof OcrRecognizeRequestSchema>;
