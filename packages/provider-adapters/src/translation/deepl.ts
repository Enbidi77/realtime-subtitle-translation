import {
  LanguageInfo,
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { ITranslationProvider } from '@echo-lingo/translation-core';

export class DeepLTranslationProvider implements ITranslationProvider {
  public readonly id: TranslationProviderId = 'deepl';
  public readonly name = 'DeepL Translator';
  public readonly isLocal = false;
  public readonly requiresApiKey = true;
  public readonly isPaid = true;
  private apiKey = '';

  constructor(apiKey = '') {
    this.apiKey = apiKey;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
  }

  public getCapability(): TranslationCapability {
    return {
      id: this.id,
      name: this.name,
      description: 'High-accuracy neural machine translation from DeepL (supports Free and Pro keys).',
      isLocal: this.isLocal,
      requiresApiKey: this.requiresApiKey,
      isConfigured: this.apiKey.length > 0,
      isPaid: this.isPaid,
      supportedLanguages: this.getSupportedLanguages(),
    };
  }

  public getSupportedLanguages(): LanguageInfo[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
      { code: 'pl', name: 'Polish', nativeName: 'Polski' },
      { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
      { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
    ];
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.apiKey && typeof config.apiKey === 'string') {
      this.apiKey = config.apiKey.trim();
    }
  }

  public async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!this.apiKey) {
      throw new Error('DeepL API Key is not configured');
    }

    const text = request.text.trim();
    const start = Date.now();
    const isFree = this.apiKey.endsWith(':fx');
    const endpoint = isFree
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const targetLangCode = request.targetLanguage.toUpperCase();
    const body: Record<string, unknown> = {
      text: [text],
      target_lang: targetLangCode,
    };

    if (request.sourceLanguage !== 'auto') {
      body.source_lang = request.sourceLanguage.toUpperCase();
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepL API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      translations?: Array<{
        detected_source_language?: string;
        text: string;
      }>;
    };

    const trans = json?.translations?.[0];
    if (!trans) {
      throw new Error('Invalid response from DeepL API');
    }

    return {
      originalText: text,
      translatedText: trans.text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: this.id,
      durationMs: Date.now() - start,
      fromCache: false,
      detectedSourceLanguage: trans.detected_source_language?.toLowerCase(),
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message?: string }> {
    if (!this.apiKey) return { ok: false, message: 'API key is missing' };
    try {
      const isFree = this.apiKey.endsWith(':fx');
      const endpoint = isFree ? 'https://api-free.deepl.com/v2/usage' : 'https://api.deepl.com/v2/usage';
      const res = await fetch(endpoint, {
        headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}` },
      });
      return { ok: res.ok, message: res.ok ? 'Connected' : `Error: ${res.statusText}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
