import { SpeechEngineType, TranslationProviderId } from '@echo-lingo/contracts';

/**
 * Speech recognition engines that require paid credentials or commercial accounts.
 */
export const PAID_SPEECH_ENGINES: readonly SpeechEngineType[] = [
  'openai-whisper',
] as const;

/**
 * Translation providers that require paid credentials or commercial accounts.
 */
export const PAID_TRANSLATION_PROVIDERS: readonly TranslationProviderId[] = [
  'google-cloud',
  'deepl',
] as const;

/**
 * Returns true if the speech engine is a paid commercial service.
 */
export function isPaidSpeechEngine(engineId: string | null | undefined): boolean {
  if (!engineId) return false;
  return (PAID_SPEECH_ENGINES as readonly string[]).includes(engineId);
}

/**
 * Returns true if the translation provider is a paid commercial service.
 */
export function isPaidTranslationProvider(providerId: string | null | undefined): boolean {
  if (!providerId) return false;
  return (PAID_TRANSLATION_PROVIDERS as readonly string[]).includes(providerId);
}

