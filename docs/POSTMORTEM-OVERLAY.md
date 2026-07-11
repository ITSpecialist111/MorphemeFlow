# Post-Mortem: Universal Screen Overlay Approach

**Date:** April 2026
**Duration of experiment:** ~2 weeks (late March – early April 2026)
**Outcome:** Abandoned — architectural limitations, not implementation bugs

---

## What we built

A native Rust daemon that:
1. Captured the entire desktop framebuffer via **DXGI Desktop Duplication** at ~120 Hz
2. Scanned for text regions using **Windows UI Automation (UIA)**
3. Rendered morpheme-highlighted overlay text using **Direct3D 11 + DirectComposition**
4. Aimed to work universally across all Windows applications

The daemon ran successfully: 1.6 MB binary, 17/17 tests passing, detecting 8+ text anchors and 11+ semantic regions per frame.

## What went wrong

### Evidence from test matrix screenshots

| Scenario | What got enhanced | What should have been enhanced |
|---|---|---|
| BBC News in Edge | Edge welcome dialog text ("Welcome to Microsoft Edge") | Article headlines and body copy |
| Wikipedia article | Edge dialog again | Article text ("While dyslexia is more often diagnosed in boys...") |
| Notepad with 200 lines | Status bar ("Line 200", "UTF-8") | The 200 lines of body text |
| OpenAI docs | Nothing (FAILED — zero anchors) | Documentation content |

### Root causes (structural, not bugs)

1. **UIA returns the wrong text.** `FindAll(TreeScope_Subtree, TrueCondition)` returns every accessible element — buttons, tabs, status bars, modals. Browser body text is collapsed into a single `Document` control. There is no signal to distinguish "what the user is reading" from "UI chrome."

2. **No per-glyph positions.** UIA gives bounding rects of *controls*, not of individual words or glyphs. `IUIAutomationTextPattern.GetVisibleRanges()` returns ranges, not per-line positions. We cannot align overlay text to the underlying document.

3. **Cannot hide original text.** There is no mechanism to make the source app's text invisible. Painting on top creates "double vision." Painting opaque backgrounds blocks interactivity.

4. **Font mismatch.** We rendered at a fixed font/size regardless of the source app. Browsers, Word, and IDEs all use different fonts at different sizes. The result is duplication, not transformation.

5. **Scroll desync.** UIA scans at ~250ms cadence; scroll events fire at 60+ Hz. DXGI move-rects can translate anchor positions, but the underlying text has been re-laid out by the app during scroll. Drift is inevitable.

6. **Test harness measured the wrong thing.** The matrix test checked anchor-count jitter (`visible_jitter <= 7`), not whether the correct text was enhanced or whether overlay positions matched underlying glyphs. 6/6 PASS was meaningless.

## What the OS would need to provide for this approach to work

For a future contributor considering this path, here's what would be required:

- **Per-glyph bounding boxes** from every application's text rendering pipeline (equivalent to browser DOM `getClientRects()` but at the OS level)
- **Font metadata** for rendered text (family, size, weight, color, line-height)
- **Semantic text role** distinguishing "body content the user is reading" from "UI chrome"
- **A compositing hook** that can replace or transform glyph runs in the framebuffer without blocking interactivity
- **Sub-frame latency** synchronization between the text position query and the composite

None of these exist on Windows, macOS, Linux, Android, or iOS. This is why every shipping reading aid (Bionic Reading, Helperbird, Immersive Reader, BeeLine) works per-context, not universally.

## What we kept

- **`crates/engine/`** — the Rust morpheme analysis engine. This was always platform-independent and carries forward into the Reader app.
- **The test infrastructure** — integration tests, fixture files, and the matrix harness scripts are preserved under `experiments/zero-latency-overlay/` for reference.
- **The research** — typography research, morpheme databases, and font analysis all carry forward.

## Lessons

1. **Validate the hardest assumption first.** We should have built a minimal "does UIA give us the right text with the right positions?" test before building the full compositor pipeline.
2. **Test what matters.** A test suite that checks stability metrics but not correctness gives false confidence.
3. **Per-context beats universal** for text manipulation. The DOM gives us everything we need in browsers; clipboard capture + reflow gives us everything for native apps.

## New approach

- **MorphemeFlow Web** — Browser extension (MV3). DOM-level, pixel-perfect morpheme highlighting.
- **MorphemeFlow Reader** — Native sidecar window. Captures text via clipboard/OCR, reflows with morpheme highlighting and TTS.

See [STRATEGY-V2.md](../../STRATEGY-V2.md) and [PLAN-V2.md](../../PLAN-V2.md).
