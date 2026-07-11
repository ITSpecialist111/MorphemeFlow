import { describe, expect, it } from "vitest";
import fixture from "../../../data/test-fixtures/words.json";
import { analyzeWord } from "../src/morpheme-analyzer";
import { tokenize } from "../src/tokenizer";

describe("shared Rust/TypeScript fixture contract", () => {
  for (const testCase of fixture.words) {
    it(`matches structural expectations for ${testCase.input}`, () => {
      const result = analyzeWord(testCase.input);
      expect(result.tier).toBe(testCase.expectedTier);
      expect(result.morphemes.map((morpheme) => morpheme.text).join("")).toBe(testCase.input);
      expect(result.syllables.join("")).toBe(testCase.input);

      if ("minMorphemes" in testCase && testCase.minMorphemes !== undefined) {
        expect(result.morphemes.length).toBeGreaterThanOrEqual(testCase.minMorphemes);
      }
      if ("minSyllables" in testCase && testCase.minSyllables !== undefined) {
        expect(result.syllables.length).toBeGreaterThanOrEqual(testCase.minSyllables);
      }
      if ("expectedTypes" in testCase && testCase.expectedTypes) {
        expect(result.morphemes.map((morpheme) => morpheme.type)).toEqual(testCase.expectedTypes);
      }
    });
  }

  for (const testCase of fixture.tokenization) {
    it(`matches tokenization expectations for ${JSON.stringify(testCase.input)}`, () => {
      expect(tokenize(testCase.input)).toEqual(testCase.expectedTokens);
    });
  }
});
