import { SubtitleSegment } from '@echo-lingo/contracts';
import { formatSrtTimestamp, formatVttTimestamp, formatDisplayTime } from '@echo-lingo/subtitle-core/timestamps.js';

export interface ExportFormatOptions {
  includeOriginal?: boolean;
  targetLanguage?: string;
  includeTimestamps?: boolean;
}

/**
 * Format subtitle segments as standard SubRip (.srt)
 */
export function exportToSrt(segments: SubtitleSegment[], options: ExportFormatOptions = {}): string {
  const { includeOriginal = true, targetLanguage } = options;
  const validSegments = segments
    .filter((s) => s.originalText.trim().length > 0)
    .sort((a, b) => a.startTime - b.startTime);

  const blocks: string[] = [];

  validSegments.forEach((segment, index) => {
    const lines: string[] = [];
    lines.push((index + 1).toString());
    lines.push(`${formatSrtTimestamp(segment.startTime)} --> ${formatSrtTimestamp(segment.endTime)}`);

    const textParts: string[] = [];
    if (includeOriginal) {
      textParts.push(segment.originalText.trim());
    }

    if (targetLanguage && segment.translations[targetLanguage]) {
      textParts.push(segment.translations[targetLanguage].trim());
    } else if (!targetLanguage && Object.keys(segment.translations).length > 0) {
      const firstTrans = Object.values(segment.translations)[0];
      if (firstTrans) textParts.push(firstTrans.trim());
    }

    if (textParts.length === 0) {
      textParts.push(segment.originalText.trim());
    }

    lines.push(textParts.join('\n'));
    blocks.push(lines.join('\n'));
  });

  return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}

/**
 * Format subtitle segments as WebVTT (.vtt)
 */
export function exportToVtt(segments: SubtitleSegment[], options: ExportFormatOptions = {}): string {
  const { includeOriginal = true, targetLanguage } = options;
  const validSegments = segments
    .filter((s) => s.originalText.trim().length > 0)
    .sort((a, b) => a.startTime - b.startTime);

  const lines: string[] = ['WEBVTT', ''];

  validSegments.forEach((segment, index) => {
    lines.push((index + 1).toString());
    lines.push(`${formatVttTimestamp(segment.startTime)} --> ${formatVttTimestamp(segment.endTime)}`);

    const textParts: string[] = [];
    if (includeOriginal) {
      textParts.push(segment.originalText.trim());
    }

    if (targetLanguage && segment.translations[targetLanguage]) {
      textParts.push(segment.translations[targetLanguage].trim());
    } else if (!targetLanguage && Object.keys(segment.translations).length > 0) {
      const firstTrans = Object.values(segment.translations)[0];
      if (firstTrans) textParts.push(firstTrans.trim());
    }

    if (textParts.length === 0) {
      textParts.push(segment.originalText.trim());
    }

    lines.push(textParts.join('\n'));
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format subtitle segments as clean Plain Text (.txt)
 */
export function exportToTxt(segments: SubtitleSegment[], options: ExportFormatOptions = {}): string {
  const { includeOriginal = true, targetLanguage, includeTimestamps = true } = options;
  const validSegments = segments
    .filter((s) => s.originalText.trim().length > 0)
    .sort((a, b) => a.startTime - b.startTime);

  const lines: string[] = [];

  validSegments.forEach((segment) => {
    const timePrefix = includeTimestamps
      ? `[${formatDisplayTime(segment.startTime)} - ${formatDisplayTime(segment.endTime)}] `
      : '';

    const textParts: string[] = [];
    if (includeOriginal) {
      textParts.push(segment.originalText.trim());
    }

    if (targetLanguage && segment.translations[targetLanguage]) {
      textParts.push(`-> ${segment.translations[targetLanguage].trim()}`);
    } else if (!targetLanguage && Object.keys(segment.translations).length > 0) {
      const firstTrans = Object.values(segment.translations)[0];
      if (firstTrans) textParts.push(`-> ${firstTrans.trim()}`);
    }

    lines.push(`${timePrefix}${textParts.join(' ')}`);
  });

  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}

/**
 * Format subtitle segments as structured JSON
 */
export function exportToJson(segments: SubtitleSegment[]): string {
  return JSON.stringify(
    {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      segmentCount: segments.length,
      segments: segments.sort((a, b) => a.startTime - b.startTime),
    },
    null,
    2
  );
}
