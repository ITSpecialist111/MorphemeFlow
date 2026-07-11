# Zero-Latency Universal Overlay (Archived Experiment)

This directory contains the archived code from MorphemeFlow's universal screen overlay experiment (March–April 2026). The approach used DXGI Desktop Duplication + UIA text scanning + Direct3D 11 compositing to paint morpheme highlights directly onto any application's screen output.

**This approach was abandoned** because UIA cannot provide per-glyph positions for body text in browsers or Office, making accurate overlay alignment impossible. See [docs/POSTMORTEM-OVERLAY.md](../../docs/POSTMORTEM-OVERLAY.md) for the full post-mortem.

The project has pivoted to a **browser extension** (DOM-level, pixel-perfect) and a **native reader app** (reflows captured text in its own window).
