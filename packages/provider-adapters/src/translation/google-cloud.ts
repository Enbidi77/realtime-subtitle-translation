import {
  LanguageInfo,
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { ITranslationProvider } from '@echo-lingo/translation-core';
import { SUPPORTED_LANGUAGES } from '@echo-lingo/config';

export class GoogleCloudTranslationProvider implements ITranslationProvider {
  public readonly id: TranslationProviderId = 'google-cloud';
  public readonly name = 'Google Cloud Translation';
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
      description: 'Official Google Cloud Translation v2 API with enterprise SLA and high quota.',
      isLocal: this.isLocal,
      requiresApiKey: this.requiresApiKey,
      isConfigured: this.apiKey.length > 0,
      isPaid: this.isPaid,
      supportedLanguages: this.getSupportedLanguages(),
    };
  }

  public getSupportedLanguages(): LanguageInfo[] {
    return SUPPORTED_LANGUAGES;
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.apiKey && typeof config.apiKey === 'string') {
      this.apiKey = config.apiKey.trim();
    }
  }

  public async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!this.apiKey) {
      throw new Error('Google Cloud API Key is not configured');
    }

    const text = request.text.trim();
    const start = Date.now();

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      this.apiKey
    )}`;

    const body: Record<string, unknown> = {
      q: text,
      target: request.targetLanguage,
      format: 'text',
    };
    if (request.sourceLanguage !== 'auto') {
      body.source = request.sourceLanguage;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Google Cloud Translation error (${response.status}): ${errBody}`);
    }

    const json = (await response.json()) as {
      data?: {
        translations?: Array<{
          translatedText: string;
          detectedSourceLanguage?: string;
        }>;
      };
    };

    const trans = json?.data?.translations?.[0];
    if (!trans) {
      throw new Error('Invalid response from Google Cloud Translation API');
    }

    return {
      originalText: text,
      translatedText: trans.translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: this.id,
      durationMs: Date.now() - start,
      fromCache: false,
      detectedSourceLanguage: trans.detectedSourceLanguage,
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message?: string }> {
    if (!this.apiKey) {
      return { ok: false, message: 'API key is missing' };
    }
    try {
      const res = await this.translate({
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        priority: 'high',
      });
      return { ok: res.translatedText.length > 0 };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
