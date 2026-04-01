// MorphemeFlow — Morpheme Analyzer Tests
import { describe, it, expect } from "vitest";
import { analyzeWord, analyzeWords, getDictionarySize } from "../../packages/engine/src/morpheme-analyzer";

describe("analyzeWord", () => {
  describe("Tier 1: Dictionary lookup", () => {
    it("should decompose 'unhappy' from dictionary", () => {
      const result = analyzeWord("unhappy");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes).toHaveLength(2);
      expect(result.morphemes[0]).toEqual({ text: "un", type: "prefix", meaning: "not/reverse" });
      expect(result.morphemes[1]).toEqual({ text: "happy", type: "root" });
    });

    it("should decompose 'unhappiness' with prefix + root + suffix", () => {
      const result = analyzeWord("unhappiness");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes).toHaveLength(3);
      expect(result.morphemes[0].type).toBe("prefix");
      expect(result.morphemes[1].type).toBe("root");
      expect(result.morphemes[2].type).toBe("suffix");
    });

    it("should decompose 'reconstruction' with multiple prefixes", () => {
      const result = analyzeWord("reconstruction");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes[0]).toEqual({ text: "re", type: "prefix", meaning: "again/back" });
      expect(result.morphemes[result.morphemes.length - 1].type).toBe("suffix");
    });

    it("should handle simple root-only words", () => {
      const result = analyzeWord("the");
      expect(result.morphemes).toHaveLength(1);
      expect(result.morphemes[0].type).toBe("root");
    });

    it("should be case-insensitive", () => {
      const result = analyzeWord("Unhappy");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes).toHaveLength(2);
    });
  });

  describe("Tier 1: Dictionary coverage", () => {
    it("should decompose 'development' (root + suffix)", () => {
      const result = analyzeWord("development");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes).toHaveLength(2);
      expect(result.morphemes[0]).toEqual({ text: "develop", type: "root" });
      expect(result.morphemes[1]).toEqual({ text: "ment", type: "suffix", meaning: "result of" });
    });

    it("should decompose 'beautiful' (root + suffix)", () => {
      const result = analyzeWord("beautiful");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes[0].type).toBe("root");
      expect(result.morphemes[1]).toEqual({ text: "ful", type: "suffix", meaning: "full of" });
    });

    it("should decompose 'impossible' (prefix + root)", () => {
      const result = analyzeWord("impossible");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes[0]).toEqual({ text: "im", type: "prefix", meaning: "not/into" });
    });

    it("should decompose 'comfortable' (root + suffix)", () => {
      const result = analyzeWord("comfortable");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes).toHaveLength(2);
      expect(result.morphemes[1]).toEqual({ text: "able", type: "suffix", meaning: "capable of" });
    });

    it("should decompose 'darkness' (root + suffix)", () => {
      const result = analyzeWord("darkness");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes).toHaveLength(2);
      expect(result.morphemes[0]).toEqual({ text: "dark", type: "root" });
      expect(result.morphemes[1]).toEqual({ text: "ness", type: "suffix", meaning: "state of" });
    });
  });

  describe("Tier 2: Rule-based parsing", () => {
    it("should parse words with known prefix + valid root", () => {
      const result = analyzeWord("unbroken");
      expect(result.morphemes.length).toBeGreaterThanOrEqual(1);
    });

    it("should parse words with known suffix + valid root", () => {
      const result = analyzeWord("darkness");
      expect(result.confidence).toBe("dictionary");
      expect(result.morphemes).toHaveLength(2);
    });
  });

  describe("Tier 3: Syllable fallback", () => {
    it("should fall back to syllables for unknown words", () => {
      const result = analyzeWord("blorftank");
      expect(result.confidence).toBe("syllable-only");
      expect(result.syllables.length).toBeGreaterThanOrEqual(1);
    });

    it("should provide multi-syllable fallback for longer unknown words", () => {
      const result = analyzeWord("fantabulation");
      expect(result.syllables.length).toBeGreaterThan(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle short words (<=3 chars)", () => {
      const result = analyzeWord("cat");
      expect(result.morphemes).toHaveLength(1);
      expect(result.morphemes[0].text).toBe("cat");
    });

    it("should handle empty string", () => {
      const result = analyzeWord("");
      expect(result.morphemes).toHaveLength(1);
    });

    it("should provide syllables alongside morphemes", () => {
      const result = analyzeWord("uncomfortable");
      expect(result.syllables.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle words with mixed case", () => {
      const result = analyzeWord("BEAUTIFUL");
      expect(result.morphemes.length).toBeGreaterThan(1);
    });

    it("should handle words with punctuation stripped", () => {
      const result = analyzeWord("hello!");
      // Punctuation stripped, "hello" analyzed (syllable fallback for simple word)
      expect(result.morphemes.length).toBeGreaterThanOrEqual(1);
      expect(result.word).toBe("hello!");
    });

    it("should handle hyphenated-ish input gracefully", () => {
      const result = analyzeWord("self-aware");
      // Non-alpha chars stripped, so analyzes "selfaware"
      expect(result.morphemes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Dictionary stats", () => {
    it("should have 37K+ entries from MorphoLex", () => {
      expect(getDictionarySize()).toBeGreaterThan(30000);
    });
  });

  describe("Batch analysis", () => {
    it("should analyze multiple words and deduplicate", () => {
      const results = analyzeWords(["happy", "unhappy", "happy", "the"]);
      expect(results.size).toBe(3); // deduped
      expect(results.has("happy")).toBe(true);
      expect(results.has("unhappy")).toBe(true);
      expect(results.has("the")).toBe(true);
    });

    it("should handle large batches efficiently", () => {
      const words = Array.from({ length: 100 }, (_, i) =>
        ["development", "beautiful", "impossible", "comfortable", "darkness"][i % 5]
      );
      const start = performance.now();
      const results = analyzeWords(words);
      const elapsed = performance.now() - start;

      expect(results.size).toBe(5);
      expect(elapsed).toBeLessThan(200); // Should be well under 200ms
    });
  });

  describe("Morpheme meaning annotations", () => {
    it("should include meanings for prefixes", () => {
      const result = analyzeWord("unhappy");
      const prefix = result.morphemes.find((m) => m.type === "prefix");
      expect(prefix?.meaning).toBeDefined();
      expect(prefix?.meaning).toContain("not");
    });

    it("should include meanings for suffixes", () => {
      const result = analyzeWord("darkness");
      const suffix = result.morphemes.find((m) => m.type === "suffix");
      expect(suffix?.meaning).toBeDefined();
      expect(suffix?.meaning).toContain("state");
    });

    it("should not require meanings for roots", () => {
      const result = analyzeWord("unhappy");
      const root = result.morphemes.find((m) => m.type === "root");
      // Root meaning is optional
      expect(root?.text).toBe("happy");
    });
  });
});
