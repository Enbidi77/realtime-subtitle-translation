import { SearchHighlightRange, SearchResultItem } from './types.js';

/**
 * Normalizes text for search matching:
 * - Decomposes unicode combining characters (NFKD)
 * - Removes diacritical marks / accents (e.g., 'Tiếng Việt' -> 'tieng viet')
 * - Converts to lower case
 * - Trims and collapses multiple spaces
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two strings have a Levenshtein distance within maxDist
 */
export function isLevenshteinClose(a: string, b: string, maxDist = 2): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;
  if (!a || !b) return Math.max(a.length, b.length) <= maxDist;

  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }

  return dp[b.length] <= maxDist;
}

/**
 * Calculates start and end indices for matching substrings in the original display text
 */
export function findHighlightRanges(originalText: string, query: string): SearchHighlightRange[] {
  if (!originalText || !query) return [];

  const normOriginal = normalizeText(originalText);
  const normQuery = normalizeText(query);
  if (!normQuery) return [];

  const ranges: SearchHighlightRange[] = [];

  // Match full query phrase first if present
  let fullPos = 0;
  while (fullPos < normOriginal.length) {
    const idx = normOriginal.indexOf(normQuery, fullPos);
    if (idx === -1) break;
    ranges.push({
      start: Math.min(idx, originalText.length),
      end: Math.min(idx + normQuery.length, originalText.length),
    });
    fullPos = idx + normQuery.length;
  }

  // Also match individual tokens for multi-word queries
  const normTokens = normQuery.split(' ').filter((t) => t.length > 0);
  for (const token of normTokens) {
    let searchPos = 0;
    while (searchPos < normOriginal.length) {
      const index = normOriginal.indexOf(token, searchPos);
      if (index === -1) break;

      const start = Math.min(index, originalText.length);
      const end = Math.min(index + token.length, originalText.length);

      ranges.push({ start, end });
      searchPos = index + token.length;
    }
  }

  if (ranges.length <= 1) return ranges;

  // Sort and merge overlapping or adjacent ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged: SearchHighlightRange[] = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export interface MatchScoreResult {
  score: number;
  titleHighlights: SearchHighlightRange[];
  descHighlights: SearchHighlightRange[];
}

/**
 * Computes a relevance score between an item and a search query.
 * Higher scores indicate better matches.
 * Returns 0 if there is no acceptable match.
 */
export function scoreSearchResult(item: SearchResultItem, rawQuery: string): MatchScoreResult {
  const query = normalizeText(rawQuery);
  if (!query) {
    return {
      score: item.score ?? 0,
      titleHighlights: [],
      descHighlights: [],
    };
  }

  const queryTokens = query.split(' ').filter(Boolean);
  const normTitle = normalizeText(item.title);
  const normDesc = normalizeText(item.description || item.subtitle || '');
  const normPath = normalizeText(item.path || '');
  const normKeywords = (item.keywords || []).map(normalizeText);

  let score = 0;

  // 1. Exact match on title (Priority 1000)
  if (normTitle === query) {
    score += 1000;
  }
  // 2. Exact start-of-title prefix match (Priority 800)
  else if (normTitle.startsWith(query)) {
    score += 800;
  }
  // 3. Word boundary match in title (Priority 700)
  else if (normTitle.includes(` ${query}`) || normTitle.split(' ').some((w) => w.startsWith(query))) {
    score += 700;
  }
  // 4. Substring match in title (Priority 600)
  else if (normTitle.includes(query)) {
    score += 600;
  }

  // Acronym match check (e.g., 'ocr' for 'Optical Character Recognition', 'st' for 'Screen Translation')
  const titleAcronym = normTitle
    .split(' ')
    .map((w) => w[0])
    .join('');
  if (titleAcronym.includes(query) && query.length >= 2) {
    score += 650;
  }

  // Keywords exact / prefix matches
  for (const kw of normKeywords) {
    if (kw === query) {
      score = Math.max(score, 680);
    } else if (kw.startsWith(query)) {
      score = Math.max(score, 550);
    } else if (kw.includes(query)) {
      score = Math.max(score, 450);
    }
  }

  // Multi-word token coverage
  let titleTokenMatches = 0;
  let descTokenMatches = 0;
  let allTokensMatch = true;

  for (const token of queryTokens) {
    const inTitle = normTitle.includes(token);
    const inDesc = normDesc.includes(token);
    const inPath = normPath.includes(token);
    const inKw = normKeywords.some((k) => k.includes(token));

    if (inTitle) titleTokenMatches++;
    if (inDesc) descTokenMatches++;

    if (!inTitle && !inDesc && !inPath && !inKw) {
      // Check fuzzy match on title words for single-letter typos if token is long enough
      let fuzzyFound = false;
      if (token.length >= 4) {
        const titleWords = normTitle.split(' ');
        for (const word of titleWords) {
          if (word.length >= 3 && isLevenshteinClose(token, word, 1)) {
            fuzzyFound = true;
            score += 280;
            break;
          }
        }
      }

      if (!fuzzyFound) {
        allTokensMatch = false;
      }
    }
  }

  if (allTokensMatch && queryTokens.length > 1) {
    score += 350 + titleTokenMatches * 50;
  }

  // Description / Subtitle match
  if (normDesc.includes(query)) {
    score += 300;
  } else if (descTokenMatches > 0) {
    score += descTokenMatches * 40;
  }

  // Path / Breadcrumb match
  if (normPath.includes(query)) {
    score += 150;
  }

  // Prioritize active or prominent items if base match exists
  if (score > 0 && item.badge?.toLowerCase() === 'active') {
    score += 50;
  }

  // If initial score already assigned (e.g. from recent items), add controlled boost
  if (score > 0 && item.score) {
    score += Math.min(item.score * 0.1, 50);
  }

  // Only compute highlights if there's a match
  const titleHighlights = score > 0 ? findHighlightRanges(item.title, rawQuery) : [];
  const descHighlights = score > 0 && item.description ? findHighlightRanges(item.description, rawQuery) : [];

  return {
    score,
    titleHighlights,
    descHighlights,
  };
}

/**
 * Deduplicates search results by unique ID or action key.
 * Keeps the item with higher score.
 */
export function deduplicateResults(items: SearchResultItem[]): SearchResultItem[] {
  const map = new Map<string, SearchResultItem>();

  for (const item of items) {
    const key = item.id || `${item.category}:${item.action.type}:${JSON.stringify(item.action.payload || {})}`;
    const existing = map.get(key);

    if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

/**
 * Sorts search results stably:
 * 1. Score descending
 * 2. Title ascending
 * 3. ID ascending
 */
export function sortSearchResults(items: SearchResultItem[]): SearchResultItem[] {
  return [...items].sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
    const titleDiff = a.title.localeCompare(b.title);
    if (titleDiff !== 0) return titleDiff;
    return a.id.localeCompare(b.id);
  });
}
