import { describe, it, expect } from 'vitest';
import {
  ScreenTranslationSettingsSchema,
  ScreenTranslateRequestSchema,
  AppSettingsSchema,
} from '@echo-lingo/contracts';

describe('Screen Translation Contracts', () => {
  it('validates ScreenTranslationSettingsSchema defaults and keepMainWindowHiddenAfterCapture flag', () => {
    const defaultSettings = ScreenTranslationSettingsSchema.parse({});
    expect(defaultSettings.keepMainWindowHiddenAfterCapture).toBe(false);
    expect(defaultSettings.hideOverlayOnCapture).toBe(true);

    const customSettings = ScreenTranslationSettingsSchema.parse({
      keepMainWindowHiddenAfterCapture: true,
    });
    expect(customSettings.keepMainWindowHiddenAfterCapture).toBe(true);
  });

  it('validates ScreenTranslateRequestSchema with optional keepMainWindowHidden parameter', () => {
    const baseRequest = {
      region: { displayId: 1, x: 100, y: 100, width: 300, height: 200 },
      ocrLanguage: 'en',
    };

    const parsedDefault = ScreenTranslateRequestSchema.parse(baseRequest);
    expect(parsedDefault.keepMainWindowHidden).toBeUndefined();

    const parsedWithHidden = ScreenTranslateRequestSchema.parse({
      ...baseRequest,
      keepMainWindowHidden: true,
    });
    expect(parsedWithHidden.keepMainWindowHidden).toBe(true);
  });

  it('validates AppSettingsSchema with nested ScreenTranslationSettings', () => {
    const parsed = AppSettingsSchema.parse({
      screenTranslation: {
        keepMainWindowHiddenAfterCapture: true,
      },
    });
    expect(parsed.screenTranslation.keepMainWindowHiddenAfterCapture).toBe(true);
  });
});

