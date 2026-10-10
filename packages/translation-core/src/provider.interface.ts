import {
  LanguageInfo,
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';

export interface ITranslationProvider {
  readonly id: TranslationProviderId;
  readonly name: string;
  readonly isLocal: boolean;
  readonly requiresApiKey: boolean;

  getCapability(): TranslationCapability;
  getSupportedLanguages(): LanguageInfo[];
  initialize(config?: Record<string, unknown>): Promise<void>;
  translate(request: TranslationRequest): Promise<TranslationResult>;
  testConnection(): Promise<{ ok: boolean; message?: string }>;
}
