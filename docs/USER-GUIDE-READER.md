# MorphemeFlow Reader — User Guide

## What is MorphemeFlow Reader?

MorphemeFlow Reader is a Windows desktop app that makes text easier to read by breaking words into their meaningful parts (morphemes) and applying dyslexia-friendly formatting. It works with text from **any** application.

## Getting Started

### Installation
1. Download the installer from the project's GitHub Releases page when a signed beta is published, or build it locally with `npm run build:reader`
2. Run the installer — follow the prompts
3. MorphemeFlow Reader will appear in your system tray

### First Launch
On first launch, a quick 3-step setup will help you:
1. **Choose a preset** — Subtle, Balanced, or Full
2. **Learn selection capture** — how to grab text from any app
3. **Learn OCR snap** — how to capture non-selectable text

## Core Features

### Capture Selected Text
1. Select text in any application (Word, browser, PDF viewer, etc.)
2. Press **Ctrl+Shift+M**
3. The selected text appears in Reader with morpheme highlighting

Reader preserves and restores the complete clipboard, including rich text, images, and custom formats. Capture waits for slower applications rather than assuming Copy completes in a fixed delay.

### OCR Snap
1. Press **Ctrl+Shift+R**
2. On the monitor under your pointer, draw a rectangle around non-selectable text (images, scanned PDFs)
3. The recognized text appears in Reader

The selector disappears before the screenshot and OCR runs entirely through Windows on the local machine. For very large areas, select a smaller region; Windows OCR limits each image dimension (commonly 2600 physical pixels).

### Paste Text
1. Open Reader
2. Paste or type text in the input area
3. Click **Analyze** or press **Ctrl+Enter**

## Reading Features

### Morpheme Highlighting
Words are color-coded by morpheme type:
- **Purple** — Prefixes (un-, re-, pre-)
- **Dark** — Roots (the core meaning)
- **Green** — Suffixes (-tion, -ness, -ment)
- **Amber** — Inflections (-ing, -ed, -s)

Hover over any morpheme to see its meaning.

### Text-to-Speech
- Click the **play button** in the footer to hear the text read aloud
- The current word is highlighted as it's spoken
- Click again to pause/resume; click stop to end

### Reading Ruler
Press **R** (when not typing) or use the ruler button in the footer to toggle a reading ruler that helps track your line position.

## Customization

### Presets
- **Subtle** — Light formatting, small font, low highlight intensity
- **Balanced** — Medium formatting (recommended starting point)
- **Full** — Maximum formatting, large font, high intensity

### Settings (click the gear icon)
- **Theme** — 7 options: Cream, Light, Gray, Blue, Green, Peach, Dark
- **Font** — System, Lexend, Atkinson Hyperlegible, Verdana, OpenDyslexic
- **Font Size** — 14px to 36px
- **Letter Spacing** — Adjustable for readability
- **Word and Syllable Spacing** — Independent controls for crowding and syllable boundaries
- **Line Height** — Adjustable vertical spacing
- **Highlight Intensity** — How strongly morphemes are colored
- **Speech Rate** — 0.5× to 1.8×
- **Feature Toggles** — Morpheme colours, syllable spacing, and ruler can be independently disabled

### Pin Window
Click the pin icon to keep Reader always on top of other windows.

## Hotkeys

| Action | Default |
|---|---|
| Capture selection | Ctrl+Shift+M |
| OCR snap region | Ctrl+Shift+R |
| Toggle reading ruler | R |
| Analyze pasted text | Ctrl+Enter |

Hotkeys can be customized in Settings.

## System Tray

Right-click the MorphemeFlow tray icon for:
- Show/Hide Reader
- Capture Selection
- Snap Region (OCR)
- Settings
- Quit

Closing the Reader window hides it to the tray so the global capture shortcuts remain available. Use **Quit** from the tray menu to exit fully.

## Privacy

MorphemeFlow makes **zero network requests**. All text processing happens entirely on your device. No data is ever sent anywhere.

## Troubleshooting

### Selection capture doesn't work
- Ensure the source app allows Ctrl+C (some apps block clipboard access)
- Try selecting text first, then pressing the hotkey
- Reader now shows a visible message when no text was copied or the clipboard could not be preserved

### OCR produces incorrect text
- Ensure the text region is clearly visible and high contrast
- Larger text regions produce better results
- OCR works best with printed/digital text, not handwriting

### Logs
Crash logs are stored at `%APPDATA%\MorphemeFlow\logs\reader.log` for troubleshooting.
