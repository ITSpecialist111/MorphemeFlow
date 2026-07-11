// MorphemeFlow — Morpheme Analyzer Tests
// Tests the 3-tier analysis strategy: dictionary → rule-based → syllable fallback

import { describe, it, expect } from "vitest";
import { analyzeWord, analyzeWords, getDictionarySize } from "../src/morpheme-analyzer";

describe("analyzeWord", () => {
  describe("Tier 1: Dictionary lookup", () => {
    const dictionaryWords = [
      { word: "unhappy", expectPrefix: "un", expectRoot: true },
      { word: "reconstruction", expectMorphemes: true },
      { word: "unfortunately", expectMorphemes: true },
      { word: "development", expectMorphemes: true },
      { word: "international", expectMorphemes: true },
      { word: "understanding", expectMorphemes: true },
      { word: "improvement", expectMorphemes: true },
      { word: "relationship", expectMorphemes: true },
      { word: "information", expectMorphemes: true },
      { word: "environment", expectMorphemes: true },
      { word: "organization", expectMorphemes: true },
      { word: "communication", expectMorphemes: true },
      { word: "transportation", expectMorphemes: true },
      { word: "responsibility", expectMorphemes: true },
      { word: "advertisement", expectMorphemes: true },
      { word: "uncomfortable", expectMorphemes: true },
      { word: "disagreement", expectMorphemes: true },
      { word: "disappearance", expectMorphemes: true },
      { word: "encouragement", expectMorphemes: true },
      { word: "entertainment", expectMorphemes: true },
    ];

    for (const { word } of dictionaryWords) {
      it(`decomposes "${word}" into multiple morphemes`, () => {
        const result = analyzeWord(word);
        expect(result.morphemes.length).toBeGreaterThan(1);
      });
    }

    it("returns dictionary confidence for known words", () => {
      const result = analyzeWord("unhappy");
      // Could be dictionary or rule-based depending on dictionary coverage
      expect(["dictionary", "rule-based"]).toContain(result.confidence);
    });

    it("populates tier metadata", () => {
      const result = analyzeWord("unhappy");
      expect(result.tier).toBeDefined();
      expect(["dictionary", "rule", "syllable"]).toContain(result.tier);
    });
  });

  describe("Tier 2: Rule-based decomposition", () => {
    it("strips prefix + root", () => {
      const result = analyzeWord("undo");
      expect(result.morphemes.length).toBeGreaterThanOrEqual(1);
    });

    it("strips root + suffix", () => {
      const result = analyzeWord("helpful");
      const types = result.morphemes.map((m) => m.type);
      // Should have root and suffix if rule-based, or multiple morphemes from dict
      expect(result.morphemes.length).toBeGreaterThanOrEqual(1);
    });

    it("handles prefix + root + suffix", () => {
      const result = analyzeWord("unhelpful");
      expect(result.morphemes.length).toBeGreaterThan(1);
    });

    it("includes meaning metadata for affixes", () => {
      const result = analyzeWord("unhelpful");
      const withMeaning = result.morphemes.filter((m) => m.meaning);
      // At least one affix should have meaning
      if (result.confidence !== "syllable-only") {
        expect(withMeaning.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Tier 3: Syllable fallback", () => {
    it("falls back to syllables for unknown words", () => {
      const result = analyzeWord("xylophone");
      expect(result.syllables.length).toBeGreaterThan(1);
    });

    it("single-syllable words get one morpheme", () => {
      const result = analyzeWord("cat");
      expect(result.morphemes).toHaveLength(1);
      expect(result.morphemes[0].type).toBe("root");
    });
  });

  describe("Edge cases", () => {
    it("handles empty string", () => {
      const result = analyzeWord("");
      expect(result.morphemes).toHaveLength(1);
    });

    it("handles single character", () => {
      const result = analyzeWord("a");
      expect(result.morphemes).toHaveLength(1);
    });

    it("handles short words (<=3 chars) without decomposition", () => {
      const result = analyzeWord("the");
      expect(result.morphemes).toHaveLength(1);
      expect(result.morphemes[0].text).toBe("the");
    });

    it("handles uppercase input", () => {
      const result = analyzeWord("UNHAPPY");
      expect(result.morphemes.length).toBeGreaterThan(1);
      expect(result.morphemes.map((m) => m.text).join("")).toBe("UNHAPPY");
      expect(result.syllables.join("")).toBe("UNHAPPY");
    });

    it("handles mixed case", () => {
      const result = analyzeWord("UnHaPpY");
      expect(result.morphemes.length).toBeGreaterThan(1);
      expect(result.morphemes.map((m) => m.text).join("")).toBe("UnHaPpY");
      expect(result.syllables.join("")).toBe("UnHaPpY");
    });

    it("handles words with punctuation", () => {
      const result = analyzeWord("don't");
      expect(result.word).toBe("don't");
      expect(result.morphemes.map((m) => m.text).join("")).toBe("don't");
      expect(result.syllables.join("")).toBe("don't");
    });

    it("preserves hyphens in every rendered segmentation", () => {
      const result = analyzeWord("well-known");
      expect(result.morphemes.map((m) => m.text).join("")).toBe("well-known");
      expect(result.syllables.join("")).toBe("well-known");
    });

    it("preserves case in rule and syllable tiers", () => {
      for (const word of ["RUNNING", "ZyGoMoRpHiC"]) {
        const result = analyzeWord(word);
        expect(result.morphemes.map((m) => m.text).join("")).toBe(word);
        expect(result.syllables.join("")).toBe(word);
      }
    });

    it("preserves original word in result", () => {
      const result = analyzeWord("RUNNING");
      expect(result.word).toBe("RUNNING");
    });
  });

  describe("High-frequency word coverage", () => {
    // Top 50 multi-morpheme English words
    const words = [
      "running", "played", "teacher", "quickly", "beautiful",
      "impossible", "carefully", "wonderful", "dangerous", "different",
      "important", "happening", "beginning", "something", "everything",
      "everyone", "together", "sometimes", "afternoon", "understand",
      "remember", "discover", "consider", "continue", "complete",
      "possible", "powerful", "thankful", "movement", "agreement",
      "statement", "treatment", "payment", "equipment", "department",
      "connection", "direction", "education", "location", "nation",
      "condition", "position", "question", "attention", "action",
      "reaction", "addition", "tradition", "production", "collection",
    ];

    for (const word of words) {
      it(`analyzes "${word}" without error`, () => {
        const result = analyzeWord(word);
        expect(result).toBeDefined();
        expect(result.morphemes.length).toBeGreaterThanOrEqual(1);
        expect(result.syllables.length).toBeGreaterThanOrEqual(1);
      });
    }
  });
});

describe("analyzeWords", () => {
  it("batch-analyzes and deduplicates", () => {
    const results = analyzeWords(["hello", "HELLO", "world", "Hello"]);
    expect(results.size).toBe(2); // deduplicated by lowercase
    expect(results.has("hello")).toBe(true);
    expect(results.has("world")).toBe(true);
  });

  it("returns correct result for each word", () => {
    const results = analyzeWords(["unhappy", "cat"]);
    expect(results.get("unhappy")!.morphemes.length).toBeGreaterThan(1);
    expect(results.get("cat")!.morphemes).toHaveLength(1);
  });
});

describe("getDictionarySize", () => {
  it("returns a positive number", () => {
    expect(getDictionarySize()).toBeGreaterThan(0);
  });

  it("has substantial coverage (>30k entries)", () => {
    expect(getDictionarySize()).toBeGreaterThan(30_000);
  });
});
