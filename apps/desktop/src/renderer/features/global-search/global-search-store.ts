import { create } from "zustand";
import {
  SearchResultItem,
  SearchCategoryFilter,
  SearchMetrics,
} from "./types.js";
import { getSearchEngine } from "./search-engine.js";
import { getCommandRegistry } from "./command-registry.js";
import { getRecentHistoryManager } from "./recent-manager.js";

interface GlobalSearchState {
  isOpen: boolean;
  query: string;
  activeCategory: SearchCategoryFilter;
  selectedIndex: number;
  results: SearchResultItem[];
  isLoading: boolean;
  metrics: SearchMetrics | null;
  recentQueries: string[];
  historyEnabled: boolean;

  // Actions
  open: (initialQuery?: string, initialCategory?: SearchCategoryFilter) => void;
  close: () => void;
  toggle: (initialCategory?: SearchCategoryFilter) => void;
  setQuery: (query: string) => void;
  setActiveCategory: (category: SearchCategoryFilter) => void;
  setSelectedIndex: (index: number) => void;
  selectNext: () => void;
  selectPrev: () => void;
  executeSelected: () => Promise<void>;
  executeItem: (item: SearchResultItem) => Promise<void>;
  clearRecentHistory: () => void;
  removeRecentItem: (id: string) => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useGlobalSearchStore = create<GlobalSearchState>((set, get) => ({
  isOpen: false,
  query: "",
  activeCategory: "all",
  selectedIndex: 0,
  results: [],
  isLoading: false,
  metrics: null,
  recentQueries: getRecentHistoryManager().getRecentQueries(),
  historyEnabled: getRecentHistoryManager().isEnabled(),

  open: (initialQuery = "", initialCategory = "all") => {
    const recentManager = getRecentHistoryManager();
    set({
      isOpen: true,
      query: initialQuery,
      activeCategory: initialCategory,
      selectedIndex: 0,
      isLoading: true,
      recentQueries: recentManager.getRecentQueries(),
      historyEnabled: recentManager.isEnabled(),
    });

    // Run initial search / load suggestions
    const engine = getSearchEngine();
    engine
      .search(initialQuery, initialCategory)
      .then(({ results, metrics }) => {
        set({
          results,
          metrics,
          isLoading: false,
          selectedIndex: 0,
        });
      });
  },

  close: () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    set({
      isOpen: false,
      query: "",
      selectedIndex: 0,
      isLoading: false,
    });
  },

  toggle: (initialCategory) => {
    const { isOpen, open, close } = get();
    if (isOpen) {
      close();
    } else {
      open("", initialCategory || "all");
    }
  },

  setQuery: (query: string) => {
    set({ query, isLoading: true });

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      const { activeCategory } = get();
      const engine = getSearchEngine();
      const { results, metrics } = await engine.search(query, activeCategory);

      // Only update if search wasn't cleared in the meantime
      if (get().isOpen) {
        set({
          results,
          metrics,
          isLoading: false,
          selectedIndex: 0,
        });
      }
    }, 60);
  },

  setActiveCategory: (category: SearchCategoryFilter) => {
    set({ activeCategory: category, isLoading: true, selectedIndex: 0 });

    const { query } = get();
    const engine = getSearchEngine();
    engine.search(query, category).then(({ results, metrics }) => {
      if (get().isOpen) {
        set({
          results,
          metrics,
          isLoading: false,
          selectedIndex: 0,
        });
      }
    });
  },

  setSelectedIndex: (index: number) => {
    const { results } = get();
    if (results.length === 0) {
      set({ selectedIndex: 0 });
      return;
    }
    const clamped = Math.max(0, Math.min(index, results.length - 1));
    set({ selectedIndex: clamped });
  },

  selectNext: () => {
    const { results, selectedIndex } = get();
    if (results.length === 0) return;
    const next = (selectedIndex + 1) % results.length;
    set({ selectedIndex: next });
  },

  selectPrev: () => {
    const { results, selectedIndex } = get();
    if (results.length === 0) return;
    const prev = (selectedIndex - 1 + results.length) % results.length;
    set({ selectedIndex: prev });
  },

  executeSelected: async () => {
    const { results, selectedIndex, executeItem } = get();
    if (
      results.length > 0 &&
      selectedIndex >= 0 &&
      selectedIndex < results.length
    ) {
      await executeItem(results[selectedIndex]);
    }
  },

  executeItem: async (item: SearchResultItem) => {
    const recentManager = getRecentHistoryManager();
    const { query } = get();

    // Record query and item in history
    if (query.trim().length > 1) {
      recentManager.addRecentQuery(query);
    }
    recentManager.addRecentItem(item);

    // Close palette
    get().close();

    // Execute via command registry
    const registry = getCommandRegistry();
    await registry.execute(item);
  },

  clearRecentHistory: () => {
    const recentManager = getRecentHistoryManager();
    recentManager.clearAll();
    set({
      recentQueries: [],
      results: [],
    });

    // Reload suggestions without recent items
    const engine = getSearchEngine();
    engine.search("", get().activeCategory).then(({ results, metrics }) => {
      set({ results, metrics, selectedIndex: 0 });
    });
  },

  removeRecentItem: (id: string) => {
    const recentManager = getRecentHistoryManager();
    recentManager.removeRecentItem(id);
    const updatedResults = get().results.filter((i) => i.id !== id);
    set({ results: updatedResults });
  },
}));
