import { describe, it, expect } from 'vitest';
import {
  GoogleWebTranslationProvider,
  MockTranslationProvider,
  MockSpeechProvider,
  OpenAIWhisperProvider,
  GroqWhisperProvider,
  LocalWhisperProvider,
  WindowsSpeechProvider,
  MockOcrProvider,
  WindowsNativeOcrProvider,
} from '@echo-lingo/provider-adapters';
import { OcrRegistry } from '@echo-lingo/ocr-core';

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
        priority: 'high',
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

    it('lists model statuses and handles transcription for LocalWhisperProvider', async () => {
      const local = new LocalWhisperProvider();
      await local.initialize();
      expect(local.isReady()).toBe(true);

      const models = await local.getModelStatus();
      expect(models.length).toBeGreaterThan(1);
      expect(models[0].id).toBe('tiny');

      // Silent buffer should return empty string without error
      const res = await local.transcribe(new Float32Array(16000), { sampleRate: 16000 });
      expect(res.text).toBe('');
      expect(res.isFinal).toBe(true);
    });

    it('initializes and reports properties for WindowsSpeechProvider', async () => {
      const winSpeech = new WindowsSpeechProvider();
      expect(winSpeech.id).toBe('windows-speech');
      expect(winSpeech.isLocal).toBe(true);
      expect(winSpeech.isReady()).toBe(process.platform === 'win32');

      // Silent buffer should return empty string without error
      const res = await winSpeech.transcribe(new Float32Array(16000), { sampleRate: 16000 });
      expect(res.text).toBe('');
      expect(res.isFinal).toBe(true);

      const status = await winSpeech.getModelStatus();
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
    });
  });

  describe('OCR Providers', () => {
    it('initializes and recognizes mock text with MockOcrProvider', async () => {
      const mock = new MockOcrProvider();
      expect(mock.id).toBe('mock');
      expect(mock.isLocal).toBe(true);
      expect(await mock.healthCheck()).toBe(true);

      const cap = mock.getCapability();
      expect(cap.supportedLanguages.length).toBeGreaterThan(0);

      const result = await mock.recognize({
        imageBuffer: 'fake-base64',
        language: 'en',
      });

      expect(result.text).toBe('EchoLingo On-Screen OCR Translation');
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('reports capability and readiness for WindowsNativeOcrProvider', async () => {
      const winOcr = new WindowsNativeOcrProvider();
      expect(winOcr.id).toBe('windows-native');
      expect(winOcr.isLocal).toBe(true);
      expect(await winOcr.healthCheck()).toBe(process.platform === 'win32');

      const cap = winOcr.getCapability();
      expect(cap.id).toBe('windows-native');
      expect(cap.isLocal).toBe(true);
      expect(cap.supportedLanguages.length).toBeGreaterThan(0);
    });

    it('integrates OCR providers into OcrRegistry', async () => {
      const registry = new OcrRegistry();
      const mock = new MockOcrProvider();
      const winOcr = new WindowsNativeOcrProvider();

      registry.register(mock);
      registry.register(winOcr);

      registry.setActiveProvider('mock');
      const active = registry.getActiveProvider();
      expect(active.id).toBe('mock');

      const res = await registry.recognize({
        imageBuffer: 'fake-base64',
        language: 'en',
      });
      expect(res.text).toBe('EchoLingo On-Screen OCR Translation');

      const caps = registry.getAllCapabilities();
      expect(caps).toHaveLength(2);
    });
  });
});

