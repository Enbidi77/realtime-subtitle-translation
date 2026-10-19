import { z } from 'zod';

export const TranslationProviderIdSchema = z.enum([
  'google-web',
  'google-cloud',
  'deepl',
  'libretranslate',
  'ollama',
  'mock',
]);
export type TranslationProviderId = z.infer<typeof TranslationProviderIdSchema>;

export const LanguageInfoSchema = z.object({
  code: z.string(),
  name: z.string(),
  nativeName: z.string().optional(),
});
export type LanguageInfo = z.infer<typeof LanguageInfoSchema>;

export const TranslationCapabilitySchema = z.object({
  id: TranslationProviderIdSchema,
  name: z.string(),
  description: z.string(),
  isLocal: z.boolean(),
  requiresApiKey: z.boolean(),
  isConfigured: z.boolean(),
  isPaid: z.boolean().default(false),
  supportedLanguages: z.array(LanguageInfoSchema),
});
export type TranslationCapability = z.infer<typeof TranslationCapabilitySchema>;

export const TranslationRequestSchema = z.object({
  text: z.string().min(1),
  sourceLanguage: z.string().default('auto'),
  targetLanguage: z.string(),
  priority: z.enum(['high', 'low']).default('high'),
  context: z.string().optional(),
});
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;

export const TranslationResultSchema = z.object({
  originalText: z.string(),
  translatedText: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  provider: z.string(),
  durationMs: z.number().nonnegative(),
  fromCache: z.boolean().default(false),
  detectedSourceLanguage: z.string().optional(),
});
export type TranslationResult = z.infer<typeof TranslationResultSchema>;

export const GlossaryEntrySchema = z.object({
  id: z.string(),
  sourceTerm: z.string().min(1),
  targetTerm: z.string().min(1),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  caseSensitive: z.boolean().default(false),
  description: z.string().optional(),
  createdAt: z.number(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;
