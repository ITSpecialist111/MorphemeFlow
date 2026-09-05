# MorphemeFlow Android

Android 11+ accessibility focus overlay, local OCR reading lens, and Share/Process Text Reader. The TypeScript engine and Windows Reader's lossless renderer are bundled with the fonts. Google ML Kit's Latin recognition model is bundled for offline use. The app has no Internet permission.

## Build

Install Node.js 22+ (24 tested), JDK 17+, and Android SDK platform 36. Set `ANDROID_HOME` to the SDK directory. Install the repository's npm dependencies first. The pinned Gradle wrapper verifies its distribution SHA-256.

From the repository root on Windows:

```powershell
npm install
npm run test:fonts
npm run test:android:assets
.\apps\reader-android\gradlew.bat -p apps/reader-android testDebugUnitTest lintDebug assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk` relative to this directory. This is a debug-signed test build. A release needs a separately managed signing key and store review. No signing credentials are committed.

On other hosts, use `./apps/reader-android/gradlew` with the same arguments. The asset staging task requires `node` on PATH and installed workspace npm dependencies. Build-time dependency downloads are separate from the installed app's offline operation.

## Device Tests

Use an isolated emulator or dedicated test device. Instrumentation temporarily enables the accessibility service using test-only shell identity and restores the preceding settings afterward. This does not change the production consent flow.

```powershell
.\apps\reader-android\gradlew.bat -p apps/reader-android connectedDebugAndroidTest
```

Tests cover touch-through to a separate application, exact OCR of known text, protected-screen refusal/blanking, no Internet permission, clearing, sharing, and passage retention across rotation. Screenshots are test-only artifacts under the app's external test files directory. Physical-device, TalkBack, large-text, folding, battery, and release-signing checks remain necessary.

## Privacy And Dependencies

The service requests screenshot capability but not app-content retrieval, gestures, key filtering, or touch exploration. Text remains in memory. Backup and device-transfer rules exclude app data. Android screenshots are transient full-display images cropped locally before OCR.

The app source is MIT licensed. AndroidX is Apache-2.0 licensed. Google ML Kit is a bundled proprietary SDK governed by [Google's ML Kit terms](https://developers.google.com/ml-kit/terms), not an open-source OCR engine. Font OFL notices are included with the assets. No cloud model or account is required.

See [the screen-tools guide](../../docs/SCREEN-TOOLS.md) and [privacy policy](../../docs/PRIVACY.md).