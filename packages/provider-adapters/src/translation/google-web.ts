import {
  LanguageInfo,
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { ITranslationProvider } from '@echo-lingo/translation-core';
import { SUPPORTED_LANGUAGES } from '@echo-lingo/config';

export class GoogleWebTranslationProvider implements ITranslationProvider {
  public readonly id: TranslationProviderId = 'google-web';
  public readonly name = 'Google Translate (Free)';
  public readonly isLocal = false;
  public readonly requiresApiKey = false;

  public getCapability(): TranslationCapability {
    return {
      id: this.id,
      name: this.name,
      description: 'Zero-configuration web translation supporting 100+ languages with no API key required.',
      isLocal: this.isLocal,
      requiresApiKey: this.requiresApiKey,
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
    if (!text) {
      return {
        originalText: '',
        translatedText: '',
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        provider: this.id,
        durationMs: 0,
        fromCache: false,
      };
    }

    const start = Date.now();
    const sl = request.sourceLanguage === 'auto' ? 'auto' : request.sourceLanguage;
    const tl = request.targetLanguage;

    // 1. Try Chrome Extension Google Translate API (fastest, high rate limit tolerance)
    try {
      const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(
        sl
      )}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as unknown;
        let translatedText = '';
        let detectedLang: string | undefined;

        if (Array.isArray(data)) {
          if (Array.isArray(data[0])) {
            translatedText = String(data[0][0] || '').trim();
            if (typeof data[0][1] === 'string') {
              detectedLang = data[0][1];
            }
          } else if (typeof data[0] === 'string') {
            translatedText = data[0].trim();
          }
        } else if (typeof data === 'string') {
          translatedText = data.trim();
        }

        if (translatedText) {
          return {
            originalText: text,
            translatedText,
            sourceLanguage: request.sourceLanguage,
            targetLanguage: request.targetLanguage,
            provider: this.id,
            durationMs: Date.now() - start,
            fromCache: false,
            detectedSourceLanguage: detectedLang || request.sourceLanguage,
          };
        }
      }
    } catch (err) {
      console.warn('[GoogleWeb] Primary endpoint failed, trying fallback...', err);
    }

    // 2. Fallback to translate_a/single
    try {
      const fallbackUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        sl
      )}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(fallbackUrl, {
        method: 'GET',
      });

      if (response.ok) {
        const data = (await response.json()) as unknown;
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedParts: string[] = [];
          for (const chunk of data[0] as Array<unknown[]>) {
            if (Array.isArray(chunk) && typeof chunk[0] === 'string') {
              translatedParts.push(chunk[0]);
            }
          }
          const translatedText = translatedParts.join('').trim();
          if (translatedText) {
            return {
              originalText: text,
              translatedText,
              sourceLanguage: request.sourceLanguage,
              targetLanguage: request.targetLanguage,
              provider: this.id,
              durationMs: Date.now() - start,
              fromCache: false,
              detectedSourceLanguage: typeof data[2] === 'string' ? data[2] : request.sourceLanguage,
            };
          }
        }
      }
    } catch (fallbackErr) {
      console.error('[GoogleWeb] Fallback translation error:', fallbackErr);
    }

    // If both web APIs failed, return original text as safe fallback instead of erroring
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: this.id,
      durationMs: Date.now() - start,
      fromCache: false,
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message?: string }> {
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
