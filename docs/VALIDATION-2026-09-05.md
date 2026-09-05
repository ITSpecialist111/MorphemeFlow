# Screen Tools Validation - September 5, 2026

Status: tested Windows release build and Android debug prototype. Not a signed public release, all-app guarantee, clinical validation, or verified first-of-its-kind claim.

## Windows 0.1.1 Feedback Follow-Up

The user reported a non-working Windows Close button and no improvement in their test subject's reading experience.

The actual-window regression reproduced the lens defect: its enabled state became false and its text cleared, but the native window remained visible. The lens was shown through Win32 and hidden through Tauri. Hiding now uses `ShowWindow(SW_HIDE)` consistently with native presentation. The main Reader's X also now exits rather than silently hiding to the tray. A shutdown lifecycle waits for active selection capture to complete clipboard restoration and prevents new screen-tool activation while closing. Tray Hide Reader remains explicit background operation.

The lens also ignored letter spacing, word spacing, syllable-gap size, line height, and highlight intensity. Reader and lens now share one typography implementation and receive preference updates even while the lens is paused. Both expose a style selector with a Plain text comparison. Subtle/Balanced use Atkinson, Spacious uses 24px Lexend. Valid saved font choices remain unchanged until a preset is deliberately chosen. Manual adjustments leave Plain mode so controls take effect.

Executed on the completed 0.1.1 code:

| Check | Result |
|---|---|
| Reader JavaScript unit tests | 16 passed, including complete typography parity and lossless Plain/assisted switching |
| Windows Rust unit tests | 12 passed, including idle close, close during capture, and capture refusal during shutdown; interactive smoke test excluded from this count |
| Strict Windows Clippy | Passed |
| Actual release application regression | Passed: computed typography changes, paused synchronization, manual settings from Plain mode, native lens visibility after Close, reopen, narrow layout, and main X exit with screen tools enabled |
| Release packaging | MSI and NSIS built for 0.1.1; delivery copy SHA-256 verified |

Reproduce the owned-process regression after building the app and fixture:

```powershell
cargo build -p reader-windows --bin reader-windows --example screen_fixture
node --test apps/reader-windows/test/windows-feedback.test.mjs
```

Set `MORPHEMEFLOW_READER_EXE=target/release/reader-windows.exe` to exercise the release executable. The test uses a temporary WebView2 profile and closes only its own Reader and fixture processes. Screenshots are in `test-results/windows-feedback/`.

Current Windows installer: `dist/MorphemeFlow-Windows-0.1.1-Setup.exe` (2.74 MiB). The existing `dist/MorphemeFlow-Windows-Setup.exe` path is updated to the same file. SHA-256:

```text
C1799AA1654EF00CC4913AD4B5AEDECAEFF2F863241FFC804A157D2AC4631B44
```

The subject's lack of reading benefit is not resolved by these automated checks. They prove that controls and presentation work, not that this intervention improves comfort, speed, or comprehension. Screen focus alone only dims/tints the source. A further trial must evaluate the lens/Reader styles with the person reading, and change the intervention if there is still no benefit. No new Android build or Android device testing was performed for this Windows-specific follow-up.

The remaining sections record the initial 0.1.0 implementation and its evidence.

## Result

The project now contains genuine native cross-app focus overlays on Windows and Android. Nearby OCR reading lenses reuse the linguistic renderer instead of trying to replace source glyphs. Windows supports an opt-in live pointer lens. Android supports a user-requested band snapshot and Share/Process Text. The existing full Reader and optional browser extension remain intact.

The revised [product intent](PRODUCT-INTENT.md) supersedes the July sidecar-only interpretation. [Screen tools](SCREEN-TOOLS.md) documents architecture, controls, and operating-system limits.

## Executed Checks

| Check | Result |
|---|---|
| Existing TypeScript engine | 221 tests passed |
| Existing browser DOM suite | 4 tests passed |
| Reader JavaScript | 12 tests passed: lossless rendering, Unicode, segmentation fallback, settings, cancellation, independent stop control, offline-only voice selection |
| Android shipped JavaScript bundle | 2 tests passed: exact text, morphemes, syllables, HTML injection safety, bounded settings and long tokens |
| Font integrity | All 7 font files have valid font signatures |
| TypeScript / ESLint / extension build | Passed |
| Rust workspace | 33 tests passed: 24 engine/fixture tests and 9 screen-focus/lens geometry/settings tests |
| Native Windows smoke test | Passed separately with `--ignored`: actual mouse input through the overlay, unchanged foreground focus, capture exclusion, exact OCR sentence, and layer removal |
| Windows rustfmt / strict Clippy | Passed |
| Windows release build | EXE, MSI, and NSIS generated |
| Actual release Reader runtime | Passed: three font families load, toolbar toggles, pasted text, narrow layout, selection capture from a separate native application, live OCR, changed source refresh, left alignment, pause, and physical emergency hotkey |
| Android unit tests | 6 passed: portrait/landscape/foldable bounds, rotation rejection, crop validation, constrained lens placement |
| Android lint | Completed with no errors. Warnings remain for localization, pinned dependency versions, and API/style recommendations |
| Android debug APK | Built and installed on a local Android 16/API 36 foldable emulator |
| Android instrumentation suite | 4 passed in 59.086 seconds: touch-through plus exact OCR, protected-screen no-result behavior, sharing/clearing, rotation retention |
| Phone/tablet web rendering | 390px and 820px views: no horizontal overflow or header overlap, all three font families loaded, no JavaScript page errors |
| Editor diagnostics | No errors in the touched application and verification files |
| npm audit, production dependencies | 0 vulnerabilities |
| npm audit, complete development tree | 5 advisories: 1 moderate, 4 high, all transitive development dependencies |

The Windows native fixture rendered **Reading independently**, which both Windows OCR and Android OCR recognized exactly in their respective independent test applications. The Windows live lens also updated to **Understanding information** after the fixture changed. Tests use known fixture content, not private application text.

## Defects Found By Runtime Testing

- The Android overlay omitted the camera-cutout area, producing 2076x2016 overlay coordinates for a 2076x2152 screenshot. Capture now uses full-display coordinates and inset-safe control positions.
- Lexend and three OpenDyslexic assets were GitHub HTML pages saved with font extensions. They were replaced with upstream binaries and actual OFL notices. Binary validation and browser font-load assertions now detect this failure.
- A stop button reused the hotkey-recorder CSS class and could lose its label. It now has independent styling and a regression test.
- `Ctrl+Shift+Esc` is reserved by Windows for Task Manager. Emergency stop now uses **Ctrl+Alt+Shift+Esc**, verified by native injected key events.
- Short lens text was centered and large lenses could cover their source region. Text is now left-aligned and lens placement shrinks to the available space or refuses when space is insufficient.
- Syllable spacer elements created word-internal line breaks on phone screens. Shared word wrappers now keep fitting words together, verified at 390px without overflow.

Earlier Android harness runs exposed fixture packaging, button-label casing, scoped test-permission cleanup, and emulator wake-up issues. Those are corrected. A later first-view timeout was observed while the invalid fonts were still bundled. The font-corrected APK passed all four device tests. The subsequent shared word-wrap CSS correction was verified in Playwright, then both packages were rebuilt. Full native workflow suites were not repeated after that CSS-only rebuild. This is not evidence of exhaustive long-run reliability.

## Packages

| Artifact | Size |
|---|---|
| Windows release executable | 11.73 MiB |
| Windows MSI | 3.85 MiB |
| Windows NSIS installer | 2.74 MiB |
| Android all-architecture debug APK, including local OCR | 51.13 MiB |

Windows remains below the 25 MiB installer target. Android includes multiple native OCR architectures and is not subject to that Windows installer target. No production signing key was created or requested.

SHA-256 of the final builds:

```text
reader-windows.exe
A44ABF496341C7A6B25E8AF94A30AD9354EA403DCC370BA6CDFA956BC3CF820A

MorphemeFlow Reader_0.1.0_x64_en-US.msi
E17813468CB38D76B2E73E2E6970A1BBBC759AC480AB3E1B293B51F1092E25DA

MorphemeFlow Reader_0.1.0_x64-setup.exe
9BA10BD262F26454A58A5CF567C8B0572D7312AB6A59A44FFCFA47C5139C8786

app-debug.apk
757D47A57F23453CA86EA62E137B49E13D3D55FB75F7DB13B8C7EEE31D6D3609
```

The initial delivery used `dist/MorphemeFlow-Windows-Setup.exe` and `dist/MorphemeFlow-Android.apk`. The Windows path now contains 0.1.1 as documented above; Android is unchanged. The hashes in this initial-build section are historical. Build outputs and screenshots are ignored generated artifacts, not source files to commit.

## Repeat The Checks

Use Node.js 22+ (24 tested), the Rust Windows toolchain, JDK 17+, Android SDK platform 36, and `ANDROID_HOME`. Install npm dependencies before building Android assets.

```powershell
npm test
npm run test:reader
npm run test:android:assets
npm run typecheck
npm run lint
npm run build
cargo fmt --all -- --check
cargo clippy -p reader-windows --all-targets -- -D warnings
cargo test --workspace
cargo test -p reader-windows native_overlay_passes_clicks_without_taking_focus --lib -- --ignored --test-threads=1
npm run build:reader
.\apps\reader-android\gradlew.bat -p apps/reader-android testDebugUnitTest lintDebug assembleDebug
.\apps\reader-android\gradlew.bat -p apps/reader-android connectedDebugAndroidTest
```

The desktop smoke test moves the pointer and creates a temporary fixture. Run it on an interactive test desktop. The runtime JavaScript test uses `apps/reader-windows/test/runtime.test.mjs`, a separately built `screen_fixture` example, and an explicit localhost WebView2 test port. Do not ship or leave that debug endpoint enabled.

Android instrumentation must run on an isolated emulator or dedicated test device. It temporarily changes accessibility settings using test-only shell identity, restores them, and saves fixture screenshots for review. Production activation still requires user consent. The test emulator here used read-only mode without saving its snapshot.

## Remaining Release Gates

R1. Physical Android device coverage, including vendor accessibility restrictions, actual fold/unfold transitions, screen lock during OCR, TalkBack, large font sizes, battery usage, and Play accessibility-policy review. Android 11-15 were not device-tested here.

R2. Real-world Windows application matrix, mixed-DPI multi-monitor hardware, screen-reader/high-contrast testing, protected/elevated/fullscreen behavior, and sustained capture latency. The controlled fixture proves a working mechanism, not every application's compatibility.

R3. Clean-machine Windows install/uninstall, signing/SmartScreen, Android release signing, and store distribution. Installers were built, not installed over the user's system.

R4. Resolve development dependency advisories before public release: `@humanfs/node`, `brace-expansion`, `js-yaml`, `nanoid`, and `postcss`. No unrelated automatic dependency upgrade was applied.

R5. Usability trials with dyslexic readers and broader linguistic/OCR accuracy evaluation. Morphological-awareness research does not validate this exact visual intervention. Rust and TypeScript still have different syllable fallback implementations.

R6. Expand the existing browser real-site matrix and full WCAG audit. New phone/tablet and controlled native tests do not substitute for those gates.

## Visual Evidence

Generated screenshots are under `test-results/screen-tools/`: Windows Reader, narrow Reader, live lens, Android cross-app lens, shared Reader, rotated Reader, and phone/tablet bundled views. They show known test content only. The screenshot folder is intentionally ignored by Git.