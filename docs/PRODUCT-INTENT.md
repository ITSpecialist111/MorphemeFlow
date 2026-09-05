# MorphemeFlow Product Intent

**Status:** Authoritative product direction
**Last reviewed:** September 5, 2026

## Commander's intent

Build one coherent, free, local-first accessibility product that stays available over Windows and Android applications, browsers, and tools, and helps a person with dyslexia read without changing tools for each source.

The default interaction should remain in the source application. A screen focus band and optional tint support the original content directly. A nearby reading lens supplies morpheme highlighting, syllable spacing, accessible fonts, and speech when source text needs reformatting. Selection, sharing, and a full Reader remain available for longer passages.

This direction supersedes the July 2026 sidecar-only interpretation of "universal". It does not revive the archived per-glyph replacement experiment.

## User promise

1. **Available across applications.** Screen focus works independently of the app's text APIs. Windows supports a live pointer lens and selection/OCR capture. Android supports a movable focus band, user-requested OCR lens, and Share/Process Text. Browser enhancement remains optional.
2. **Never rewrites captured text.** Highlighting may add colour and visual spacing, but the rendered and copied character sequence must exactly reconstruct the captured text. OCR can misrecognize the screen, so OCR results must be labelled and must not be represented as lossless source extraction.
3. **Meaning, not a visual trick.** Prefixes, roots, suffixes, and inflections come from linguistic analysis. The product does not imitate position-based bolding.
4. **Useful immediately, adaptable later.** Balanced defaults work on first launch; fonts, spacing, colour intensity, themes, ruler, and speech remain adjustable.
5. **Private by construction.** Text analysis, OCR, speech, caching, and settings operate locally. No account, analytics, content upload, or MorphemeFlow server is allowed.
6. **One dependable experience.** One native installation per operating system supplies its screen tools and Reader. Both share the same reading concepts, local assets, and text-preservation rules. The optional extension provides higher-fidelity browser text styling.

## What “universal” means

Universal means an app-independent reading aid over ordinary application surfaces, with explicit operating-system exclusions. It does not mean that an external app can replace every glyph, bypass screen-capture protection, or draw on every secure system surface.

The archived DXGI/UI Automation experiment failed to align and replace source glyphs. A click-through focus layer needs no text geometry, and a separately laid-out lens needs no source-font matching. These supported overlays avoid that failure mode rather than assuming every overlay is impossible.

Current capability boundaries:

| Context | Surface | Mechanism |
|---|---|---|
| Ordinary Windows desktop apps and browsers | Screen focus | Native nonactivating, click-through layered windows on the pointer's monitor |
| Visible unprotected Windows text | Live reading lens | Bounded pointer-region OCR, changed-frame rejection, nearby reflow, pause and stop |
| Ordinary Android applications | Screen focus | User-enabled accessibility overlay, non-touchable focus layer, separate floating controls |
| Visible unprotected Android text | Reading lens | User-requested screenshot, crop to chosen band, bundled on-device OCR, labelled snapshot |
| Android text shared by another app | Reader | Share / Process Text, exact captured-text rendering |
| Standard web reading | Browser extension | Modify semantic DOM text while retaining exact original text |
| Selectable native text | Reader | Preserve the clipboard, synthesize Copy, reflow captured text |
| Images, scanned PDFs, inaccessible controls | Reader | Draw a screen region and run Windows OCR locally |
| Pasted or authored text | Reader | Direct local analysis |
| Long-form support | Reader | Adaptive typography, reading ruler, local text-to-speech |

Windows secure desktops, protected/DRM surfaces, some elevated windows, and exclusive fullscreen rendering are not guaranteed. Android protected windows, OS consent surfaces, device policy, and vendor restrictions can deny capture or overlays. Do not defeat those protections. Report inability and offer sharing/selection when available.

Windows lens recognition is sampled, not frame-synchronous. Android recognition is explicitly requested, not continuous monitoring. Neither platform has demonstrated arbitrary in-place font replacement. The combination is a product hypothesis, not a verified "world first" or a proven clinical intervention.

## Single-package direction

Windows ships an installer containing the screen tools and Reader. Android ships an APK containing its accessibility service, Reader, engine, OCR model, and fonts. A Windows executable and Android APK cannot be the same binary. The product must remain useful on either platform without a browser extension. Browser extension installation requires the browser's approved mechanism and explicit consent.

The suite should still feel singular:

- one name, visual language, privacy promise, and documentation set;
- equivalent presets, fonts, themes, colours, and engine fixtures;
- one Reader installer for universal capture and OCR;
- one Android package with user-enabled accessibility access and no Internet permission;
- optional store-installed browser enhancement for in-page fidelity;
- no duplicated account, cloud, or subscription layer.

A future installer may detect supported browsers and open official store listings, but it must never bypass browser consent.

## Non-negotiable constraints

- WCAG 2.1 AA minimum for controls, focus states, and colour contrast.
- Preserve source text exactly through analysis, rendering, removal, and copy/paste.
- Preserve the user's complete clipboard, including non-text formats, during selection capture.
- Zero MorphemeFlow network requests and zero telemetry.
- Screenshot pixels are transient. Android's API captures the display before cropping locally, so the consent disclosure must say so.
- Overlays must preserve ordinary app interaction. Turning off must cancel pending work and prevent late results reopening a lens.
- Screen focus and live capture require deliberate activation. Android accessibility permission must never be silently enabled.
- English analysis for the first release; do not imply validated support for other languages.
- Fonts must be redistributable under SIL OFL 1.1 or an equivalently permissive licence.
- Do not use Bionic Reading's brand, API, or position-based fixation method.
- Do not use BeeLine Reader's patented colour-gradient mechanism.
- Keep experimental overlay code archived and excluded from production builds.
- The new focus/lens implementations are separate from that archived glyph compositor.
- Reader installer target: under 25 MB, measured on release artifacts.

## Product acceptance gates

A release is not accepted merely because it compiles or an anchor-count metric is stable.

### Correctness

- Every transformed token and complete document reconstructs byte-for-byte or character-for-character as appropriate.
- Shared fixtures agree structurally between TypeScript and Rust engines.
- Browser disable/remove restores the exact original DOM text.
- Capture restores all clipboard formats whether capture succeeds, returns no text, or errors.
- Actual bundled fonts decode and load, not merely exist as files with font extensions.
- Capture geometry uses one coordinate system across DPI, display cutouts, rotation, and fold changes.
- Failed, stale, cancelled, and protected captures cannot display a new reading result.

### Real-world usefulness

- Selection capture is manually verified in at least Notepad, a Chromium browser, Word or WordPad-equivalent rich text, a PDF viewer, and an editor.
- OCR is manually verified on digital text, an image, and a scanned-document sample.
- Browser enhancement is visually verified on article, documentation, email/web-app, and dynamically updated pages.
- Evidence checks the *right reading content*, not only performance or stability.
- Native tests send clicks/touches through the focus layer to an independent test application and recognize a known sentence there.
- Android device tests cover overlay shutdown, screenshot protection, shared text, and rotation. Emulators do not replace physical-device acceptance.

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
