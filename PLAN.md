# MorphemeFlow — Implementation Plan

**Methodology:** gstack (Think → Plan → Build → Review → Test → Ship → Reflect)
**License:** MIT
**Status:** PLAN PHASE — Ready for review

---

## Sprint 0: Project Setup & Foundation (Current)

### 0.1 Research (DONE)
- [x] Competitive analysis of 10 existing tools
- [x] Typography & color science research
- [x] Dyslexia science foundations
- [x] NLP technical approaches research
- [x] gstack methodology review
- [x] Architecture design

### 0.2 Project Scaffolding
- [ ] Initialize git repository
- [ ] Set up project structure (see below)
- [ ] Install gstack skills (`git clone` into `.claude/skills/`)
- [ ] Create CLAUDE.md with project context
- [ ] Set up package.json with build tooling
- [ ] Configure Manifest V3 extension skeleton
- [ ] Set up TypeScript + build pipeline (esbuild or Vite)
- [ ] Create basic extension that loads on any page (hello world)

### Target File Structure
```
morphemeflow/
├── .claude/
│   └── skills/
│       └── gstack/           # gstack methodology
├── CLAUDE.md                  # Project context for Claude
├── ARCHITECTURE.md            # This document
├── README.md                  # Public-facing docs
├── LICENSE                    # MIT
├── package.json
├── tsconfig.json
├── vite.config.ts             # Build configuration
│
├── src/
│   ├── manifest.json          # Extension manifest (V3)
│   │
│   ├── background/
│   │   └── service-worker.ts  # Extension lifecycle
│   │
│   ├── content/
│   │   ├── index.ts           # Content script entry
│   │   ├── dom-scanner.ts     # TreeWalker + text node finding
│   │   ├── dom-modifier.ts    # Apply visual changes to DOM
│   │   ├── observer.ts        # MutationObserver for dynamic content
│   │   └── styles.css         # Injected styles
│   │
│   ├── engine/
│   │   ├── tokenizer.ts       # Word tokenization
│   │   ├── morpheme-analyzer.ts  # Hybrid morpheme detection
│   │   ├── syllable-splitter.ts  # Knuth-Liang wrapper
│   │   ├── word-cache.ts      # LRU cache for analysis results
│   │   └── types.ts           # Shared type definitions
│   │
│   ├── data/
│   │   ├── morpheme-dictionary.json  # Top 5K words, pre-analyzed
│   │   ├── prefix-rules.ts    # Prefix pattern definitions
│   │   ├── suffix-rules.ts    # Suffix pattern definitions
│   │   └── root-validator.ts  # Root word validation
│   │
│   ├── features/
│   │   ├── morpheme-highlight.ts  # Morpheme color coding
│   │   ├── syllable-spacing.ts    # Micro-kerning
│   │   ├── reading-env.ts         # Typography/color adjustments
│   │   ├── reading-ruler.ts       # Line focus guide
│   │   └── tts.ts                 # Text-to-speech
│   │
│   ├── popup/
│   │   ├── index.html         # Extension popup
│   │   ├── popup.ts           # Popup logic
│   │   └── popup.css          # Popup styles
│   │
│   └── shared/
│       ├── settings.ts        # Settings management
│       ├── messages.ts        # Message passing types
│       └── constants.ts       # Shared constants
│
├── data/
│   └── build-dictionary.ts    # Script to build morpheme dictionary
│
├── test/
│   ├── engine/
│   │   ├── morpheme-analyzer.test.ts
│   │   ├── syllable-splitter.test.ts
│   │   └── tokenizer.test.ts
│   ├── features/
│   │   └── morpheme-highlight.test.ts
│   └── fixtures/
│       └── sample-texts.ts    # Test text samples
│
└── research/                  # Existing research docs
    ├── competitive-analysis.md
    ├── typography-and-dyslexia-research.md
    ├── dyslexia-science-foundations.md
    └── nlp-technical-approaches.md
```

---

## Sprint 1: Core Engine (The Brain)

**Goal:** Build the text processing engine that can analyze any English word.

### 1.1 Tokenizer
- Build word tokenizer that preserves whitespace and punctuation
- Handle contractions, hyphenated words, numbers, URLs
- Output: array of tokens with type (word, punctuation, whitespace)

### 1.2 Morpheme Analyzer
- Build morpheme dictionary (top 5,000 English words, hand-verified decompositions)
- Implement prefix stripping (26 common prefixes)
- Implement suffix stripping (30 common suffixes)
- Implement root validation (check stripped root against word list)
- Handle edge cases: double affixes (un-believ-able), stem changes (happi→happy)
- Target: >95% accuracy on common English text

### 1.3 Syllable Splitter
- Integrate hypher (Knuth-Liang algorithm) with English patterns
- Map hyphenation points to syllable boundaries
- Handle exceptions/corrections
- Target: >98% accuracy (Knuth-Liang baseline is 99%)

### 1.4 Word Cache
- LRU cache (10,000 entries)
- Persist top entries to extension storage for cross-page speed
- Cache hit rate target: >90% on typical web pages

### Deliverable
A standalone library that takes a string → returns `MorphemeResult[]` for each word. Fully testable without browser.

---

## Sprint 2: DOM Layer (The Eyes)

**Goal:** Take engine output and apply it to live web pages.

### 2.1 DOM Scanner
- TreeWalker-based text node discovery
- Target readable elements: p, h1-h6, li, td, th, blockquote, span, a, em, strong, label
- Skip: script, style, code, pre, input, textarea, [contenteditable], svg, noscript
- IntersectionObserver for viewport-only processing

### 2.2 DOM Modifier
- Replace text nodes with DocumentFragment containing styled spans
- Batch updates via requestAnimationFrame
- Preserve original text as data attribute (for clean undo)
- Handle text selection (ensure copy/paste gives original text)

### 2.3 Dynamic Content Observer
- MutationObserver for DOM changes (SPA navigation, AJAX content, infinite scroll)
- Debounced processing (don't re-process on every mutation)
- Handle React/Vue/Angular virtual DOM reconciliation

### 2.4 Undo/Reset
- One-click revert to original page state
- Store original text nodes for restoration
- Clean removal of all injected styles and spans

### Deliverable
Extension that can modify text on any webpage and revert cleanly.

---

## Sprint 3: Visual Features (The Style)

**Goal:** Implement the four core visual features.

### 3.1 Morpheme Highlighting
- Color coding: prefix (indigo), root (bold/dark), suffix (green)
- Customizable colors via CSS custom properties
- Intensity slider (subtle → vivid)
- Tooltip on hover showing morpheme meaning (optional)

### 3.2 Syllable Micro-Kerning
- Default: 0.08em extra spacing at syllable boundaries
- Intensity slider: 0 (off) → 0.04em (subtle) → 0.08em (default) → 0.2em (strong) → full split with dots
- Must not break word wrapping or line breaks

### 3.3 Reading Environment
- Font switcher: Lexend (default), Atkinson Hyperlegible, OpenDyslexic, System Default
- Font size: slider 14px-28px
- Letter spacing: slider 0-0.2em
- Word spacing: slider 0-0.35em
- Line height: slider 1.2-2.5
- Theme: Cream, Soft Yellow, Pale Blue, Peach, Soft Green, Dark Mode, Default
- Max line width: slider 45ch-100ch

### 3.4 Reading Ruler
- Focus window mode (dims above/below)
- Highlight band mode (colored stripe)
- Underline mode (simple guide line)
- Follows mouse Y position (configurable sensitivity)
- Keyboard control (arrow keys to move)
- Adjustable height and tint color

### Deliverable
All visual features working and configurable via popup UI.

---

## Sprint 4: TTS & Audio (The Voice)

**Goal:** Add text-to-speech with word-level highlighting.

### 4.1 Basic TTS
- Web Speech API integration
- Play/pause/stop controls
- Speed control (0.5x-2x)
- Voice selection (from available system voices)

### 4.2 Word-Level Sync
- Listen for SpeechSynthesis boundary events
- Highlight current word being spoken
- Auto-scroll to keep highlighted word visible

### 4.3 Syllable-Level Sync (Stretch goal for v1.0)
- Estimate syllable timing from word duration
- Highlight individual syllables during speech
- This is novel and may require iteration

### Deliverable
TTS that reads page content with synchronized word highlighting.

---

## Sprint 5: Polish & Ship (v0.1 MVP)

### 5.1 Popup UI
- Clean, accessible settings panel
- Preset buttons: Subtle, Balanced, Full
- Per-site settings override
- Quick toggle on/off

### 5.2 Performance Optimization
- Profile and optimize hot paths
- Ensure <100ms initial processing time
- Memory usage audit (<5MB)
- Test on heavy pages (Wikipedia, news sites, academic papers)

### 5.3 Cross-Browser Testing
- Chrome (primary)
- Firefox
- Edge
- Ensure Manifest V3 compatibility

### 5.4 Accessibility
- The extension itself must be accessible (keyboard navigation, screen reader compatible)
- High contrast mode for settings panel
- Respect prefers-reduced-motion

### 5.5 Documentation
- README with screenshots
- Contributing guide
- Feature documentation
- Privacy policy (we collect nothing)

### 5.6 Ship
- Chrome Web Store submission
- Firefox Add-ons submission
- GitHub release with source code
- Landing page (optional)

---

## Future Sprints (Post-MVP)

### Sprint 6: Adaptive Personalization (v1.0)
- Track which features user enables/adjusts
- A/B test feature combinations internally
- Suggest optimal settings based on usage patterns
- "Reading assessment" flow to determine optimal starting config

### Sprint 7: Multilingual Support
- Add hyphenation patterns for French, Spanish, German, Italian, Portuguese
- Language-specific morpheme rules
- Auto-detect page language
- Multilingual morpheme dictionaries

### Sprint 8: Advanced Features
- PDF support (via pdf.js integration)
- Epub reader mode
- Browser reading mode integration
- API for third-party integration
- Mobile companion (Android/iOS)

---

## Success Metrics

| Metric | Target (MVP) | Target (v1.0) |
|--------|-------------|----------------|
| Morpheme accuracy | >95% on common text | >97% |
| Processing speed | <100ms per page | <50ms |
| Memory usage | <5MB | <5MB |
| Extension size | <2MB | <3MB |
| Chrome Web Store rating | 4.0+ | 4.5+ |
| Weekly active users | 100 | 10,000 |
| Open source contributors | 5 | 20 |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| DOM manipulation breaks pages | High | Careful element targeting; "safe mode" auto-disable; per-site blacklist |
| Morpheme accuracy too low | Medium | Expand dictionary; user-reported corrections; fallback to syllable-only |
| Performance too slow on heavy pages | Medium | Viewport-only processing; Web Workers; aggressive caching |
| Copyright claim from Bionic Reading | Low | We use completely different technology (linguistic vs. positional); no brand similarity |
| Low adoption | Medium | Strong open-source community building; evidence-based positioning; education market outreach |

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Type safety, better tooling, industry standard |
| Build tool | Vite | Fast builds, good extension support via plugin |
| UI framework | Vanilla + CSS | Popup is simple enough; avoids framework overhead |
| Testing | Vitest | Fast, TypeScript-native, compatible with Vite |
| Syllable engine | hypher | Proven Knuth-Liang implementation, MIT-compatible |
| Tokenization | Custom | Small, tailored to our needs |
| Morpheme analysis | Custom hybrid | Nothing suitable exists |
| TTS | Web Speech API | Zero dependencies, built into browsers |
| Extension manifest | V3 | Required for Chrome; future-proof |

---

*Plan follows gstack methodology: Think (research) → Plan (this document) → Build → Review → Test → Ship → Reflect*
*Ready for `/plan-ceo-review` and `/plan-eng-review` when gstack is installed.*
