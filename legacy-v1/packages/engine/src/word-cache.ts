// MorphemeFlow — LRU Word Cache
// Caches morpheme analysis results for performance.
// Platform-agnostic — persist/restore methods accept a storage adapter.

import type { MorphemeResult } from "./types";

const DEFAULT_MAX_ENTRIES = 10_000;

export interface CacheStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export class WordCache {
  private cache = new Map<string, MorphemeResult>();
  private maxSize: number;
  public hits = 0;
  public misses = 0;

  constructor(maxSize = DEFAULT_MAX_ENTRIES) {
    this.maxSize = maxSize;
  }

  get(word: string): MorphemeResult | undefined {
    const key = word.toLowerCase();
    const result = this.cache.get(key);
    if (result) {
      // Move to end (most recently used) by re-inserting
      this.cache.delete(key);
      this.cache.set(key, result);
      this.hits++;
      return result;
    }
    this.misses++;
    return undefined;
  }

  set(word: string, result: MorphemeResult): void {
    const key = word.toLowerCase();
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, result);
  }

  has(word: string): boolean {
    return this.cache.has(word.toLowerCase());
  }

  get size(): number {
    return this.cache.size;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  // Persist top entries to external storage (platform-specific adapter)
  async persist(storage: CacheStorage, key: string, count = 5000): Promise<void> {
    const allEntries = [...this.cache.entries()];
    const start = Math.max(0, allEntries.length - count);
    const entries = allEntries.slice(start);
    try {
      await storage.set(key, entries);
    } catch {
      // Storage quota exceeded — silently fail
    }
  }

  // Restore from external storage
  async restore(storage: CacheStorage, key: string): Promise<void> {
    try {
      const entries = (await storage.get(key)) as [string, MorphemeResult][] | undefined;
      if (entries) {
        for (const [k, value] of entries) {
          this.cache.set(k, value);
        }
      }
    } catch {
      // Storage unavailable — start fresh
    }
  }
}
