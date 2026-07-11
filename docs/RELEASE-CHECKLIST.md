# MorphemeFlow Release Checklist

Use this checklist for every public beta or stable release. A green build is necessary but not sufficient; visual evidence must show that the intended reading content is enhanced correctly.

## Automated gates

- [ ] `npm ci`
- [ ] `npm audit` reports zero known vulnerabilities
- [ ] `npm test` passes engine fixture and browser DOM suites
- [ ] `npm run lint` passes without warnings
- [ ] `npm run typecheck` passes
- [ ] `npm run build` produces the extension distribution
- [ ] `cargo fmt --all -- --check` passes
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` passes
- [ ] `cargo test --workspace` passes
- [ ] `cargo check --workspace` passes
- [ ] `npm run build:reader` produces MSI and NSIS artifacts
- [ ] Installed Reader size is measured and the installer target remains under 25 MB, or the exception is documented before release

## Exact-text safety

- [ ] Uppercase, mixed-case, apostrophe, hyphen, smart-quote, number, and punctuation samples reconstruct exactly
- [ ] Browser enable → disable restores exact source text
- [ ] Browser copy/paste returns the original plaintext
- [ ] Reader output's complete token sequence equals its input before rendering
- [ ] Selection capture restores a known plain-text clipboard value
- [ ] Selection capture restores rich text and an image clipboard sample
- [ ] Clipboard restoration is verified after success, no-selection, and source-app failure

## Reader matrix (Windows 10 and 11)

For each row, record version, latency, result, and a screenshot of the Reader output.

| Source | Selection capture | OCR snap | Correct text | Notes |
|---|---:|---:|---:|---|
| Notepad | [ ] | [ ] | [ ] | |
| Chromium browser | [ ] | [ ] | [ ] | |
| Firefox | [ ] | [ ] | [ ] | |
| Word or equivalent rich editor | [ ] | [ ] | [ ] | |
| Outlook/Teams/Slack equivalent | [ ] | [ ] | [ ] | |
| VS Code | [ ] | [ ] | [ ] | |
| Text PDF | [ ] | [ ] | [ ] | |
| Scanned PDF/image | N/A | [ ] | [ ] | |
| High-DPI secondary monitor | N/A | [ ] | [ ] | |

Additional Reader checks:

- [ ] Empty capture shows actionable feedback
- [ ] Empty/low-confidence OCR shows actionable feedback
- [ ] OCR selector never appears in the captured image
- [ ] OCR selector targets the monitor under the pointer and converts mixed-DPI coordinates correctly
- [ ] Customized capture and OCR shortcuts work after restart and cannot conflict
- [ ] Close hides to tray; tray Show, Hide, Capture, OCR, Settings, and Quit work
- [ ] Pin state, theme, font, sliders, feature toggles, onboarding state, and hotkeys persist
- [ ] TTS play/pause/resume/stop and current-word highlighting work with the installed WebView2 runtime
- [ ] Reading ruler works with pointer, footer button, and keyboard; reduced-motion preference is respected
- [ ] All bundled fonts load when installed offline

## Browser matrix

Capture before/after evidence at desktop and 200% zoom. Confirm body content is enhanced while navigation, forms, editors, code, and hidden UI remain untouched.

| Page type | Chromium | Firefox | Correct content | UI untouched | Dynamic updates |
|---|---:|---:|---:|---:|---:|
| Wikipedia article | [ ] | [ ] | [ ] | [ ] | N/A |
| News article | [ ] | [ ] | [ ] | [ ] | [ ] |
| GitHub rendered README | [ ] | [ ] | [ ] | [ ] | [ ] |
| Documentation site | [ ] | [ ] | [ ] | [ ] | [ ] |
| Substack/long-form article | [ ] | [ ] | [ ] | [ ] | N/A |
| Webmail message | [ ] | [ ] | [ ] | [ ] | [ ] |
| SPA/social feed | [ ] | [ ] | [ ] | [ ] | [ ] |

Additional browser checks:

- [ ] Per-site disable takes effect immediately and survives restart
- [ ] Global enable/disable and shortcut work
- [ ] Sync quota failure falls back to local storage
- [ ] Mutation-heavy pages remain responsive
- [ ] Extension internal/store/restricted pages fail gracefully
- [ ] No page-content or telemetry network requests originate from MorphemeFlow

## Accessibility

- [ ] Keyboard-only operation covers every Reader and popup control
- [ ] Focus order is logical and focus is always visible
- [ ] NVDA reads controls, status feedback, exact Reader text, and TTS state coherently
- [ ] Every theme and morpheme colour combination meets WCAG 2.1 AA for normal text
- [ ] 200% and 400% zoom do not hide essential controls
- [ ] Windows high-contrast mode remains usable
- [ ] `prefers-reduced-motion` removes nonessential motion

## Distribution and privacy

- [ ] Install MSI and NSIS artifacts on clean Windows virtual machines
- [ ] Test with WebView2 present and with the configured bootstrapper path
- [ ] Verify Windows reputation/signing behavior and document beta warnings
- [ ] Verify uninstall behavior and decide explicitly whether local preferences remain
- [ ] Inspect production network activity during analysis, OCR, TTS, settings, and browsing
- [ ] Confirm extension permissions match the published privacy explanation
- [ ] Include MIT license, font OFL notices, MorphoLex attribution, and third-party notices
- [ ] Update README progress, user guide, privacy date, store listing, and release notes

## Release evidence

Store release evidence under a dated directory outside the shipped binaries:

- test matrix with OS/browser/app versions;
- screenshots showing expected reading content;
- installer sizes and hashes;
- automated command outputs;
- known limitations and accepted exceptions;
- approver and release date.
