# CLAUDE.md — MorphemeFlow Development Guide

## Project Overview
MorphemeFlow delivers **morpheme highlighting, syllable micro-kerning, and adaptive typography** for dyslexia reading support.

- **MorphemeFlow Reader** — Native Windows app (Tauri 2.x + Rust). Captures text from any application via clipboard or OCR, reflows it with morpheme highlighting, TTS, and reading ruler.
- **MorphemeFlow Web** — MV3 browser extension. Enhances semantic reading content in place and preserves original DOM text.
- **Rust Engine** — Shared morpheme analysis, tokenization, syllable splitting, word cache.

## Architecture
- **Engine:** `crates/engine/` — 3-tier morpheme analysis (dictionary, rule-based, syllable fallback), tokenizer, LRU cache.
- **Reader App:** `apps/reader-windows/` — Tauri 2.x with WebView frontend, Rust backend for text analysis, clipboard capture, OCR.
- **Web Extension:** `packages/web/` with the TypeScript engine in `packages/engine-ts/`.
- **Product intent:** `docs/PRODUCT-INTENT.md` is authoritative. A literal cross-application glyph overlay is explicitly out of scope; see the post-mortem.

## Commands
```bash
# Typecheck, lint, and test TypeScript surfaces
npm run typecheck
npm run lint
npm test

# Build TypeScript engine + browser extension
npm run build

# Check and test Rust workspace (24 engine tests total: 22 unit + 2 integration)
cargo check --workspace
cargo test --workspace

# Run Reader in dev mode
npm run dev:reader

# Build installer (MSI + NSIS)
npm run build:reader
```

## Project Structure
```text
Dyslexia-Solution/
├── crates/engine/                   # Rust morpheme engine
│   ├── src/analyzer.rs              # 3-tier analysis + rule-based syllable fallback
│   ├── src/tokenizer.rs             # Unicode-aware tokenizer
│   └── src/cache.rs                 # LRU word cache
├── apps/reader-windows/             # Tauri 2.x desktop app
│   ├── src-tauri/src/lib.rs         # Tauri commands, tray, shortcuts
│   ├── src-tauri/src/capture.rs     # Clipboard-based text capture
│   ├── src-tauri/src/ocr.rs         # Screen OCR (Windows.Media.Ocr)
│   └── ui/                          # Frontend (HTML/CSS/JS)
├── packages/engine-ts/              # TypeScript engine (Hypher/Knuth-Liang)
├── packages/web/                    # Browser extension (MV3)
├── data/test-fixtures/              # Shared test fixtures
├── public/fonts/                    # Bundled fonts (Lexend, Atkinson, OpenDyslexic)
├── research/                        # Research synthesis & typography studies
├── docs/                            # Architecture, user guides, privacy
└── experiments/                     # Archived experiments
```

## Key Principles
- All fonts must be SIL OFL 1.1 or similarly permissive
- Never copy Bionic Reading's approach — our method is linguistically meaningful
- Accessibility first: WCAG 2.1 AA minimum
- Privacy: zero network requests, all processing client-side
- Reader installer <25MB

## Copyright Safety
- NO Bionic Reading API/brand/algorithm
- NO BeeLine Reader color gradient (patented US 9,396,167)
- Using: Knuth-Liang (public domain), CMU dictionary (BSD), MorphoLex (CC-BY)
- Fonts: Lexend, Atkinson Hyperlegible, OpenDyslexic (all SIL OFL 1.1)

## Research References
See `research/` for research synthesis and typography studies.
See `docs/ARCHITECTURE.md` for the v2 system design.
