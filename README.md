# MorphemeFlow

**Morpheme highlighting, syllable micro-kerning, and adaptive typography to help people with dyslexia read.**

One product suite, two complementary surfaces:

- **MorphemeFlow Reader** — The universal Windows hub. Select text in almost any application or draw around text on screen; Reader reflows it with morpheme highlighting, syllable spacing, adaptive typography, a reading ruler, and local text-to-speech.
- **MorphemeFlow Web** — The optional high-fidelity browser surface (Chrome/Edge/Firefox). It enhances semantic reading content directly in the DOM while preserving the exact original text.

“Universal” means coverage of the reading journey, not an unreliable attempt to replace every glyph in another application's framebuffer. The archived DXGI/UIA experiment and its evidence are documented in [docs/POSTMORTEM-OVERLAY.md](docs/POSTMORTEM-OVERLAY.md). The authoritative product direction is [docs/PRODUCT-INTENT.md](docs/PRODUCT-INTENT.md).

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
- **Web extension:** Node.js 18+, npm
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
├── apps/reader-windows/        # Native Reader app (in development)
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
