import { describe, it, expect } from 'vitest';
import {
  AppSettingsSchema,
  CloseBehaviorSchema,
  SplashStatusEventSchema,
  SupportedLocaleSchema,
  FeatureFlagsSchema,
} from '@echo-lingo/contracts';
import {
  DEFAULT_APP_SETTINGS,
  isPaidSpeechEngine,
  isPaidTranslationProvider,
  PAID_SPEECH_ENGINES,
  PAID_TRANSLATION_PROVIDERS,
  getLanguageName,
  isFeatureEnabled,
  DEFAULT_FEATURE_FLAGS,
} from '@echo-lingo/config';
import { zlibSyncCheck } from './png-helper.js';

describe('App Settings & Close Behavior Contracts', () => {
  it('validates supported UI locales in AppSettingsSchema and SupportedLocaleSchema', () => {
    const validLocales = ['en', 'vi', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru'] as const;
    for (const loc of validLocales) {
      expect(SupportedLocaleSchema.parse(loc)).toBe(loc);
      const settings = AppSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, locale: loc });
      expect(settings.locale).toBe(loc);
    }
    expect(() => SupportedLocaleSchema.parse('invalid-locale')).toThrow();
    expect(getLanguageName('zh', 'zh')).toBe('简体中文');
    expect(getLanguageName('ja', 'ja')).toBe('日本語');
    expect(getLanguageName('en', 'en')).toBe('English');
  });
  it('validates default closeBehavior, splash screen, and showPaidProviders settings', () => {
    expect(DEFAULT_APP_SETTINGS.closeBehavior).toBe('ask');
    expect(DEFAULT_APP_SETTINGS.enableSplashScreen).toBe(true);
    expect(DEFAULT_APP_SETTINGS.showPaidProviders).toBe(false);
    expect(DEFAULT_APP_SETTINGS.hasCompletedOnboarding).toBe(false);
    expect(DEFAULT_APP_SETTINGS.overlaySettings.hideOnCapture).toBe(true);
    expect(DEFAULT_APP_SETTINGS.screenTranslation.hideOverlayOnCapture).toBe(true);
    expect(DEFAULT_APP_SETTINGS.screenTranslation.keepMainWindowHiddenAfterCapture).toBe(false);
    const parsed = AppSettingsSchema.parse(DEFAULT_APP_SETTINGS);
    expect(parsed.closeBehavior).toBe('ask');
    expect(parsed.enableSplashScreen).toBe(true);
    expect(parsed.showPaidProviders).toBe(false);
    expect(parsed.hasCompletedOnboarding).toBe(false);
    expect(parsed.overlaySettings.hideOnCapture).toBe(true);
    expect(parsed.screenTranslation.hideOverlayOnCapture).toBe(true);
    expect(parsed.screenTranslation.keepMainWindowHiddenAfterCapture).toBe(false);
  });

  it('correctly classifies paid and free speech and translation providers', () => {
    expect(isPaidSpeechEngine('openai-whisper')).toBe(true);
    expect(isPaidSpeechEngine('groq-whisper')).toBe(true);
    expect(isPaidSpeechEngine('whisper-local')).toBe(false);
    expect(isPaidSpeechEngine('windows-speech')).toBe(false);
    expect(isPaidSpeechEngine('mock')).toBe(false);

    expect(isPaidTranslationProvider('google-cloud')).toBe(true);
    expect(isPaidTranslationProvider('deepl')).toBe(true);
    expect(isPaidTranslationProvider('google-web')).toBe(false);
    expect(isPaidTranslationProvider('libretranslate')).toBe(false);
    expect(isPaidTranslationProvider('ollama')).toBe(false);
    expect(isPaidTranslationProvider('mock')).toBe(false);

    expect(PAID_SPEECH_ENGINES).toContain('openai-whisper');
    expect(PAID_SPEECH_ENGINES).toContain('groq-whisper');
    expect(PAID_TRANSLATION_PROVIDERS).toContain('google-cloud');
    expect(PAID_TRANSLATION_PROVIDERS).toContain('deepl');
  });

  it('accepts valid closeBehavior options', () => {
    expect(CloseBehaviorSchema.parse('minimize-to-tray')).toBe('minimize-to-tray');
    expect(CloseBehaviorSchema.parse('quit')).toBe('quit');
    expect(CloseBehaviorSchema.parse('ask')).toBe('ask');
  });

  it('rejects invalid closeBehavior options', () => {
    expect(() => CloseBehaviorSchema.parse('invalid-action')).toThrow();
    expect(() => AppSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, closeBehavior: 'unknown' as any })).toThrow();
  });

  it('validates SplashStatusEventSchema correctly', () => {
    const valid = SplashStatusEventSchema.parse({
      message: 'Initializing...',
      step: 1,
      totalSteps: 4,
      progress: 25,
    });
    expect(valid.message).toBe('Initializing...');
    expect(valid.step).toBe(1);
    expect(valid.totalSteps).toBe(4);
    expect(valid.progress).toBe(25);

    expect(() => SplashStatusEventSchema.parse({ progress: -5 })).toThrow();
    expect(() => SplashStatusEventSchema.parse({ message: 123 as any })).toThrow();
  });

  it('generates a valid PNG icon for system tray', () => {
    const png = zlibSyncCheck(32);
    // Standard PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    expect(png[4]).toBe(0x0d);
    expect(png[5]).toBe(0x0a);
    expect(png[6]).toBe(0x1a);
    expect(png[7]).toBe(0x0a);
    expect(png.length).toBeGreaterThan(100);
  });
  it('validates FeatureFlagsSchema defaults and custom flags', () => {
    const defaultFlags = FeatureFlagsSchema.parse({});
    expect(defaultFlags.liveSubtitles).toBe(true);
    expect(defaultFlags.videoSubtitles).toBe(true);
    expect(defaultFlags.screenOcr).toBe(true);
    expect(defaultFlags.sessions).toBe(true);
    expect(defaultFlags.history).toBe(true);
    expect(defaultFlags.providers).toBe(true);
    expect(DEFAULT_APP_SETTINGS.featureFlags).toEqual(DEFAULT_FEATURE_FLAGS);

    const customFlags = FeatureFlagsSchema.parse({
      videoSubtitles: false,
      screenOcr: false,
      experimentalCustom: false,
    });
    expect(customFlags.videoSubtitles).toBe(false);
    expect(customFlags.screenOcr).toBe(false);
    expect(customFlags.liveSubtitles).toBe(true);
    expect((customFlags as any).experimentalCustom).toBe(false);
  });

  it('evaluates isFeatureEnabled correctly for core, camelCase, and kebab-case pages', () => {
    // Core pages always enabled
    expect(isFeatureEnabled('dashboard', { videoSubtitles: false })).toBe(true);
    expect(isFeatureEnabled('settings', { videoSubtitles: false })).toBe(true);

    // Default behavior when no flags or empty flags
    expect(isFeatureEnabled('video-subtitles', undefined)).toBe(true);
    expect(isFeatureEnabled('video-subtitles', {})).toBe(true);

    // Controlled via camelCase
    expect(isFeatureEnabled('video-subtitles', { videoSubtitles: false })).toBe(false);
    expect(isFeatureEnabled('ocr-translate', { screenOcr: false })).toBe(false);
    expect(isFeatureEnabled('sessions', { sessions: false })).toBe(false);
    expect(isFeatureEnabled('history', { history: false })).toBe(false);
    expect(isFeatureEnabled('providers', { providers: false })).toBe(false);
    expect(isFeatureEnabled('live-subtitles', { liveSubtitles: false })).toBe(false);

    // Controlled via kebab-case directly
    expect(isFeatureEnabled('video-subtitles', { 'video-subtitles': false })).toBe(false);
    expect(isFeatureEnabled('ocr-translate', { 'ocr-translate': false })).toBe(false);
  });
});
