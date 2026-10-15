import {
  ISearchProvider,
  SearchResultItem,
  SearchCategoryFilter,
  SearchMetrics,
  ProviderExecutionMetric,
  SearchEngineOptions,
} from './types.js';
import { deduplicateResults, sortSearchResults } from './scoring.js';
import { NavigationProvider } from './providers/navigation-provider.js';
import { CommandsProvider } from './providers/commands-provider.js';
import { SettingsProvider } from './providers/settings-provider.js';
import { DatabaseProvider } from './providers/database-provider.js';
import { HelpProvider } from './providers/help-provider.js';
import { getRecentHistoryManager } from './providers/recent-provider.js';

export class SearchEngine {
  private static instance: SearchEngine | null = null;
  private providers: ISearchProvider[] = [];
  private currentAbortController: AbortController | null = null;
  private currentSequence = 0;
  private options: Required<SearchEngineOptions>;

  private constructor(options?: SearchEngineOptions) {
    this.options = {
      debounceMs: options?.debounceMs ?? 60,
      providerTimeoutMs: options?.providerTimeoutMs ?? 800,
      maxTotalResults: options?.maxTotalResults ?? 50,
    };

    // Register built-in providers
    this.registerProvider(new NavigationProvider());
    this.registerProvider(new CommandsProvider());
    this.registerProvider(new SettingsProvider());
    this.registerProvider(new DatabaseProvider());
    this.registerProvider(new HelpProvider());
  }

  public static getInstance(options?: SearchEngineOptions): SearchEngine {
    if (!SearchEngine.instance) {
      SearchEngine.instance = new SearchEngine(options);
    }
    return SearchEngine.instance;
  }

  public registerProvider(provider: ISearchProvider): void {
    if (!this.providers.some((p) => p.id === provider.id)) {
      this.providers.push(provider);
    }
  }

  public unregisterProvider(providerId: string): void {
    this.providers = this.providers.filter((p) => p.id !== providerId);
  }

  public getProviders(): readonly ISearchProvider[] {
    return this.providers;
  }

  /**
   * Returns initial suggested items when query is empty (recent items + quick actions)
   */
  public async getInitialSuggestions(category: SearchCategoryFilter = 'all'): Promise<SearchResultItem[]> {
    const recentManager = getRecentHistoryManager();
    const recentItems = recentManager.getRecentItems();

    const providerItems: SearchResultItem[] = [];
    for (const p of this.providers) {
      if (category !== 'all' && p.category !== category) continue;
      if (p.getInitialItems) {
        try {
          const items = await p.getInitialItems();
          providerItems.push(...items);
        } catch {
          // Gracefully skip
        }
      }
    }

    const filteredRecent = category === 'all'
      ? recentItems
      : recentItems.filter((i) => i.category === category);

    const combined = [...filteredRecent, ...providerItems];
    return deduplicateResults(combined).slice(0, 15);
  }

  /**
   * Executes a search query across all matching providers concurrently
   */
  public async search(
    rawQuery: string,
    category: SearchCategoryFilter = 'all'
  ): Promise<{ results: SearchResultItem[]; metrics: SearchMetrics; sequence: number }> {
    const query = rawQuery.trim();

    // Abort previous in-flight search
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    const sequence = ++this.currentSequence;
    const startTime = performance.now();

    if (!query) {
      const suggestions = await this.getInitialSuggestions(category);
      return {
        results: suggestions,
        metrics: {
          totalDurationMs: Math.round(performance.now() - startTime),
          providerMetrics: [],
        },
        sequence,
      };
    }

    // Filter relevant providers
    const activeProviders = this.providers.filter((p) => {
      if (category === 'all') return true;
      if (category === 'session' && (p.category === 'session' || p.category === 'ocr' || p.category === 'glossary')) return true;
      return p.category === category;
    });

    const providerPromises = activeProviders.map(async (provider): Promise<{
      items: SearchResultItem[];
      metric: ProviderExecutionMetric;
    }> => {
      const pStart = performance.now();

      // Enforce timeout on provider
      const timeoutPromise = new Promise<SearchResultItem[]>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout exceeding ${this.options.providerTimeoutMs}ms`));
        }, this.options.providerTimeoutMs);

        signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
      });

      try {
        const fetchPromise = Promise.resolve(provider.getResults(query, signal));
        const items = await Promise.race([fetchPromise, timeoutPromise]);
        const pDuration = Math.round(performance.now() - pStart);

        return {
          items: Array.isArray(items) ? items : [],
          metric: {
            providerId: provider.id,
            durationMs: pDuration,
            itemCount: items.length,
            status: 'fulfilled',
          },
        };
      } catch (err: any) {
        const pDuration = Math.round(performance.now() - pStart);
        const isTimeout = err?.message?.includes('Timeout');

        return {
          items: [],
          metric: {
            providerId: provider.id,
            durationMs: pDuration,
            itemCount: 0,
            status: isTimeout ? 'timed-out' : 'rejected',
          },
        };
      }
    });

    const results = await Promise.allSettled(providerPromises);

    // If a newer search query began, discard results
    if (signal.aborted || sequence !== this.currentSequence) {
      return {
        results: [],
        metrics: { totalDurationMs: 0, providerMetrics: [] },
        sequence,
      };
    }

    const allItems: SearchResultItem[] = [];
    const providerMetrics: ProviderExecutionMetric[] = [];

    for (const res of results) {
      if (res.status === 'fulfilled') {
        allItems.push(...res.value.items);
        providerMetrics.push(res.value.metric);
      }
    }

    // Filter by category if strictly required
    const categoryFiltered = category === 'all'
      ? allItems
      : allItems.filter((item) => {
          if (category === 'session') {
            return item.category === 'session' || item.category === 'ocr' || item.category === 'glossary';
          }
          return item.category === category;
        });

    const deduplicated = deduplicateResults(categoryFiltered);
    const sorted = sortSearchResults(deduplicated).slice(0, this.options.maxTotalResults);

    const totalDurationMs = Math.round(performance.now() - startTime);

    return {
      results: sorted,
      metrics: {
        totalDurationMs,
        providerMetrics,
      },
      sequence,
    };
  }
}

export function getSearchEngine(): SearchEngine {
  return SearchEngine.getInstance();
}

