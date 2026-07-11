// MorphemeFlow — Tokenizer Tests

import { describe, it, expect } from "vitest";
import { tokenize, reconstructText } from "../src/tokenizer";

describe("tokenize", () => {
  describe("basic tokenization", () => {
    it("splits words and whitespace", () => {
      const tokens = tokenize("hello world");
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ text: "hello", type: "word" });
      expect(tokens[1]).toEqual({ text: " ", type: "whitespace" });
      expect(tokens[2]).toEqual({ text: "world", type: "word" });
    });

    it("handles punctuation", () => {
      const tokens = tokenize("Hello, world!");
      const types = tokens.map((t) => t.type);
      expect(types).toContain("word");
      expect(types).toContain("punctuation");
    });

    it("handles multiple spaces", () => {
      const tokens = tokenize("hello   world");
      expect(tokens).toHaveLength(3);
      expect(tokens[1].type).toBe("whitespace");
      expect(tokens[1].text).toBe("   ");
    });
  });

  describe("contractions", () => {
    it("keeps don't as a single word token", () => {
      const tokens = tokenize("don't");
      const words = tokens.filter((t) => t.type === "word");
      expect(words).toHaveLength(1);
      expect(words[0].text).toBe("don't");
    });

    it("keeps they're as a single word token", () => {
      const tokens = tokenize("they're");
      const words = tokens.filter((t) => t.type === "word");
      expect(words).toHaveLength(1);
    });

    it("handles smart quotes in contractions", () => {
      const tokens = tokenize("don\u2019t");
      const words = tokens.filter((t) => t.type === "word");
      expect(words).toHaveLength(1);
      expect(words[0].text).toContain("don");
    });

    it("handles I'm, we've, she'd", () => {
      for (const contraction of ["I'm", "we've", "she'd"]) {
        const tokens = tokenize(contraction);
        const words = tokens.filter((t) => t.type === "word");
        expect(words).toHaveLength(1);
      }
    });
  });

  describe("hyphenated words", () => {
    it("keeps well-known as a single word token", () => {
      const tokens = tokenize("well-known");
      const words = tokens.filter((t) => t.type === "word");
      expect(words).toHaveLength(1);
      expect(words[0].text).toBe("well-known");
    });

    it("handles multi-hyphen words", () => {
      const tokens = tokenize("state-of-the-art");
      const words = tokens.filter((t) => t.type === "word");
      expect(words).toHaveLength(1);
    });
  });

  describe("em-dashes and special punctuation", () => {
    it("handles em-dashes", () => {
      const tokens = tokenize("hello—world");
      // em-dash is punctuation, should separate words
      expect(tokens.length).toBeGreaterThanOrEqual(3);
    });

    it("handles ellipses", () => {
      const tokens = tokenize("wait...");
      expect(tokens.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("URLs", () => {
    it("recognizes HTTP URLs", () => {
      const tokens = tokenize("visit https://example.com/path today");
      const urls = tokens.filter((t) => t.type === "url");
      expect(urls).toHaveLength(1);
      expect(urls[0].text).toContain("https://example.com");
    });

    it("recognizes www URLs", () => {
      const tokens = tokenize("go to www.example.com");
      const urls = tokens.filter((t) => t.type === "url");
      expect(urls).toHaveLength(1);
    });
  });

  describe("email addresses", () => {
    it("recognizes email addresses", () => {
      const tokens = tokenize("email user@example.com please");
      const emails = tokens.filter((t) => t.type === "email");
      expect(emails).toHaveLength(1);
      expect(emails[0].text).toBe("user@example.com");
    });
  });

  describe("numbers", () => {
    it("recognizes integers", () => {
      const tokens = tokenize("page 42 of 100");
      const numbers = tokens.filter((t) => t.type === "number");
      expect(numbers).toHaveLength(2);
    });

    it("recognizes decimals", () => {
      const tokens = tokenize("pi is 3.14");
      const numbers = tokens.filter((t) => t.type === "number");
      expect(numbers.length).toBeGreaterThanOrEqual(1);
      expect(numbers.some((n) => n.text === "3.14")).toBe(true);
    });

    it("recognizes thousands-separated numbers", () => {
      const tokens = tokenize("population: 1,000,000");
      const numbers = tokens.filter((t) => t.type === "number");
      expect(numbers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("abbreviations", () => {
    it("handles U.S.A. as separate tokens", () => {
      const tokens = tokenize("U.S.A.");
      // This creates individual letter + punctuation tokens
      expect(tokens.length).toBeGreaterThan(1);
    });
  });

  describe("text reconstruction", () => {
    const testCases = [
      "Hello, world!",
      "don't stop believing",
      "The quick brown fox jumps over the lazy dog.",
      "Visit https://example.com for more info.",
      "Email user@test.com today!",
      "Price: $1,000.00",
      "well-known fact",
      "Hello... world!",
      "a—b—c",
      "   multiple   spaces   ",
    ];

    for (const text of testCases) {
      it(`reconstructs "${text.slice(0, 30)}..."`, () => {
        const tokens = tokenize(text);
        expect(reconstructText(tokens)).toBe(text);
      });
    }
  });

  describe("only word tokens should be analyzed", () => {
    it("non-word tokens are not type 'word'", () => {
      const tokens = tokenize("hello, 42, https://example.com, user@test.com!");
      for (const token of tokens) {
        if (token.type === "word") {
          expect(token.text).toMatch(/^[a-zA-Z]/);
        }
      }
    });
  });
});
