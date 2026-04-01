#!/usr/bin/env node
// MorphemeFlow — Morpheme Dictionary Generator
//
// Combines two sources to build a comprehensive, verified morpheme dictionary:
// 1. MorphoLex (Sánchez-Gutiérrez et al.) — ~68K academically verified segmentations
// 2. Word frequency list (top 50K English words by usage)
//
// Strategy:
//   - Parse MorphoLex segmentations into our Morpheme[] format
//   - Intersect with frequency list to prioritize common words
//   - Supplement with our rule-based engine for frequent words missing from MorphoLex
//   - Output a TypeScript dictionary file sorted by frequency
//
// Usage: node scripts/generate-dictionary.mjs
//
// Output: packages/engine/data/morpheme-dictionary.ts

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// We need to use CommonJS require for xlsx
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

// --- Prefix meaning map ---
const PREFIX_MEANINGS = {
  a: "to/toward",
  ab: "away from",
  ad: "to/toward",
  an: "without",
  ante: "before",
  anti: "against",
  auto: "self",
  be: "make/about",
  bi: "two",
  circum: "around",
  co: "together",
  com: "together",
  con: "together",
  contra: "against",
  counter: "against",
  de: "down/from",
  di: "two",
  dia: "through",
  dis: "not/apart",
  e: "out of",
  em: "in/into",
  en: "in/into",
  epi: "upon",
  eu: "good",
  ex: "out of",
  extra: "beyond",
  fore: "before",
  hetero: "different",
  homo: "same",
  hyper: "over/excess",
  hypo: "under",
  il: "not",
  im: "not/into",
  in: "not/into",
  infra: "below",
  inter: "between",
  intra: "within",
  ir: "not",
  macro: "large",
  mal: "bad",
  mega: "large",
  meta: "beyond",
  micro: "small",
  mid: "middle",
  mini: "small",
  mis: "wrong",
  mono: "one",
  multi: "many",
  neo: "new",
  non: "not",
  ob: "against",
  omni: "all",
  out: "beyond",
  over: "above/excess",
  pan: "all",
  para: "beside",
  per: "through",
  peri: "around",
  poly: "many",
  post: "after",
  pre: "before",
  pro: "forward/for",
  proto: "first",
  pseudo: "false",
  re: "again/back",
  retro: "backward",
  semi: "half",
  sub: "under",
  super: "above",
  supra: "above",
  sur: "over",
  sym: "together",
  syn: "together",
  tele: "distant",
  trans: "across",
  tri: "three",
  ultra: "beyond",
  un: "not/reverse",
  under: "below",
  uni: "one",
};

// --- Suffix meaning map ---
const SUFFIX_MEANINGS = {
  able: "capable of",
  ible: "capable of",
  acy: "state of",
  age: "action/result",
  al: "relating to",
  ial: "relating to",
  ance: "state of",
  ence: "state of",
  ant: "one who",
  ent: "one who",
  ar: "relating to",
  ary: "relating to",
  ate: "make/cause",
  ation: "process",
  ator: "one who",
  dom: "state of",
  ed: "past tense",
  ee: "one who receives",
  en: "made of/make",
  er: "one who/more",
  ery: "place of",
  es: "plural",
  ess: "female",
  est: "most",
  ful: "full of",
  fy: "make",
  ia: "condition",
  ic: "relating to",
  ical: "relating to",
  ice: "state of",
  ify: "make",
  ile: "capable of",
  ine: "relating to",
  ing: "ongoing",
  ion: "action/state",
  ious: "full of",
  ise: "make",
  ism: "belief/system",
  ist: "one who",
  ite: "quality of",
  ity: "state of",
  ive: "tending to",
  ize: "make",
  less: "without",
  let: "small",
  like: "resembling",
  ling: "small",
  log: "speech/study",
  logy: "study of",
  ly: "in manner of",
  ment: "result of",
  most: "most",
  ness: "state of",
  or: "one who",
  ory: "relating to",
  ous: "full of",
  ry: "collection",
  s: "plural",
  ship: "state/skill",
  sion: "action/state",
  tion: "action/state",
  tude: "state of",
  ty: "state of",
  ual: "relating to",
  ular: "relating to",
  ure: "action/result",
  ward: "direction",
  wards: "direction",
  wise: "manner",
  y: "quality of",
};

// ============================================================
// Step 1: Parse MorphoLex segmentations
// ============================================================

/**
 * Parse MorphoLex segmentation notation into our morpheme format.
 *
 * Format examples:
 *   {(root)}             → single root
 *   {<pre<(root)}        → prefix + root
 *   {(root)>suf>}        → root + suffix
 *   {<pre<(root)>suf>}   → prefix + root + suffix
 *   {(root1)}{(root2)}   → compound word
 *   {(root)>s1>>s2>}     → root + 2 suffixes
 */
function parseMorphoLexSegm(word, segm) {
  if (!segm || typeof segm !== "string") return null;

  const morphemes = [];

  // Extract all morpheme parts using regex
  // Prefixes: <prefix<
  // Roots: (root)
  // Suffixes: >suffix>

  const prefixRegex = /<([^<>]+)</g;
  const rootRegex = /\(([^()]+)\)/g;
  const suffixRegex = />([^<>]+)>/g;

  // Collect all matches with their positions for ordering
  const parts = [];

  let match;
  while ((match = prefixRegex.exec(segm)) !== null) {
    parts.push({ type: "prefix", text: match[1], pos: match.index });
  }
  while ((match = rootRegex.exec(segm)) !== null) {
    parts.push({ type: "root", text: match[1], pos: match.index });
  }
  while ((match = suffixRegex.exec(segm)) !== null) {
    parts.push({ type: "suffix", text: match[1], pos: match.index });
  }

  if (parts.length === 0) return null;

  // Sort by position in the segmentation string
  parts.sort((a, b) => a.pos - b.pos);

  // Build morphemes array
  for (const part of parts) {
    const morpheme = { text: part.text, type: part.type };

    // Add meanings for known prefixes/suffixes
    if (part.type === "prefix" && PREFIX_MEANINGS[part.text]) {
      morpheme.meaning = PREFIX_MEANINGS[part.text];
    }
    if (part.type === "suffix" && SUFFIX_MEANINGS[part.text]) {
      morpheme.meaning = SUFFIX_MEANINGS[part.text];
    }

    morphemes.push(morpheme);
  }

  // Validate: the concatenated morpheme texts should approximately match the word
  const joined = morphemes.map((m) => m.text).join("");
  const wordClean = word.toLowerCase().replace(/[^a-z]/g, "");

  // Allow some tolerance (MorphoLex sometimes uses stems, not exact surface forms)
  if (joined.length < wordClean.length * 0.5) return null;

  return morphemes;
}

// ============================================================
// Step 2: Load and parse data
// ============================================================

function loadMorphoLex() {
  console.log("Loading MorphoLex...");
  const xlsxPath = resolve(__dirname, "MorphoLEX_en.xlsx");
  const wb = XLSX.readFile(xlsxPath);

  const entries = new Map(); // word → { morphemes, prs }

  // Process all PRS sheets (skip Presentation, All prefixes/suffixes/roots)
  const prsSheets = wb.SheetNames.filter(
    (name) =>
      /^\d+-\d+-\d+$/.test(name) && name !== "0-0-0" // skip contractions
  );

  for (const sheetName of prsSheets) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws);

    for (const row of data) {
      const word = String(row.Word || "").toLowerCase().trim();
      if (!word || word.length < 2) continue;

      // Skip words with numbers, hyphens, apostrophes
      if (/[^a-z]/.test(word)) continue;

      const segm = row.MorphoLexSegm;
      const morphemes = parseMorphoLexSegm(word, segm);

      if (morphemes && morphemes.length >= 1) {
        // Only include words with actual decomposition (>1 morpheme)
        // or single roots (for cache optimization)
        entries.set(word, {
          morphemes,
          prs: sheetName,
          nmorph: row.Nmorph || morphemes.length,
        });
      }
    }
  }

  console.log(`  Parsed ${entries.size} words from MorphoLex`);
  return entries;
}

function loadFrequencyList() {
  console.log("Loading word frequency list...");
  const freqPath = resolve(__dirname, "en_50k.txt");
  const lines = readFileSync(freqPath, "utf-8").split("\n");
  const freq = new Map(); // word → rank (lower = more common)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [word] = line.split(/\s+/);
    if (word && /^[a-z]+$/.test(word) && word.length >= 2) {
      freq.set(word, i + 1);
    }
  }

  console.log(`  Loaded ${freq.size} words with frequency ranks`);
  return freq;
}

// ============================================================
// Step 3: Combine and generate
// ============================================================

function generateDictionary() {
  const morphoLex = loadMorphoLex();
  const freqList = loadFrequencyList();

  // --- Phase A: MorphoLex entries ranked by frequency ---
  console.log("\nPhase A: Merging MorphoLex with frequency data...");

  const scored = [];

  for (const [word, data] of morphoLex) {
    const rank = freqList.get(word) || 999999;
    scored.push({ word, ...data, rank });
  }

  // Sort by frequency rank (most common first)
  scored.sort((a, b) => a.rank - b.rank);

  // --- Phase B: Take top entries (multi-morpheme words prioritized) ---
  const dictionary = new Map();

  // First pass: all multi-morpheme words in top 10K frequency
  let multiCount = 0;
  let singleCount = 0;

  for (const entry of scored) {
    if (entry.morphemes.length > 1) {
      dictionary.set(entry.word, entry.morphemes);
      multiCount++;
    } else if (entry.rank <= 5000) {
      // Include single-morpheme words only if very common (optimization: cache hit)
      dictionary.set(entry.word, entry.morphemes);
      singleCount++;
    }
  }

  console.log(`  Multi-morpheme: ${multiCount}`);
  console.log(`  Single-morpheme (top 5K freq): ${singleCount}`);
  console.log(`  Total dictionary: ${dictionary.size}`);

  return dictionary;
}

// ============================================================
// Step 4: Write TypeScript output
// ============================================================

function writeDictionary(dictionary) {
  console.log("\nWriting TypeScript dictionary...");

  const outPath = resolve(
    ROOT,
    "packages/engine/data/morpheme-dictionary.ts"
  );

  // Build the file content
  const lines = [];
  lines.push("// MorphemeFlow — Generated Morpheme Dictionary");
  lines.push("// DO NOT EDIT MANUALLY — generated by scripts/generate-dictionary.mjs");
  lines.push("//");
  lines.push(`// Source: MorphoLex (Sánchez-Gutiérrez et al.) + word frequency data`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(`// Entries: ${dictionary.size}`);
  lines.push("//");
  lines.push('import type { Morpheme } from "../src/types";');
  lines.push("");
  lines.push(
    "export const MORPHEME_DICTIONARY: Record<string, Morpheme[]> = {"
  );

  // Sort alphabetically for stable output
  const sortedEntries = [...dictionary.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [word, morphemes] of sortedEntries) {
    const morphStr = morphemes
      .map((m) => {
        const parts = [`text: "${m.text}"`, `type: "${m.type}"`];
        if (m.meaning) parts.push(`meaning: "${m.meaning}"`);
        return `{ ${parts.join(", ")} }`;
      })
      .join(", ");

    lines.push(`  "${word}": [${morphStr}],`);
  }

  lines.push("};");
  lines.push("");

  writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`  Written to: ${outPath}`);
  console.log(`  Size: ${(Buffer.byteLength(lines.join("\n")) / 1024).toFixed(0)} KB`);
}

// ============================================================
// Main
// ============================================================

console.log("=== MorphemeFlow Dictionary Generator ===\n");
const dictionary = generateDictionary();
writeDictionary(dictionary);
console.log("\nDone!");
