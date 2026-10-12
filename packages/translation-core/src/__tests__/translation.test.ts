import { describe, it, expect, beforeEach } from 'vitest';
import {
  TranslationCache,
  GlossaryEngine,
  TranslationRegistry,
  ITranslationProvider,
} from '@echo-lingo/translation-core';
import {
  TranslationCapability,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';

class FakeTestProvider implements ITranslationProvider {
  public readonly id = 'mock';
  public readonly name = 'Mock Provider';
  public readonly isLocal = true;
  public readonly requiresApiKey = false;
  public callCount = 0;

  public getCapability(): TranslationCapability {
    return {
      id: 'mock',
      name: 'Mock Provider',
      description: 'Test mock provider',
      isLocal: true,
      requiresApiKey: false,
      isConfigured: true,
      supportedLanguages: [{ code: 'vi', name: 'Vietnamese' }],
    };
  }

  public getSupportedLanguages() {
    return [{ code: 'vi', name: 'Vietnamese' }];
  }

  public async initialize(): Promise<void> {}

  public async translate(request: TranslationRequest): Promise<TranslationResult> {
    this.callCount++;
    return {
      originalText: request.text,
      translatedText: `[VI] ${request.text}`,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: 'mock',
      durationMs: 15,
      fromCache: false,
    };
  }

  public async testConnection() {
    return { ok: true };
  }
}

describe('Translation Core', () => {
  describe('TranslationCache', () => {
    it('stores and retrieves cached items', () => {
      const cache = new TranslationCache(5);
      cache.set('en', 'vi', 'Hello', 'Xin chào', 'mock');

      const hit = cache.get('en', 'vi', 'Hello');
      expect(hit).not.toBeNull();
      expect(hit?.translatedText).toBe('Xin chào');

      // Case-insensitive key match
      const hitLower = cache.get('en', 'vi', 'hello');
      expect(hitLower?.translatedText).toBe('Xin chào');
    });

    it('evicts oldest items when max capacity is reached', () => {
      const cache = new TranslationCache(2);
      cache.set('en', 'vi', 'one', 'một', 'mock');
      cache.set('en', 'vi', 'two', 'hai', 'mock');
      cache.set('en', 'vi', 'three', 'ba', 'mock');

      expect(cache.size).toBe(2);
      expect(cache.get('en', 'vi', 'one')).toBeNull();
      expect(cache.get('en', 'vi', 'two')).not.toBeNull();
      expect(cache.get('en', 'vi', 'three')).not.toBeNull();
    });
  });

  describe('GlossaryEngine', () => {
    it('replaces glossary keywords while respecting word boundaries', () => {
      const glossary = new GlossaryEngine([
        {
          id: '1',
          sourceTerm: 'EchoLingo',
          targetTerm: 'EchoLingo App',
          sourceLanguage: 'auto',
          targetLanguage: 'vi',
          caseSensitive: false,
          createdAt: 0,
        },
      ]);

      const text = 'Welcome to EchoLingo today!';
      const result = glossary.apply(text, 'en', 'vi');
      expect(result).toBe('Welcome to EchoLingo App today!');
    });
  });

  describe('TranslationRegistry', () => {
    let registry: TranslationRegistry;
    let fakeProvider: FakeTestProvider;

    beforeEach(() => {
      registry = new TranslationRegistry();
      fakeProvider = new FakeTestProvider();
      registry.register(fakeProvider);
      registry.setActiveProvider('mock');
    });

    it('translates text and caches the result', async () => {
      const res1 = await registry.translate({
        text: 'Good morning',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        priority: 'high',
      });

      expect(res1.translatedText).toBe('[VI] Good morning');
      expect(res1.fromCache).toBe(false);
      expect(fakeProvider.callCount).toBe(1);

      // Second call should come from cache
      const res2 = await registry.translate({
        text: 'Good morning',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        priority: 'high',
      });

      expect(res2.translatedText).toBe('[VI] Good morning');
      expect(res2.fromCache).toBe(true);
      expect(fakeProvider.callCount).toBe(1); // Provider not called again!
    });

    it('translates into multiple target languages concurrently', async () => {
      const res = await registry.translateMultiple('Hello', 'en', ['vi', 'es']);
      expect(res.vi).toBe('[VI] Hello');
    });
  });
});
