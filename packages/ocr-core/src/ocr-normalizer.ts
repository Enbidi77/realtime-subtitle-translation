import { OcrResponse, OcrBlock, OcrLine, OcrWord } from '@echo-lingo/contracts';

export interface NormalizerOptions {
  preserveLineBreaks?: boolean;
  removeAdjacentDuplicates?: boolean;
  collapseWhitespace?: boolean;
}

/**
 * Normalizes recognized OCR text according to language and formatting conventions.
 */
export function normalizeOcrText(
  rawText: string,
  options: NormalizerOptions = {}
): string {
  if (!rawText) return '';

  const {
    preserveLineBreaks = true,
    removeAdjacentDuplicates = true,
    collapseWhitespace = true,
  } = options;

  // 1. Remove non-printable control characters except newline and tab
  let text = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Standardize CRLF to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Normalize lines
  const lines = text.split('\n').map((line) => {
    let l = line;
    if (collapseWhitespace) {
      // Replace multiple spaces/tabs with single space, but preserve CJK spacing
      l = l.replace(/[ \t]+/g, ' ').trim();
    }
    return l;
  });

  // 4. Remove adjacent duplicate lines
  const filteredLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    if (current.length === 0) {
      // Avoid consecutive empty lines
      if (filteredLines.length > 0 && filteredLines[filteredLines.length - 1] !== '') {
        filteredLines.push('');
      }
      continue;
    }

    if (removeAdjacentDuplicates && filteredLines.length > 0) {
      const prev = filteredLines[filteredLines.length - 1];
      if (prev === current) {
        continue;
      }
    }

    filteredLines.push(current);
  }

  // 5. Trim starting and ending empty lines
  while (filteredLines.length > 0 && filteredLines[0] === '') {
    filteredLines.shift();
  }
  while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1] === '') {
    filteredLines.pop();
  }

  if (preserveLineBreaks) {
    return filteredLines.join('\n');
  }

  return filteredLines.join(' ');
}

export interface RawOcrInput {
  text: string;
  providerId: string;
  confidence?: number;
  language?: string;
  durationMs?: number;
  blocks?: Array<{
    text: string;
    confidence?: number;
    boundingBox?: any;
    lines?: Array<{
      text: string;
      confidence?: number;
      boundingBox?: any;
      words?: Array<{
        text: string;
        confidence?: number;
        boundingBox?: any;
      }>;
    }>;
  }>;
  lines?: Array<{
    text: string;
    confidence?: number;
    boundingBox?: any;
    words?: Array<{
      text: string;
      confidence?: number;
      boundingBox?: any;
    }>;
  }>;
}

/**
 * Normalizes a raw OCR response into a clean, structured OcrResponse.
 */
export function normalizeOcrResponse(raw: RawOcrInput): OcrResponse {
  const normalizedText = normalizeOcrText(raw.text);

  const blocks: OcrBlock[] = (raw.blocks || []).map((b) => ({
    text: normalizeOcrText(b.text),
    confidence: Math.max(0, Math.min(1, b.confidence ?? 1)),
    boundingBox: b.boundingBox,
    lines: (b.lines || []).map((l) => ({
      text: normalizeOcrText(l.text),
      confidence: Math.max(0, Math.min(1, l.confidence ?? 1)),
      boundingBox: l.boundingBox,
      words: (l.words || []).map((w) => ({
        text: w.text.trim(),
        confidence: Math.max(0, Math.min(1, w.confidence ?? 1)),
        boundingBox: w.boundingBox,
      })),
    })),
  }));

  const lines: OcrLine[] = (raw.lines || []).map((l) => ({
    text: normalizeOcrText(l.text),
    confidence: Math.max(0, Math.min(1, l.confidence ?? 1)),
    boundingBox: l.boundingBox,
    words: (l.words || []).map((w) => ({
      text: w.text.trim(),
      confidence: Math.max(0, Math.min(1, w.confidence ?? 1)),
      boundingBox: w.boundingBox,
    })),
  }));

  // Calculate average confidence score if not provided
  let confidence = raw.confidence ?? 1;
  if (confidence === 1 && lines.length > 0) {
    const sum = lines.reduce((acc, curr) => acc + curr.confidence, 0);
    confidence = Math.round((sum / lines.length) * 100) / 100;
  }

  return {
    text: normalizedText,
    blocks,
    lines,
    confidence,
    language: raw.language,
    durationMs: raw.durationMs ?? 0,
    providerId: raw.providerId,
  };
}
