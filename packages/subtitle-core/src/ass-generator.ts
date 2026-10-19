import { SubtitleSegment, SubtitleStyleOptions, SubtitleAlignment } from '@echo-lingo/contracts';
import { formatAssTimestamp } from './timestamps.js';

/**
 * Convert a CSS hex color string (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) to ASS color format: &HAABBGGRR&.
 * Note: ASS uses &HAABBGGRR& where AA is transparency: 00 = completely opaque, FF = completely transparent.
 */
export function hexToAssColor(hex: string): string {
  if (!hex) return '&H00FFFFFF&';
  let cleaned = hex.trim().replace(/^#/, '');

  // Expand short forms #RGB -> #RRGGBB, #RGBA -> #RRGGBBAA
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('') + 'FF';
  } else if (cleaned.length === 4) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (cleaned.length === 6) {
    cleaned += 'FF';
  }

  if (cleaned.length !== 8) {
    return '&H00FFFFFF&';
  }

  const r = cleaned.substring(0, 2);
  const g = cleaned.substring(2, 4);
  const b = cleaned.substring(4, 6);
  const webAlpha = parseInt(cleaned.substring(6, 8), 16);

  // Invert alpha: Web FF (opaque) -> ASS 00; Web 00 (transparent) -> ASS FF
  const assAlphaNum = 255 - (isNaN(webAlpha) ? 255 : webAlpha);
  const assAlphaHex = assAlphaNum.toString(16).padStart(2, '0').toUpperCase();

  return `&H${assAlphaHex}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}&`;
}

/**
 * Convert SubtitleAlignment to ASS Numpad position integer (1-9)
 */
export function alignmentToAssNumber(alignment: SubtitleAlignment): number {
  switch (alignment) {
    case 'bottom-left':
      return 1;
    case 'bottom-center':
      return 2;
    case 'bottom-right':
      return 3;
    case 'middle-center':
      return 5;
    case 'top-left':
      return 7;
    case 'top-center':
      return 8;
    case 'top-right':
      return 9;
    default:
      return 2;
  }
}

/**
 * Clean text for ASS dialogue: escape curly braces, normalize newlines to \N
 */
export function escapeAssText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '\\N')
    .trim();
}

export interface AssScriptOptions {
  resolution?: { width: number; height: number };
  title?: string;
}

/**
 * Generate a complete Advanced SubStation Alpha (ASS v4+) script for video burn-in
 */
export function generateAssScript(
  segments: SubtitleSegment[],
  style: SubtitleStyleOptions,
  options: AssScriptOptions = {}
): string {
  const width = options.resolution?.width || 1920;
  const height = options.resolution?.height || 1080;
  const title = options.title || 'EchoLingo Video Subtitles';

  const alignNum = alignmentToAssNumber(style.alignment);
  const primaryAssColor = hexToAssColor(style.primaryColor);
  const secondaryAssColor = hexToAssColor(style.secondaryColor);
  const outlineAssColor = hexToAssColor(style.outlineColor);
  const shadowAssColor = hexToAssColor(style.shadowColor);
  const backBoxAssColor = hexToAssColor(style.backgroundColor);

  // BorderStyle: 1 = outline + drop shadow, 3 = opaque box
  const borderStyle = style.backgroundBox ? 3 : 1;
  const outlineVal = style.backgroundBox ? 0 : style.outlineWidth;
  const shadowVal = style.backgroundBox ? 0 : style.shadowDistance;
  const backColor = style.backgroundBox ? backBoxAssColor : shadowAssColor;

  const boldVal = style.bold ? -1 : 0; // ASS uses -1 or 1 for true
  const italicVal = style.italic ? -1 : 0;

  // Header & Styles
  const lines: string[] = [
    '[Script Info]',
    `Title: ${title}`,
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: None',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${style.fontFamily},${style.fontSize},${primaryAssColor},${secondaryAssColor},${outlineAssColor},${backColor},${boldVal},${italicVal},0,0,100,100,0,0,${borderStyle},${outlineVal},${shadowVal},${alignNum},${style.horizontalMargin},${style.horizontalMargin},${style.verticalMargin},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  // Filter and sort segments
  const validSegments = segments
    .filter((s) => s.startTime < s.endTime && (s.originalText.trim() || Object.keys(s.translations).length > 0))
    .sort((a, b) => a.startTime - b.startTime);

  for (const seg of validSegments) {
    const startStr = formatAssTimestamp(seg.startTime);
    const endStr = formatAssTimestamp(seg.endTime);

    const original = seg.originalText ? seg.originalText.trim() : '';
    let translation = '';

    if (style.translationLanguage && seg.translations[style.translationLanguage]) {
      translation = seg.translations[style.translationLanguage].trim();
    } else {
      const transValues = Object.values(seg.translations);
      if (transValues.length > 0 && transValues[0]) {
        translation = transValues[0].trim();
      }
    }

    let dialogueText = '';

    if (style.layoutMode === 'bilingual-stacked' && style.showOriginal && style.showTranslation && original && translation) {
      // Bilingual stacked layout: Original on top, translated below with secondary color and slightly smaller font
      const escapedOrig = escapeAssText(original);
      const escapedTrans = escapeAssText(translation);
      const subFontSize = Math.max(12, Math.round(style.fontSize * 0.85));

      dialogueText = `{\\fs${style.fontSize}\\c${primaryAssColor}}${escapedOrig}\\N{\\fs${subFontSize}\\c${secondaryAssColor}}${escapedTrans}`;
    } else if (style.showTranslation && translation) {
      dialogueText = escapeAssText(translation);
    } else if (style.showOriginal && original) {
      dialogueText = escapeAssText(original);
    } else if (original) {
      dialogueText = escapeAssText(original);
    }

    if (dialogueText) {
      lines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${dialogueText}`);
    }
  }

  return lines.join('\n') + '\n';
}

