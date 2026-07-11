# MorphemeFlow Privacy Policy

**Last updated:** July 11, 2026

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

### Text-to-speech and logs

Reader uses the local WebView2/Windows speech facilities. Crash and operational messages are stored in `%APPDATA%\MorphemeFlow\logs\reader.log`; captured text is not included. Logs are never transmitted automatically.

## Permissions Explained

- **"Read and change all your data on all websites"** (`<all_urls>`): Required to apply morpheme highlighting and reading environment styles to page text. The extension reads page text purely to identify words for highlighting. No text is stored or transmitted.
- **Storage**: Used to save your preferences locally.
- **Active Tab**: Used to communicate settings changes to the current page.

## Open Source

MorphemeFlow is fully open source under the MIT license. You can inspect every line of code at: https://github.com/your-username/Dyslexia-Solution

## Contact

For questions about this privacy policy, open an issue on our GitHub repository.
