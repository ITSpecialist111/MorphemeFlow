# MorphemeFlow Privacy Policy

**Last updated:** September 5, 2026

## Summary

MorphemeFlow collects **zero** data. No analytics, no tracking, and no content requests to MorphemeFlow or any third party.

## Data Collection

MorphemeFlow does not collect, transmit, or store any personal data. Specifically:

- **No application network requests.** The extension and Reader never contact an external server. Text analysis, OCR, and speech happen on your device.
- **No analytics or telemetry.** We do not track usage patterns, page visits, or any user behavior.
- **No user accounts.** There is no sign-up, login, or authentication of any kind.
- **No third-party services.** No ads, no tracking pixels, no external scripts.

## Data Storage

The browser extension stores settings (font preferences, color choices, enabled features) using the browser's built-in `chrome.storage.sync` API with a `chrome.storage.local` fallback. This data:

- Is never transmitted by MorphemeFlow
- May be synchronized by your browser vendor through your browser profile if you enabled browser sync; MorphemeFlow does not control or receive that synchronization
- Can be deleted at any time by uninstalling the extension

A word analysis cache is stored locally to improve performance. It contains only common English words and their morpheme breakdowns — no page content or personal text.

The Windows Reader stores preferences in its local application-data directory. Captured text is held in memory only for the current Reader session and is not written to logs or sent anywhere.

### Clipboard capture

For selection capture, Reader temporarily asks the foreground application to copy the selected text. Before doing so it enumerates and duplicates every Windows clipboard format, including non-text formats. It restores those concrete copies before returning, whether capture succeeds, produces no text, or fails. Clipboard data is not persisted by MorphemeFlow.

### Screen OCR

The OCR selector captures only the rectangle explicitly drawn by the user. Pixels are passed to the built-in `Windows.Media.Ocr` engine on the device and discarded after recognition. MorphemeFlow does not save screenshots.

The optional Windows live lens repeatedly samples a bounded region around the pointer while enabled. It compares the pixels before and after recognition, rejects changed frames, and shows recognized text in a separate lens. It does not run until activated, and stopping it invalidates pending results. Recognized text can contain OCR mistakes.

Screen focus itself reads only pointer/display geometry. Its click-through panes do not read application text or take screenshots.

### Android

Android screen tools require explicit user activation in Accessibility settings. The service does not request app-content retrieval, gesture injection, touch exploration, or key filtering. A non-touchable focus layer passes input through to other apps; only the separate toolbar and reading lens receive input in their own bounds.

Tapping **Read screen band** requests an Android display screenshot. The full screenshot exists transiently in memory, then a local crop of the chosen band is submitted to the bundled ML Kit Latin OCR model. Pixels are released after recognition. There is no continuous capture, screenshot history, automatic document saving, or content logging. Protected content can be denied or blanked by Android.

The APK excludes `INTERNET` and `ACCESS_NETWORK_STATE`, including permissions declared by dependencies. WebView navigation is restricted to packaged assets, with file/content access and network loads disabled. The virtual `appassets.androidplatform.net` origin is served by `WebViewAssetLoader` locally, not fetched from that domain. OCR uses the bundled model, not an install-time model download.

Preferences remain in app-private storage. Backup and device-transfer rules exclude app data. Shared passages remain in memory, including across rotation, and Clear removes them from the active Reader. Incoming share-intent text is removed after consumption. The OS, keyboard, source application, and speech provider have their own policies outside MorphemeFlow's control.

### Text-to-speech and logs

Windows Reader selects an English voice marked `localService` by WebView2. Android selects an installed English voice that does not require a network connection. Missing offline voices produce visible feedback instead of selecting a cloud voice. Voice installation is managed by the operating system and may require a separate download.

Windows crash and operational messages are stored in `%APPDATA%\MorphemeFlow\logs\reader.log`. Android logs capture status and geometry failures, not recognized content. Logs are never transmitted automatically. Development tests explicitly save fixture screenshots as test evidence; production capture paths do not.

## Permissions Explained

- **"Read and change all your data on all websites"** (`<all_urls>`): Required to apply morpheme highlighting and reading environment styles to page text. The extension reads page text purely to identify words for highlighting. No text is stored or transmitted.
- **Storage**: Used to save your preferences locally.
- **Active Tab**: Used to communicate settings changes to the current page.

## Open Source

MorphemeFlow is fully open source under the MIT license. You can inspect every line of code at: https://github.com/your-username/Dyslexia-Solution

## Contact

For questions about this privacy policy, open an issue on our GitHub repository.
