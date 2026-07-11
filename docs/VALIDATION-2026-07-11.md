# MorphemeFlow Validation Checkpoint — July 11, 2026

This checkpoint records what was actually executed and observed while completing the universal-capture Reader beta and hardening the browser beta. It is not a substitute for the clean-machine and multi-browser release matrix in `RELEASE-CHECKLIST.md`.

## Automated results

| Gate | Result |
|---|---|
| `npm audit` | 0 vulnerabilities |
| TypeScript engine | 221 tests passed across 6 suites |
| Browser DOM layer | 4 tests passed |
| ESLint | Clean |
| TypeScript strict typecheck | Clean for engine and extension |
| Extension production build | Passed; 18 files, 2.83 MiB unpacked, no source maps |
| `cargo fmt --all -- --check` | Clean |
| `cargo clippy --workspace --all-targets -- -D warnings` | Clean |
| Rust engine | 22 unit tests passed |
| Shared Rust fixtures | 2 integration tests passed |
| `cargo check --workspace` | Clean |
| Tauri production build | Optimized EXE, MSI, and NSIS bundles generated |
| Optimized executable smoke test | Responsive `MorphemeFlow Reader` window from release binary |

## Native Reader runtime evidence

### Selection capture

A Windows Notepad RichEdit control was populated with and explicitly asserted to contain the selected sentence:

> The unfortunately complex reconstruction was helpful.

The foreground process and keyboard-focused editor were asserted before the global capture shortcut fired. Reader reported success and displayed that exact sentence with morpheme colour and syllable micro-spacing.

Clipboard preservation was tested in both failure and success paths:

- no selected text: original marker restored; actionable warning logged;
- selected text: original marker restored; success logged;
- rich clipboard: Unicode text, HTML, a custom application format, and a bitmap all retained their original values after a successful capture.

Capture now records the foreground source window when the hotkey fires, waits for modifiers to be released, re-focuses that source, waits for the clipboard sequence to change, and restores concrete duplicates of every clipboard format.

### Screen OCR

The real transparent OCR selector was launched through the global shortcut. Window enumeration confirmed:

- selector visible;
- main Reader hidden while selection was active;
- selector hidden and Reader visible after completion.

A controlled local target rendered `MorphemeFlow OCR validation` in 34-point Segoe UI on white. Drawing a rectangle around it produced the exact recognized text in Reader. A monospace Notepad sample was also routed correctly but showed recognition errors, confirming that OCR quality depends on source rendering; this limitation remains documented rather than being hidden by a generic success metric.

### Reader interface

The actual native WebView was visually checked at the configured 480×720 window size for:

- onboarding navigation;
- empty/paste state;
- analyzed reading view;
- settings panel;
- combined morpheme and syllable rendering;
- transparent OCR selector;
- visible status feedback.

## Exact-text invariants

Both engines now project normalized linguistic analysis back onto the original surface spelling. Regression cases cover uppercase, mixed case, apostrophes, hyphens, lexical stem changes, punctuation, rule analysis, and syllable fallback.

The browser DOM tests verify that:

- transformed text remains character-for-character identical;
- removal restores original text;
- morpheme colour and zero-text syllable gaps can coexist;
- semantic article content is processed while navigation is skipped;
- pages without a semantic main root fall back to prose containers instead of arbitrary UI text.

## Production artifacts

| Artifact | Size | SHA-256 |
|---|---:|---|
| `reader-windows.exe` | 11.42 MiB | `4D78838C279558787BAFBC459C11C5B68640A7676CAACB64354D83861C262B8A` |
| MSI installer | 3.80 MiB | `8827CC5AD0788BA95CF74D07F1BC2BEEC037A58849DE9682EEE0EA25C3731CD3` |
| NSIS installer | 2.69 MiB | `32A542E8DFCBC1425CFA946849E0F1332133FBC1B41FF016D6EB4A996FE08F11` |

All artifacts are below the 25 MiB product target. Hashes apply to this checkpoint and change on any subsequent rebuild.

## Deliberately remaining release gates

- Clean Windows 10 and Windows 11 virtual-machine installation/uninstall tests.
- Code signing and Windows reputation behavior.
- Full real-site Chromium/Firefox evidence matrix, including webmail and mutation-heavy SPAs.
- WCAG colour-contrast, 200%/400% zoom, high-contrast, and NVDA audit.
- Deeper Rust/TypeScript syllable-boundary parity; Rust currently uses the documented deterministic fallback while TypeScript uses Hypher/Knuth-Liang.
- Chrome Web Store and Mozilla Add-ons submission.

These are public-release gates, not hidden implementation stubs. The standalone Reader's core input → local analysis → accessible reflow journeys are implemented and verified at this checkpoint.
