import { SubtitleSegment } from '@echo-lingo/contracts';
import { formatSrtTimestamp, formatVttTimestamp, formatDisplayTime } from '@echo-lingo/subtitle-core/timestamps.js';

export interface ExportFormatOptions {
  includeOriginal?: boolean;
  targetLanguage?: string;
  includeTimestamps?: boolean;
}

/**
 * UTF-8 Byte Order Mark for universal Windows player and editor compatibility
 */
const UTF8_BOM = '\uFEFF';

/**
 * Format subtitle segments as standard SubRip (.srt)
 */
export function exportToSrt(segments: SubtitleSegment[], options: ExportFormatOptions = {}): string {
  const { includeOriginal = true, targetLanguage } = options;
  const validSegments = segments
    .filter((s) => {
      const hasOrig = Boolean(s.originalText && s.originalText.trim().length > 0);
      const hasTrans = Boolean(
        s.translations && Object.values(s.translations).some((t) => t && t.trim().length > 0)
      );
      return hasOrig || hasTrans;
    })
    .sort((a, b) => a.startTime - b.startTime);

  const blocks: string[] = [];

  validSegments.forEach((segment) => {
    const startMs = Math.max(0, Math.floor(segment.startTime));
    const endMs = Math.max(startMs + 500, Math.floor(segment.endTime));

    const textParts: string[] = [];
    const origText = segment.originalText ? segment.originalText.trim() : '';

    let transText = '';
    if (targetLanguage && segment.translations && segment.translations[targetLanguage]) {
      transText = segment.translations[targetLanguage].trim();
    } else if (segment.translations && Object.keys(segment.translations).length > 0) {
      const firstVal = Object.values(segment.translations).find((t) => t && t.trim().length > 0);
      if (firstVal) transText = firstVal.trim();
    }

    if (includeOriginal && origText) {
      textParts.push(origText);
    }

    if (transText) {
      textParts.push(transText);
    }

    // Fallback: If textParts is empty (e.g. includeOriginal is false but no translation exists)
    if (textParts.length === 0) {
      if (origText) textParts.push(origText);
      else if (transText) textParts.push(transText);
    }

    // Skip empty cues that would break SRT format
    if (textParts.length === 0) return;

    const lines: string[] = [];
    lines.push((blocks.length + 1).toString());
    lines.push(`${formatSrtTimestamp(startMs)} --> ${formatSrtTimestamp(endMs)}`);
    lines.push(textParts.join('\n'));
    blocks.push(lines.join('\n'));
  });

  return UTF8_BOM + blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}

/**
 * Format subtitle segments as WebVTT (.vtt)
 */
export function exportToVtt(segments: SubtitleSegment[], options: ExportFormatOptions = {}): string {
  const { includeOriginal = true, targetLanguage } = options;
  const validSegments = segments
    .filter((s) => {
      const hasOrig = Boolean(s.originalText && s.originalText.trim().length > 0);
      const hasTrans = Boolean(
        s.translations && Object.values(s.translations).some((t) => t && t.trim().length > 0)
      );
      return hasOrig || hasTrans;
    })
    .sort((a, b) => a.startTime - b.startTime);

  const lines: string[] = ['WEBVTT', ''];
  let cueIndex = 1;

  validSegments.forEach((segment) => {
    const startMs = Math.max(0, Math.floor(segment.startTime));
    const endMs = Math.max(startMs + 500, Math.floor(segment.endTime));

    const textParts: string[] = [];
    const origText = segment.originalText ? segment.originalText.trim() : '';

    let transText = '';
    if (targetLanguage && segment.translations && segment.translations[targetLanguage]) {
      transText = segment.translations[targetLanguage].trim();
    } else if (segment.translations && Object.keys(segment.translations).length > 0) {
      const firstVal = Object.values(segment.translations).find((t) => t && t.trim().length > 0);
      if (firstVal) transText = firstVal.trim();
    }

    if (includeOriginal && origText) {
      textParts.push(origText);
    }

    if (transText) {
      textParts.push(transText);
    }

    if (textParts.length === 0) {
      if (origText) textParts.push(origText);
      else if (transText) textParts.push(transText);
    }

    if (textParts.length === 0) return;

    lines.push(cueIndex.toString());
    lines.push(`${formatVttTimestamp(startMs)} --> ${formatVttTimestamp(endMs)}`);
    lines.push(textParts.join('\n'));
    lines.push('');
    cueIndex++;
  });

  return lines.join('\n');
}

/**
 * Format subtitle segments as clean Plain Text (.txt)
 */
export function exportToTxt(segments: SubtitleSegment[], options: ExportFormatOptions = {}): string {
  const { includeOriginal = true, targetLanguage, includeTimestamps = true } = options;
  const validSegments = segments
    .filter((s) => {
      const hasOrig = Boolean(s.originalText && s.originalText.trim().length > 0);
      const hasTrans = Boolean(
        s.translations && Object.values(s.translations).some((t) => t && t.trim().length > 0)
      );
      return hasOrig || hasTrans;
    })
    .sort((a, b) => a.startTime - b.startTime);

  const lines: string[] = [];

  validSegments.forEach((segment) => {
    const startMs = Math.max(0, Math.floor(segment.startTime));
    const endMs = Math.max(startMs + 500, Math.floor(segment.endTime));

    const timePrefix = includeTimestamps
      ? `[${formatDisplayTime(startMs)} - ${formatDisplayTime(endMs)}] `
      : '';

    const textParts: string[] = [];
    const origText = segment.originalText ? segment.originalText.trim() : '';

    let transText = '';
    if (targetLanguage && segment.translations && segment.translations[targetLanguage]) {
      transText = segment.translations[targetLanguage].trim();
    } else if (segment.translations && Object.keys(segment.translations).length > 0) {
      const firstVal = Object.values(segment.translations).find((t) => t && t.trim().length > 0);
      if (firstVal) transText = firstVal.trim();
    }

    if (includeOriginal && origText) {
      textParts.push(origText);
    }

    if (transText) {
      textParts.push(includeOriginal && origText ? `-> ${transText}` : transText);
    }

    if (textParts.length === 0) {
      if (origText) textParts.push(origText);
      else if (transText) textParts.push(transText);
    }

    if (textParts.length === 0) return;

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
