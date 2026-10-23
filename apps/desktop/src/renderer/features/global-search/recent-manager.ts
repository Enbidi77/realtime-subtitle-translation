import { SearchResultItem } from "./types.js";

const RECENT_QUERIES_KEY = "echolingo:recent_search_queries";
const RECENT_ITEMS_KEY = "echolingo:recent_search_items";
const SEARCH_HISTORY_ENABLED_KEY = "echolingo:search_history_enabled";

const MAX_RECENT_QUERIES = 8;
const MAX_RECENT_ITEMS = 10;

export class RecentHistoryManager {
  private static instance: RecentHistoryManager | null = null;

  public static getInstance(): RecentHistoryManager {
    if (!RecentHistoryManager.instance) {
      RecentHistoryManager.instance = new RecentHistoryManager();
    }
    return RecentHistoryManager.instance;
  }

  public isEnabled(): boolean {
    try {
      const val = localStorage.getItem(SEARCH_HISTORY_ENABLED_KEY);
      return val !== "false";
    } catch {
      return true;
    }
  }

  public setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(
        SEARCH_HISTORY_ENABLED_KEY,
        enabled ? "true" : "false",
      );
      if (!enabled) {
        this.clearAll();
      }
    } catch {
      // Ignored
    }
  }

  public getRecentQueries(): string[] {
    if (!this.isEnabled()) return [];
    try {
      const raw = localStorage.getItem(RECENT_QUERIES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addRecentQuery(query: string): void {
    if (!this.isEnabled()) return;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    try {
      const queries = this.getRecentQueries().filter(
        (q) => q.toLowerCase() !== trimmed.toLowerCase(),
      );
      queries.unshift(trimmed);
      localStorage.setItem(
        RECENT_QUERIES_KEY,
        JSON.stringify(queries.slice(0, MAX_RECENT_QUERIES)),
      );
    } catch {
      // Ignored
    }
  }

  public getRecentItems(): SearchResultItem[] {
    if (!this.isEnabled()) return [];
    try {
      const raw = localStorage.getItem(RECENT_ITEMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addRecentItem(item: SearchResultItem): void {
    if (!this.isEnabled()) return;
    try {
      const items = this.getRecentItems().filter((i) => i.id !== item.id);
      const cleanItem: SearchResultItem = {
        id: item.id,
        category: item.category,
        title: item.title,
        description: item.description,
        icon: item.icon,
        path: item.path,
        badge: "Recent",
        action: item.action,
        score: 950,
      };
      items.unshift(cleanItem);
      localStorage.setItem(
        RECENT_ITEMS_KEY,
        JSON.stringify(items.slice(0, MAX_RECENT_ITEMS)),
      );
    } catch {
      // Ignored
    }
  }

  public removeRecentItem(id: string): void {
    try {
      const items = this.getRecentItems().filter((i) => i.id !== id);
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(items));
    } catch {
      // Ignored
    }
  }

  public clearAll(): void {
    try {
      localStorage.removeItem(RECENT_QUERIES_KEY);
      localStorage.removeItem(RECENT_ITEMS_KEY);
    } catch {
      // Ignored
    }
  }
}

export function getRecentHistoryManager(): RecentHistoryManager {
  return RecentHistoryManager.getInstance();
}
