# CLAUDE.md — MorphemeFlow Development Guide

## Project Overview
MorphemeFlow is a **universal screen overlay** (desktop app + browser extension) that combines morpheme highlighting, syllable micro-kerning, and adaptive typography to help people with dyslexia read better in **any application**.

## Architecture
- **Primary:** Tauri v2 desktop app with transparent click-through overlay
- **Secondary:** Chrome browser extension (MV3) for precise DOM-level web support
- **Shared:** Pure TypeScript morpheme engine used by both targets

## Commands
- `npm run dev` — Start development build with hot reload
- `npm run build` — Production build (all packages)
- `npm run test` — Run tests with Vitest
- `npm run lint` — ESLint
- `npm run dev:overlay` — Start Tauri desktop overlay in dev mode
- `npm run dev:extension` — Start browser extension dev build
- `npm run build:engine` — Build shared engine package only

## Project Structure (Monorepo)
```
morphemeflow/
├── packages/
│   ├── engine/            # SHARED: Pure morpheme engine (tokenizer, analyzer, cache)
│   ├── overlay/           # PRIMARY: Tauri desktop overlay (transparent, click-through)
│   │   ├── src-tauri/     # Rust backend (UIA text detection, window management)
│   │   └── src/           # WebView frontend (canvas overlay, settings UI)
│   └── extension/         # SECONDARY: Browser extension (MV3, DOM-level)
├── public/
│   └── fonts/             # Bundled accessible fonts (Lexend, OpenDyslexic, Atkinson)
├── test/
├── research/              # Research documents and references
└── ARCHITECTURE.md        # Full system design
```

## Key Architecture Decisions
- **Universal overlay:** Transparent Tauri window sits on top of all applications
- **Text detection:** Windows UI Automation API (primary) + OCR fallback for universal text access
- **Morpheme detection:** Hybrid approach — dictionary lookup (~5K words) + rule-based affix stripping + syllable fallback
- **Shared engine:** Pure TypeScript engine used by both overlay and extension
- **Performance target:** < 200ms initial processing, < 50ms incremental
- **No external API calls:** Everything runs client-side for privacy and speed

## Methodology (gstack ETHOS)
- **Boil the Lake:** Universal coverage — every app, every text, every user.
- **Search Before Building:** Use proven algorithms (Liang's hyphenation, established morpheme databases).
- **User Sovereignty:** Every feature is user-configurable. Presets for quick start, sliders for fine-tuning.

## Key Principles
- All fonts must be SIL OFL 1.1 or similarly permissive
- Never copy Bionic Reading's approach (arbitrary letter bolding) — our method is linguistically meaningful
- Keep bundle size reasonable (engine <500KB, overlay <10MB, extension <2MB)
- Accessibility first: WCAG 2.1 AA minimum
- Privacy: zero network requests, all processing client-side
- Works across ALL applications — browser, desktop apps, PDFs, everything

## Research References
See `research/00-research-synthesis.md` for the full research synthesis.
See `research/typography-and-dyslexia-research.md` for typography/color details.
See `ARCHITECTURE.md` for the universal overlay system design.
