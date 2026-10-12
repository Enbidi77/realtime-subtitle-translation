import {
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { ITranslationProvider } from './provider.interface.js';
import { TranslationCache } from './cache.js';
import { GlossaryEngine } from './glossary.js';

export interface TranslationRegistryOptions {
  cache?: TranslationCache;
  glossary?: GlossaryEngine;
  defaultProviderId?: TranslationProviderId;
}

export class TranslationRegistry {
  private providers = new Map<TranslationProviderId, ITranslationProvider>();
  private activeProviderId: TranslationProviderId;
  private cache: TranslationCache;
  private glossary: GlossaryEngine;

  constructor(options: TranslationRegistryOptions = {}) {
    this.cache = options.cache || new TranslationCache();
    this.glossary = options.glossary || new GlossaryEngine();
    this.activeProviderId = options.defaultProviderId || 'google-web';
  }

  public register(provider: ITranslationProvider): void {
    this.providers.set(provider.id, provider);
  }

  public get(id: TranslationProviderId): ITranslationProvider | undefined {
    return this.providers.get(id);
  }

  public setActiveProvider(id: TranslationProviderId): boolean {
    if (this.providers.has(id)) {
      this.activeProviderId = id;
      return true;
    }
    return false;
  }

  public getActiveProviderId(): TranslationProviderId {
    return this.activeProviderId;
  }

  public getActiveProvider(): ITranslationProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      // Fallback to first available provider
      const first = this.providers.values().next().value;
      if (first) return first;
      throw new Error(`No translation provider registered for ${this.activeProviderId}`);
    }
    return provider;
  }

  public getAllCapabilities(): TranslationCapability[] {
    return Array.from(this.providers.values()).map((p) => p.getCapability());
  }

  public getCache(): TranslationCache {
    return this.cache;
  }

  public getGlossary(): GlossaryEngine {
    return this.glossary;
  }

  /**
   * Translate text with caching, glossary replacement, and error resilience
   */
  public async translate(
    request: TranslationRequest,
    providerId?: TranslationProviderId
  ): Promise<TranslationResult> {
    const text = request.text.trim();
    if (!text) {
      return {
        originalText: '',
        translatedText: '',
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        provider: 'noop',
        durationMs: 0,
        fromCache: true,
      };
    }

    const provider = providerId ? this.providers.get(providerId) : this.getActiveProvider();
    if (!provider) {
      throw new Error(`Translation provider ${providerId || this.activeProviderId} not found`);
    }

    // Check cache first
    const cached = this.cache.get(request.sourceLanguage, request.targetLanguage, text);
    if (cached) {
      return {
        originalText: text,
        translatedText: cached.translatedText,
        sourceLanguage: cached.sourceLanguage,
        targetLanguage: cached.targetLanguage,
        provider: cached.provider,
        durationMs: 1,
        fromCache: true,
      };
    }

    const start = Date.now();
    let result: TranslationResult;

    // Retry once on failure
    try {
      result = await provider.translate(request);
    } catch (err) {
      console.warn(`Translation attempt 1 failed with ${provider.id}:`, err);
      // Wait 300ms before retry
      await new Promise((r) => setTimeout(r, 300));
      result = await provider.translate(request);
    }

    // Apply custom glossary substitutions if any
    const postProcessed = this.glossary.apply(
      result.translatedText,
      result.sourceLanguage,
      result.targetLanguage
    );

    result = {
      ...result,
      translatedText: postProcessed,
      durationMs: Date.now() - start,
      fromCache: false,
    };

    // Save to cache
    this.cache.set(
      result.sourceLanguage,
      result.targetLanguage,
      text,
      result.translatedText,
      result.provider
    );

    return result;
  }

  /**
   * Translate text into multiple target languages concurrently
   */
  public async translateMultiple(
    text: string,
    sourceLanguage: string,
    targetLanguages: string[],
    providerId?: TranslationProviderId
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    const promises = targetLanguages.map(async (targetLang) => {
      try {
        const res = await this.translate(
          {
            text,
            sourceLanguage,
            targetLanguage: targetLang,
            priority: 'high',
          },
          providerId
        );
        results[targetLang] = res.translatedText;
      } catch (err) {
        console.error(`Failed to translate into ${targetLang}:`, err);
        results[targetLang] = `[Translation error: ${targetLang}]`;
      }
    });

    await Promise.all(promises);
    return results;
  }
}
