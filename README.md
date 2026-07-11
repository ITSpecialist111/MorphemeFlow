# MorphemeFlow

**Morpheme highlighting, syllable micro-kerning, and adaptive typography to help people with dyslexia read.**

One product suite, two complementary surfaces:

- **MorphemeFlow Reader** — The universal Windows hub. Select text in almost any application or draw around text on screen; Reader reflows it with morpheme highlighting, syllable spacing, adaptive typography, a reading ruler, and local text-to-speech.
- **MorphemeFlow Web** — The optional high-fidelity browser surface (Chrome/Edge/Firefox). It enhances semantic reading content directly in the DOM while preserving the exact original text.

“Universal” means coverage of the reading journey, not an unreliable attempt to replace every glyph in another application's framebuffer. The archived DXGI/UIA experiment and its evidence are documented in [docs/POSTMORTEM-OVERLAY.md](docs/POSTMORTEM-OVERLAY.md). The authoritative product direction is [docs/PRODUCT-INTENT.md](docs/PRODUCT-INTENT.md).

---

## Project verdict

**The original literal Windows-wide text overlay did not work. The product goal does work through the Reader plus browser-extension architecture.** The current result is a validated beta, not yet a fully hardened public release.

### What failed

The archived DXGI/UI Automation experiment could produce a stable overlay, but it could not reliably transform the text a person was actually reading:

- Windows UI Automation exposes controls and coarse rectangles, not dependable per-glyph layout, source fonts, or semantic “main reading content.”
- The overlay highlighted UI chrome such as dialogs and status bars while missing article and document body text.
- Windows provides no general way for an external process to hide or replace another application's original glyphs without blocking interaction.
- UI Automation scans and application scrolling could not remain synchronized at frame rate.
- The original harness measured anchor stability rather than whether the correct content was enhanced.

These are platform constraints, not defects that can be solved by adding more overlay heuristics. That implementation is retained only as a documented experiment under `experiments/zero-latency-overlay/`.

### What works now

| Reading context | Working approach | Validation status |
|---|---|---|
| Selectable text in native apps, browsers, editors, and PDF viewers | Reader records the source window, preserves every clipboard format, issues Copy, restores the clipboard, then reflows the captured text | Verified end to end with foreground Notepad text and plain/rich clipboard data |
| Images, scanned PDFs, games, and inaccessible controls | Reader displays a temporary per-monitor rectangle selector and runs local `Windows.Media.Ocr` after hiding itself | Verified with an exact controlled Segoe UI target; source quality still affects accuracy |
| Standard web articles and web applications | MV3 extension transforms semantic DOM/prose content in place while skipping navigation, forms, editors, code, and hidden UI | Engine and DOM regression tests pass; full real-site browser matrix remains |
| Pasted or typed text | Reader analyzes locally and renders morpheme colour, syllable spacing, adaptive typography, ruler, and speech | Implemented and visually/runtime validated |

The key safety rule is now enforced in both engines: **analysis may add styling and zero-text spacing, but it must never change the original character sequence.** Case, punctuation, apostrophes, hyphens, and spelling changes are projected back onto the exact source text.

### What the investigation found

1. Universal **coverage** is achievable; universal external glyph replacement is not available through current Windows APIs.
2. Context-specific sources are reliable: DOM for web content, Copy for selectable native text, and OCR for pixels.
3. Correct-content evidence matters more than a stable performance metric. Tests must verify the intended sentence or article, not merely that an overlay remained still.
4. Clipboard preservation must include HTML, images, and custom formats—not only plain text—and capture must remain pinned to the window active when the shortcut fired.
5. The repository already contained useful engine and extension work, but its user journeys, status documents, validation, and release tooling needed to be connected and corrected.

### Evidence so far

- **225 JavaScript tests:** 221 TypeScript engine tests and 4 browser DOM tests.
- **24 Rust tests:** 22 unit tests and 2 shared-fixture integration tests.
- npm audit, ESLint, strict TypeScript, rustfmt, strict Clippy, Cargo tests/checks, extension builds, and Reader release builds pass.
- A successful capture restored Unicode text, HTML, a custom clipboard format, and bitmap data unchanged.
- Production artifacts were generated below the 25 MiB target: 11.42 MiB executable, 3.80 MiB MSI, and 2.69 MiB NSIS installer.

Detailed executed evidence is in [docs/VALIDATION-2026-07-11.md](docs/VALIDATION-2026-07-11.md).

### What is next

Before calling MorphemeFlow production-ready:

1. Run and record the real-site Chromium/Edge/Firefox matrix: articles, documentation, GitHub, webmail, and mutation-heavy SPAs.
2. Complete WCAG colour-contrast, keyboard, Windows high-contrast, 200%/400% zoom, reduced-motion, and NVDA testing.
3. Install/uninstall both Reader bundles on clean Windows 10 and 11 machines; verify WebView2 bootstrap, code signing, and SmartScreen behavior.
4. Improve Rust/TypeScript syllable-boundary parity. TypeScript uses Hypher/Knuth-Liang; Rust currently uses a deterministic fallback.
5. Harden OCR with language selection, preprocessing/confidence handling, and a broader font/size/source-image matrix.
6. Conduct usability trials with dyslexic readers, then submit the optional extension to the Chrome and Mozilla stores.

The complete release gate is maintained in [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md).

---

## What it does

### 1. Morpheme Highlighting
Decomposes words into meaningful parts — roots, prefixes, and suffixes — with color-coding.

```
The  un·success·ful  re·construct·ion  was  un·fortunate·ly  delay·ed
     ^^  ^^^^^^^  ^^^  ^^  ^^^^^^^^^  ^^^       ^^  ^^^^^^^^^  ^^
     pfx  root   sfx  pfx   root    sfx       pfx    root    sfx
```

**Why:** Dyslexic readers have intact morphological processing. Morpheme awareness bypasses the phonological deficit (Carlisle 2000, Bowers et al. 2010).

### 2. Syllable Micro-Kerning
Subtle, barely-perceptible spacing at syllable boundaries — reduces visual crowding without adding dots or hyphens.

**Why:** Extra letter spacing significantly improves reading in dyslexia (Zorzi et al. 2012, PNAS).

### 3. Adaptive Reading Environment
Research-backed typography: optimized fonts (Lexend, Atkinson Hyperlegible), configurable letter/word spacing, line height, background colors, and a reading ruler.

---

## Install

### Web Extension
*Beta implementation complete; store submission and real-site evidence are still pending.* Build it locally with `npm run build:web`, then load `packages/web/dist/` as an unpacked extension.

### Reader (Windows)
*Universal-capture beta implemented; signed public installer validation is still pending.* Run it with `npm run dev:reader`.

---

## Development

### Prerequisites
- **Web extension:** Node.js 20+, npm
- **Rust engine / Reader:** Rust toolchain (`rustup`, `cargo`)

### Quick start

```bash
# Install JS dependencies
npm install

# Test, lint, and typecheck the TypeScript engine + browser DOM layer
npm test
npm run lint
npm run typecheck

# Build both TypeScript packages
npm run build

# Test the Rust engine and Windows Reader
cargo test --workspace

# Launch / package the Windows Reader
npm run dev:reader
npm run build:reader
```

### Project structure

```
Dyslexia-Solution/
├── crates/engine/              # Rust morpheme engine (shared by Reader)
├── packages/
│   ├── engine-ts/              # TypeScript engine (shared by web extension)
│   └── web/                    # Browser extension (MV3)
├── apps/reader-windows/        # Native Reader app (validated beta)
├── data/
│   ├── morpheme-dictionary/    # Dictionary data & generation scripts
│   └── cmudict/                # CMU Pronouncing Dictionary
├── public/fonts/               # Bundled accessible fonts
├── research/                   # Research synthesis & references
├── docs/                       # Architecture, user guides, post-mortems
└── experiments/                # Archived experiments (zero-latency overlay)
```

---

## Progress

| Phase | Description | Status |
|---|---|---|
| P0 | Repo restructure & post-mortem | Done |
| P1 | TS engine modernisation | Done |
| P2 | Web extension MVP | Beta implemented; real-site matrix pending |
| P3 | Web extension polish + ship | In progress |
| P4 | Rust engine port | MVP implemented; deeper syllable parity pending |
| P5 | Reader native shell | Done |
| P6 | Selection capture pipeline | Done — full clipboard preservation + visible recovery |
| P7 | OCR snap pipeline | Done — per-monitor transparent region selector |
| P8 | TTS + reading ruler | Done |
| P9 | Settings, tray, hotkeys, installer | Beta done; signed clean-machine installer test pending |
| P10 | Cross-product polish & launch | In progress |

See [PLAN-V2.md](PLAN-V2.md) for the detailed work breakdown and [STRATEGY-V2.md](STRATEGY-V2.md) for the strategic rationale.
See [docs/VALIDATION-2026-07-11.md](docs/VALIDATION-2026-07-11.md) for the latest executed evidence and [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md) for remaining public-release gates.

---

## How it compares

| | Bionic Reading | Helperbird | Immersive Reader | **MorphemeFlow** |
|---|---|---|---|---|
| **Approach** | Positional bolding | Feature bundle | Extract & re-render | **Linguistic** |
| **Morphemes** | No | No | No | **Yes** |
| **Evidence** | None | None | Partial | **Strong** |
| **Open source** | No | No | No | **Yes** |
| **Privacy** | API calls | Cloud | Cloud | **100% local** |
| **Price** | $3-5/mo | $7/mo | Free (MS only) | **Free forever** |

---

## Privacy

**Zero MorphemeFlow network requests.** Everything runs locally. No data collected, no accounts, no cloud processing. Browser settings use the browser's own storage APIs and may participate in browser-vendor sync only when the user has enabled that feature.

## Research

Built on peer-reviewed research: Carlisle (2000), Bowers et al. (2010), Zorzi et al. (2012), Ziegler & Goswami (2005), Coltheart et al. (2001). See `research/` for the full synthesis.

## License

**MIT** — fully open source, free forever. All fonts are SIL OFL 1.1. No proprietary dependencies. No Bionic Reading API. No BeeLine Reader patents.

## Contributing

Contributions welcome! See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for build instructions and [PLAN-V2.md](PLAN-V2.md) for what needs building.

---

*MorphemeFlow: Reading support that actually works, backed by science, free forever.*
