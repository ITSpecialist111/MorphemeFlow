// MorphemeFlow — Morpheme Analyzer
// The core intelligence: decomposes words into morphemes using a 3-tier strategy.
// Tier 1: Dictionary lookup (pre-computed, hand-verified)
// Tier 2: Rule-based affix stripping + root validation (recursive)
// Tier 3: Syllable fallback (treats syllables as pseudo-morphemes)

import type { Morpheme, MorphemeResult } from "./types";
import { PREFIX_RULES } from "../data/prefix-rules";
import { SUFFIX_RULES } from "../data/suffix-rules";
import { isValidRoot } from "../data/root-validator";
import { splitSyllables } from "./syllable-splitter";
import { lookupMorphemes, getDictSize } from "../data/morpheme-dictionary";

function isEnglishLetter(char: string): boolean {
  return /^[a-z]$/i.test(char);
}

/**
 * Project normalized analysis segments back onto the exact surface form.
 * Analysis is intentionally case-insensitive, but rendering must never alter
 * capitalization, apostrophes, hyphens, or other characters in the source.
 */
function projectSurfaceForm<T extends { text: string }>(word: string, parts: T[]): T[] | null {
  if (parts.length === 0) return null;

  const sourceChars = Array.from(word);
  const sourceLetters = sourceChars.filter(isEnglishLetter).map((char) => char.toLowerCase());
  const analyzed = parts.flatMap((part, partIndex) =>
    Array.from(part.text)
      .filter(isEnglishLetter)
      .map((char) => ({ char: char.toLowerCase(), partIndex })),
  );
  if (sourceLetters.length === 0 || analyzed.length === 0) return null;

  // Dictionary entries encode lexical stems (for example, relate + ion)
  // while the visible word contains spelling changes (relation). A compact
  // Levenshtein alignment maps those abstract boundaries to surface letters.
  const rows = analyzed.length + 1;
  const cols = sourceLetters.length + 1;
  const distances = Array.from({ length: rows }, () => new Uint16Array(cols));
  for (let row = 0; row < rows; row++) distances[row][0] = row;
  for (let col = 0; col < cols; col++) distances[0][col] = col;

  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const substitution = distances[row - 1][col - 1]
        + (analyzed[row - 1].char === sourceLetters[col - 1] ? 0 : 1);
      const deletion = distances[row - 1][col] + 1;
      const insertion = distances[row][col - 1] + 1;
      distances[row][col] = Math.min(substitution, deletion, insertion);
    }
  }

  type Alignment = { sourceIndex: number; partIndex?: number };
  const alignment: Alignment[] = [];
  let row = analyzed.length;
  let col = sourceLetters.length;
  while (row > 0 || col > 0) {
    const canPair = row > 0 && col > 0;
    const substitutionCost = canPair
      ? distances[row - 1][col - 1] + (analyzed[row - 1].char === sourceLetters[col - 1] ? 0 : 1)
      : Number.POSITIVE_INFINITY;

    if (canPair && distances[row][col] === substitutionCost) {
      alignment.push({ sourceIndex: col - 1, partIndex: analyzed[row - 1].partIndex });
      row -= 1;
      col -= 1;
    } else if (row > 0 && distances[row][col] === distances[row - 1][col] + 1) {
      row -= 1; // A lexical-stem character is absent from the surface spelling.
    } else {
      alignment.push({ sourceIndex: col - 1 });
      col -= 1; // The surface spelling has a character absent from the lexical stem.
    }
  }
  alignment.reverse();

  const letterParts = new Array<number>(sourceLetters.length);
  let previousPart: number | undefined;
  for (let index = 0; index < alignment.length; index++) {
    const item = alignment[index];
    if (item.partIndex !== undefined) {
      letterParts[item.sourceIndex] = item.partIndex;
      previousPart = item.partIndex;
      continue;
    }

    const nextPart = alignment
      .slice(index + 1)
      .find((candidate) => candidate.partIndex !== undefined)?.partIndex;
    letterParts[item.sourceIndex] = previousPart ?? nextPart ?? 0;
  }

  const projected = parts.map((part) => ({ ...part, text: "" }));
  let letterIndex = 0;
  let activePart = 0;
  for (const char of sourceChars) {
    if (isEnglishLetter(char)) {
      activePart = letterParts[letterIndex] ?? activePart;
      letterIndex += 1;
    }
    projected[activePart].text += char;
  }

  return projected.filter((part) => part.text.length > 0);
}

function projectSyllables(word: string, syllables: string[]): string[] {
  const projected = projectSurfaceForm(word, syllables.map((text) => ({ text })));
  return projected?.map((part) => part.text) ?? [word];
}

/**
 * Tier 1: Dictionary lookup
 */
function dictionaryLookup(word: string): Morpheme[] | null {
  return lookupMorphemes(word) ?? null;
}

/**
 * Tier 2: Rule-based affix stripping (recursive)
 * Tries to peel off prefixes and suffixes, validates remaining root.
 * Recurses on the remaining stem to handle words like un-believ-able.
 */
function ruleBasedParse(word: string, depth = 0): { morphemes: Morpheme[]; rule: string } | null {
  if (depth > 3 || word.length <= 2) return null;

  const morphemes: Morpheme[] = [];
  let remaining = word;
  let ruleDesc = "";

  // Try stripping prefixes (longest match first — rules are pre-sorted)
  let prefixFound: (typeof PREFIX_RULES)[0] | null = null;
  for (const rule of PREFIX_RULES) {
    if (remaining.startsWith(rule.affix) && remaining.length > rule.affix.length + 2) {
      prefixFound = rule;
      remaining = remaining.slice(rule.affix.length);
      ruleDesc = `prefix:${rule.affix}`;
      break;
    }
  }

  // Try stripping suffixes (longest match first)
  let suffixFound: (typeof SUFFIX_RULES)[0] | null = null;
  let rootCandidate = remaining;
  for (const rule of SUFFIX_RULES) {
    if (remaining.endsWith(rule.affix) && remaining.length > rule.affix.length + 2) {
      suffixFound = rule;
      rootCandidate = remaining.slice(0, -rule.affix.length);
      ruleDesc += (ruleDesc ? "+" : "") + `suffix:${rule.affix}`;
      break;
    }
  }

  // Apply stem changes if the suffix rule defines one
  let validatedRoot = rootCandidate;
  if (suffixFound?.stemChange) {
    validatedRoot = suffixFound.stemChange(rootCandidate);
  }

  // Check if the root itself can be further decomposed (recursive)
  if (prefixFound || suffixFound) {
    const innerWord = suffixFound ? rootCandidate : remaining;

    // First check if the root is valid as-is
    const rootIsValid = isValidRoot(validatedRoot) || isValidRoot(rootCandidate);

    if (!rootIsValid) {
      // Try recursive decomposition of the remaining stem
      const innerResult = ruleBasedParse(innerWord, depth + 1);
      if (innerResult) {
        if (prefixFound) {
          morphemes.push({
            text: prefixFound.affix,
            type: "prefix",
            meaning: prefixFound.meaning,
          });
        }
        morphemes.push(...innerResult.morphemes);
        if (suffixFound) {
          morphemes.push({
            text: suffixFound.affix,
            type: "suffix",
            meaning: suffixFound.meaning,
          });
        }
        return { morphemes, rule: ruleDesc + ">" + innerResult.rule };
      }
      // No valid decomposition found
      return null;
    }

    // Root is valid — build morpheme list
    if (prefixFound) {
      morphemes.push({
        text: prefixFound.affix,
        type: "prefix",
        meaning: prefixFound.meaning,
      });
    }

    morphemes.push({
      text: rootCandidate,
      type: "root",
    });

    if (suffixFound) {
      morphemes.push({
        text: suffixFound.affix,
        type: "suffix",
        meaning: suffixFound.meaning,
      });
    }

    return morphemes.length > 1 ? { morphemes, rule: ruleDesc } : null;
  }

  return null;
}

/**
 * Tier 3: Syllable fallback
 * When we can't find morphemes, split into syllables as pseudo-morphemes.
 */
function syllableFallback(word: string): Morpheme[] {
  const syllables = splitSyllables(word);
  if (syllables.length <= 1) {
    return [{ text: word, type: "root" }];
  }
  return syllables.map((s) => ({ text: s, type: "root" as const }));
}

/**
 * Analyze a single word — the main entry point.
 * Returns morpheme decomposition using the 3-tier strategy.
 */
export function analyzeWord(word: string): MorphemeResult {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");

  if (normalized.length === 0) {
    return {
      word,
      morphemes: [{ text: word, type: "root" }],
      syllables: [word],
      confidence: "syllable-only",
      tier: "syllable",
    };
  }

  // Short words (<=3 chars) — don't decompose
  if (normalized.length <= 3) {
    return {
      word,
      morphemes: [{ text: word, type: "root" }],
      syllables: [word],
      confidence: "syllable-only",
      tier: "syllable",
    };
  }

  const syllables = projectSyllables(word, splitSyllables(normalized));

  // Tier 1: Dictionary
  const dictResult = dictionaryLookup(normalized);
  if (dictResult) {
    const morphemes = projectSurfaceForm(word, dictResult)
      ?? [{ text: word, type: "root" as const }];
    return {
      word,
      morphemes,
      syllables,
      confidence: "dictionary",
      tier: "dictionary",
    };
  }

  // Tier 2: Rule-based
  const ruleResult = ruleBasedParse(normalized);
  if (ruleResult) {
    const morphemes = projectSurfaceForm(word, ruleResult.morphemes)
      ?? [{ text: word, type: "root" as const }];
    return {
      word,
      morphemes,
      syllables,
      confidence: "rule-based",
      tier: "rule",
      ruleApplied: ruleResult.rule,
    };
  }

  // Tier 3: Syllable fallback
  return {
    word,
    morphemes: projectSurfaceForm(word, syllableFallback(normalized))
      ?? [{ text: word, type: "root" }],
    syllables,
    confidence: "syllable-only",
    tier: "syllable",
  };
}

/**
 * Analyze multiple words efficiently (batch mode).
 * Deduplicates to avoid re-analyzing the same word.
 */
export function analyzeWords(words: string[]): Map<string, MorphemeResult> {
  const results = new Map<string, MorphemeResult>();
  const unique = new Set(words.map((w) => w.toLowerCase()));

  for (const word of unique) {
    results.set(word, analyzeWord(word));
  }

  return results;
}

/**
 * Get dictionary size (for stats/debugging)
 */
export function getDictionarySize(): number {
  return getDictSize();
}
