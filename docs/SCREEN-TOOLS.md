# Cross-App Screen Tools

MorphemeFlow combines an app-independent focus overlay with a reading lens. Focus supports the original screen directly. The lens reflows captured text with morpheme colours, syllable spacing, and accessible fonts without pretending to replace the app's glyphs.

## Windows

Start the Reader, then enable **Screen focus** or **Live lens** in its toolbar. Both start disabled. The system tray also controls them.

| Control | Action |
|---|---|
| `Ctrl+Shift+F` | Toggle screen focus |
| `Ctrl+Shift+L` | Toggle the live reading lens |
| `Ctrl+Alt+Shift+Esc` | Stop both screen tools and cancel pending lens results |
| `Ctrl+Shift+M` | Read selected text, preserving clipboard formats |
| `Ctrl+Shift+R` | Draw a rectangle for local OCR |

Screen focus follows the pointer's monitor. Settings control band height, surround dimming, tint, and pointer tracking. Disable pointer tracking to hold its position. These layers pass mouse input through and do not take keyboard focus. They do not require a browser extension or text access.

The live lens samples approximately 760 by 100 logical pixels around the pointer, clipped to the app window and current display. It places the reading result above or below that source region and shrinks to fit available space. OCR and analysis are serialized, with a 700 ms delay between requests. Pointer movement and changed pixel buffers invalidate that capture. A moving or animated surface can therefore remain unreadable instead of showing a misleading result.

Move the pointer into the lens to hold the snapshot. **Pause** keeps it there explicitly. **Open in Reader** transfers that text for long-form reading and speech. **Close** stops the lens. The captured region may include app chrome if that is what the pointer is over; this is not semantic article extraction.

Windows 0.1.1 uses the same font, letter/word spacing, syllable gap, line height, theme, and intensity settings in the Reader and lens. These update while paused as well as during live capture. The **Style** selector offers Subtle, Balanced, Spacious, Custom, and a **Plain text** comparison of the same captured words. Spacious selects 24px Lexend and the larger spacing preset. Existing custom font choices are not silently migrated.

Screen focus only dims/tints the existing screen. It does not change the source app's text. Use the lens or Reader to assess the typography changes. Compare comfort and comprehension with the person reading; neither successful OCR nor more visible highlighting demonstrates a reading benefit.

The main Reader's **X** now quits, stopping all screen tools. It waits for any active selection capture to restore the clipboard. **Hide Reader** in the tray remains the explicit way to keep background tools running. Lens **Close** stops that lens without quitting the application.

Requires Windows 10 version 2004 or later for capture exclusion, plus local Windows OCR language support and WebView2. Secure desktops, protected content, some elevated applications, and exclusive fullscreen are not guaranteed. Capture refusal is not bypassed. Windows font/spacing changes apply in the lens/Reader, not to arbitrary source-app glyphs.

## Android

Requires Android 11/API 30 or later. Install the APK, open MorphemeFlow, and select **Screen tools**. Read the disclosure, then enable the service using Android's own Accessibility settings. Sideloaded apps can require Android's additional restricted-settings consent. MorphemeFlow does not enable that permission itself.

The floating toolbar provides a drag handle, **Read screen band**, screen-focus toggle, settings, and stop. Drag the handle vertically to move the band. Tapping the handle opens settings, where band position is also adjustable without dragging. The focus layer passes touches through to the underlying app. The toolbar and lens intercept touches only within their own bounds.

Reading is user-requested, not continuous. The display screenshot is cropped locally to the band and recognized by the bundled OCR model. The result opens as **Screen OCR snapshot**, with offline speech and close controls. Capture failures, protected content, display changes, and missing speech voices produce feedback. Closing or stopping clears the active snapshot.

The Android accessibility shortcut can toggle the tools when configured by the user. The main app also accepts **Share text** and **Process Text**, which avoid OCR and preserve the supplied text exactly. Selected fonts, text size, morphemes, syllables, focus height/position, dimming, and tint are adjustable.

The app deliberately does not request accessibility text-tree retrieval or keyboard interception. It therefore cannot silently select a paragraph from every app. Passwords should remain masked in the source app. Protected screens, permission dialogs, device policy, work profiles, and vendor restrictions may prevent capture or overlays. Physical-device and store-policy validation remain release requirements.

## Architecture

| Component | Responsibility |
|---|---|
| Windows `overlay.rs` / `overlay_windows.rs` | Validated focus geometry, dedicated native message loop, three layered panes, input pass-through, capture exclusion |
| Windows `lens.rs` / `ocr.rs` | Bounded local OCR, generation-based cancellation, changed-frame rejection, lens placement |
| Windows `ui/render.js` | Shared lossless DOM renderer used by Reader, lens, and Android bundle |
| Android `ReadingService` / `FocusView` | User-enabled accessibility overlay, lifecycle, capture, cutout-safe geometry, and floating lens |
| Android `ReaderView` | WebView restricted to packaged resources, no JavaScript bridge or external navigation |
| TypeScript engine | Android and browser linguistic analysis, bundled offline |
| Rust engine | Windows linguistic analysis, shared fixture checks |

The archived DXGI/UIA compositor remains excluded from the workspace build. Its failure to replace source glyphs is still relevant, but does not invalidate ordinary focus overlays or separately laid-out lenses.

## Product Limits

The goal is one coherent tool per operating system, not one binary for incompatible operating systems. Browser extensions remain optional and require independent browser consent. The prototype does not establish novelty against every competing product or prove a dyslexia treatment benefit. Personal preference and usability testing should determine which visual supports are helpful.

OCR is approximate. Do not treat its output as an authoritative transcription for passwords, medication, financial instructions, or other error-sensitive content. Use source-preserving sharing or selection when available.