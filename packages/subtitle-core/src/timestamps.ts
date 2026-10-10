/**
 * Timestamp formatting and parsing utilities for SRT, WebVTT, and UI displays.
 */

export function padZero(num: number, size = 2): string {
  let s = Math.floor(Math.max(0, num)).toString();
  while (s.length < size) s = '0' + s;
  return s;
}

/**
 * Format milliseconds to SubRip (SRT) timestamp format: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)},${padZero(millis, 3)}`;
}

/**
 * Format milliseconds to WebVTT timestamp format: HH:MM:SS.mmm
 */
export function formatVttTimestamp(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(millis, 3)}`;
}

/**
 * Format milliseconds for UI display: MM:SS or HH:MM:SS
 */
export function formatDisplayTime(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);

  if (hours > 0) {
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
  }
  return `${padZero(minutes)}:${padZero(seconds)}`;
}

/**
 * Parse standard timestamp strings (SRT "00:01:23,456" or VTT "00:01:23.456" or "01:23.456")
 * Returns milliseconds, or null if unparseable.
 */
export function parseTimestamp(str: string): number | null {
  if (!str) return null;
  const cleaned = str.trim();

  // Pattern: (HH:)?MM:SS[,.]mmm
  const regex = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/;
  const match = cleaned.match(regex);

  if (!match) {
    // Fallback simple second format e.g. "12.34"
    const secNum = parseFloat(cleaned.replace(',', '.'));
    if (!isNaN(secNum) && isFinite(secNum) && secNum >= 0) {
      return Math.round(secNum * 1000);
    }
    return null;
  }

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  let millisStr = match[4];
  while (millisStr.length < 3) millisStr += '0';
  const millis = parseInt(millisStr.substring(0, 3), 10);

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
}
