/**
 * Computes Levenshtein edit distance between two strings with space-optimized buffer.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;

  let prevRow = new Int32Array(n + 1);
  let currRow = new Int32Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const charA = a.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const cost = charA === b.charCodeAt(j - 1) ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }

    // Swap row buffers
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n];
}

/**
 * Calculates string similarity ratio between 0 (completely different) and 1 (identical).
 */
export function calculateSimilarity(a: string, b: string): number {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();

  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(normA, normB);
  return 1.0 - dist / maxLen;
}

/**
 * Determines whether the newly recognized text represents a meaningful change
 * compared to the previously translated text.
 *
 * @param previousText Previously recognized text
 * @param newText Newly recognized text
 * @param threshold Difference ratio threshold (0.0 - 1.0, default 0.15 = 15% change)
 */
export function isMeaningfulChange(
  previousText: string,
  newText: string,
  threshold = 0.15
): boolean {
  const prevClean = previousText.trim().toLowerCase().replace(/\s+/g, ' ');
  const newClean = newText.trim().toLowerCase().replace(/\s+/g, ' ');

  // Exact match -> definitely unchanged
  if (prevClean === newClean) return false;

  // Transition from empty to non-empty or vice versa
  if (!prevClean && newClean) return true;
  if (prevClean && !newClean) return false; // Ignore disappearance to avoid flashing

  const similarity = calculateSimilarity(prevClean, newClean);
  const diffRatio = 1.0 - similarity;

  return diffRatio >= threshold;
}

/**
 * Identifies newly added lines in newText that were not present in previousText.
 */
export function extractAddedLines(previousText: string, newText: string): string[] {
  const prevLines = new Set(
    previousText
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)
  );

  return newText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !prevLines.has(l.toLowerCase()));
}
