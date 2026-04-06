# MorphemeFlow (Project Periphery Architecture)

**The world's first hardware-accelerated, zero-latency screen overlay for dyslexia reading support across Windows 11.**

> **Notice:** The project has pivoted from a DOM/Tauri-based overlay to a native Windows Rust architecture using Direct3D and DXGI Desktop Duplication to achieve zero scrolling latency. The previous TypeScript/Tauri version is archived in the `legacy-v1` directory.

Project Periphery handles dyslexia overlays by bypassing the OS UI document paradigm completely. It tracks text on the screen using swap-chain frame buffers and optical flow, compositing micro-kerning and morphemic highlights directly above the desktop surface without waiting for UI events.

## 🚀 Architecture & Crates
- `crates/engine` — Rust morpheme analyzer (prefix/root/suffix splitting, punctuation-aware).
- `crates/compositor` — DXGI Desktop Duplication capture + move/dirty rect metadata + dirty-region GPU readback.
- `crates/overlay-daemon` — Runtime orchestration: capture loop, UIA semantic scan loop, anchor tracker, click-through Win32 overlay renderer.

## Current Native Build (April 6, 2026)

| Component | Status | Notes |
|---|---|---|
| DXGI capture pipeline | Working | Captures frames and metadata at runtime |
| Motion-aware tracking | Working | Move rect translation + dirty signature confidence |
| UIA text intake | Working | Foreground-window semantic region extraction |
| Overlay rendering | Working prototype | Morpheme-colored text rendering in transparent click-through window |
| Flicker mitigation | Improved | Double-buffered paint + redraw only when frame index changes |
| Automated matrix test harness | Working | Runs scripted app/web scenarios with screenshots + reports |

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

## How It Works (Current Prototype)

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

1. **Where loop (fast)** — DXGI Desktop Duplication captures frame metadata (move + dirty rects) and dirty-region readbacks.
2. **What loop (async)** — UIA scanner finds visible text-like regions in the active window (`text + rect`) and filters noise.
3. **Track loop (fusion)** — Anchors are matched/updated by text similarity, overlap, motion vectors, and dirty-signature stability.
4. **Render loop (real-time)** — A transparent always-on-top click-through Win32 window draws morpheme-colored overlay text.

## Current Status

| Component | Status | Details |
|-----------|--------|---------|
| **Morpheme Engine** | **Working prototype** | Heuristic prefix/root/suffix splitter in Rust (`crates/engine`) |
| **Desktop Overlay** | **Working** | Win32 transparent click-through overlay, double-buffered paint |
| **Text Detection** | **Working** | UIA subtree scan with filtering/merge/dedupe |
| **Tracking** | **Working** | Motion + confidence + dirty-signature persistence |
| **Automated Validation** | **Working** | `scripts/overlay-matrix-test.ps1` with multi-app/multi-site scenarios |
| **Legacy Stack** | **Archived** | Former TypeScript/Tauri build is in `legacy-v1/` |

Most recent matrix run:
- `test-results/overlay-matrix/20260406-184848/report.md` → PASS `6/6` scenarios, FAIL `0`.
- Jitter gate active: `visible_jitter <= 7`, `semantic_jitter <= 6`.

## Rendering Behavior

Default overlay mode now renders morpheme-colored text, not debug rectangles.

Color mapping:
- Prefix: amber
- Root: mint green
- Suffix: cool blue
- Unknown: neutral light gray

Debug options:
- `PERIPHERY_DEBUG_BOXES=1` shows anchor rectangles.
- `PERIPHERY_DEBUG_OVERLAY=1` shows telemetry text.

Both are off by default for a clean reading view.

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
- Rust toolchain (`rustup`, `cargo`)
- Windows 11 (current target platform)

### Running the Overlay
```bash
# From repo root
cargo run --bin overlay-daemon
```

### Build and Test
```bash
# Build all native crates
cargo build --workspace

# Run all Rust tests
cargo test --workspace
```

### Automated Multi-App/Web Test Harness
```bash
# Runs overlay-daemon against a scenario matrix of native apps + websites,
# performs scripted scrolling, captures screenshots, and writes reports.
powershell -ExecutionPolicy Bypass -File scripts/overlay-matrix-test.ps1
```

Jitter regression gate is enabled by default:
- `-MaxVisibleJitter` default `7.0`
- `-MaxSemanticJitter` default `6.0`
- `-DisableJitterGate` to run informational-only sampling

Outputs are written under:
`test-results/overlay-matrix/<timestamp>/`

Artifacts include:
- `report.json`
- `report.md`
- per-scenario screenshots
- overlay-daemon stdout/stderr logs

### Legacy TypeScript/Tauri Stack
The earlier implementation remains available in `legacy-v1/` for reference.

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
