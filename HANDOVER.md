# Project Periphery: Complete Handover
**Date:** April 6, 2026  
**Status:** Native Windows 11 prototype is running end-to-end with morpheme text rendering and automated matrix validation.

## Mission
Deliver a universal low-latency dyslexia overlay for Windows 11 that follows scrolling across any app/browser and applies meaningful reading transforms (not just highlight boxes).

## Architecture (Implemented)
Runtime is split into three cooperating loops:

1. **Where loop (fast frame/motion substrate)**
   - `crates/compositor/src/lib.rs`
   - DXGI Desktop Duplication frame capture
   - Move rect + dirty rect metadata extraction
   - Dirty-region-only GPU readback via staging texture

2. **What loop (semantic intake)**
   - `crates/overlay-daemon/src/uia.rs`
   - UIA foreground-window scan for visible text-like elements
   - Text normalization, merge, dedupe, ranking, noise filtering

3. **Track + Render loop**
   - `crates/overlay-daemon/src/tracker.rs`
   - `crates/overlay-daemon/src/overlay_window.rs`
   - Motion-aware anchor tracking with confidence and dirty-signature stability
   - Transparent click-through Win32 overlay that now draws morpheme-colored text

## What Changed In The Latest Iteration

### 1) Morpheme rendering is now live in overlay output
File: `crates/overlay-daemon/src/overlay_window.rs`
1. Integrated `engine::MorphemeAnalyzer` into renderer.
2. Replaced default view from border-only debug boxes to morpheme-colored text painting.
3. Added segment-level coloring:
   - Prefix: amber
   - Root: mint green
   - Suffix: cool blue
   - Unknown: neutral gray

### 2) Flicker/churn reduction in paint loop
File: `crates/overlay-daemon/src/overlay_window.rs`
1. Kept double-buffered draw path (memory DC + blit).
2. Added redraw gating: overlay invalidates only when `snapshot.frame_index` changes.
3. Kept click-through behavior (`WM_NCHITTEST -> HTTRANSPARENT`).

### 3) Debug noise moved behind explicit flags
File: `crates/overlay-daemon/src/overlay_window.rs`
1. `PERIPHERY_DEBUG_BOXES=1` to show anchor rectangles.
2. `PERIPHERY_DEBUG_OVERLAY=1` to show telemetry HUD.
3. Both are off by default so users see transformed text, not diagnostic clutter.

### 4) Engine analysis upgraded from placeholder
File: `crates/engine/src/analyzer.rs`
1. Added heuristic prefix/suffix inventory and longest-match splitting.
2. Added punctuation-edge handling.
3. Added/updated unit tests for core split behavior and punctuation preservation.

## Current Runtime Behavior
1. Launch `overlay-daemon`.
2. Overlay tracks foreground text regions while scrolling and window switching.
3. Overlay paints morpheme-colored text in detected regions.
4. Debug visuals are optional via env flags.

## Validation (Latest)

### Local test/build
1. `cargo test --workspace` passed.
2. `cargo run --bin overlay-daemon` smoke check: process remains running and responsive.

### Automated matrix
Executed on April 6, 2026:
1. `powershell -ExecutionPolicy Bypass -File scripts/overlay-matrix-test.ps1 -DurationSeconds 6 -ScrollEvents 8 -MinSamples 2`
2. Output directory: `test-results/overlay-matrix/20260406-184848/`
3. Result: PASS `6/6`, FAIL `0`
4. Jitter gate enforced:
   - `visible_jitter <= 7.0`
   - `semantic_jitter <= 6.0`
5. Report files:
   - `test-results/overlay-matrix/20260406-184848/report.md`
   - `test-results/overlay-matrix/20260406-184848/report.json`

## Run Instructions
From repo root:

```bash
cargo run --bin overlay-daemon
```

Optional debug toggles:

```powershell
$env:PERIPHERY_DEBUG_BOXES="1"
$env:PERIPHERY_DEBUG_OVERLAY="1"
cargo run --bin overlay-daemon
```

## Known Gaps / Not Final Yet
1. Renderer is still GDI-based; DirectComposition/DirectWrite migration is still outstanding.
2. Morpheme analyzer is heuristic (not yet dictionary-grade MorphoLex parity).
3. UIA can miss text in heavily custom-rendered apps.
4. Multi-monitor/output routing still needs hardening for all display topologies.
5. No finalized product shell yet (settings UI, hotkeys, tray integration in native stack).

## Next Priority Work
1. Replace GDI text output with DirectWrite + DirectComposition for sharper glyph control and perf.
2. Add line-aware token layout (better multiline clipping and typography controls).
3. Expand analyzer with dictionary-backed morphology and confidence scoring.
4. Add dedicated performance telemetry (paint time, tracker latency, UIA scan cost).
5. Extend matrix harness with frame-time/cadence jitter (timestamp-based), not just anchor-count jitter.

## Primary Files
1. Capture substrate: `crates/compositor/src/lib.rs`
2. Runtime orchestrator: `crates/overlay-daemon/src/main.rs`
3. Tracker: `crates/overlay-daemon/src/tracker.rs`
4. Semantic intake: `crates/overlay-daemon/src/uia.rs`
5. Renderer: `crates/overlay-daemon/src/overlay_window.rs`
6. Morpheme analyzer: `crates/engine/src/analyzer.rs`
