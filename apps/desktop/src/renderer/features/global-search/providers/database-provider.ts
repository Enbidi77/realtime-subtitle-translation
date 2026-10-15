import { ISearchProvider, SearchResultItem } from '../types.js';
import { scoreSearchResult } from '../scoring.js';

export class DatabaseProvider implements ISearchProvider {
  public readonly id = 'database';
  public readonly category = 'session';
  public readonly name = 'Database & Content';

  public async getResults(query: string, signal?: AbortSignal): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    if (!window.electronAPI?.search?.queryDatabase) {
      return [];
    }

    if (signal?.aborted) return [];

    try {
      const response = await window.electronAPI.search.queryDatabase({
        query: trimmed,
        limit: 25,
      });

      if (signal?.aborted) return [];

      const rawItems = response?.items || [];
      const scoredItems: SearchResultItem[] = [];

      for (const item of rawItems) {
        const match = scoreSearchResult(item, trimmed);
        scoredItems.push({
          ...item,
          score: match.score > 0 ? match.score : (item.score || 250),
          titleHighlights: match.titleHighlights,
          descHighlights: match.descHighlights,
        });
      }

      return scoredItems;
    } catch (err) {
      // Gracefully handle database or IPC failures without breaking the rest of search
      return [];
    }
  }

  public async getInitialItems(): Promise<SearchResultItem[]> {
    return [];
  }
}

