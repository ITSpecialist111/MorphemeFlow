// MorphemeFlow — Syllable Splitter Tests
import { describe, it, expect } from "vitest";
import { splitSyllables, countSyllables } from "../../packages/engine/src/syllable-splitter";

describe("splitSyllables", () => {
  it("should split a multisyllabic word", () => {
    const result = splitSyllables("happy");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("should return single-syllable words unchanged", () => {
    const result = splitSyllables("cat");
    expect(result).toEqual(["cat"]);
  });

  it("should handle short words", () => {
    const result = splitSyllables("the");
    expect(result).toEqual(["the"]);
  });

  it("should handle empty string", () => {
    const result = splitSyllables("");
    expect(result).toEqual([""]);
  });

  it("should split 'uncomfortable' into multiple syllables", () => {
    const result = splitSyllables("uncomfortable");
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("should not produce empty syllables", () => {
    const words = ["hello", "world", "beautiful", "understanding", "reconstruction"];
    for (const word of words) {
      const syllables = splitSyllables(word);
      for (const s of syllables) {
        expect(s.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("countSyllables", () => {
  it("should count syllables correctly", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("happy")).toBeGreaterThanOrEqual(2);
  });
});
