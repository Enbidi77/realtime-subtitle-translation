import {
  SearchResultCategory,
  SearchResultItem,
  SearchAction,
  SearchHighlightRange,
  SearchDatabaseRequest,
  SearchDatabaseResponse,
} from '@echo-lingo/contracts';

export type {
  SearchResultCategory,
  SearchResultItem,
  SearchAction,
  SearchHighlightRange,
  SearchDatabaseRequest,
  SearchDatabaseResponse,
};

export type SearchCategoryFilter = 'all' | SearchResultCategory;

export interface ISearchProvider {
  id: string;
  category: SearchResultCategory;
  name: string;
  getResults(query: string, signal?: AbortSignal): Promise<SearchResultItem[]> | SearchResultItem[];
  getInitialItems?(): Promise<SearchResultItem[]> | SearchResultItem[];
}

export interface ProviderExecutionMetric {
  providerId: string;
  durationMs: number;
  itemCount: number;
  status: 'fulfilled' | 'rejected' | 'timed-out';
}

export interface SearchMetrics {
  totalDurationMs: number;
  providerMetrics: ProviderExecutionMetric[];
}

export interface SearchEngineOptions {
  debounceMs?: number;
  providerTimeoutMs?: number;
  maxTotalResults?: number;
}

