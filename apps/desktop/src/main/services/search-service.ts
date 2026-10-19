import {
  SearchDatabaseRequestSchema,
  SearchDatabaseResponse,
} from '@echo-lingo/contracts';
import { createLogger, ILogger } from '@echo-lingo/logger';
import { getDatabase } from '@/database/db-instance.js';

export class SearchService {
  private static instance: SearchService | null = null;
  private readonly log: ILogger = createLogger('SearchService');

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  public async searchDatabase(req: unknown): Promise<SearchDatabaseResponse> {
    const startTime = performance.now();
    const parsed = SearchDatabaseRequestSchema.safeParse(req);
    if (!parsed.success) {
      this.log.warn('Invalid search:database payload:', parsed.error);
      return { items: [], durationMs: 0 };
    }

    try {
      const db = getDatabase();
      const items = db.searchDatabase(parsed.data.query, {
        limit: parsed.data.limit,
        categories: parsed.data.categories,
      });
      const durationMs = Math.round(performance.now() - startTime);
      return { items, durationMs };
    } catch (err) {
      this.log.error('Failed to execute search:database:', err);
      return { items: [], durationMs: Math.round(performance.now() - startTime) };
    }
  }
}

export function getSearchService(): SearchService {
  return SearchService.getInstance();
}

