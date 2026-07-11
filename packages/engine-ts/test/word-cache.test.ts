// MorphemeFlow — Word Cache Tests

import { describe, it, expect } from "vitest";
import { WordCache } from "../src/word-cache";
import type { MorphemeResult } from "../src/types";

function makeResult(word: string): MorphemeResult {
  return {
    word,
    morphemes: [{ text: word, type: "root" }],
    syllables: [word],
    confidence: "dictionary",
  };
}

describe("WordCache", () => {
  describe("basic operations", () => {
    it("stores and retrieves", () => {
      const cache = new WordCache(100);
      const result = makeResult("hello");
      cache.set("hello", result);
      expect(cache.get("hello")).toEqual(result);
    });

    it("returns undefined for missing keys", () => {
      const cache = new WordCache(100);
      expect(cache.get("missing")).toBeUndefined();
    });

    it("is case-insensitive", () => {
      const cache = new WordCache(100);
      cache.set("Hello", makeResult("Hello"));
      expect(cache.get("hello")).toBeDefined();
      expect(cache.get("HELLO")).toBeDefined();
    });

    it("has() works", () => {
      const cache = new WordCache(100);
      cache.set("hello", makeResult("hello"));
      expect(cache.has("hello")).toBe(true);
      expect(cache.has("world")).toBe(false);
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when full", () => {
      const cache = new WordCache(3);
      cache.set("a", makeResult("a"));
      cache.set("b", makeResult("b"));
      cache.set("c", makeResult("c"));
      cache.set("d", makeResult("d")); // should evict "a"

      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(true);
      expect(cache.has("d")).toBe(true);
      expect(cache.size).toBe(3);
    });

    it("accessing an entry moves it to most-recent", () => {
      const cache = new WordCache(3);
      cache.set("a", makeResult("a"));
      cache.set("b", makeResult("b"));
      cache.set("c", makeResult("c"));

      cache.get("a"); // refresh "a"
      cache.set("d", makeResult("d")); // should evict "b" (oldest unused)

      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
    });
  });

  describe("hit tracking", () => {
    it("tracks hits and misses", () => {
      const cache = new WordCache(100);
      cache.set("hello", makeResult("hello"));

      cache.get("hello"); // hit
      cache.get("hello"); // hit
      cache.get("world"); // miss

      expect(cache.hits).toBe(2);
      expect(cache.misses).toBe(1);
    });

    it("computes hit rate", () => {
      const cache = new WordCache(100);
      cache.set("hello", makeResult("hello"));

      cache.get("hello"); // hit
      cache.get("world"); // miss

      expect(cache.hitRate).toBeCloseTo(0.5);
    });

    it("returns 0 hit rate when empty", () => {
      const cache = new WordCache(100);
      expect(cache.hitRate).toBe(0);
    });
  });

  describe("clear", () => {
    it("clears all entries and stats", () => {
      const cache = new WordCache(100);
      cache.set("hello", makeResult("hello"));
      cache.get("hello");
      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.hits).toBe(0);
      expect(cache.misses).toBe(0);
      expect(cache.has("hello")).toBe(false);
    });
  });

  describe("persistence", () => {
    it("persists to and restores from storage adapter", async () => {
      const store = new Map<string, unknown>();
      const storage = {
        get: async (key: string) => store.get(key),
        set: async (key: string, value: unknown) => { store.set(key, value); },
      };

      const cache1 = new WordCache(100);
      cache1.set("hello", makeResult("hello"));
      cache1.set("world", makeResult("world"));
      await cache1.persist(storage, "test-cache");

      const cache2 = new WordCache(100);
      await cache2.restore(storage, "test-cache");

      expect(cache2.has("hello")).toBe(true);
      expect(cache2.has("world")).toBe(true);
    });
  });
});
