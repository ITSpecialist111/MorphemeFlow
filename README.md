# MorphemeFlow

**The world's first universal screen overlay for dyslexia reading support.**

MorphemeFlow is an open-source desktop application that sits transparently on top of **any application** — browsers, Word, PDFs, Slack, email, IDEs — and transforms text using evidence-based techniques that help dyslexic readers decode words through meaning, not just sound.

> Like f.lux changes your screen's color temperature everywhere, MorphemeFlow changes how text appears everywhere.

---

## What Makes This One-of-a-Kind

No tool on the market combines these three capabilities, and **none** works universally across all applications:

### 1. Morpheme Highlighting
Automatically decomposes words into their meaningful parts — roots, prefixes, and suffixes — with color-coding.

```
The  un·success·ful  re·construct·ion  was  un·fortunate·ly  delay·ed
     ^^  ^^^^^^^  ^^^  ^^  ^^^^^^^^^  ^^^       ^^  ^^^^^^^^^  ^^
     pfx  root   sfx  pfx   root    sfx       pfx    root    sfx
```

**Why it works:** Research shows dyslexic readers have intact morphological processing. Morpheme awareness bypasses the phonological deficit — the core challenge in dyslexia (Carlisle 2000, Bowers et al. 2010).

### 2. Syllable Micro-Kerning
Adds subtle, barely-perceptible spacing at syllable boundaries. Not visible dots or hyphens — just fractional spacing that reduces visual crowding.

**Why it works:** Extra letter spacing significantly improves reading in dyslexia (Zorzi et al. 2012, PNAS). Our approach applies spacing intelligently at syllable boundaries rather than uniformly.

### 3. Adaptive Reading Environment
Research-backed typography: optimized fonts, letter/word spacing, line height, background colors, and a reading ruler.

**Why it works:** Warm cream backgrounds, 0.07-0.12em letter spacing, and fonts like Lexend (designed to reduce visual stress) all have evidence supporting their use.

---

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  Your normal application (browser, Word, Slack...)   │
│                                                       │
│  "The unsuccessful reconstruction was delayed"       │
│                        ▲                              │
│                        │  transparent overlay         │
│  ┌─────────────────────┴─────────────────────────┐  │
│  │  MorphemeFlow overlay (click-through)          │  │
│  │  "The [un][success][ful] [re][construct][ion]" │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

1. **Text Detection** — Reads text from any application using Windows UI Automation API with multiple extraction strategies:
   - **TextPattern** with `GetVisibleRanges()` for rich text (Word, VS Code)
   - **ValuePattern** for edit controls
   - **LegacyIAccessible** for legacy apps
   - **CurrentName** for standard UI elements
   - OCR fallback for custom-rendered content
2. **Morpheme Analysis** — 37,215-entry MorphoLex dictionary + rule-based affix stripping (26 prefixes, 30 suffixes, 800+ roots) + Knuth-Liang syllable fallback
3. **Overlay Rendering** — Opaque background covers + morpheme-colored text on a transparent, always-on-top, click-through canvas
4. **Toggle with hotkey** — Ctrl+Shift+M to toggle on/off

## Current Status

| Component | Status | Details |
|-----------|--------|---------|
| **Morpheme Engine** | **Complete** | 41/41 tests passing, 37K MorphoLex dictionary, 3-tier analysis |
| **Desktop Overlay** | **Working** | Transparent click-through window, canvas renderer, system tray |
| **Text Detection** | **Working** | UIA with TextPattern, ValuePattern, LegacyIAccessible, tree walking |
| **Tested Apps** | **Working** | Word, Chrome (BBC, Wikipedia, GitHub), VS Code |
| **Settings UI** | **Basic** | Presets (subtle/balanced/full), hotkey toggle |

## Architecture

```
packages/
  engine/     # Pure TypeScript morpheme engine (shared)
  overlay/    # Tauri v2 desktop overlay (Rust + WebView)
```

- **Primary:** Tauri v2 desktop app — transparent overlay, works everywhere
- **Shared:** Pure TypeScript morpheme engine

## Features

| Feature | Description | Evidence |
|---------|-------------|----------|
| Morpheme highlighting | Color-coded prefix/root/suffix decomposition | Strong (meta-analyses: Bowers 2010, Goodwin 2010) |
| Syllable micro-kerning | Subtle spacing at syllable boundaries | Strong (Zorzi 2012, PNAS) |
| Dyslexia-optimized fonts | Lexend, Atkinson Hyperlegible, OpenDyslexic | Moderate-Strong |
| Letter/word spacing | Configurable 0-0.2em | Strong (Zorzi 2012) |
| Background themes | Warm cream, pale blue, peach, soft green, dark | Moderate |
| Reading ruler | Focus window, highlight band, or underline guide | Moderate |
| Text-to-speech | Web Speech API with word-level highlighting | Strong |
| Presets | Subtle, Balanced, Full — one-click configuration | UDL framework |

## Privacy

**Zero network requests.** Everything runs locally on your device. No data is collected, no accounts required, no cloud processing. Your reading habits stay private.

## Getting Started

### Prerequisites
- Node.js 18+
- Rust toolchain (for Tauri overlay)
- Windows 10/11 (macOS/Linux support planned)

### Development
```bash
# Install dependencies
npm install

# Run tests (engine)
npm test

# Build engine
npm run build:engine

# Start overlay (requires Rust)
npm run dev:overlay
```

### Running the Overlay
```bash
# Start the Tauri dev server + overlay
cd packages/overlay
npx tauri dev

# Or from the repo root
npm run dev:overlay
```

Toggle the overlay with **Ctrl+Shift+M**. Right-click the system tray icon for settings/quit.

### Capture & Debug Tool
```bash
# Capture text regions from a specific window (for debugging)
cd packages/overlay/src-tauri
cargo run --bin capture_regions -- "Word"     # captures from Word
cargo run --bin capture_regions -- "Chrome"   # captures from Chrome
cargo run --bin capture_regions               # captures from frontmost window
```

Saves JSON to `test/fixtures/captured-regions.json` for analysis.

## How It Compares

| | Bionic Reading | Helperbird | Immersive Reader | **MorphemeFlow** |
|---|---|---|---|---|
| **Scope** | Browser only | Browser only | Microsoft apps | **Any application** |
| **Approach** | Positional bolding | Feature bundle | Extract & re-render | **Linguistic overlay** |
| **Evidence** | None | None | Partial | **Strong** |
| **Morphemes** | No | No | No | **Yes** |
| **Works in Word?** | No | No | Yes (MS only) | **Yes** |
| **Works in Slack?** | No | Partial | No | **Yes** |
| **Open source** | No | No | No | **Yes** |
| **Privacy** | API calls | Cloud | Cloud | **100% local** |
| **Price** | $3-5/mo | $7/mo | Free (MS) | **Free forever** |

## Research Foundation

Built on peer-reviewed research:
- **Morphological awareness:** Carlisle (2000), Bowers et al. (2010), Goodwin & Ahn (2010)
- **Letter spacing:** Zorzi et al. (2012, PNAS)
- **Grain size theory:** Ziegler & Goswami (2005)
- **Dual-route model:** Coltheart et al. (2001)
- **Multimodal learning:** Mayer (2001), Paivio (1971)
- **UDL framework:** Rose & Meyer (CAST)

See `research/` directory for full research synthesis.

## Copyright & Licensing

**MIT License** — fully open source, free forever.

All fonts are SIL OFL 1.1. All algorithms are original or public domain. No dependency on any proprietary system. Specifically:
- No Bionic Reading API/brand/algorithm
- No BeeLine Reader patented color gradient (US 9,396,167)
- Uses: Knuth-Liang (public domain), CMU dictionary (BSD), hypher (BSD-3), MorphoLex (CC-BY)

## Contributing

Contributions welcome! This is a tool that can genuinely help millions of people. See `ARCHITECTURE.md` for the full system design.

## Credits

Built with care for the 15-20% of the population with dyslexia.

---

*MorphemeFlow: Because reading support should work everywhere, not just in your browser.*
