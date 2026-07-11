# MorphemeFlow Product Intent

**Status:** Authoritative product direction
**Last reviewed:** July 11, 2026

## Commander's intent

Build one coherent, free, local-first accessibility product that lets a person with dyslexia take text from any application or web browser and immediately read it in a calmer, linguistically meaningful form.

The user should not need to understand morphemes, configure a pipeline, upload a document, create an account, or choose a different tool for every source. Select text and press one shortcut; if text cannot be selected, draw around it. MorphemeFlow does the rest on the local machine.

## User promise

1. **Works wherever reading happens.** Browser articles receive precise DOM enhancement. Word, Outlook, Teams, Slack, editors, PDF viewers, images, games, and locked surfaces feed the always-available Reader through selection capture or OCR.
2. **Never changes the words.** Highlighting may add colour and visual spacing, but the rendered and copied character sequence must exactly reconstruct the source text.
3. **Meaning, not a visual trick.** Prefixes, roots, suffixes, and inflections come from linguistic analysis. The product does not imitate position-based bolding.
4. **Useful immediately, adaptable later.** Balanced defaults work on first launch; fonts, spacing, colour intensity, themes, ruler, and speech remain adjustable.
5. **Private by construction.** Text analysis, OCR, speech, caching, and settings operate locally. No account, analytics, content upload, or MorphemeFlow server is allowed.
6. **One dependable experience.** The Reader is the universal Windows hub and distributable package. The browser extension is the high-fidelity web surface of the same product, not a competing product.

## What “universal” means

Universal means **coverage of the user's reading journey**, not an unsupported claim that Windows lets an external process replace every glyph inside every application.

The archived DXGI/UI Automation experiment proved that a literal framebuffer text overlay cannot reliably identify body content, obtain per-glyph geometry, hide source glyphs, preserve interaction, or remain synchronized while scrolling. That route is closed unless operating-system capabilities materially change.

MorphemeFlow achieves universal coverage through the best local source available in each context:

| Context | Surface | Mechanism |
|---|---|---|
| Standard web reading | Browser extension | Modify semantic DOM text while retaining exact original text |
| Selectable native text | Reader | Preserve the clipboard, synthesize Copy, reflow captured text |
| Images, scanned PDFs, games, inaccessible controls | Reader | Draw a screen region and run Windows OCR locally |
| Pasted or authored text | Reader | Direct local analysis |
| Long-form support | Reader | Adaptive typography, reading ruler, local text-to-speech |

The Reader is an always-on-top **reading sidecar**, which users may place over or beside other applications. It does not pretend to transform inaccessible source glyphs in place.

## Single-package direction

The Windows Reader installer is the primary standalone package and must remain useful without a browser extension. Browser security policies require users to install extensions through each browser's approved extension mechanism; MorphemeFlow must not silently side-load or alter browser policy.

The suite should still feel singular:

- one name, visual language, privacy promise, and documentation set;
- equivalent presets, fonts, themes, colours, and engine fixtures;
- one Reader installer for universal capture and OCR;
- optional store-installed browser enhancement for in-page fidelity;
- no duplicated account, cloud, or subscription layer.

A future installer may detect supported browsers and open official store listings, but it must never bypass browser consent.

## Non-negotiable constraints

- WCAG 2.1 AA minimum for controls, focus states, and colour contrast.
- Preserve source text exactly through analysis, rendering, removal, and copy/paste.
- Preserve the user's complete clipboard, including non-text formats, during selection capture.
- Zero MorphemeFlow network requests and zero telemetry.
- English analysis for the first release; do not imply validated support for other languages.
- Fonts must be redistributable under SIL OFL 1.1 or an equivalently permissive licence.
- Do not use Bionic Reading's brand, API, or position-based fixation method.
- Do not use BeeLine Reader's patented colour-gradient mechanism.
- Keep experimental overlay code archived and excluded from production builds.
- Reader installer target: under 25 MB, measured on release artifacts.

## Product acceptance gates

A release is not accepted merely because it compiles or an anchor-count metric is stable.

### Correctness

- Every transformed token and complete document reconstructs byte-for-byte or character-for-character as appropriate.
- Shared fixtures agree structurally between TypeScript and Rust engines.
- Browser disable/remove restores the exact original DOM text.
- Capture restores all clipboard formats whether capture succeeds, returns no text, or errors.

### Real-world usefulness

- Selection capture is manually verified in at least Notepad, a Chromium browser, Word or WordPad-equivalent rich text, a PDF viewer, and an editor.
- OCR is manually verified on digital text, an image, and a scanned-document sample.
- Browser enhancement is visually verified on article, documentation, email/web-app, and dynamically updated pages.
- Evidence checks the *right reading content*, not only performance or stability.

### Accessibility and resilience

- Complete keyboard operation and visible focus.
- All themes meet contrast requirements.
- Reduced-motion preference is respected.
- Capture failures and empty OCR results produce actionable visible feedback.
- Settings and customized hotkeys survive restart and safely fall back when registration fails.

### Privacy and distribution

- Production artifacts make no content or telemetry requests.
- Store permissions are minimal and explained.
- Installer and extension include all required local assets and third-party notices.
- Clean-machine installation and uninstall are tested before public release.

## Priority order

When choices conflict, optimize in this order:

1. Preserve user text and data.
2. Put the correct reading content in front of the user.
3. Keep capture fast and reliable.
4. Maintain accessibility and readability.
5. Preserve local-only privacy.
6. Improve linguistic depth and cross-engine parity.
7. Add convenience and visual polish.

This order exists because a stable, attractive transformation of the wrong text is still a failed product.
