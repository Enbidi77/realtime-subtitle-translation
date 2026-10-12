import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatSrtTimestamp,
  formatVttTimestamp,
  formatDisplayTime,
  parseTimestamp,
  exportToSrt,
  exportToVtt,
  exportToTxt,
  exportToJson,
  parseSrt,
  parseVtt,
  SubtitleTimeline,
} from '@echo-lingo/subtitle-core';
import { SubtitleSegment } from '@echo-lingo/contracts';

describe('Subtitle Core', () => {
  describe('Timestamps', () => {
    it('formats SRT timestamp correctly with comma', () => {
      expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
      expect(formatSrtTimestamp(1234)).toBe('00:00:01,234');
      expect(formatSrtTimestamp(3661500)).toBe('01:01:01,500');
    });

    it('formats WebVTT timestamp correctly with dot', () => {
      expect(formatVttTimestamp(0)).toBe('00:00:00.000');
      expect(formatVttTimestamp(1234)).toBe('00:00:01.234');
      expect(formatVttTimestamp(3661500)).toBe('01:01:01.500');
    });

    it('formats display time cleanly', () => {
      expect(formatDisplayTime(5000)).toBe('00:05');
      expect(formatDisplayTime(65000)).toBe('01:05');
      expect(formatDisplayTime(3605000)).toBe('01:00:05');
    });

    it('parses timestamps with comma and dot', () => {
      expect(parseTimestamp('00:01:23,456')).toBe(83456);
      expect(parseTimestamp('00:01:23.456')).toBe(83456);
      expect(parseTimestamp('01:23.456')).toBe(83456);
      expect(parseTimestamp('invalid')).toBe(null);
    });
  });

  describe('Serializers & Parsers Round-trip', () => {
    const mockSegments: SubtitleSegment[] = [
      {
        id: 'seg-1',
        sessionId: 'session-123',
        startTime: 1000,
        endTime: 4000,
        originalText: 'Hello world',
        translations: { vi: 'Xin chào thế giới', es: 'Hola mundo' },
        sourceLanguage: 'en',
        targetLanguages: ['vi', 'es'],
        status: 'final',
        confidence: 0.95,
        speechProvider: 'whisper-local',
        translationProvider: 'google-web',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'seg-2',
        sessionId: 'session-123',
        startTime: 4500,
        endTime: 7000,
        originalText: 'Welcome to EchoLingo',
        translations: { vi: 'Chào mừng bạn đến với EchoLingo' },
        sourceLanguage: 'en',
        targetLanguages: ['vi'],
        status: 'final',
        confidence: 0.99,
        speechProvider: 'whisper-local',
        translationProvider: 'google-web',
        createdAt: 4500,
        updatedAt: 4500,
      },
    ];

    it('exports to valid SRT', () => {
      const srt = exportToSrt(mockSegments, { targetLanguage: 'vi' });
      expect(srt).toContain('1\n00:00:01,000 --> 00:00:04,000');
      expect(srt).toContain('Hello world\nXin chào thế giới');
      expect(srt).toContain('2\n00:00:04,500 --> 00:00:07,000');
    });

    it('exports to valid WebVTT', () => {
      const vtt = exportToVtt(mockSegments);
      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('00:00:01.000 --> 00:00:04.000');
    });

    it('exports to clean Plain Text', () => {
      const txt = exportToTxt(mockSegments, { targetLanguage: 'vi' });
      expect(txt).toContain('[00:01 - 00:04] Hello world -> Xin chào thế giới');
    });

    it('exports to JSON', () => {
      const jsonStr = exportToJson(mockSegments);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.version).toBe('1.0');
      expect(parsed.segmentCount).toBe(2);
      expect(parsed.segments[0].originalText).toBe('Hello world');
    });

    it('parses SRT back into segments', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Hello world
Xin chào thế giới

2
00:00:05,000 --> 00:00:08,000
Second subtitle
`;
      const segments = parseSrt(srt, { targetLanguage: 'vi' });
      expect(segments).toHaveLength(2);
      expect(segments[0].startTime).toBe(1000);
      expect(segments[0].endTime).toBe(4000);
      expect(segments[0].originalText).toBe('Hello world');
      expect(segments[0].translations.vi).toBe('Xin chào thế giới');
      expect(segments[1].originalText).toBe('Second subtitle');
    });

    it('parses WebVTT back into segments', () => {
      const vtt = `WEBVTT

1
00:00:01.500 --> 00:00:03.000
Live translation test
`;
      const segments = parseVtt(vtt);
      expect(segments).toHaveLength(1);
      expect(segments[0].startTime).toBe(1500);
      expect(segments[0].endTime).toBe(3000);
      expect(segments[0].originalText).toBe('Live translation test');
    });
  });

  describe('SubtitleTimeline', () => {
    let timeline: SubtitleTimeline;

    beforeEach(() => {
      timeline = new SubtitleTimeline();
    });

    it('handles partial and final transitions', () => {
      const partialSeg: SubtitleSegment = {
        id: 'p-1',
        sessionId: 's-1',
        startTime: 100,
        endTime: 500,
        originalText: 'Hello',
        translations: {},
        sourceLanguage: 'en',
        targetLanguages: ['vi'],
        status: 'partial',
        speechProvider: 'whisper',
        translationProvider: 'none',
        createdAt: 100,
        updatedAt: 100,
      };

      timeline.updatePartial(partialSeg);
      expect(timeline.getSegments(true)).toHaveLength(1);
      expect(timeline.getSegments(false)).toHaveLength(0);

      const finalSeg: SubtitleSegment = {
        ...partialSeg,
        id: 'p-1',
        originalText: 'Hello world',
        translations: { vi: 'Xin chào thế giới' },
        status: 'final',
        endTime: 1200,
      };

      timeline.addFinal(finalSeg);
      expect(timeline.count).toBe(1);
      expect(timeline.getSegments(false)).toHaveLength(1);
      expect(timeline.getSegments(false)[0].originalText).toBe('Hello world');
      expect(timeline.getSegments(true)).toHaveLength(1); // active partial cleared
    });

    it('searches segments by original text or translation', () => {
      timeline.addFinal({
        id: '1',
        sessionId: 's',
        startTime: 0,
        endTime: 1000,
        originalText: 'Speech recognition engine',
        translations: { vi: 'Bộ máy nhận dạng giọng nói' },
        sourceLanguage: 'en',
        targetLanguages: ['vi'],
        status: 'final',
        speechProvider: 'whisper',
        translationProvider: 'test',
        createdAt: 0,
        updatedAt: 0,
      });

      expect(timeline.search('engine')).toHaveLength(1);
      expect(timeline.search('nhận dạng')).toHaveLength(1);
      expect(timeline.search('notfound')).toHaveLength(0);
    });

    it('updates and deletes segments', () => {
      timeline.addFinal({
        id: 'seg-test',
        sessionId: 's',
        startTime: 0,
        endTime: 1000,
        originalText: 'Old text',
        translations: {},
        sourceLanguage: 'en',
        targetLanguages: [],
        status: 'final',
        speechProvider: 'whisper',
        translationProvider: 'none',
        createdAt: 0,
        updatedAt: 0,
      });

      timeline.updateSegment('seg-test', { originalText: 'Corrected text' });
      expect(timeline.getSegmentById('seg-test')?.originalText).toBe('Corrected text');

      timeline.deleteSegment('seg-test');
      expect(timeline.count).toBe(0);
    });
  });
});
