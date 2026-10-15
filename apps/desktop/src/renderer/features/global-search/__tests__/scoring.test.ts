import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  isLevenshteinClose,
  findHighlightRanges,
  scoreSearchResult,
  deduplicateResults,
  sortSearchResults,
} from '../scoring.js';
import { SearchResultItem } from '../types.js';

describe('Global Search Scoring & Normalization', () => {
  describe('normalizeText', () => {
    it('normalizes uppercase, trailing spaces, and multiple internal spaces', () => {
      expect(normalizeText('  Hello   WORLD  ')).toBe('hello world');
    });

    it('removes diacritics and accents (Unicode NFKD)', () => {
      expect(normalizeText('Tiếng Việt')).toBe('tieng viet');
      expect(normalizeText('Cài đặt')).toBe('cai dat');
      expect(normalizeText('Phụ đề trực tiếp')).toBe('phu de truc tiep');
      expect(normalizeText('Café au lait')).toBe('cafe au lait');
    });

    it('handles empty or falsy strings', () => {
      expect(normalizeText('')).toBe('');
    });
  });

  describe('isLevenshteinClose', () => {
    it('identifies identical and small typo variations', () => {
      expect(isLevenshteinClose('settings', 'settings', 1)).toBe(true);
      expect(isLevenshteinClose('settngs', 'settings', 1)).toBe(true); // 1 deletion
      expect(isLevenshteinClose('dasboard', 'dashboard', 1)).toBe(true); // 1 deletion
      expect(isLevenshteinClose('completely', 'different', 2)).toBe(false);
    });
  });

  describe('findHighlightRanges', () => {
    it('returns exact match ranges', () => {
      const ranges = findHighlightRanges('Live Subtitles View', 'Live');
      expect(ranges).toEqual([{ start: 0, end: 4 }]);
    });

    it('merges overlapping match ranges', () => {
      const ranges = findHighlightRanges('EchoLingo App', 'Echo EchoLingo');
      expect(ranges.length).toBe(1);
      expect(ranges[0].start).toBe(0);
    });

    it('finds accent-insensitive highlights', () => {
      const ranges = findHighlightRanges('Cài đặt hệ thống', 'cai dat');
      expect(ranges).toEqual([{ start: 0, end: 7 }]);
    });
  });

  describe('scoreSearchResult', () => {
    const baseItem: SearchResultItem = {
      id: 'test:1',
      category: 'navigation',
      title: 'Live Subtitles',
      description: 'Real-time speech recognition and subtitle stream',
      icon: 'Mic',
      path: 'Navigation',
      keywords: ['speech', 'transcription', 'phu de'],
      action: { type: 'navigate', payload: { page: 'live-subtitles' } },
    };

    it('prioritizes exact title match above substring matches', () => {
      const exactMatch = scoreSearchResult(baseItem, 'Live Subtitles');
      const substringMatch = scoreSearchResult(baseItem, 'Subtitles');

      expect(exactMatch.score).toBeGreaterThan(substringMatch.score);
      expect(exactMatch.score).toBeGreaterThanOrEqual(1000);
    });

    it('prioritizes title prefix matches above description matches', () => {
      const prefixMatch = scoreSearchResult(baseItem, 'Live');
      const descMatch = scoreSearchResult(baseItem, 'recognition');

      expect(prefixMatch.score).toBeGreaterThan(descMatch.score);
      expect(prefixMatch.score).toBeGreaterThanOrEqual(800);
    });

    it('matches acronyms correctly', () => {
      const ocrItem: SearchResultItem = {
        id: 'test:ocr',
        category: 'command',
        title: 'Optical Character Recognition',
        icon: 'ScanText',
        action: { type: 'command' },
      };

      const result = scoreSearchResult(ocrItem, 'ocr');
      expect(result.score).toBeGreaterThanOrEqual(650);
    });

    it('matches diacritic-free query against accented Vietnamese text', () => {
      const viItem: SearchResultItem = {
        id: 'test:vi',
        category: 'settings',
        title: 'Cài đặt Ngôn ngữ',
        description: 'Tùy chọn hiển thị tiếng Việt',
        icon: 'Languages',
        action: { type: 'setting' },
      };

      const result = scoreSearchResult(viItem, 'cai dat');
      expect(result.score).toBeGreaterThan(0);
      expect(result.titleHighlights.length).toBeGreaterThan(0);
    });

    it('handles small typo via fuzzy matching', () => {
      const dashboardItem: SearchResultItem = {
        id: 'test:dash',
        category: 'navigation',
        title: 'Dashboard Home',
        icon: 'LayoutDashboard',
        action: { type: 'navigate' },
      };

      // "dasboard" (missing 'h')
      const result = scoreSearchResult(dashboardItem, 'dasboard');
      expect(result.score).toBeGreaterThan(0);
    });

    it('returns score 0 when there is no match', () => {
      const result = scoreSearchResult(baseItem, 'unrelated queries xyz');
      expect(result.score).toBe(0);
    });
  });

  describe('deduplicateResults', () => {
    it('deduplicates items by ID and keeps the item with higher score', () => {
      const items: SearchResultItem[] = [
        {
          id: 'dup:1',
          category: 'navigation',
          title: 'Lower score item',
          score: 100,
          icon: 'Home',
          action: { type: 'navigate' },
        },
        {
          id: 'dup:1',
          category: 'navigation',
          title: 'Higher score item',
          score: 900,
          icon: 'Home',
          action: { type: 'navigate' },
        },
      ];

      const deduplicated = deduplicateResults(items);
      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].title).toBe('Higher score item');
      expect(deduplicated[0].score).toBe(900);
    });
  });

  describe('sortSearchResults', () => {
    it('stably sorts by score descending, then title ascending', () => {
      const items: SearchResultItem[] = [
        { id: '3', category: 'command', title: 'Charlie', score: 500, icon: 'X', action: { type: 'command' } },
        { id: '1', category: 'command', title: 'Bravo', score: 900, icon: 'X', action: { type: 'command' } },
        { id: '2', category: 'command', title: 'Alpha', score: 500, icon: 'X', action: { type: 'command' } },
      ];

      const sorted = sortSearchResults(items);
      expect(sorted[0].id).toBe('1'); // score 900
      expect(sorted[1].id).toBe('2'); // score 500, Alpha before Charlie
      expect(sorted[2].id).toBe('3'); // score 500, Charlie
    });
  });
});

