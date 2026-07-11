# MorphemeFlow — Strategy v2 (Pivot Proposal)

**Date:** April 18, 2026
**Author:** Codebase review + new strategy
**Status:** ACCEPTED AND IMPLEMENTED — the DXGI/UIA overlay is archived; current intent is defined in [docs/PRODUCT-INTENT.md](docs/PRODUCT-INTENT.md)

---

## TL;DR

The current "universal screen overlay via DXGI + UIA" architecture **cannot work** for the dyslexia reading use case. Empirical evidence in `test-results/overlay-matrix/20260407-093216/` shows the overlay paints colored morpheme text on top of irrelevant UI chrome (Edge welcome dialogs, Notepad status bars) while completely missing the actual body text the user wants to read. The matrix harness reports PASS only because it measures anchor-count jitter, not whether the right text is actually being enhanced.

The root causes are **architectural, not bugs** — they cannot be fixed inside the current approach:

1. UIA does not expose per-line, per-glyph positions for body text in browsers/Office. It returns one giant Document control covering the whole page.
2. UIA does not expose font, size, color, or weight — so we cannot render aligned overlay text that looks like a transformation rather than a duplicate.
3. There is no mechanism to *hide* the underlying text. Painting on top creates "double vision."
4. UIA scans at ~250ms cadence; DXGI move-rects fire at frame rate. Anchor positions inevitably drift during scroll.

**Proposal:** Pivot to a **two-product strategy** that ships value in weeks, not quarters:

- **Product A — MorphemeFlow Web** (browser extension, MV3). Resurrect and finish `legacy-v1/`. DOM-precise. Ships in 2–3 weeks.
- **Product B — MorphemeFlow Reader** (native Windows sidecar window). Reuses the Rust `engine` crate. Floats next to any app, shows clipboard / selection / cursor-context text reflowed with morpheme highlighting, syllable spacing, and TTS. Ships in 4–6 weeks.

The current `compositor` and `overlay-daemon` crates should be **archived** as `experiments/zero-latency-overlay/` with a candid post-mortem. The `engine` crate is keep-and-extend.

---

## 1. What's actually broken (from the screenshots)

`test-results/overlay-matrix/20260407-093216/screenshot-Web-BBC-News.png`:
- The overlay paints "Welcome to Microsoft Edge, the", "You're almost set up", "Your data and privacy preferences", "Microsoft" in big bold colored text *on top of an Edge welcome modal*.
- Actual BBC headlines and body copy receive zero treatment.
- Black panel rectangles obscure parts of the underlying UI.

`screenshot-Web-Wikipedia-Dyslexia.png`:
- Same Edge dialog gets enhanced again.
- The Wikipedia article body (visible at the bottom: "While dyslexia is more often diagnosed in boys…") is untouched — exactly the text a dyslexic user opened the page to read.

`screenshot-App-Notepad-LongText.png`:
- Notepad's status bar items "Line 200", "Zoom Unix (LF) UTF-8", "Plain text" get colorized.
- The 200 lines of body text in the editor are untouched.

`screenshot-Web-OpenAI-Docs.png`: scenario FAILED — no anchors at all.

These are not bugs to patch. They are the inevitable output of the architecture.

---

## 2. Why the universal-overlay approach is unsalvageable

| Problem | Why it is structural |
|---|---|
| **Wrong text gets enhanced** | `UIA.FindAll(TreeScope_Subtree, TrueCondition)` returns every accessible element. UI chrome (buttons, tabs, status bars, modals) all expose `CurrentName`. Body text in browsers is collapsed into one Document element. The filter has no signal to distinguish "what the user is reading" from "buttons on a dialog." |
| **Cannot align overlay text** | UIA gives bounding rects of *controls*, not of glyph runs. There is no API to ask "where does the word 'reconstruction' sit on screen and at what pixel size?" `IUIAutomationTextPattern.GetVisibleRanges()` only returns the bounding rect of a *range*, not per-line and never per-glyph. |
| **Cannot hide original** | We have no mechanism to make the underlying app's text invisible. Painting opaque panels under our overlay text (current approach) blocks the page underneath, breaking interactivity and looking awful. |
| **Fonts mismatch** | We render Segoe UI 23pt regardless of the source. Browsers, Word, IDEs all use different fonts at different sizes. Result is duplication, not transformation. |
| **Scroll desync** | UIA scan is ~250ms; scroll happens at 60+Hz. DXGI move-rects translate anchors but the underlying text the anchors describe has been re-laid-out by the app. Drift is inevitable. |
| **No per-app reading context** | The "stable primary anchor" heuristic picks whatever happens to score highest in a flat sort. There is no concept of "the paragraph the user's caret is in" or "the line under the mouse cursor." |
| **Test harness measures the wrong thing** | The matrix harness only checks `visible_jitter <= 7` and `semantic_jitter <= 6` — counts of detected anchors over time. It never verifies that the right text was enhanced or that overlay positions match the underlying glyphs. PASS 6/6 is meaningless. |

What would make the current approach work is OS-level access to the rendered text layer — e.g., a Windows accessibility *provider proxy* that intercepts `ITextProvider` between every app and the OS, plus the ability to mask the original glyphs in the framebuffer. Neither exists on Windows. macOS (TextReplacement private API), Android (AccessibilityService overlays), and iOS (no API at all) all have similar walls. **No production tool has solved the universal-overlay problem this way.** Bionic Reading, Helperbird, Immersive Reader, BeeLine — every shipping competitor is per-context (browser, Office, PDF, etc.).

---

## 3. What the legacy v1 already gave us (and we abandoned)

`legacy-v1/packages/engine/src/` contains a real engine, not a heuristic stub:
- `morpheme-analyzer.ts` (5.2 KB) — three-tier analyzer: dictionary lookup → rule-based affix strip → syllable fallback
- `syllable-splitter.ts` (3.7 KB) — Knuth-Liang via `hypher`
- `word-cache.ts` (2.5 KB) — LRU cache
- `tokenizer.ts`, `types.ts`, `settings.ts`

`legacy-v1/packages/engine/data/` contains:
- `cmudict.dict` — CMU Pronouncing Dictionary (~125k words) for syllable boundaries
- `morpheme-dictionary.ts`, `prefix-rules.ts`, `suffix-rules.ts`, `root-validator.ts`

`legacy-v1/packages/extension/src/` is a working MV3 extension skeleton:
- `content/dom-scanner.ts` (3.8 KB) — TreeWalker + IntersectionObserver
- `content/dom-modifier.ts` (4.9 KB) — Replace text nodes with morpheme spans, preserve copy/paste original
- `content/styles.css` (5.5 KB) — color scheme, kerning, ruler
- `popup/`, `background/`, `manifest.json`

**This is 80% of a shippable product** that was paused mid-stream because the team wanted "universal." It is a much shorter path to value than continuing the native overlay.

The current Rust `engine` crate is a 22-prefix / 30-suffix heuristic with no dictionary, no syllable splitter, no cache. It is strictly weaker than the legacy TS engine.

---

## 4. The recommended pivot

### Product A — MorphemeFlow Web (browser extension)

**Why first:** ~70% of dyslexic adults' reading happens in a browser (articles, email web UIs, social, docs). It also has the only environment where we can reliably know font, size, and position of every word, and replace text without ghosting.

**Scope (MVP, 2–3 weeks):**
1. Resurrect `legacy-v1/packages/extension` and `legacy-v1/packages/engine`. Move them up to `packages/web/` and `packages/engine-ts/`.
2. Bring the engine to current quality:
   - Wire CMUdict-based syllable splitter; verify against test fixtures already in `legacy-v1/packages/test/fixtures/`.
   - Add a curated 5k-word morpheme dictionary (use MorphoLex CC-licensed data, or build from CELEX-derived public lists).
   - Confidence scoring per analysis (dictionary > rule > syllable fallback).
3. DOM modifier hardening:
   - Skip `code`, `pre`, `kbd`, `[contenteditable]`, `input`, `textarea`, SVG, `noscript`, anything inside `[aria-hidden]`.
   - Preserve original text on the parent element via `data-mf-original` so copy-paste works.
   - Use `MutationObserver` with debounce + `IntersectionObserver` to only process viewport text.
4. Settings UI: presets (Subtle, Balanced, Full), font picker (Lexend/Atkinson/OpenDyslexic), spacing sliders, color theme, per-site toggle.
5. Reading ruler as content overlay (cheap — a `position: fixed` band tracking `mousemove`).
6. Ship to Chrome Web Store + Firefox Add-ons under MIT license.

**Out of scope for v1:** TTS sync (week 4 add-on), PDF support (use browser-native PDF.js viewer extension wrap-up later).

### Product B — MorphemeFlow Reader (native Windows sidecar)

**Why second:** Solves the "but I read in Word / Outlook / Slack / a PDF viewer too" problem **without** trying to overlay anything. A small always-on-top window that takes whatever text the user points at and re-renders it beautifully.

**How input gets in (priority order, all hotkey-triggered):**
1. **Selection capture** — `Ctrl+Shift+M` copies the current selection (`SendInput` Ctrl+C, read clipboard) and shows it reflowed in the sidecar. Works in Word, Outlook, Slack, Teams, VS Code, every text-having app on the planet.
2. **Region OCR snap** — `Ctrl+Shift+R` lets the user drag a rectangle; the captured pixels go through `Windows.Media.Ocr` (free, on-device, fast) and the recognized text appears in the sidecar reflowed. Covers PDFs, image-rendered PDFs, games, locked apps.
3. **Caret-context follow** (v2) — Uses UIA `TextEdit` or `Text` pattern's caret/selection events, *only when explicitly enabled*, to mirror the paragraph the user's typing cursor is in. This is UIA used as a content source, not as a layout engine — much more tractable.

**What the sidecar window shows:**
- The user's text reflowed in their chosen font/size/spacing/theme.
- Morpheme color coding.
- Syllable micro-kerning at chosen intensity.
- A reading ruler (since we own the renderer).
- TTS read-aloud with synchronized word and syllable highlighting (we control the glyph positions).
- Pin / un-pin, opacity slider, dock-to-side.

**Tech stack for Reader:**
- Rust + `winit` + `wgpu` (or `tao`/`wry` if WebView2 simpler — same engine reuse story as Tauri).
- Reuses the existing `crates/engine` crate after we port the legacy dictionary + syllable splitter into Rust (or compile the TS engine to wasm and call from Rust).
- Existing `crates/compositor` and `crates/overlay-daemon` are *not* used; they go to `experiments/`.

### Why this combination is decisive

| Use case | Covered by |
|---|---|
| Reading articles, email, docs, social, web apps | Web extension (precise, native) |
| Reading Word / Outlook / Slack / Teams / Discord / VS Code | Reader: selection capture (`Ctrl+Shift+M`) |
| Reading PDFs (text or scanned) | Reader: OCR snap (`Ctrl+Shift+R`) |
| Reading games, kiosks, locked apps | Reader: OCR snap |
| Long-form reading sessions | Reader: paste large blocks, ruler, TTS |
| Quick lookup of a single hard word | Either: hover/select → enhanced rendering |

This covers every scenario the original "universal overlay" promised, with the same engine, but without ever needing to predict per-glyph layout in someone else's window.

---

## 5. What to do with the current Rust code

| Crate | Decision | Rationale |
|---|---|---|
| `crates/engine` | **KEEP** — extend with port of legacy TS dictionary + syllable splitter (or wasm bridge). | Rust core is the right place for the morpheme engine long-term. Currently weaker than legacy TS — must be brought up. |
| `crates/compositor` | **ARCHIVE** to `experiments/zero-latency-overlay/`. | DXGI desktop duplication is impressive engineering but solves a problem we no longer have. Worth keeping as a reference for future R&D. |
| `crates/overlay-daemon` | **ARCHIVE** to `experiments/zero-latency-overlay/`. | Same reason. The matrix harness, screenshots, and post-mortem stay with it. |
| `legacy-v1/packages/engine` | **PROMOTE** to `packages/engine-ts/`. | Real engine, real dictionary, real syllable logic. |
| `legacy-v1/packages/extension` | **PROMOTE** to `packages/web/`. | Working MV3 skeleton. |
| `legacy-v1/packages/overlay` (Tauri) | **DELETE**. | Was DOM-via-Tauri; superseded by the Reader plan. |
| `scripts/overlay-matrix-test.ps1` | **ARCHIVE** with the overlay daemon. | Measures the wrong thing for the new strategy. |
| `public/fonts/`, `research/` | **KEEP** as-is. | Still applicable. |

---

## 6. New repository layout (target)

```
Dyslexia-Solution/
├── crates/
│   └── engine/                  # Rust morpheme + syllable engine (extended)
├── packages/
│   ├── engine-ts/               # TS engine (promoted from legacy-v1)
│   └── web/                     # MV3 browser extension
├── apps/
│   └── reader-windows/          # Rust + winit/wgpu sidecar reader
├── experiments/
│   └── zero-latency-overlay/    # Archived compositor + overlay-daemon + matrix
├── data/
│   ├── morpheme-dictionary/     # Source data + build script
│   └── cmudict/
├── research/                    # Unchanged
├── public/fonts/                # Unchanged
└── docs/
    ├── ARCHITECTURE.md          # Rewritten for v2
    ├── STRATEGY-V2.md           # This doc
    └── POSTMORTEM-OVERLAY.md    # New — what we learned
```

---

## 7. Milestones

### M1 — Decision + cleanup (this week)
- [ ] Decision on this strategy doc.
- [ ] Move `crates/compositor` and `crates/overlay-daemon` to `experiments/zero-latency-overlay/`.
- [ ] Move `legacy-v1/packages/engine` → `packages/engine-ts/`.
- [ ] Move `legacy-v1/packages/extension` → `packages/web/`.
- [ ] Update `Cargo.toml` workspace, `package.json`, `tsconfig.json`.
- [ ] Write `docs/POSTMORTEM-OVERLAY.md` — preserve the technical learnings.

### M2 — Web extension MVP (2–3 weeks)
- [ ] Engine: dictionary load, three-tier analyzer, syllable splitter, LRU cache — all green tests.
- [ ] Content script: scanner + modifier + observer — works on a curated test set (Wikipedia, BBC News, GitHub README, OpenAI docs, Substack).
- [ ] Popup with presets + sliders.
- [ ] Per-site enable/disable.
- [ ] Reading ruler.
- [ ] Manual QA on Chrome, Edge, Firefox.
- [ ] Submit to Chrome Web Store + Firefox Add-ons.

### M3 — Reader v0.1 (3–4 weeks after M2)
- [ ] Window shell (winit + wgpu or Tauri/wry).
- [ ] Engine integration (Rust port or wasm bridge).
- [ ] `Ctrl+Shift+M` selection capture path.
- [ ] Renderer with morpheme color, syllable kerning, ruler, theme.
- [ ] Settings persisted to `%APPDATA%`.
- [ ] System tray + global hotkeys.

### M4 — Reader v0.2 (2 weeks after M3)
- [ ] `Ctrl+Shift+R` region OCR via `Windows.Media.Ocr`.
- [ ] TTS read-aloud with word/syllable sync.
- [ ] Multi-monitor positioning.
- [ ] Code-signed installer.

### M5 — Polish + adoption
- [ ] Onboarding flow (first-run quick-tour).
- [ ] Telemetry-free crash reporter (local log only).
- [ ] Open-source launch on HN/Reddit/dyslexia communities.

---

## 8. Risk assessment

| Risk | Mitigation |
|---|---|
| "But the original vision was universal overlay" | The Reader gives universal coverage of *reading*, not of *automatic transformation in place*. For a dyslexic user, the practical question is "can I read this hard text easily?" — the Reader answers yes for any text on any screen, via selection or OCR snap. |
| Selection-capture changes the clipboard | Save/restore clipboard contents around the capture. Standard pattern (PowerToys Text Extractor does this). |
| OCR latency on big regions | `Windows.Media.Ocr` is hardware-accelerated and routinely <200ms for a paragraph. Show a spinner; users will accept this for hard-to-read content. |
| TS engine ↔ Rust engine drift | Pick one as canonical (recommend Rust + wasm export); generate fixtures both must pass. |
| User fatigue from yet-another-pivot | Be explicit in the post-mortem and CHANGELOG about *why* we pivoted, with the screenshots. Honesty earns trust from contributors. |

---

## 9. What I recommend you do right now

1. Read this doc; reject, accept, or amend.
2. If accepted, I will:
   - Create the new directory layout and move files.
   - Write `docs/POSTMORTEM-OVERLAY.md`.
   - Rewrite `ARCHITECTURE.md` to v2.
   - Stand up the web extension build (vite + crxjs) so `npm run dev` produces a loadable Chrome extension within the day.
   - Open issues for each M2 task.

If you want to keep one foot in the overlay world for a future research push, we can leave `experiments/zero-latency-overlay/` building in CI but not on the critical path.

---

*The hardest part of an ambitious technical bet is admitting the wall in front of you. The good news here is that the engine (the actual hard intellectual work — morpheme decomposition + syllable splitting + dyslexia-informed typography) is portable. We just need to put it in front of the text via the two delivery vehicles that actually have the data they need.*
