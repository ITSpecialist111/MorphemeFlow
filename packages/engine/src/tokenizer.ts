// MorphemeFlow — Word Tokenizer
// Splits text into tokens preserving all whitespace and punctuation

import type { Token } from "./types";

// Regex captures: words (including contractions/hyphens), whitespace, or punctuation
const TOKEN_REGEX = /([a-zA-Z]+(?:[''\u2019][a-zA-Z]+)*(?:-[a-zA-Z]+)*)|(\s+)|([^\s\w]|_)/g;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TOKEN_REGEX.lastIndex = 0;
  let lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    // Capture any gap (shouldn't happen with our regex, but safety)
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        type: "other",
      });
    }

    if (match[1]) {
      tokens.push({ text: match[1], type: "word" });
    } else if (match[2]) {
      tokens.push({ text: match[2], type: "whitespace" });
    } else if (match[3]) {
      tokens.push({ text: match[3], type: "punctuation" });
    }

    lastIndex = TOKEN_REGEX.lastIndex;
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
