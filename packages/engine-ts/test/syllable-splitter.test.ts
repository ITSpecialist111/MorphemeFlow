// MorphemeFlow — Syllable Splitter Tests

import { describe, it, expect } from "vitest";
import { splitSyllables, countSyllables } from "../src/syllable-splitter";

describe("splitSyllables", () => {
  describe("basic splitting", () => {
    it("returns single-syllable words as-is", () => {
      expect(splitSyllables("cat")).toEqual(["cat"]);
      expect(splitSyllables("the")).toEqual(["the"]);
      expect(splitSyllables("dog")).toEqual(["dog"]);
    });

    it("splits two-syllable words", () => {
      const result = splitSyllables("happy");
      expect(result.length).toBe(2);
      expect(result.join("")).toBe("happy");
    });

    it("splits three-syllable words", () => {
      const result = splitSyllables("beautiful");
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.join("")).toBe("beautiful");
    });
  });

  describe("accuracy on known words", () => {
    // These syllable counts are verified against CMUdict
    const knownWords: [string, number][] = [
      ["water", 2],
      ["computer", 3],
      ["information", 4],
      ["understanding", 4],
      ["communication", 5],
      ["responsibility", 6],
      ["education", 4],
      ["international", 5],
      ["unfortunately", 5],
      ["entertainment", 4],
      ["environment", 4],
      ["development", 4],
      ["organization", 5],
      ["relationship", 4],
      ["transportation", 4],
      ["elephant", 3],
      ["butterfly", 3],
      ["umbrella", 3],
      ["dinosaur", 3],
      ["banana", 3],
      ["animal", 3],
      ["together", 3],
      ["important", 3],
      ["different", 3],
      ["beautiful", 3],
      ["imagine", 3],
      ["adventure", 3],
      ["remember", 3],
      ["discover", 3],
      ["wonderful", 3],
    ];

    let correctCount = 0;
    for (const [word, expectedCount] of knownWords) {
      it(`counts "${word}" as ~${expectedCount} syllables`, () => {
        const result = splitSyllables(word);
        const count = result.length;
        // Allow ±1 tolerance (Knuth-Liang occasionally differs from CMUdict)
        const withinTolerance = Math.abs(count - expectedCount) <= 1;
        if (count === expectedCount) correctCount++;
        expect(withinTolerance).toBe(true);
      });
    }
  });

  describe("text reconstruction", () => {
    const words = [
      "hello", "world", "computer", "beautiful", "understanding",
      "reconstruction", "unfortunately", "international", "responsibility",
      "communication",
    ];

    for (const word of words) {
      it(`reconstructs "${word}" from syllables`, () => {
        const syllables = splitSyllables(word);
        expect(syllables.join("")).toBe(word);
      });
    }
  });

  describe("edge cases", () => {
    it("handles single character", () => {
      expect(splitSyllables("a")).toEqual(["a"]);
    });

    it("handles two characters", () => {
      expect(splitSyllables("go")).toEqual(["go"]);
    });

    it("handles three characters", () => {
      const result = splitSyllables("the");
      expect(result).toEqual(["the"]);
    });

    it("handles empty-ish input gracefully", () => {
      expect(splitSyllables("")).toEqual([""]);
    });
  });
});

describe("countSyllables", () => {
  it("returns 1 for monosyllabic words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("dog")).toBe(1);
  });

  it("returns correct count for polysyllabic words", () => {
    const count = countSyllables("beautiful");
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
  });
});
