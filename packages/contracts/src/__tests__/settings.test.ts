import { describe, it, expect } from 'vitest';
import { AppSettingsSchema, CloseBehaviorSchema } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { zlibSyncCheck } from './png-helper.js';

describe('App Settings & Close Behavior Contracts', () => {
  it('validates default closeBehavior as minimize-to-tray', () => {
    expect(DEFAULT_APP_SETTINGS.closeBehavior).toBe('minimize-to-tray');
    const parsed = AppSettingsSchema.parse(DEFAULT_APP_SETTINGS);
    expect(parsed.closeBehavior).toBe('minimize-to-tray');
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
});

