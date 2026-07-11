# MorphemeFlow — Detailed Execution Plan (v2)

**Date:** April 18, 2026
**Companion to:** [STRATEGY-V2.md](STRATEGY-V2.md)
**Scope:** Concrete, file-level work breakdown for the pivot from universal-overlay to Web Extension + Native Reader.

This plan converts the strategy into discrete, ordered, auditable tasks. Each task lists the files touched, the acceptance criteria, and the estimated effort in **eng-days** (1 day = ~6 focused hours). No calendar dates — those depend on parallelism choices.

> **Implementation checkpoint — July 11, 2026:** This document preserves the original task-level plan, so unchecked boxes below are historical and are not a reliable status dashboard. The TypeScript engine, MV3 extension beta, Rust engine, and Windows Reader universal-capture beta now exist. Selection capture preserves all clipboard formats; OCR has a per-monitor transparent rectangle selector; Reader rendering combines lossless morpheme colouring and syllable spacing; TTS, ruler, persistent settings, real hotkeys, tray behavior, CI, and browser DOM tests are wired. Remaining release gates are real-site/browser evidence, accessibility and contrast audit, deeper Rust/TS syllable parity, signed clean-machine installer validation, and store submission. See [docs/PRODUCT-INTENT.md](docs/PRODUCT-INTENT.md) for the authoritative product contract and [README.md](README.md) for current phase status.

---

## Phase index

| Phase | Theme | Effort | Depends on |
|---|---|---:|---|
| **P0** | Repo restructure & post-mortem | 1.0 d | — |
| **P1** | TS engine modernisation | 2.5 d | P0 |
| **P2** | Web extension (MV3) MVP | 4.0 d | P1 |
| **P3** | Web extension polish + ship | 2.5 d | P2 |
| **P4** | Rust engine port (parity with TS) | 3.0 d | P1 (parallelisable) |
| **P5** | Reader native shell | 3.0 d | P4 |
| **P6** | Reader: selection capture + clipboard pipeline | 1.5 d | P5 |
| **P7** | Reader: OCR snap pipeline | 2.0 d | P5 |
| **P8** | Reader: TTS + reading ruler | 2.0 d | P5 |
| **P9** | Reader: settings, tray, hotkeys, installer | 2.5 d | P6, P7, P8 |
| **P10** | Cross-product polish, docs, launch | 2.0 d | P3, P9 |

**Total ~26 eng-days.** Web product is shippable after P3 (~10 d). Reader product after P9 (~22 d total).

---

## P0 — Repo restructure & post-mortem (1.0 d)

### P0.1 — Create new directory layout
**Files moved (preserving git history via `git mv`):**

| From | To |
|---|---|
| `crates/compositor/` | `experiments/zero-latency-overlay/crates/compositor/` |
| `crates/overlay-daemon/` | `experiments/zero-latency-overlay/crates/overlay-daemon/` |
| `scripts/overlay-matrix-test.ps1` | `experiments/zero-latency-overlay/scripts/overlay-matrix-test.ps1` |
| `test-results/overlay-matrix/` | `experiments/zero-latency-overlay/test-results/` |
| `legacy-v1/packages/engine/` | `packages/engine-ts/` |
| `legacy-v1/packages/engine/data/` | `packages/engine-ts/data/` (already inside) |
| `legacy-v1/packages/extension/` | `packages/web/` |
| `legacy-v1/packages/test/fixtures/` | `packages/engine-ts/test/fixtures/` |
| `legacy-v1/packages/overlay/` | **delete** (Tauri DOM overlay, superseded) |
| `crates/engine/` | stays (will be extended in P4) |

New empty dirs: `apps/reader-windows/`, `data/morpheme-dictionary/`, `data/cmudict/`, `docs/`.

### P0.2 — Update workspace manifests
- [ ] `Cargo.toml` workspace members → `["crates/engine", "apps/reader-windows", "experiments/zero-latency-overlay/crates/compositor", "experiments/zero-latency-overlay/crates/overlay-daemon"]`. Mark experiments as `publish = false` and exclude from default `cargo build` via a feature gate or `--workspace --exclude`.
- [ ] Root `package.json` workspaces → `["packages/engine-ts", "packages/web"]`. Remove `tauri-cli` dep. Update scripts:
  - `dev:web` → `npm -w packages/web run dev`
  - `build:web`, `build:engine`
  - Drop `dev:overlay` / `build:overlay`.
- [ ] Delete `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` at root if not needed; otherwise repoint to `packages/`.
- [ ] Move `test/` (Rust integration test artefacts: `analyze-regions.ts`, `test-harness.html`, fixtures) into `experiments/zero-latency-overlay/test/`.

### P0.3 — Move docs
- [ ] `ARCHITECTURE.md` → `experiments/zero-latency-overlay/ARCHITECTURE-v0.3.md` (preserve as historical artifact).
- [ ] `HANDOVER.md` → `experiments/zero-latency-overlay/HANDOVER.md`.
- [ ] `PLAN.md` → `experiments/zero-latency-overlay/PLAN-v0.md` (it's the original TS-extension plan; superseded by this doc).
- [ ] `STRATEGY-V2.md` stays at root.
- [ ] `PLAN-V2.md` (this file) stays at root.

### P0.4 — Write `docs/POSTMORTEM-OVERLAY.md`
- [ ] Content: architectural reasoning from STRATEGY-V2 §2; reference the screenshot evidence; explicit list of "what we'd need from the OS to make this work" so a future contributor doesn't repeat the experiment cold.
- [ ] Link from `experiments/zero-latency-overlay/README.md` (new — 1 paragraph: "this is archived; see post-mortem").

### P0.5 — Update root `README.md`
- [ ] New 2-product positioning. Quick-start sections for both web and reader (reader marked "in development").
- [ ] Status table replaced with phase-progress table.
- [ ] Remove DXGI/UIA architecture diagrams; link to post-mortem instead.

### P0.6 — Update `CLAUDE.md`
- [ ] Project overview rewritten to match new strategy.
- [ ] Commands section: `npm run dev:web`, `cargo run -p reader-windows`, `cargo test -p engine`.

**Acceptance:** `cargo build` (default workspace) succeeds without compositor/overlay-daemon. `npm install && npm run typecheck` green for `packages/engine-ts` and `packages/web`. Old screenshots and matrix reports preserved under `experiments/`.

---

## P1 — TS engine modernisation (2.5 d)

The legacy engine is 80% there. We finish it and harden it.

### P1.1 — Engine package config (0.25 d)
- [ ] `packages/engine-ts/package.json`: rename to `@morphemeflow/engine`, add `vitest` dev dep, add `build`/`test`/`typecheck` scripts. Keep deps: `hypher`, `hyphenation.en-us`.
- [ ] `packages/engine-ts/tsconfig.json`: `target: es2022`, `moduleResolution: bundler`, `declaration: true`, `outDir: dist`. Re-enable strict mode if not already.
- [ ] Add `packages/engine-ts/src/index.ts` exports to expose: `tokenize`, `analyzeWord`, `analyzeWords`, `splitSyllables`, `WordCache`, `getDefaultSettings`, `getPreset`, all types.

### P1.2 — Audit `morpheme-analyzer.ts` (0.5 d)
- [ ] Verify `dictionaryLookup` against bundled `morpheme-dictionary.ts`. Confirm encoding, lazy decode, eviction.
- [ ] Make `ruleBasedParse` recursive (handle `un-believ-able`: prefix + suffix-stripped root validated).
- [ ] Stem-change handling: confirm rules like `happi → happy` (suffix `-ness`/`-ly`) work via `stemChange` callback.
- [ ] Add `analysisMetadata` to result: `{ tier: 'dictionary' | 'rule' | 'syllable', ruleApplied?: string }` for debugging.

### P1.3 — Wire CMUdict-based syllable counter (0.5 d)
- [ ] `packages/engine-ts/data/cmudict.dict` is already there (~125k entries). Build a compact loader that on first call:
  - Parses into `Map<string, number>` (word → syllable count derived by counting digits in pronunciation = vowel stresses).
  - Caches into IndexedDB / `chrome.storage.local` for cold-start speed.
- [ ] `splitSyllables`: use Knuth-Liang for *positions*; if the resulting count differs from CMUdict by ±1, prefer CMUdict count and rebalance positions. (Knuth-Liang occasionally over- or under-splits.)
- [ ] Optional, gated behind a flag: skip CMUdict in extension build (size). Default to Knuth-Liang only; offer CMUdict as a "high-accuracy mode" downloaded on demand.

### P1.4 — Tokenizer hardening (0.25 d)
- [ ] Add unit tests for: contractions (`don't`, `they're`), hyphens (`well-known`), em-dashes, ellipses, smart quotes, URLs (`https://...`), email addresses, code identifiers (`getElementById`), numbers (`3.14`, `1,000`), abbreviations (`U.S.A.`), emoji.
- [ ] Tokens carry `kind: 'word' | 'whitespace' | 'punctuation' | 'url' | 'email' | 'number' | 'symbol'`. Only `word` is analyzed.

### P1.5 — Test suite (1.0 d)
Create `packages/engine-ts/test/`:
- [ ] `morpheme-analyzer.test.ts` — 200+ word fixture (top-frequency English with hand-verified decompositions). Assert tier accuracy: dictionary ≥98%, rule ≥85%, syllable fallback ≥99% (Knuth-Liang baseline).
- [ ] `syllable-splitter.test.ts` — 100-word fixture from CMUdict (sampled). Assert count accuracy ≥98%.
- [ ] `tokenizer.test.ts` — 50 cases covering edge cases above.
- [ ] `word-cache.test.ts` — LRU eviction, hit-rate tracking, persistence (mock storage).
- [ ] `settings.test.ts` — preset application, custom override.
- [ ] Run: `npm -w packages/engine-ts test`.

**Acceptance:** All test suites green. `tsc --noEmit` clean. `dist/` builds cleanly. Engine consumable from the web package.

---

## P2 — Web extension (MV3) MVP (4.0 d)

### P2.1 — Build pipeline (0.5 d)
- [ ] Replace bespoke `build.mjs` with `crxjs/vite-plugin` for hot-reload Manifest V3 dev experience. New `packages/web/vite.config.ts` with `@crxjs/vite-plugin`.
- [ ] `packages/web/package.json`: deps `@crxjs/vite-plugin`, `vite`, `@morphemeflow/engine: workspace:*`, `@types/chrome`. Scripts: `dev`, `build`, `typecheck`.
- [ ] Update import paths from `../../../engine/src/index` → `@morphemeflow/engine`.
- [ ] Verify `manifest.json` MV3 fields (`web_accessible_resources`, `host_permissions`, `commands`).

### P2.2 — Content script hardening (1.0 d)
File: `packages/web/src/content/dom-scanner.ts`
- [ ] Add `IntersectionObserver` so only viewport-visible elements are processed initially. Off-screen elements queued for processing on scroll.
- [ ] Tighten skip list: add `[contenteditable]`, `[role=textbox]`, `[role=combobox]`, `picture > *`, `figure > svg`, MathJax containers.
- [ ] Detect "reader mode" pages (Substack, Medium, news sites with `<article>`). Restrict scan to `article, main, [role=main]` if present. Falls back to body otherwise.

File: `packages/web/src/content/dom-modifier.ts`
- [ ] Preserve original on the *node*, not just `parent.innerHTML` (current approach blows away sibling structure on first replacement). Use `data-mf-original-text` on the inserted wrapper.
- [ ] Copy/paste fix: add a `copy` event listener that rewrites the clipboard payload to original text from the wrapper's `data-mf-original-text`.
- [ ] Performance: batch DOM writes via `requestAnimationFrame` and `DocumentFragment`. No reads after writes within a single frame.
- [ ] Add `data-mf-tier` attribute on each morpheme for CSS-driven intensity tuning.

File: `packages/web/src/content/content.ts`
- [ ] On `UPDATE_SETTINGS`, do an *incremental* re-render rather than full `removeAll() + apply()`. Track which features actually changed.
- [ ] Add `chrome.runtime.onMessage` handler `GET_PAGE_STATS` (already partial — finish it).

### P2.3 — Background service worker (0.25 d)
File: `packages/web/src/background/background.ts`
- [ ] Persist settings to `chrome.storage.sync` with quota-fail fallback to `chrome.storage.local`.
- [ ] Handle the `toggle-morphemeflow` keyboard command → broadcast `TOGGLE_EXTENSION` to active tab.
- [ ] Apply per-site overrides on `chrome.tabs.onUpdated` if the host matches.

### P2.4 — Popup UI (1.0 d)
Files: `packages/web/src/popup/index.html`, `popup.ts`, `popup.css`
- [ ] Three preset buttons (Subtle / Balanced / Full) at top, big and obvious.
- [ ] Master on/off toggle.
- [ ] Per-feature checkboxes (morpheme, syllable, env, ruler, TTS).
- [ ] Sliders: morpheme intensity, syllable spacing, font size, letter spacing, line height.
- [ ] Font picker: Lexend / Atkinson / OpenDyslexic / System / Verdana.
- [ ] Theme picker: Default / Cream / Soft Yellow / Pale Blue / Peach / Soft Green / Dark.
- [ ] "Disable on this site" / "Enable on this site" button → site override.
- [ ] Stats footer: "Words processed: X | Time: Yms".

### P2.5 — Reading ruler (0.5 d)
File: `packages/web/src/features/reading-ruler.ts` (new)
- [ ] Mode `focus`: top + bottom dim panels (`position: fixed`, `pointer-events: none`) that follow `mousemove` Y.
- [ ] Mode `highlight`: single tinted band.
- [ ] Mode `underline`: 2px line at cursor Y.
- [ ] Inject/cleanup on settings change. Respect `prefers-reduced-motion`.

### P2.6 — Bundled fonts (0.25 d)
- [ ] Copy `public/fonts/` into the extension dist via Vite plugin.
- [ ] `web_accessible_resources` already includes `fonts/*`.
- [ ] CSS `@font-face` declarations injected into pages via the env style block (use `chrome.runtime.getURL("fonts/...")`).

### P2.7 — Smoke test on real pages (0.5 d)
Manual matrix (record before/after screenshots into `packages/web/test-evidence/`):
- [ ] en.wikipedia.org/wiki/Dyslexia
- [ ] bbc.co.uk/news (a long article)
- [ ] github.com/<repo>/blob/.../README.md (rendered)
- [ ] platform.openai.com/docs/...
- [ ] substack.com test article
- [ ] gmail.com message body (verify `[contenteditable]` skipped → composer untouched)
- [ ] Verify copy-paste of morpheme-styled text returns the original.
- [ ] Verify SPA navigation (e.g. Twitter/X) re-applies correctly.

**Acceptance:** `npm -w packages/web run build` produces a `dist/` loadable via `chrome://extensions → Load unpacked`. All 7 smoke pages show clean morpheme highlighting on body text only, with no rendering glitches in chrome/UI.

---

## P3 — Web extension polish + ship (2.5 d)

### P3.1 — Accessibility self-audit (0.5 d)
- [ ] Popup: keyboard-navigable, focus-visible outlines, `aria-label` on icon buttons, color contrast WCAG AA in all themes.
- [ ] Respect `prefers-reduced-motion` for the ruler.
- [ ] Verify the extension itself works under a screen reader (NVDA/VoiceOver).

### P3.2 — Performance pass (0.5 d)
- [ ] Profile Wikipedia article. Target: <100ms initial pass, <16ms per mutation batch.
- [ ] Cache the analyzer result map across page loads via `chrome.storage.local` (top 5k words).
- [ ] Memory: snapshot heap before/after enable; target <5MB resident.

### P3.3 — Per-site overrides UI (0.25 d)
- [ ] Show the current host in popup. "Disable on github.com" toggle persists per-host.

### P3.4 — Tooling (0.25 d)
- [ ] ESLint config (use existing root config) restricted to `packages/`.
- [ ] GitHub Actions CI: `npm ci && npm test && npm run build` for `packages/`.

### P3.5 — Store assets (0.5 d)
- [ ] Logo (use existing `public/icons/`), 1280x800 promo screenshots (5 of them, taken from P2.7 evidence).
- [ ] Store description (markdown → plain text), privacy policy ("we collect nothing"), support URL.

### P3.6 — Submit (0.5 d)
- [ ] Chrome Web Store: package + upload + privacy form.
- [ ] Mozilla Add-ons: ditto.
- [ ] (Edge picks up Chrome listing automatically.)

**Acceptance:** Extension is live (or in review) on Chrome Web Store and addons.mozilla.org. README has install buttons.

---

## P4 — Rust engine port (parallelisable with P2/P3) (3.0 d)

Goal: Bring the Rust `crates/engine` to functional parity with the TS engine so the Reader can use it natively without a wasm bridge.

### P4.1 — Data baking (0.5 d)
- [ ] Write a Node script `data/morpheme-dictionary/build.mjs` that reads the TS `morpheme-dictionary.ts`, `prefix-rules.ts`, `suffix-rules.ts` and emits:
  - `data/morpheme-dictionary/morphemes.bin` — compact binary (varint-encoded).
  - `data/morpheme-dictionary/affixes.json` — prefix/suffix tables.
  - `data/cmudict/syllable-counts.bin` — `Map<word, u8>` (word lowercase, count 1-15).
- [ ] Engine crate: `build.rs` copies these into `OUT_DIR` and emits `include_bytes!` constants.

### P4.2 — Analyzer rewrite (1.5 d)
File: `crates/engine/src/analyzer.rs`
- [ ] Replace heuristic with three-tier:
  - Tier 1 — `dictionary_lookup(&str)` reads from baked binary, lazy-decodes.
  - Tier 2 — rule-based with `PREFIX_RULES`/`SUFFIX_RULES` from baked JSON, longest-match, recursive.
  - Tier 3 — `syllable_fallback` calls the new syllable splitter.
- [ ] `analyze` returns `AnalyzedWord { confidence: Tier, morphemes: Vec<Morpheme> }`.
- [ ] Existing tests must still pass; add 50 new cases mirroring TS test fixture.

File: `crates/engine/src/syllable.rs` (new)
- [ ] Port Knuth-Liang algorithm (translate `hypher` JS or use the `hyphenation` crate which has CC-By patterns).
- [ ] Hybrid with CMUdict: returns `(positions: Vec<usize>, count: u8)`.

### P4.3 — Tokenizer (0.5 d)
File: `crates/engine/src/tokenizer.rs`
- [ ] Replace whitespace split with grapheme-cluster aware tokenizer (use `unicode-segmentation` crate). Same edge-case coverage as TS tokenizer.

### P4.4 — Cache (0.25 d)
File: `crates/engine/src/cache.rs` (new)
- [ ] LRU keyed by `String`, value `AnalyzedWord`. Cap 10k. Use `lru` crate.

### P4.5 — Cross-language fixture parity (0.25 d)
- [ ] Create `data/test-fixtures/words.json` consumed by **both** the TS engine test suite and a Rust integration test. Same input → same morphemes (modulo whitespace). Diff-fail if they ever drift.

**Acceptance:** `cargo test -p engine` green with 250+ assertions. TS↔Rust fixture parity at ≥98% structural agreement.

---

## P5 — Reader native shell (3.0 d)

### P5.1 — Pick the windowing stack (0.25 d, decision-only)
**Recommendation: Tauri 2.x with `tauri-plugin-global-shortcut`.**
- Pros: WebView-based renderer means we can reuse the TS engine UI (or Rust+wasm). Theming/typography is trivial in CSS. Bundle ~12MB.
- Cons: Slightly heavier than pure winit/wgpu (~3MB).

Alternative: `winit + wgpu + cosmic-text` — pure Rust, ~4MB, but TTS UI and typography require building a renderer from scratch (multi-day extra work).

For the Reader's ergonomics (rich typography, themes, smooth TTS highlighting) **Tauri wins.** Decision recorded here; revisit if bundle size becomes a launch blocker.

### P5.2 — Scaffold `apps/reader-windows/` (0.75 d)
- [ ] `cargo init` + `tauri init`.
- [ ] `tauri.conf.json`: window `width: 480, height: 720`, `transparent: false`, `decorations: true`, `alwaysOnTop: true` (toggleable), `resizable: true`.
- [ ] Front-end in `apps/reader-windows/ui/` — Vite + vanilla TS (no React unless needed). Reuse the engine via `@morphemeflow/engine`.
- [ ] System tray icon, "Show / Hide / Quit" menu.

### P5.3 — Reader window UI (1.0 d)
- [ ] Main panel: large reflowed text area with morpheme highlighting + syllable spacing, using engine output.
- [ ] Header: app title, pin toggle, settings cog, opacity slider.
- [ ] Footer: TTS controls (play/pause/stop), word counter.
- [ ] Empty state: "Press Ctrl+Shift+M to capture selection, or Ctrl+Shift+R to OCR a region."
- [ ] CSS theming: shares the seven themes from `packages/engine-ts/src/constants.ts`.

### P5.4 — Tauri ↔ engine bridge (0.5 d)
- [ ] Expose Rust commands: `analyze_text(text: String) -> AnalyzedDocument`, `get_settings`, `set_settings`.
- [ ] Front-end calls via `invoke('analyze_text', { text })`.

### P5.5 — Settings persistence (0.5 d)
- [ ] Store under `%APPDATA%\MorphemeFlow\settings.json` via `tauri-plugin-store`.
- [ ] Mirror the `UserSettings` shape from the TS engine.

**Acceptance:** `cargo tauri dev` opens a window. Pasting text into a debug textbox renders morpheme-highlighted output. Settings persist across restarts.

---

## P6 — Selection capture pipeline (1.5 d)

### P6.1 — Global hotkey wiring (0.25 d)
- [ ] `tauri-plugin-global-shortcut`: register `Ctrl+Shift+M` on app start.
- [ ] On trigger: emit `selection_capture_requested` event.

### P6.2 — Capture path (0.5 d)
- [ ] Save current clipboard contents (text + image formats) via Win32 `OpenClipboard`/`GetClipboardData`.
- [ ] Send `Ctrl+C` via `SendInput` (synthesized key events) to the foreground app.
- [ ] Sleep 50ms (configurable), poll clipboard for new text.
- [ ] Restore original clipboard contents.
- [ ] If no text appeared, fall back to "no selection found" toast; do not nuke clipboard.

### P6.3 — UI integration (0.5 d)
- [ ] On event, show captured text in the Reader panel, focus window, raise to front.
- [ ] If the Reader was hidden, show it; if pinned, just focus.

### P6.4 — Edge case tests (0.25 d)
Manual:
- [ ] Word document — works.
- [ ] Outlook email body — works.
- [ ] Slack message — works.
- [ ] Teams chat — works.
- [ ] VS Code editor — works.
- [ ] PDF viewer (Edge/Chrome built-in) — works for selectable PDFs.
- [ ] No selection — graceful no-op.
- [ ] Clipboard restoration verified by: copy an image first, capture text, confirm image is back on clipboard.

**Acceptance:** Selection capture produces enhanced reading view from any of the 6 host apps in <250ms end-to-end.

---

## P7 — OCR snap pipeline (2.0 d)

### P7.1 — Region picker overlay (0.75 d)
- [ ] Hotkey `Ctrl+Shift+R` shows a screen-sized transparent Tauri window with `WS_EX_LAYERED + WS_EX_TOPMOST`.
- [ ] Mouse drag draws a marquee. Release captures the rectangle, hides the picker.
- [ ] ESC cancels.

### P7.2 — Capture pixels (0.25 d)
- [ ] Use the existing DXGI machinery? No — overkill. Just `BitBlt` from `GetDC(NULL)` for the chosen rect into a 32-bpp DIB.

### P7.3 — OCR via `Windows.Media.Ocr` (0.75 d)
- [ ] Use `windows` crate: `Windows::Media::Ocr::OcrEngine::TryCreateFromUserProfileLanguages()`.
- [ ] Convert DIB → `SoftwareBitmap` → `OcrResult`.
- [ ] Concatenate `Lines` with proper line breaks; preserve hyphenated word joining.
- [ ] Send to Reader UI via the same event channel as selection capture.

### P7.4 — Quality fallbacks (0.25 d)
- [ ] If recognition confidence is low, show OCR text *and* the source image side-by-side so the user can verify.
- [ ] If `Windows.Media.Ocr` is unavailable (rare), surface a clear error (no Tesseract bundling at this stage).

**Acceptance:** Snapping a 600x300 region on a Wikipedia article PDF in under 600ms produces a Reader render of the recognized text.

---

## P8 — TTS + reading ruler in Reader (2.0 d)

### P8.1 — TTS engine (1.0 d)
- [ ] Use Web Speech API in the WebView (works inside Tauri). Voices via `speechSynthesis.getVoices()`.
- [ ] Bind play/pause/stop to UI.
- [ ] Listen to `boundary` events; map character offsets back to word/syllable spans rendered in the document.
- [ ] Highlight current word (background tint + bold). On syllable mode, highlight current syllable based on linear interpolation across the word's audio duration.

### P8.2 — Reading ruler (0.5 d)
- [ ] Inside the Reader panel only (not across the whole screen — that lives in the web extension).
- [ ] Same three modes as the web extension. Re-export the implementation if convenient.

### P8.3 — Auto-scroll while reading (0.5 d)
- [ ] Smooth-scroll the panel so the active word stays in the middle third.

**Acceptance:** Pressing Play reads the captured passage with audible voice while the active word/syllable is visibly highlighted in real time, and the view scrolls itself.

---

## P9 — Settings, tray, hotkeys, installer (2.5 d)

### P9.1 — Settings window (0.75 d)
- [ ] Separate Tauri window or embedded panel: presets, sliders, font picker, theme picker, hotkey customisation, OCR language picker.
- [ ] Validates and persists immediately.

### P9.2 — System tray UX (0.25 d)
- [ ] Tray icon with tooltip "MorphemeFlow Reader".
- [ ] Menu: Show, Hide, Capture Selection, Snap Region, Settings, Quit.

### P9.3 — Hotkey customisation (0.5 d)
- [ ] Allow user to remap `Ctrl+Shift+M` and `Ctrl+Shift+R`.
- [ ] Conflict detection (warn if hotkey is already taken by another app).

### P9.4 — Onboarding / first-run (0.25 d)
- [ ] On first launch, show a 3-step modal: pick preset → try selection capture → try OCR snap.

### P9.5 — Installer (0.5 d)
- [ ] `tauri build` → MSI + NSIS installers.
- [ ] Code-signing (use a self-signed cert for dev; defer paid cert to launch).
- [ ] Auto-update via `tauri-plugin-updater` pointed at GitHub Releases.

### P9.6 — Crash log (0.25 d)
- [ ] Local file `%APPDATA%\MorphemeFlow\logs\reader.log`. Rotated weekly. Never sent anywhere.

**Acceptance:** Double-click installer → Reader launches, tray icon appears, hotkeys work globally, settings persist, uninstall is clean.

---

## P10 — Cross-product polish, docs, launch (2.0 d)

### P10.1 — Docs (0.75 d)
- [ ] `docs/ARCHITECTURE.md` — final v2 architecture (Web + Reader + shared engine).
- [ ] `docs/USER-GUIDE-WEB.md`, `docs/USER-GUIDE-READER.md` with screenshots.
- [ ] `docs/CONTRIBUTING.md` — build instructions for both products.
- [ ] `docs/PRIVACY.md` — explicit "no network, no telemetry."
- [ ] Update top-level `README.md` with download links to both products.

### P10.2 — Landing page (0.5 d, optional)
- [ ] Single static page (GitHub Pages from `/docs/site/`): hero, two product cards, video demo gif, install CTA, link to research.

### P10.3 — Launch (0.75 d)
- [ ] HN Show post.
- [ ] Reddit r/dyslexia, r/Accessibility, r/programming.
- [ ] Twitter/Mastodon thread with the demo gif.
- [ ] Email outreach: 5 dyslexia advocacy orgs.

---

## Cross-cutting concerns

### Testing strategy
- **TS engine**: vitest, fixture-driven, ≥250 assertions.
- **Rust engine**: cargo test, parity with TS via shared `data/test-fixtures/words.json`.
- **Web extension**: manual matrix on 7 sites + Playwright e2e (post-MVP nice-to-have).
- **Reader**: manual matrix on 6 source apps + recorded user-test session (post-launch).

### Performance budgets
| Surface | Budget |
|---|---|
| Web ext initial page pass | ≤100ms on 4k-word page |
| Web ext mutation batch | ≤16ms |
| Web ext bundle | ≤500KB minified |
| Reader cold start | ≤800ms |
| Selection capture end-to-end | ≤250ms |
| OCR snap end-to-end | ≤600ms for 600x300 region |
| Reader installer | ≤25MB |

### Privacy invariants (audited at every phase)
- No network requests except auto-updater check (Reader only, opt-out in onboarding).
- No telemetry.
- No third-party SDKs.
- Settings stored locally only (web ext uses `chrome.storage.sync` which user controls; Reader uses local file).

### Security checklist
- Web ext: no `unsafe-eval` CSP, no `<all_urls>` privileges beyond what's strictly needed, MV3 service worker not persistent.
- Reader: no exposure of capture pipelines to remote endpoints; clipboard restore on every capture; OCR is on-device.

### Engine accuracy gates (block release)
- Morpheme analyzer: ≥95% agreement with hand-verified 200-word fixture.
- Syllable splitter: ≥98% on CMUdict-sampled 100-word fixture.
- Cross-language (TS↔Rust) fixture parity: ≥98% structural agreement.

---

## Open questions to resolve before P0

1. **Tauri vs winit for Reader** — strong recommendation Tauri (P5.1). Confirm.
2. **CMUdict bundling in web extension** — bundle (~3MB extra), defer to download-on-demand, or omit entirely (Knuth-Liang only)? Recommendation: defer to download-on-demand, off by default.
3. **Code-signing budget** — paid cert (~$200/yr) for Reader? Defer to post-launch; ship unsigned with SmartScreen warning initially.
4. **Telemetry** — confirm zero telemetry forever. Strong recommendation: yes, zero. It's a differentiator and matches our values.
5. **Multilingual** — out of scope for v1 (English only). Confirm.

If any of these flip, only P5/P9/P10 are affected; P0-P4 are independent of them.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|:-:|:-:|---|
| Engine parity drift between TS and Rust | M | M | Shared fixture file, CI parity test |
| `Windows.Media.Ocr` API quirks on older Win10 | L | M | Detect at runtime, surface clear error |
| Selection capture races with apps that paste bigger payloads | L | L | Add 100ms grace period, retry once |
| Chrome Web Store rejection over `<all_urls>` | M | M | Be explicit in description; offer activeTab alternative behind a flag |
| Dictionary size makes web extension >500KB | M | L | Compact binary encoding, lazy-load on first analyze |
| Tauri bundle size (~12MB) raises eyebrows | L | L | Acceptable vs Electron's 150MB; document in README |
| Pivot fatigue (third architecture in a year) | M | M | The post-mortem makes the case clearly; the engine work survives both pivots |

---

## What "done" looks like at each shippable milestone

**End of P3 (Web extension live):**
- User installs extension from Chrome Web Store.
- Visits any article.
- Sees morpheme-coloured, syllable-spaced, properly-fonted body text in <100ms.
- Toggles, presets, per-site overrides all work.
- Copy-paste returns clean text.

**End of P9 (Reader v0.1 live):**
- User downloads installer from GitHub Releases.
- Installs in two clicks.
- Tray icon appears.
- Selects text in Word → presses `Ctrl+Shift+M` → Reader pops up with the passage beautifully reflowed and read-aloud-ready.
- OCRs a paragraph from a scanned PDF → same result.

**End of P10 (Launch):**
- README has install buttons for both products.
- Launch posts visible on HN/Reddit.
- 100 install signal in first week is a green light to keep iterating.

---

*Plan ready for review. On approval I will execute P0 immediately and iterate phase by phase.*
