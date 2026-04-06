// MorphemeFlow — Morpheme Analyzer
// The core intelligence: decomposes words into morphemes using a 3-tier strategy.
// Tier 1: Dictionary lookup (pre-computed, hand-verified)
// Tier 2: Rule-based affix stripping + root validation
// Tier 3: Syllable fallback (treats syllables as pseudo-morphemes)

import type { Morpheme, MorphemeResult } from "./types";
import { PREFIX_RULES } from "../data/prefix-rules";
import { SUFFIX_RULES } from "../data/suffix-rules";
import { isValidRoot } from "../data/root-validator";
import { splitSyllables } from "./syllable-splitter";
import { lookupMorphemes, getDictSize } from "../data/morpheme-dictionary";

// Tier 1: Pre-computed morpheme dictionary — 37K+ verified entries from MorphoLex
// Compact format with lazy decoding for minimal memory footprint.

/**
 * Tier 1: Dictionary lookup
 */
function dictionaryLookup(word: string): Morpheme[] | null {
  return lookupMorphemes(word) ?? null;
}

/**
 * Tier 2: Rule-based affix stripping
 * Tries to peel off prefixes and suffixes, validates remaining root.
 */
function ruleBasedParse(word: string): Morpheme[] | null {
  const morphemes: Morpheme[] = [];
  let remaining = word;

  // Try stripping prefixes (longest match first — rules are pre-sorted)
  let prefixFound: typeof PREFIX_RULES[0] | null = null;
  for (const rule of PREFIX_RULES) {
    if (remaining.startsWith(rule.affix) && remaining.length > rule.affix.length + 2) {
      prefixFound = rule;
      remaining = remaining.slice(rule.affix.length);
      break;
    }
  }

  // Try stripping suffixes (longest match first)
  let suffixFound: typeof SUFFIX_RULES[0] | null = null;
  let rootCandidate = remaining;
  for (const rule of SUFFIX_RULES) {
    if (remaining.endsWith(rule.affix) && remaining.length > rule.affix.length + 2) {
      suffixFound = rule;
      rootCandidate = remaining.slice(0, -rule.affix.length);
      break;
    }
  }

  // Apply stem changes if the suffix rule defines one
  let validatedRoot = rootCandidate;
  if (suffixFound?.stemChange) {
    validatedRoot = suffixFound.stemChange(rootCandidate);
  }

  // Validate the root
  if (!isValidRoot(validatedRoot) && !isValidRoot(rootCandidate)) {
    // If we only found a prefix but no valid root+suffix, try without prefix
    if (prefixFound && !suffixFound) return null;
    // If we only found a suffix but no valid root, try without suffix
    if (suffixFound && !prefixFound) {
      if (isValidRoot(word)) return null; // Word is itself a root
      return null;
    }
    if (!prefixFound && !suffixFound) return null;
    // Both found but root invalid — reject
    return null;
  }

  // Build morpheme list
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

  return morphemes.length > 1 ? morphemes : null;
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
    };
  }

  // Short words (<=3 chars) — don't decompose
  if (normalized.length <= 3) {
    return {
      word,
      morphemes: [{ text: word, type: "root" }],
      syllables: [word],
      confidence: "dictionary",
    };
  }

  const syllables = splitSyllables(normalized);

  // Tier 1: Dictionary
  const dictResult = dictionaryLookup(normalized);
  if (dictResult) {
    return {
      word,
      morphemes: dictResult,
      syllables,
      confidence: "dictionary",
    };
  }

  // Tier 2: Rule-based
  const ruleResult = ruleBasedParse(normalized);
  if (ruleResult) {
    return {
      word,
      morphemes: ruleResult,
      syllables,
      confidence: "rule-based",
    };
  }

  // Tier 3: Syllable fallback
  return {
    word,
    morphemes: syllableFallback(normalized),
    syllables,
    confidence: "syllable-only",
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
