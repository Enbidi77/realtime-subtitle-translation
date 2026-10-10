export interface CacheEntry {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: string;
  timestamp: number;
}

export class TranslationCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = 2000, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  private makeKey(sourceLang: string, targetLang: string, text: string): string {
    return `${sourceLang.toLowerCase()}:${targetLang.toLowerCase()}:${text.trim().toLowerCase()}`;
  }

  public get(sourceLang: string, targetLang: string, text: string): CacheEntry | null {
    const key = this.makeKey(sourceLang, targetLang, text);
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL expiration
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  public set(
    sourceLang: string,
    targetLang: string,
    text: string,
    translatedText: string,
    provider: string
  ): void {
    const key = this.makeKey(sourceLang, targetLang, text);

    // Evict oldest if full
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      provider,
      timestamp: Date.now(),
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public get size(): number {
    return this.cache.size;
  }
}
