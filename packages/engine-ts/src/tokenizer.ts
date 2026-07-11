// MorphemeFlow — Word Tokenizer
// Splits text into tokens preserving all whitespace and punctuation.
// Handles URLs, emails, numbers, contractions, hyphenated words, and emoji.

import type { Token } from "./types";

// Order matters — earlier patterns take priority
const PATTERNS: [RegExp, Token["type"]][] = [
  // URLs (must come before word to capture http://... and www.)
  [/https?:\/\/[^\s]+|www\.[^\s]+/, "url"],
  // Email addresses
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, "email"],
  // Numbers: integers, decimals, thousands-separated
  [/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+/, "number"],
  // Words: letters including contractions (don't, they're) and hyphenated (well-known)
  [/[a-zA-Z]+(?:[''\u2019][a-zA-Z]+)*(?:-[a-zA-Z]+)*/, "word"],
  // Whitespace
  [/\s+/, "whitespace"],
  // Punctuation and symbols
  [/[^\s\w]|_/, "punctuation"],
];

// Build a combined regex from the patterns
const COMBINED_REGEX = new RegExp(
  PATTERNS.map(([re]) => `(${re.source})`).join("|"),
  "g",
);

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;

  COMBINED_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    // Capture any gap
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        type: "other",
      });
    }

    // Find which group matched
    for (let i = 0; i < PATTERNS.length; i++) {
      if (match[i + 1] !== undefined) {
        tokens.push({ text: match[i + 1], type: PATTERNS[i][1] });
        break;
      }
    }

    lastIndex = COMBINED_REGEX.lastIndex;
  }

  // Capture trailing text
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), type: "other" });
  }

  return tokens;
}

export function reconstructText(tokens: Token[]): string {
  return tokens.map((t) => t.text).join("");
}
