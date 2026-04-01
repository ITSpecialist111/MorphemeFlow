# NLP & Technical Approaches for Morpheme Detection
## Technical Research for MorphemeFlow

---

## 1. JavaScript/TypeScript NLP Libraries for Browser-Side Processing

### 1.1 compromise.js
- **What:** Lightweight NLP library for JavaScript
- **License:** MIT
- **Bundle size:** ~200KB minified
- **Key features:** Tokenization, POS tagging, verb conjugation, sentence parsing
- **Dyslexia relevance:** Can identify parts of speech (noun, verb, adjective) for color-coding; handles tokenization for word-level processing
- **Limitations:** No morpheme decomposition; no syllable splitting
- **URL:** https://github.com/spencermountain/compromise
- **Verdict:** Useful as a tokenization/POS layer, not sufficient alone

### 1.2 wink-nlp
- **What:** Fast, developer-friendly NLP library
- **License:** MIT
- **Bundle size:** ~1MB with English model
- **Key features:** Tokenization, sentence boundary detection, POS tagging, named entity recognition, custom patterns
- **Dyslexia relevance:** More performant than compromise for large text blocks; custom pattern matching could be used for morpheme rules
- **Limitations:** No built-in morpheme analysis; English-focused
- **Verdict:** Good performance characteristics for real-time processing

### 1.3 natural (NLP for Node.js)
- **What:** General-purpose NLP toolkit
- **License:** MIT
- **Key features:** Tokenizers, stemmers (Porter, Lancaster), inflectors, phonetic algorithms, classifiers
- **Dyslexia relevance:** Stemmers extract word roots (related to morpheme extraction); phonetic algorithms could inform pronunciation
- **Limitations:** Node.js-oriented; stemmers destroy information (stems aren't morphemes); large bundle
- **Verdict:** Stemmers are a starting point but insufficient for true morpheme decomposition

---

## 2. Syllable Splitting Libraries

### 2.1 syllable (npm package)
- **What:** Counts syllables in English words
- **License:** MIT
- **Bundle size:** ~5KB
- **How it works:** Rule-based algorithm using regex patterns matching English phonological rules
- **Limitations:** Counts syllables but does NOT identify syllable boundaries (positions)
- **URL:** https://github.com/words/syllable
- **Verdict:** Useful for counting but not for visual splitting

### 2.2 hypher
- **What:** Hyphenation engine implementing the Knuth-Liang algorithm
- **License:** BSD-3-Clause
- **Bundle size:** ~3KB + language patterns (~30-100KB per language)
- **How it works:** Uses the TeX hyphenation algorithm with language-specific pattern files
- **Key feature:** **Identifies hyphenation points in words** — these closely correspond to syllable boundaries
- **Language support:** 40+ languages via pattern files
- **Dyslexia relevance:** Hyphenation points ≈ syllable boundaries = exactly what we need for micro-kerning
- **URL:** https://github.com/bramstein/hypher
- **Verdict:** **Excellent candidate** for syllable boundary detection

### 2.3 hyphen (npm package)
- **What:** Another Knuth-Liang hyphenation implementation
- **License:** MIT
- **How it works:** Same algorithm as hypher, different implementation
- **Verdict:** Alternative to hypher with similar capabilities

### 2.4 Knuth-Liang Algorithm (The Gold Standard)
- **What:** The hyphenation algorithm developed by Frank Liang for Donald Knuth's TeX system (1983)
- **How it works:**
  1. Uses a large set of language-specific patterns (e.g., English has ~4,500 patterns)
  2. Each pattern specifies where hyphens can/cannot be placed in letter sequences
  3. Patterns are applied to each word; numeric values at each position determine hyphenation
  4. Odd numbers = hyphenation allowed; even numbers = hyphenation forbidden
  5. Higher numbers override lower numbers
- **Accuracy:** ~99% for English when using full TeX pattern sets
- **Performance:** O(n) per word where n is word length — extremely fast
- **Why it matters:** This is the algorithm used by virtually all digital typesetting. The pattern files are freely available and well-tested across 40+ languages.

### 2.5 syllabify.js (Custom Implementation Approach)
- A custom syllabification engine could be built using:
  1. Knuth-Liang patterns as the base
  2. Pronunciation dictionary (CMU Pronouncing Dictionary) for common words
  3. Fallback rules for unknown words
- This would give us true syllable boundaries rather than just hyphenation points

---

## 3. Morpheme Detection Approaches

### 3.1 Rule-Based Morpheme Parsing

**How it works:** Define explicit rules for prefix/suffix stripping and root identification.

**English Affix Database (freely available):**

**Common Prefixes (26 most frequent):**
| Prefix | Meaning | Example |
|--------|---------|---------|
| un- | not, opposite | unhappy |
| re- | again | rebuild |
| pre- | before | preview |
| dis- | not, opposite | disagree |
| mis- | wrongly | misunderstand |
| over- | too much | overcome |
| under- | below | understand |
| out- | beyond | outperform |
| non- | not | nonsense |
| inter- | between | interact |
| sub- | under | submarine |
| trans- | across | transport |
| super- | above | superhero |
| anti- | against | antifreeze |
| de- | undo | decompose |
| fore- | before | foresee |
| mid- | middle | midnight |
| semi- | half | semicircle |
| counter- | against | counteract |
| multi- | many | multiply |
| post- | after | postpone |
| bi- | two | bicycle |
| tri- | three | triangle |
| micro- | small | microscope |
| macro- | large | macroeconomic |
| auto- | self | automobile |

**Common Suffixes (30 most frequent):**
| Suffix | Function | Example |
|--------|----------|---------|
| -ed | past tense | walked |
| -ing | progressive | walking |
| -s / -es | plural/3rd person | cats, boxes |
| -er | comparative / agent | faster, teacher |
| -est | superlative | fastest |
| -ly | adverb | quickly |
| -tion / -sion | noun | action, tension |
| -ment | noun | movement |
| -ness | noun | happiness |
| -ful | full of | beautiful |
| -less | without | careless |
| -able / -ible | capable of | readable |
| -ous / -ious | characterized by | dangerous |
| -ive | tending to | creative |
| -al | relating to | musical |
| -ity / -ty | state of | activity |
| -ence / -ance | state/quality | difference |
| -ist | person who | artist |
| -ism | belief/practice | realism |
| -ize / -ise | to make | organize |
| -ify | to make | simplify |
| -ward | direction | backward |
| -dom | state of being | freedom |
| -ship | state/office | friendship |
| -ure | action/result | closure |
| -en | to make | strengthen |
| -ern | direction | eastern |
| -like | resembling | childlike |
| -wise | in the manner of | clockwise |
| -hood | state/condition | childhood |

**Algorithm outline:**
```
function decomposeMorphemes(word):
  1. Check if word is in exceptions dictionary (irregular forms)
  2. Try to strip known prefixes (longest match first)
  3. Try to strip known suffixes (longest match first)
  4. Verify the remaining stem is a valid root (check against word list)
  5. If stem is not valid, try alternative decompositions
  6. Return: { prefix?, root, suffix? }
```

**Strengths:** Fast, predictable, no ML dependencies, small bundle size
**Weaknesses:** Cannot handle complex cases (e.g., "unbelievable" = un+believe+able requires knowing "believ" → "believe"); misses Latin/Greek roots

### 3.2 Dictionary/Lookup-Based Approach

**How it works:** Pre-compute morpheme decompositions for a large word list and store as a lookup table.

**Available Databases:**

**MorphoLex (Free, Academic):**
- Database of morphological information for ~70,000 English words
- Provides: morpheme count, morpheme list, morpheme type, frequency data
- Based on CELEX and English Lexicon Project data
- **License:** Academic use; would need to verify for commercial use
- **Format:** CSV/Excel, convertible to JSON

**CELEX2:**
- Comprehensive morphological database for English, Dutch, German
- Contains detailed morphological decompositions
- **License:** Restricted (requires license from Max Planck Institute)
- Not suitable for open-source redistribution

**English Lexicon Project (ELP):**
- 40,000+ words with morphological information
- Free and publicly available
- Contains: morpheme count, decomposition for many entries

**CMU Pronouncing Dictionary:**
- 134,000+ words with phonetic transcriptions
- **License:** Free (BSD-like)
- No morpheme data but excellent for syllable boundary inference
- Phoneme sequences can be mapped to syllable boundaries

**Approach:** Combine multiple free databases into a comprehensive lookup:
```
{
  "unhappiness": {
    "morphemes": ["un", "happi", "ness"],
    "types": ["prefix", "root", "suffix"],
    "syllables": ["un", "hap", "pi", "ness"],
    "root_meaning": "feeling pleasure or contentment"
  }
}
```

**Bundle size concern:** A 70,000-word dictionary in compressed JSON ≈ 500KB-2MB. Acceptable for a browser extension with lazy loading.

### 3.3 Hybrid Approach (Recommended)

**Combine rule-based + dictionary lookup:**

1. **Tier 1 — Dictionary lookup** (~5,000 most common words): Precomputed, hand-verified morpheme decompositions. Instant, 100% accurate for covered words. These cover ~80% of running text.

2. **Tier 2 — Rule-based parsing** (for words not in dictionary): Apply prefix/suffix stripping rules with a root word validation step. Covers another ~15% of words with ~90% accuracy.

3. **Tier 3 — Syllable-only fallback** (for unknown words): Use Knuth-Liang hyphenation for syllable boundaries without morpheme analysis. Covers remaining ~5%.

**Combined accuracy estimate:** ~95%+ of words correctly decomposed.

---

## 4. Client-Side Performance Considerations

### 4.1 Processing Pipeline

```
Input Text → Tokenize → For each word:
  ├── Dictionary lookup (O(1) hash map)
  ├── Rule-based parse (O(n) where n = word length)
  ├── Syllable split via Knuth-Liang (O(n))
  └── Cache result
→ Apply visual formatting to DOM
```

### 4.2 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Initial page processing | < 100ms | Must feel instant |
| Per-word processing | < 0.1ms | Allows 10,000 words in 1 second |
| Memory overhead | < 5MB | Extension memory budget |
| Bundle size (core) | < 500KB | Fast extension load |
| Bundle size (dictionaries) | < 2MB | Lazy-loaded on first use |

### 4.3 Optimization Strategies

1. **Word-level caching:** Once a word is decomposed, cache the result. Most pages repeat the same words many times.
2. **Lazy processing:** Only process visible text (Intersection Observer API); process more as user scrolls.
3. **Web Workers:** Offload NLP processing to a Web Worker to avoid blocking the main thread.
4. **Compressed dictionary:** Use a trie or DAWG data structure for the morpheme dictionary — much smaller than a flat hash map.
5. **Progressive enhancement:** Show text immediately; apply morpheme/syllable formatting asynchronously.

---

## 5. DOM Manipulation Strategy

### 5.1 The Challenge

Modifying web page text to add syllable spacing or morpheme highlighting requires wrapping text nodes in `<span>` elements. This has known pitfalls:
- Increases DOM node count significantly
- Can break CSS layouts, selectors, and JavaScript event handlers
- Fragile with SPAs (React, Vue, Angular) that re-render the DOM
- Shadow DOM components are inaccessible

### 5.2 Recommended Approach: Targeted Text Node Replacement

```
1. Walk the DOM tree (TreeWalker API)
2. Identify TEXT_NODE elements within readable content (p, li, h1-h6, td, span, etc.)
3. Skip: script, style, code, pre, input, textarea, [contenteditable], svg
4. For each text node:
   a. Tokenize into words
   b. Look up/compute morpheme+syllable data
   c. Replace text node with a DocumentFragment containing styled spans
5. Use MutationObserver to handle dynamic content changes
```

### 5.3 CSS Classes for Morpheme/Syllable Highlighting

```css
/* Syllable micro-kerning */
.mf-syl-break {
  letter-spacing: 0.08em; /* Micro-gap at syllable boundary */
}

/* Morpheme highlighting */
.mf-prefix { color: var(--mf-prefix-color, #6366f1); }
.mf-root   { font-weight: var(--mf-root-weight, 600); }
.mf-suffix { color: var(--mf-suffix-color, #059669); }

/* Syllable colorization (alternating) */
.mf-syl-a { color: var(--mf-syl-color-a, #1a1a2e); }
.mf-syl-b { color: var(--mf-syl-color-b, #6366f1); }
```

---

## 6. Text-to-Speech with Syllable Synchronization

### 6.1 Web Speech API (Built-in)

- **SpeechSynthesis API:** Available in all modern browsers
- **Boundary events:** `SpeechSynthesisUtterance.onboundary` fires at word boundaries
- **Limitation:** Only provides word-level boundaries, NOT syllable-level
- **Approach:** Use word boundaries from Web Speech API + pre-computed syllable timings to estimate syllable-level highlighting

### 6.2 Syllable-Level Sync Strategy

```
1. Use Web Speech API for TTS
2. Listen for 'boundary' events (word-level)
3. When a word starts speaking:
   a. Look up its syllable count
   b. Estimate syllable duration = word_duration / syllable_count
   c. Use setTimeout to highlight each syllable at estimated intervals
4. Adjust timing based on syllable complexity (consonant clusters take longer)
```

This is an approximation but would be a significant improvement over word-level-only highlighting.

### 6.3 Alternative: Pre-processed Audio with Forced Alignment

For higher accuracy, use forced alignment tools (e.g., Gentle, Montreal Forced Aligner) to pre-compute exact syllable timings for audio. This requires server-side processing and is better suited for curated content than arbitrary web text.

---

## 7. Technology Stack Recommendation

| Layer | Technology | License | Rationale |
|-------|-----------|---------|-----------|
| Extension framework | WebExtension API (Manifest V3) | Standard | Cross-browser (Chrome, Firefox, Edge) |
| Tokenization | compromise.js or custom | MIT | Lightweight, fast |
| Morpheme detection | Custom hybrid (dictionary + rules) | MIT (ours) | No existing library does this |
| Syllable splitting | hypher (Knuth-Liang) | BSD-3 | Proven algorithm, multilingual |
| POS tagging | compromise.js | MIT | Optional enhancement |
| TTS | Web Speech API | Built-in | No dependencies |
| DOM manipulation | Custom (TreeWalker + MutationObserver) | MIT (ours) | Performance-critical, must be custom |
| UI framework | Preact or Svelte | MIT | Small bundle for popup/settings |
| Storage | browser.storage.local | Built-in | Preferences, cache |

---

*This document is for internal technical research purposes only.*
*All recommended libraries use permissive open-source licenses (MIT/BSD).*
