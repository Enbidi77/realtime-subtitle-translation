import {
  LanguageInfo,
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { ITranslationProvider } from '@echo-lingo/translation-core';
import { SUPPORTED_LANGUAGES } from '@echo-lingo/config';

export class LibreTranslateProvider implements ITranslationProvider {
  public readonly id: TranslationProviderId = 'libretranslate';
  public readonly name = 'LibreTranslate';
  public readonly isLocal = false;
  public readonly requiresApiKey = false;
  public readonly isPaid = false;
  private serverUrl = 'https://libretranslate.com';
  private apiKey = '';

  constructor(serverUrl = 'https://libretranslate.com', apiKey = '') {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
  }

  public setConfig(serverUrl: string, apiKey = ''): void {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey.trim();
  }

  public getCapability(): TranslationCapability {
    return {
      id: this.id,
      name: this.name,
      description: 'Open-source, self-hostable machine translation engine.',
      isLocal: this.serverUrl.includes('localhost') || this.serverUrl.includes('127.0.0.1'),
      requiresApiKey: false,
      isConfigured: true,
      isPaid: this.isPaid,
      supportedLanguages: this.getSupportedLanguages(),
    };
  }

  public getSupportedLanguages(): LanguageInfo[] {
    return SUPPORTED_LANGUAGES;
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.serverUrl && typeof config.serverUrl === 'string') {
      this.serverUrl = config.serverUrl.replace(/\/+$/, '');
    }
    if (config?.apiKey && typeof config.apiKey === 'string') {
      this.apiKey = config.apiKey.trim();
    }
  }

  public async translate(request: TranslationRequest): Promise<TranslationResult> {
    const text = request.text.trim();
    const start = Date.now();

    const body: Record<string, unknown> = {
      q: text,
      source: request.sourceLanguage === 'auto' ? 'auto' : request.sourceLanguage,
      target: request.targetLanguage,
      format: 'text',
    };

    if (this.apiKey) {
      body.api_key = this.apiKey;
    }

    const response = await fetch(`${this.serverUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LibreTranslate error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as { translatedText?: string; detectedLanguage?: { confidence: number; language: string } };
    if (!json.translatedText) {
      throw new Error('Invalid response from LibreTranslate API');
    }

    return {
      originalText: text,
      translatedText: json.translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: this.id,
      durationMs: Date.now() - start,
      fromCache: false,
      detectedSourceLanguage: json.detectedLanguage?.language,
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch(`${this.serverUrl}/languages`);
      return { ok: res.ok, message: res.ok ? 'Connected' : `Error: ${res.statusText}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
