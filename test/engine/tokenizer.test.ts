// MorphemeFlow — Tokenizer Tests
import { describe, it, expect } from "vitest";
import { tokenize, reconstructText } from "../../packages/engine/src/tokenizer";

describe("tokenize", () => {
  it("should split simple text into word tokens", () => {
    const tokens = tokenize("hello world");
    expect(tokens).toEqual([
      { text: "hello", type: "word" },
      { text: " ", type: "whitespace" },
      { text: "world", type: "word" },
    ]);
  });

  it("should handle punctuation", () => {
    const tokens = tokenize("Hello, world!");
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual({ text: "Hello", type: "word" });
    expect(tokens[1]).toEqual({ text: ",", type: "punctuation" });
    expect(tokens[2]).toEqual({ text: " ", type: "whitespace" });
    expect(tokens[3]).toEqual({ text: "world", type: "word" });
    expect(tokens[4]).toEqual({ text: "!", type: "punctuation" });
  });

  it("should handle contractions", () => {
    const tokens = tokenize("don't can't");
    expect(tokens[0]).toEqual({ text: "don't", type: "word" });
    expect(tokens[2]).toEqual({ text: "can't", type: "word" });
  });

  it("should handle hyphenated words", () => {
    const tokens = tokenize("well-known self-aware");
    expect(tokens[0]).toEqual({ text: "well-known", type: "word" });
    expect(tokens[2]).toEqual({ text: "self-aware", type: "word" });
  });

  it("should handle multiple spaces", () => {
    const tokens = tokenize("hello   world");
    expect(tokens).toEqual([
      { text: "hello", type: "word" },
      { text: "   ", type: "whitespace" },
      { text: "world", type: "word" },
    ]);
  });

  it("should handle empty string", () => {
    const tokens = tokenize("");
    expect(tokens).toEqual([]);
  });

  it("should reconstruct original text", () => {
    const text = "The quick, brown fox — jumped!";
    const tokens = tokenize(text);
    expect(reconstructText(tokens)).toBe(text);
  });

  it("should handle newlines and tabs", () => {
    const tokens = tokenize("hello\nworld\ttab");
    const words = tokens.filter((t) => t.type === "word");
    expect(words.map((w) => w.text)).toEqual(["hello", "world", "tab"]);
  });
});
