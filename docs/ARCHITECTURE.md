# MorphemeFlow Architecture (v2)

## Overview

MorphemeFlow is one product suite with two local surfaces for dyslexia reading support:

1. **Reader (Windows desktop app)** — Tauri 2.x + Rust engine; universal selection capture, screen-region OCR, paste, reflow, TTS, and ruler
2. **Web (MV3 browser extension)** — semantic DOM transformation using the TypeScript engine
3. **Engines (Rust + TypeScript)** — equivalent three-tier analysis contracts backed by shared fixtures

All processing is local. No network requests. No telemetry.

The authoritative user promise and the definition of “universal” are in [PRODUCT-INTENT.md](PRODUCT-INTENT.md). The production architecture does not use the archived DXGI/UIA glyph-overlay experiment.

## System Diagram

```
┌─────────────────────────────────────────────────┐
│                  Reader Window                   │
│  ┌─────────────────────────────────────────────┐ │
│  │          WebView (HTML/CSS/JS)              │ │
│  │  - Morpheme-highlighted text display        │ │
│  │  - Theme/font/spacing controls              │ │
│  │  - TTS with word-level highlighting         │ │
│  │  - Reading ruler                            │ │
│  └─────────────┬───────────────────────────────┘ │
│                │ invoke() / events                │
│  ┌─────────────┴───────────────────────────────┐ │
│  │           Tauri Rust Backend                │ │
│  │  - analyze_text command                     │ │
│  │  - Selection capture (Ctrl+C pipeline)      │ │
│  │  - OCR snap (BitBlt + Windows.Media.Ocr)    │ │
│  │  - Global shortcuts (Ctrl+Shift+M/R)        │ │
│  │  - Settings persistence (tauri-plugin-store)│ │
│  │  - System tray + crash logging              │ │
│  └─────────────┬───────────────────────────────┘ │
│                │                                  │
│  ┌─────────────┴───────────────────────────────┐ │
│  │            Engine Crate                     │ │
│  │  - 3-tier morpheme analysis                 │ │
│  │  - 37k-entry dictionary (compact binary)    │ │
│  │  - Rule-based affix stripping               │ │
│  │  - Rule-based syllable fallback             │ │
│  │  - LRU word cache (5k entries)              │ │
│  │  - Tokenizer (word/whitespace/punct/number) │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Engine: 3-Tier Analysis

1. **Dictionary lookup** (Tier 1): 37,000+ entries with morpheme decompositions, types, and meanings. Compact binary format, lazy-decoded.
2. **Rule-based parsing** (Tier 2): Prefix/suffix stripping with validation against known roots. Handles common English affixes (un-, re-, -ing, -tion, -ness, etc.).
3. **Syllable fallback** (Tier 3): visible syllable segmentation for words not found by the first two tiers.

The TypeScript engine uses Hypher's Knuth-Liang implementation. The current Rust engine uses a deterministic vowel/consonant fallback; deeper boundary parity remains planned. Both engines project normalized linguistic segments back onto the exact source spelling, including case, apostrophes, and hyphens. Rendering must satisfy `segments.join("") === source`.

## Text Capture Pipelines

### Selection Capture (Ctrl+Shift+M)
1. Enumerate every clipboard format and duplicate each handle with Windows `OleDuplicateData` (all formats, not only text)
2. Synthesize Ctrl+C via Win32 `SendInput`
3. Poll the clipboard sequence number for up to 650ms while the foreground app responds
4. Read Unicode text with contention retries
5. Restore and flush every original clipboard format, including on empty capture or error
6. Emit `selection-captured` event to WebView

### OCR Snap (Ctrl+Shift+R)
1. A hidden, transparent Tauri window is positioned over the monitor under the pointer
2. The user draws a rectangle; CSS coordinates are converted with that monitor's scale factor
3. The selector hides before capture so it cannot contaminate the image
4. `BitBlt` captures the physical screen rectangle
5. Dimensions are checked against `OcrEngine.MaxImageDimension`; pixels are converted to `SoftwareBitmap` (BGRA8)
6. `Windows.Media.Ocr.OcrEngine.RecognizeAsync` runs locally
7. The main Reader appears and receives recognized text through `selection-captured`

### Browser DOM Pipeline
1. Prefer `main`, `article`, `[role=main]`, and article-body roots; otherwise scan prose containers only
2. Skip navigation, forms, editable controls, code, SVG, hidden content, MathJax, and already processed nodes
3. Tokenize each text node and analyze words through the local TypeScript engine/cache
4. Replace only the text node with exact-text wrappers containing morpheme spans and zero-text syllable gaps
5. Debounced mutation processing handles dynamic pages; nested roots are deduplicated and each batch is bounded
6. Disable/remove restores exact original text; copy produces original plaintext

## File Layout

```
crates/engine/          # Shared Rust engine
  src/analyzer.rs       # 3-tier morpheme analysis
  src/tokenizer.rs      # Unicode-aware tokenizer
  src/cache.rs          # LRU word cache
  src/analyzer.rs       # Also contains current syllable fallback + surface alignment

apps/reader-windows/    # Tauri desktop app
  src-tauri/src/lib.rs  # Tauri commands + app setup
  src-tauri/src/capture.rs  # Clipboard capture
  src-tauri/src/ocr.rs      # Screen OCR
  ui/                   # Frontend (HTML/CSS/JS)

packages/engine-ts/     # Browser TypeScript engine + 221 tests
packages/web/           # MV3 extension + DOM regression tests

data/test-fixtures/     # Shared test fixtures (Rust + TS parity)
```

## Privacy Invariants

- Zero network requests (no auto-updater, no telemetry, no analytics)
- All processing on-device
- Clipboard contents restored after every capture
- Analysis and rendering preserve the exact source character sequence
- Settings stored locally only (`%APPDATA%\MorphemeFlow\`)
- Logs stored locally, rotated, never transmitted

## Performance Budgets

| Surface | Target |
|---|---|
| Reader cold start | < 800ms |
| Selection capture | < 250ms |
| OCR snap (600x300) | < 600ms |
| Engine analysis (1000 words) | < 50ms |
| Installer size | < 25MB |
