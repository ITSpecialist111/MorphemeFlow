#!/usr/bin/env node
// MorphemeFlow — Data Baking Script
// Reads TS engine data files and emits plain-text formats for Rust consumption.
//
// Output:
//   data/morpheme-dictionary/morphemes.txt  — one "word\tmorph:type[:meaning]|..." per line
//   data/affix-rules/prefixes.json          — prefix rules as JSON
//   data/affix-rules/suffixes.json          — suffix rules as JSON
//   data/affix-rules/roots.txt              — one root word per line

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── 1. Extract morpheme dictionary ─────────────────────

console.log("Extracting morpheme dictionary...");
const dictSource = readFileSync(
  resolve(root, "packages/engine-ts/data/morpheme-dictionary.ts"),
  "utf-8"
);

// Parse the COMPACT_DICT entries using regex
const dictEntries = [];
const entryRegex = /^\s*"([^"]+)"\s*:\s*"([^"]+)"/gm;
let match;
while ((match = entryRegex.exec(dictSource)) !== null) {
  dictEntries.push(`${match[1]}\t${match[2]}`);
}

writeFileSync(
  resolve(root, "data/morpheme-dictionary/morphemes.txt"),
  dictEntries.join("\n") + "\n"
);
console.log(`  Wrote ${dictEntries.length} entries to morphemes.txt`);

// ── 2. Extract prefix rules ────────────────────────────

console.log("Extracting prefix rules...");
const prefixSource = readFileSync(
  resolve(root, "packages/engine-ts/data/prefix-rules.ts"),
  "utf-8"
);

const prefixes = [];
const affixRegex = /affix:\s*"([^"]+)",\s*meaning:\s*"([^"]+)",\s*requiresRoot:\s*(true|false)/g;
while ((match = affixRegex.exec(prefixSource)) !== null) {
  prefixes.push({
    affix: match[1],
    meaning: match[2],
    requiresRoot: match[3] === "true",
  });
}

writeFileSync(
  resolve(root, "data/affix-rules/prefixes.json"),
  JSON.stringify(prefixes, null, 2) + "\n"
);
console.log(`  Wrote ${prefixes.length} prefix rules`);

// ── 3. Extract suffix rules ────────────────────────────

console.log("Extracting suffix rules...");
const suffixSource = readFileSync(
  resolve(root, "packages/engine-ts/data/suffix-rules.ts"),
  "utf-8"
);

const suffixes = [];
// Reset regex
const suffixRegex = /affix:\s*"([^"]+)",\s*meaning:\s*"([^"]+)",\s*requiresRoot:\s*(true|false)/g;
while ((match = suffixRegex.exec(suffixSource)) !== null) {
  suffixes.push({
    affix: match[1],
    meaning: match[2],
    requiresRoot: match[3] === "true",
  });
}

writeFileSync(
  resolve(root, "data/affix-rules/suffixes.json"),
  JSON.stringify(suffixes, null, 2) + "\n"
);
console.log(`  Wrote ${suffixes.length} suffix rules`);

// ── 4. Extract root words ──────────────────────────────

console.log("Extracting root words...");
const rootSource = readFileSync(
  resolve(root, "packages/engine-ts/data/root-validator.ts"),
  "utf-8"
);

const rootWords = [];
const rootRegex = /"([a-z]+)"/g;
// Skip lines before ROOT_WORDS definition
const rootBlock = rootSource.slice(rootSource.indexOf("new Set(["));
while ((match = rootRegex.exec(rootBlock)) !== null) {
  rootWords.push(match[1]);
}

writeFileSync(
  resolve(root, "data/affix-rules/roots.txt"),
  rootWords.join("\n") + "\n"
);
console.log(`  Wrote ${rootWords.length} root words`);

console.log("\nDone! Data baked to data/morpheme-dictionary/ and data/affix-rules/");
