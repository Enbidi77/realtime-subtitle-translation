import { describe, it, expect, vi } from 'vitest';
import { SearchEngine } from '../search-engine.js';
import { ISearchProvider, SearchResultItem } from '../types.js';

describe('SearchEngine Orchestrator', () => {
  it('registers and retrieves providers', () => {
    const engine = SearchEngine.getInstance();
    const mockProvider: ISearchProvider = {
      id: 'mock-1',
      category: 'command',
      name: 'Mock Command Provider',
      getResults: () => [],
    };

    engine.registerProvider(mockProvider);
    expect(engine.getProviders().some((p) => p.id === 'mock-1')).toBe(true);

    engine.unregisterProvider('mock-1');
    expect(engine.getProviders().some((p) => p.id === 'mock-1')).toBe(false);
  });

  it('filters results by category', async () => {
    const engine = SearchEngine.getInstance();

    const navProvider: ISearchProvider = {
      id: 'mock-nav',
      category: 'navigation',
      name: 'Mock Nav',
      getResults: (q) => [
        {
          id: 'nav:1',
          category: 'navigation',
          title: `Nav Item for ${q}`,
          score: 800,
          icon: 'Compass',
          action: { type: 'navigate' },
        },
      ],
    };

    const cmdProvider: ISearchProvider = {
      id: 'mock-cmd',
      category: 'command',
      name: 'Mock Cmd',
      getResults: (q) => [
        {
          id: 'cmd:1',
          category: 'command',
          title: `Cmd Item for ${q}`,
          score: 800,
          icon: 'Terminal',
          action: { type: 'command' },
        },
      ],
    };

    engine.registerProvider(navProvider);
    engine.registerProvider(cmdProvider);

    // Search all
    const allRes = await engine.search('Item', 'all');
    expect(allRes.results.some((r) => r.category === 'navigation')).toBe(true);

    // Search command only
    const cmdRes = await engine.search('Item', 'command');
    expect(cmdRes.results.every((r) => r.category === 'command')).toBe(true);

    engine.unregisterProvider('mock-nav');
    engine.unregisterProvider('mock-cmd');
  });

  it('resiliently handles a provider that throws an error', async () => {
    const engine = SearchEngine.getInstance();

    const failingProvider: ISearchProvider = {
      id: 'failing-provider',
      category: 'help',
      name: 'Failing Provider',
      getResults: () => {
        throw new Error('Database connection failed');
      },
    };

    const workingProvider: ISearchProvider = {
      id: 'working-provider',
      category: 'command',
      name: 'Working Provider',
      getResults: () => [
        {
          id: 'ok:1',
          category: 'command',
          title: 'Working Command',
          score: 900,
          icon: 'Play',
          action: { type: 'command' },
        },
      ],
    };

    engine.registerProvider(failingProvider);
    engine.registerProvider(workingProvider);

    const res = await engine.search('Working');
    expect(res.results.some((r) => r.id === 'ok:1')).toBe(true);

    const failingMetric = res.metrics.providerMetrics.find((m) => m.providerId === 'failing-provider');
    expect(failingMetric?.status).toBe('rejected');

    engine.unregisterProvider('failing-provider');
    engine.unregisterProvider('working-provider');
  });

  it('returns initial suggestions when query is empty', async () => {
    const engine = SearchEngine.getInstance();
    const res = await engine.search('');

    expect(res.results.length).toBeGreaterThan(0);
    expect(res.metrics.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('records performance duration and metrics', async () => {
    const engine = SearchEngine.getInstance();
    const res = await engine.search('Settings');

    expect(typeof res.metrics.totalDurationMs).toBe('number');
    expect(Array.isArray(res.metrics.providerMetrics)).toBe(true);
  });
});

