import { describe, it, expect } from 'vitest';
import {
  GoogleWebTranslationProvider,
  MockTranslationProvider,
  MockSpeechProvider,
  OpenAIWhisperProvider,
  GroqWhisperProvider,
  LocalWhisperProvider,
} from '../index.js';

describe('Provider Adapters', () => {
  describe('Translation Providers', () => {
    it('initializes and reports capabilities for MockTranslationProvider', async () => {
      const mock = new MockTranslationProvider();
      const cap = mock.getCapability();
      expect(cap.id).toBe('mock');
      expect(cap.isConfigured).toBe(true);

      const res = await mock.translate({
        text: 'hello',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
      });
      expect(res.translatedText).toBe('Xin chào');
    });

    it('reports capability for GoogleWebTranslationProvider', () => {
      const gweb = new GoogleWebTranslationProvider();
      const cap = gweb.getCapability();
      expect(cap.id).toBe('google-web');
      expect(cap.requiresApiKey).toBe(false);
      expect(cap.isConfigured).toBe(true);
      expect(cap.supportedLanguages.length).toBeGreaterThan(10);
    });
  });

  describe('Speech Providers', () => {
    it('initializes and transcribes audio with MockSpeechProvider', async () => {
      const mock = new MockSpeechProvider();
      expect(mock.isReady()).toBe(true);

      const res = await mock.transcribe(new Float32Array(16000), { sampleRate: 16000 });
      expect(res.text.length).toBeGreaterThan(0);
      expect(res.isFinal).toBe(true);
    });

    it('reports configuration readiness for Cloud Whisper providers', () => {
      const openai = new OpenAIWhisperProvider('');
      expect(openai.isReady()).toBe(false);

      openai.setApiKey('sk-fake-key');
      expect(openai.isReady()).toBe(true);

      const groq = new GroqWhisperProvider('');
      expect(groq.isReady()).toBe(false);

      groq.setApiKey('gsk-fake-key');
      expect(groq.isReady()).toBe(true);
    });

    it('lists model statuses for LocalWhisperProvider', async () => {
      const local = new LocalWhisperProvider();
      const models = await local.getModelStatus();
      expect(models.length).toBeGreaterThan(1);
      expect(models[0].id).toBe('tiny');
    });
  });
});
