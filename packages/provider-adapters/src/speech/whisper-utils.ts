/**
 * Normalizes speech language tags into ISO-639-1 two-letter codes expected by Whisper implementations.
 * Maps regional / three-letter variants (e.g., 'fil' -> 'tl', 'zh-TW' -> 'zh', 'nb'/'nn' -> 'no').
 */
export function normalizeWhisperLanguage(lang?: string): string {
  if (!lang || lang === 'auto') return 'auto';
  const clean = lang.trim().toLowerCase();
  if (clean.startsWith('zh-') || clean === 'zh') return 'zh';
  if (clean.startsWith('fil') || clean.startsWith('tl')) return 'tl';
  if (clean.startsWith('nb') || clean.startsWith('nn') || clean.startsWith('no')) return 'no';
  if (clean.startsWith('sr-')) return 'sr';
  const prefix = clean.split(/[-_]/)[0];
  return prefix.length === 2 ? prefix : clean;
}

