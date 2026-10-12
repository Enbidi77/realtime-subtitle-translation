import { SubtitleSegment } from '@echo-lingo/contracts';
import { parseTimestamp } from '@echo-lingo/subtitle-core/timestamps.js';

export interface ParseOptions {
  sessionId?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

/**
 * Generate a random fallback segment ID
 */
function createSegmentId(): string {
  return 'seg_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
}

/**
 * Parse an SRT (SubRip) string into SubtitleSegment objects.
 */
export function parseSrt(content: string, options: ParseOptions = {}): SubtitleSegment[] {
  const sessionId = options.sessionId || 'imported-session';
  const sourceLang = options.sourceLanguage || 'en';
  const targetLang = options.targetLanguage || 'vi';

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawBlocks = normalized.split(/\n\s*\n/);
  const segments: SubtitleSegment[] = [];

  for (const block of rawBlocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) continue;

    let timeLineIndex = 0;
    // Check if line 0 is an index number (e.g. "1")
    if (/^\d+$/.test(lines[0]) && lines.length > 1) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const startTime = parseTimestamp(startStr);
    const endTime = parseTimestamp(endStr);

    if (startTime === null || endTime === null) continue;

    const textLines = lines.slice(timeLineIndex + 1);
    const rawText = textLines.join(' ').trim();
    if (!rawText) continue;

    // Check if text has translation separator (e.g. "Original -> Translation" or multi-lines)
    const textParts = textLines;
    let originalText = rawText;
    const translations: Record<string, string> = {};

    if (textParts.length >= 2) {
      originalText = textParts[0];
      translations[targetLang] = textParts.slice(1).join(' ');
    }

    const now = Date.now();
    segments.push({
      id: createSegmentId(),
      sessionId,
      startTime,
      endTime,
      originalText,
      translations,
      sourceLanguage: sourceLang,
      targetLanguages: Object.keys(translations),
      status: 'final',
      confidence: 1.0,
      speechProvider: 'imported',
      translationProvider: Object.keys(translations).length > 0 ? 'imported' : 'none',
      createdAt: now,
      updatedAt: now,
    });
  }

  return segments.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Parse a WebVTT (.vtt) string into SubtitleSegment objects.
 */
export function parseVtt(content: string, options: ParseOptions = {}): SubtitleSegment[] {
  // Strip header line "WEBVTT" and potential metadata/notes
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toUpperCase().startsWith('WEBVTT')) {
      startIndex = i + 1;
      break;
    }
  }

  const bodyContent = lines.slice(startIndex).join('\n');
  return parseSrt(bodyContent, options);
}

/**
 * Auto-detect and parse subtitle content from file name or raw text
 */
export function parseSubtitles(
  content: string,
  fileName = '',
  options: ParseOptions = {}
): SubtitleSegment[] {
  const isVtt =
    fileName.toLowerCase().endsWith('.vtt') ||
    content.trim().toUpperCase().startsWith('WEBVTT');

  if (isVtt) {
    return parseVtt(content, options);
  }

  return parseSrt(content, options);
}
