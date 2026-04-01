# MorphemeFlow: Research Synthesis & Master Plan
## A Novel, Copyright-Free Dyslexia Reading Tool

---

## Executive Summary

**MorphemeFlow** is a browser extension (and future web app) that combines three evidence-based dyslexia interventions into a single, automated tool — something no existing product does:

1. **Morpheme Highlighting** — Automatically parse words into roots, prefixes, and suffixes, then visually distinguish them (our primary differentiator)
2. **Syllable Micro-Kerning** — Add fractional spacing between syllables without breaking word shape (elegant, adult-friendly)
3. **Adaptive Typography** — Research-backed font, spacing, color, and reading ruler system with full user customization

This combination is **entirely novel**. Individual pieces exist; nobody has combined them into a single consumer tool.

---

## Part 1: The Science

### 1.1 Why Morphemes Matter for Dyslexia

Morphological awareness — the ability to recognize word parts (roots, prefixes, suffixes) — is one of the strongest compensatory strategies for dyslexic readers.

**Key findings:**
- Dyslexic readers who develop strong morphological awareness compensate significantly for their phonological weaknesses
- Morphological training improves: word reading accuracy, vocabulary, spelling, and reading comprehension
- Unlike phonological interventions (which target the core deficit), morphological approaches leverage a *strength* — dyslexic readers often have strong semantic/meaning-based processing
- Morphology is currently taught manually by specialists. No mainstream tech tool automates this.

**Our approach:** Automatically highlight morphemes in real-time as users read web content. Roots get one visual treatment, prefixes another, suffixes another. This turns passive reading into active morphological processing without any conscious effort.

### 1.2 The Crowding Effect & Spacing

The "crowding effect" is a perceptual phenomenon where nearby visual elements interfere with each other's recognition. Dyslexic readers are significantly more susceptible.

**Key research:**
- Zorzi et al. (2012, PNAS): Extra letter spacing improved reading speed by ~20% in dyslexic children
- Perea et al. (2012): Increased spacing benefits dyslexic readers without hindering typical readers
- Lexend font research: 84% of 100,000+ test subjects showed improved reading fluency with optimized spacing

**Our approach:** Apply micro-kerning at syllable boundaries — not full hyphenation or splitting, but ~0.5-1px of additional space. Preserves word shape for fluent readers while reducing crowding at natural break points.

### 1.3 Color & Visual Stress

- 12-14% of the general population and up to 46% of dyslexic people experience visual stress (Meares-Irlen)
- Pure white backgrounds cause glare; warm cream/buff backgrounds reduce stress
- Optimal contrast: 10:1 to 15:1 (not maximum 21:1)
- Color preference is *highly individual* — tools must offer choices

### 1.4 Typography Research

**What actually helps (evidence-based):**
| Factor | Recommendation | Evidence Level |
|--------|---------------|----------------|
| Font | Lexend, Atkinson Hyperlegible, Verdana | Strong |
| Letter spacing | 0.07-0.12em | Strong (PNAS) |
| Word spacing | 0.16-0.25em | Moderate |
| Line height | 1.8 | Moderate |
| Line length | 55-65 characters | Moderate |
| Font size | 18px+ | Strong |
| Text alignment | Left only, never justify | Strong |
| Background | Warm cream (#FAF4EB) > pure white | Moderate |
| Text color | Soft black (#2D2D2D) > pure black | Moderate |
| Ligatures | Disable for dyslexic users | Weak/Preference |

**What doesn't help as much as claimed:**
- OpenDyslexic font: subjectively preferred but no measurable speed improvement in controlled studies
- Single "best" color: varies per individual

---

## Part 2: Competitive Landscape

### 2.1 What Exists

| Tool | Approach | Gap |
|------|----------|-----|
| **Bionic Reading** | Bolds first few letters of each word | Speed-focused, not comprehension. No morphological basis. Proprietary/trademarked. |
| **Helperbird** | Font swap, overlays, text-to-speech, dyslexia rulers | Feature-rich but passive (changes presentation, doesn't help decode) |
| **BeeLine Reader** | Color gradient across lines | Reduces line-jumping but doesn't help word decoding |
| **Microsoft Immersive Reader** | Syllable splitting, line focus, read-aloud | Has syllable feature but splits with visible dividers (not micro-kerning). Limited to Microsoft ecosystem |
| **LucidRead** | Open-source, strips distractions | Basic; no morpheme support |
| **OpenDyslexic Extension** | Font swap only | One-trick pony |
| **Apple Reader Mode** | Strips distractions, adjustable font/bg | Passive presentation only |

### 2.2 The Gap We Fill

**No existing tool does ALL of:**
1. Automatic morpheme detection and highlighting on arbitrary web text
2. Syllable-aware micro-kerning (not visible splitting)
3. Research-backed adaptive typography (not just font swap)
4. Reading ruler with color tint options
5. All in a single, cohesive browser extension

Our **primary differentiator** is #1 — morpheme highlighting. This is the "Bionic Reading moment" for comprehension rather than speed. Everything else is table stakes that makes the tool complete.

### 2.3 Copyright/Patent Analysis

**What we must avoid:**
- Bionic Reading's specific method (bolding first N letters) is trademarked under "Bionic Reading"
- We are NOT using their method — our approach is fundamentally different (morphological parsing vs. arbitrary letter bolding)

**What we freely use:**
- Morphological analysis is publicly available linguistic science
- Syllabification algorithms (Liang's TeX algorithm) are open-source (public domain/MIT)
- Typography CSS is standard web technology
- All fonts we use are SIL OFL 1.1 licensed (free for commercial use)
- Color overlay research is published academic work
- Reading ruler is a common accessibility pattern with no IP restrictions

**Our approach is legally distinct** because:
- Bionic Reading bolds arbitrary letter counts. We highlight semantically meaningful word parts (morphemes).
- Our method is based on linguistic morphology, not arbitrary visual manipulation.
- We use different visual treatments (color/underline vs. bold).

---

## Part 3: Technical Architecture

### 3.1 Morpheme Detection — How It Actually Works

**Approach: Hybrid dictionary + algorithmic**

1. **Pre-built morpheme dictionary** (~50,000 most common English words)
   - Source: MorphoLex database (CC BY-NC-SA) or build our own from public linguistic data
   - Format: `{ "unhappiness": { prefix: "un", root: "happi", suffix: "ness" } }`
   - Stored as compressed JSON, loaded once (~200KB gzipped)

2. **Algorithmic fallback** for unknown words
   - Strip known prefixes: un-, re-, pre-, dis-, mis-, over-, under-, etc. (~80 common prefixes)
   - Strip known suffixes: -ing, -tion, -ness, -ment, -able, -ful, etc. (~100 common suffixes)
   - What remains is treated as the root
   - Accuracy: ~85% for common English words

3. **Syllabification engine**
   - Use Liang's hyphenation algorithm (same as TeX/LaTeX)
   - JavaScript implementation: `hypher` or `hyphenation` npm packages (MIT license)
   - Accuracy: ~98% for standard English

### 3.2 Browser Extension Architecture

```
morphemeflow/
├── manifest.json          (MV3 Chrome extension manifest)
├── src/
│   ├── background/
│   │   └── service-worker.ts   (Extension lifecycle, settings sync)
│   ├── content/
│   │   ├── content-script.ts   (Main DOM processing entry point)
│   │   ├── morpheme-engine.ts  (Morpheme detection logic)
│   │   ├── syllable-engine.ts  (Syllable splitting logic)
│   │   ├── text-processor.ts   (Walks DOM, applies transformations)
│   │   ├── reading-ruler.ts    (Interactive reading ruler)
│   │   └── styles.css          (Injected styles)
│   ├── popup/
│   │   ├── popup.html          (Extension popup UI)
│   │   ├── popup.ts            (Settings controls)
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html        (Full settings page)
│   │   └── options.ts
│   └── shared/
│       ├── morpheme-dict.json  (Compressed morpheme database)
│       ├── settings.ts         (Default settings, types)
│       └── constants.ts
├── fonts/                      (Bundled fonts: Lexend, OpenDyslexic, Atkinson)
├── tests/
├── package.json
└── tsconfig.json
```

### 3.3 DOM Processing Pipeline

```
Page Load / Mutation Observer
  → Walk text nodes (TreeWalker API)
  → For each text node:
    → Tokenize into words
    → For each word:
      → Look up in morpheme dictionary
      → If not found, apply algorithmic decomposition
      → If syllable mode enabled, run syllabification
      → Wrap word parts in <span> elements with appropriate classes
    → Replace original text node with processed fragment
  → Apply CSS for visual treatment
```

**Performance targets:**
- Initial page processing: < 200ms for typical page
- Incremental (mutation observer): < 50ms per batch
- Memory: < 10MB total (dictionary + extension)

### 3.4 Visual Treatment Options

**Morpheme highlighting modes:**

```css
/* Mode 1: Color coding (default) */
.mf-prefix { color: var(--mf-prefix-color, #6366F1); }  /* Indigo */
.mf-root   { color: var(--mf-root-color, #059669); font-weight: 500; }  /* Green, slightly bold */
.mf-suffix { color: var(--mf-suffix-color, #D97706); }  /* Amber */

/* Mode 2: Underline */
.mf-prefix { text-decoration: underline; text-decoration-color: var(--mf-prefix-color); }
.mf-root   { font-weight: 500; }
.mf-suffix { text-decoration: underline; text-decoration-color: var(--mf-suffix-color); text-decoration-style: dotted; }

/* Mode 3: Background highlight */
.mf-prefix { background: var(--mf-prefix-bg, rgba(99, 102, 241, 0.1)); border-radius: 2px; }
.mf-root   { background: var(--mf-root-bg, rgba(5, 150, 105, 0.1)); border-radius: 2px; }
.mf-suffix { background: var(--mf-suffix-bg, rgba(217, 119, 6, 0.1)); border-radius: 2px; }

/* Mode 4: Subtle (root bold only) */
.mf-root   { font-weight: 600; }
.mf-prefix, .mf-suffix { opacity: 0.7; }
```

**Syllable micro-kerning:**
```css
.mf-syllable-break {
  letter-spacing: 0.04em;  /* Barely perceptible gap */
  /* Could also use word-spacing on injected zero-width spaces */
}
```

### 3.5 Settings & Customization

Users can configure:
- **Morpheme mode:** Off / Color / Underline / Background / Subtle
- **Syllable spacing:** Off / Light / Medium / Heavy
- **Font:** System default / Lexend / OpenDyslexic / Atkinson Hyperlegible
- **Font size scale:** 0.8x to 2.0x
- **Letter spacing:** 0 to 0.2em (slider)
- **Word spacing:** 0 to 0.35em (slider)
- **Line height:** 1.2 to 2.5 (slider)
- **Line length:** 40ch to 80ch (slider)
- **Background color:** 8 presets + custom picker
- **Text color:** 5 presets + custom picker
- **Reading ruler:** Off / Focus window / Highlight band / Underline
- **Ruler color:** 8 tint presets
- **Ruler height:** Adjustable
- **Preset profiles:** "Gentle", "Study Mode", "Focus", "Custom"

---

## Part 4: Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Working browser extension with morpheme highlighting on any webpage

1. Set up Chrome MV3 extension scaffold (TypeScript, Vite/Webpack)
2. Build morpheme dictionary from public linguistic data
3. Implement morpheme detection engine (dictionary + algorithmic fallback)
4. Implement DOM walker with MutationObserver
5. Basic popup UI with on/off toggle
6. Visual treatment: color-coded morpheme highlighting

**Deliverable:** Extension that color-codes morphemes on any webpage.

### Phase 2: Typography Engine (Week 2)
**Goal:** Full adaptive typography system

1. Bundle Lexend, OpenDyslexic, Atkinson Hyperlegible fonts
2. Build CSS injection system for typography overrides
3. Implement all typography controls (spacing, size, line height, etc.)
4. Color theme system with 8 presets
5. Settings page with real-time preview

**Deliverable:** Extension that transforms any page to be dyslexia-friendly.

### Phase 3: Reading Ruler & Syllables (Week 3)
**Goal:** Complete feature set

1. Implement reading ruler (3 modes)
2. Integrate syllabification engine (Liang's algorithm)
3. Implement syllable micro-kerning
4. Add preset profiles ("Gentle", "Study Mode", "Focus")
5. Performance optimization (lazy processing, virtual DOM diff)

**Deliverable:** Feature-complete extension.

### Phase 4: Polish & Ship (Week 4)
**Goal:** Production-ready release

1. Cross-browser testing (Chrome, Edge, Firefox)
2. Performance profiling and optimization
3. Accessibility audit (WCAG 2.1 AA compliance)
4. Chrome Web Store listing and assets
5. Landing page / website
6. Documentation

**Deliverable:** Published extension on Chrome Web Store.

---

## Part 5: gstack Methodology Application

Following gstack's ETHOS for this project:

### "Boil the Lake"
- Full morpheme dictionary coverage for top 50K words
- All typography controls from the research
- All 3 reading ruler modes
- 8 color presets matching research
- Complete test coverage

### "Search Before Building"
- **Layer 1 (Tried & True):** Chrome MV3 extension architecture, MutationObserver, CSS custom properties
- **Layer 2 (New & Popular):** TypeScript, Vite for build, variable fonts
- **Layer 3 (First Principles):** Morpheme-based highlighting is our eureka moment — nobody has packaged linguistic morphology into an automatic consumer tool

### "User Sovereignty"
- Every feature is configurable
- Presets for quick start, sliders for fine-tuning
- Nothing is forced — user controls all visual treatments

---

## Part 6: Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript | Type safety, IDE support |
| Build | Vite + CRXJS | Fast builds, MV3 support |
| Extension | Chrome MV3 | Modern standard, service workers |
| Fonts | Lexend + OpenDyslexic + Atkinson | SIL OFL, research-backed |
| Morphemes | Custom dictionary + algorithm | No dependency lock-in |
| Syllables | Hypher (MIT) | Liang's algorithm, proven |
| UI | Vanilla TS + CSS | Minimal bundle, fast |
| Testing | Vitest | Fast, TypeScript-native |

---

## Part 7: What Makes This Novel

### The "11 out of 10" Eureka Moment (gstack Layer 3)

Everyone in the dyslexia tech space is focused on *presentation* (change the font, change the color, add an overlay). Bionic Reading went one step further by modifying the *text itself* — but their modification is arbitrary (not linguistically meaningful).

**Our insight:** Instead of arbitrary visual manipulation, use real linguistic structure. Morphemes are the natural building blocks of meaning. Dyslexic readers already rely on morphological processing as a compensatory strategy. By *visually exposing* the morphological structure that's hidden in printed text, we're not just making text "easier to look at" — we're making it **easier to decode at a fundamental cognitive level**.

This is the difference between:
- **Bionic Reading:** "**Un**happiness" (arbitrary bold)
- **MorphemeFlow:** "<prefix>un</prefix><root>happi</root><suffix>ness</suffix>" (meaningful structure)

The user doesn't just see the text differently — they *understand* it differently. That's the breakthrough.

---

*Research compiled: March 2026*
*Status: Ready for implementation*
