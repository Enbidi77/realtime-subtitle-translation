import {
  LanguageInfo,
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { ITranslationProvider } from '@echo-lingo/translation-core';
import { SUPPORTED_LANGUAGES } from '@echo-lingo/config';

export class MockTranslationProvider implements ITranslationProvider {
  public readonly id: TranslationProviderId = 'mock';
  public readonly name = 'Mock Translation Provider';
  public readonly isLocal = true;
  public readonly requiresApiKey = false;

  public getCapability(): TranslationCapability {
    return {
      id: this.id,
      name: this.name,
      description: 'Deterministic offline mock provider for automated tests and CI environments.',
      isLocal: true,
      requiresApiKey: false,
      isConfigured: true,
      supportedLanguages: this.getSupportedLanguages(),
    };
  }

  public getSupportedLanguages(): LanguageInfo[] {
    return SUPPORTED_LANGUAGES;
  }

  public async initialize(): Promise<void> {}

  public async translate(request: TranslationRequest): Promise<TranslationResult> {
    const text = request.text.trim();
    // Simulate ~15ms processing latency
    await new Promise((r) => setTimeout(r, 15));

    // Basic translations for common phrases in test/demo
    const dict: Record<string, Record<string, string>> = {
      'hello': { vi: 'Xin chào', es: 'Hola', fr: 'Bonjour', ja: 'こんにちは' },
      'hello world': { vi: 'Xin chào thế giới', es: 'Hola mundo', fr: 'Bonjour le monde', ja: 'こんにちは世界' },
      'welcome': { vi: 'Chào mừng', es: 'Bienvenido', fr: 'Bienvenue', ja: 'ようこそ' },
      'good morning': { vi: 'Chào buổi sáng', es: 'Buenos días', fr: 'Bonjour', ja: 'おはようございます' },
    };

    const lower = text.toLowerCase();
    let translatedText = `[${request.targetLanguage.toUpperCase()}] ${text}`;
    if (dict[lower] && dict[lower][request.targetLanguage]) {
      translatedText = dict[lower][request.targetLanguage];
    }

    return {
      originalText: text,
      translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: this.id,
      durationMs: 15,
      fromCache: false,
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: 'Mock provider ready' };
  }
}
