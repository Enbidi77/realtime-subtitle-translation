import { describe, it, expect } from 'vitest';
import {
  formatAssTimestamp,
  hexToAssColor,
  alignmentToAssNumber,
  escapeAssText,
  generateAssScript,
} from '@echo-lingo/subtitle-core';
import { SubtitleSegment, SubtitleStyleOptions } from '@echo-lingo/contracts';
import { DEFAULT_SUBTITLE_STYLE, BILINGUAL_DUAL_STYLE, MODERN_GLASS_STYLE } from '@echo-lingo/config';

describe('ASS Generator', () => {
  describe('formatAssTimestamp', () => {
    it('formats 0 ms to 0:00:00.00', () => {
      expect(formatAssTimestamp(0)).toBe('0:00:00.00');
    });

    it('formats 1234 ms to 0:00:01.23', () => {
      expect(formatAssTimestamp(1234)).toBe('0:00:01.23');
    });

    it('formats 3661500 ms (1h 1m 1.5s) to 1:01:01.50', () => {
      expect(formatAssTimestamp(3661500)).toBe('1:01:01.50');
    });
  });

  describe('hexToAssColor', () => {
    it('converts #FFFFFF to opaque ASS white &H00FFFFFF&', () => {
      expect(hexToAssColor('#FFFFFF')).toBe('&H00FFFFFF&');
    });

    it('converts #FACC15 (RGB) to inverted BGR &H0015CCFA&', () => {
      expect(hexToAssColor('#FACC15')).toBe('&H0015CCFA&');
    });

    it('handles alpha inversion properly for #00000080', () => {
      // 0x80 = 128 -> ASS Alpha = 255 - 128 = 127 = 0x7F
      expect(hexToAssColor('#00000080')).toBe('&H7F000000&');
    });

    it('handles shorthand #FFF', () => {
      expect(hexToAssColor('#FFF')).toBe('&H00FFFFFF&');
    });
  });

  describe('alignmentToAssNumber', () => {
    it('maps alignments to correct numpad integer values', () => {
      expect(alignmentToAssNumber('bottom-center')).toBe(2);
      expect(alignmentToAssNumber('bottom-left')).toBe(1);
      expect(alignmentToAssNumber('bottom-right')).toBe(3);
      expect(alignmentToAssNumber('top-center')).toBe(8);
      expect(alignmentToAssNumber('middle-center')).toBe(5);
    });
  });

  describe('escapeAssText', () => {
    it('escapes braces and normalizes newlines to \\N', () => {
      expect(escapeAssText('Hello {world}')).toBe('Hello \\{world\\}');
      expect(escapeAssText('Line 1\nLine 2')).toBe('Line 1\\NLine 2');
    });
  });

  describe('generateAssScript', () => {
    const mockSegments: SubtitleSegment[] = [
      {
        id: 'seg-1',
        sessionId: 'session-1',
        startTime: 1000,
        endTime: 3500,
        originalText: 'Hello world',
        translations: { vi: 'Xin chào thế giới' },
        sourceLanguage: 'en',
        targetLanguages: ['vi'],
        status: 'final',
        speechProvider: 'whisper',
        translationProvider: 'google',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'seg-2',
        sessionId: 'session-1',
        startTime: 4000,
        endTime: 6500,
        originalText: 'Enjoy your video',
        translations: { vi: 'Thưởng thức video của bạn' },
        sourceLanguage: 'en',
        targetLanguages: ['vi'],
        status: 'final',
        speechProvider: 'whisper',
        translationProvider: 'google',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    it('generates standard ASS script with translated text when translation is enabled', () => {
      const script = generateAssScript(mockSegments, DEFAULT_SUBTITLE_STYLE, {
        resolution: { width: 1920, height: 1080 },
      });

      expect(script).toContain('[Script Info]');
      expect(script).toContain('PlayResX: 1920');
      expect(script).toContain('PlayResY: 1080');
      expect(script).toContain('[V4+ Styles]');
      expect(script).toContain('Style: Default,Arial,28');
      expect(script).toContain('[Events]');
      expect(script).toContain('Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Xin chào thế giới');
      expect(script).toContain('Dialogue: 0,0:00:04.00,0:00:06.50,Default,,0,0,0,,Thưởng thức video của bạn');
    });

    it('generates standard ASS script with original text when translation is disabled', () => {
      const script = generateAssScript(
        mockSegments,
        { ...DEFAULT_SUBTITLE_STYLE, showTranslation: false, showOriginal: true },
        { resolution: { width: 1920, height: 1080 } }
      );

      expect(script).toContain('Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Hello world');
      expect(script).toContain('Dialogue: 0,0:00:04.00,0:00:06.50,Default,,0,0,0,,Enjoy your video');
    });

    it('generates bilingual stacked script with custom formatting tags', () => {
      const script = generateAssScript(mockSegments, BILINGUAL_DUAL_STYLE);

      expect(script).toContain('Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\fs24\\c&H00FFFFFF&}Hello world\\N{\\fs20\\c&H0015CCFA&}Xin chào thế giới');
    });

    it('configures opaque background box when backgroundBox is enabled', () => {
      const script = generateAssScript(mockSegments, MODERN_GLASS_STYLE);

      // BorderStyle should be 3 (opaque box)
      expect(script).toContain(',3,0,0,2,');
    });
  });
});
