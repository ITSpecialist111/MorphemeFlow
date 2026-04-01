# MorphemeFlow — Architecture & Solution Design

**Version:** 0.2 (Universal Overlay)
**Date:** March 2026
**Status:** BUILDING

---

## Executive Summary

**MorphemeFlow** is an open-source **universal screen overlay** that helps people with dyslexia read text in **any application** — browsers, Word, PDFs, emails, Slack, IDEs, anything with text on screen. It combines three evidence-based interventions that no existing tool offers together:

1. **Morpheme Highlighting** — Automatically decomposes words into roots, prefixes, and suffixes with visual differentiation
2. **Syllable Micro-Kerning** — Adds subtle spacing at syllable boundaries to reduce cognitive decoding load
3. **Adaptive Reading Environment** — Typography overlays, reading ruler, and TTS with word-level sync

**What makes it unique:**
- **Universal:** Works across ALL applications, not just browsers. Like f.lux for reading.
- **Transparent overlay:** The underlying UI is untouched. MorphemeFlow sits on top.
- **Morpheme-level intelligence:** No existing tool automates morpheme decomposition on arbitrary screen text.
- **Application-agnostic:** Uses OS Accessibility APIs + OCR fallback to read text from any app.

**Copyright-free:** Built entirely on open-source libraries, freely available linguistic data, and original algorithms.

---

## 1. Product Vision

### The Problem
Dyslexic readers face a phonological bottleneck everywhere — not just in browsers. They read in:
- Web browsers (articles, email, social media)
- Desktop apps (Word, Outlook, Slack, Teams, Discord)
- PDFs (academic papers, legal documents)
- IDEs (code and comments)
- Mobile-like desktop apps (Electron apps, PWAs)

Existing tools are **locked to one context**:
- Browser extensions only work in browsers
- Microsoft Immersive Reader only works in Microsoft apps
- Apple's accessibility only works on macOS/iOS
- No tool works across all applications universally

### The Solution
MorphemeFlow is a **desktop application** that creates a **transparent, click-through overlay** on top of the entire screen. It reads text from any application using OS Accessibility APIs (with OCR fallback), processes it through the morpheme engine, and renders enhanced text directly over the originals.

The user sees their normal apps — unchanged. But text is transformed: morphemes are color-coded, syllable spacing is adjusted, fonts are optimized. Toggle it on/off with a hotkey. It's invisible until you need it.

### Design Principles

1. **Universal, not app-specific** — Works on any text, any application, any context
2. **Overlay, not replacement** — The original UI is untouched; we layer on top
3. **Science-backed, not gimmick-based** — Every feature maps to published research
4. **Subtle, not stigmatizing** — Adults should feel comfortable using it in a meeting
5. **Fast, not laggy** — Processing must be imperceptible (<100ms per screen region)
6. **Private, not cloudy** — All processing happens locally on-device
7. **Open, not locked** — MIT license, open-source, no API dependency

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S SCREEN                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ANY APPLICATION                          │   │
│  │  (Browser, Word, Slack, PDF viewer, IDE, etc.)       │   │
│  │                                                       │   │
│  │  "The unsuccessful reconstruction of the building"   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▲                                    │
│                          │ transparent overlay                │
│  ┌───────────────────────┴──────────────────────────────┐   │
│  │           MORPHEMEFLOW OVERLAY (click-through)        │   │
│  │                                                       │   │
│  │  "The [un][success][ful] [re][construct][ion]..."    │   │
│  │       ^^^  ^^^^^^^^ ^^^  ^^^ ^^^^^^^^^^ ^^^          │   │
│  │       pfx  root     sfx  pfx root       sfx          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                MORPHEMEFLOW DESKTOP APP (Tauri)               │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  System Tray │  │  Settings    │  │  Hotkey Manager   │  │
│  │  (Toggle)    │  │  Window      │  │  (Ctrl+Shift+M)   │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐ │
│  │                    CORE ENGINE                          │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │         Text Detection Layer                     │   │ │
│  │  │                                                   │   │ │
│  │  │  ┌──────────────┐    ┌────────────────────────┐  │   │ │
│  │  │  │ Accessibility│    │   OCR Fallback          │  │   │ │
│  │  │  │ API (UIA on  │    │   (Windows.Media.OCR    │  │   │ │
│  │  │  │ Windows,     │    │    or Tesseract)        │  │   │ │
│  │  │  │ AX on macOS) │    │                          │  │   │ │
│  │  │  └──────────────┘    └────────────────────────┘  │   │ │
│  │  └─────────────────────────┬───────────────────────┘   │ │
│  │                            │ text + bounding rects      │ │
│  │                            ▼                            │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │         Morpheme Processing Engine               │   │ │
│  │  │                                                   │   │ │
│  │  │  ┌───────────┐  ┌───────────┐  ┌──────────────┐ │   │ │
│  │  │  │ Tokenizer │→ │ Morpheme  │→ │   Syllable   │ │   │ │
│  │  │  │           │  │ Analyzer  │  │   Splitter   │ │   │ │
│  │  │  └───────────┘  └───────────┘  └──────────────┘ │   │ │
│  │  │                      │                            │   │ │
│  │  │               ┌──────┴──────┐                     │   │ │
│  │  │               │  Word Cache │                     │   │ │
│  │  │               │ (LRU, 10K)  │                     │   │ │
│  │  │               └─────────────┘                     │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  │                            │                            │ │
│  │                            ▼                            │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │         Overlay Renderer                         │   │ │
│  │  │                                                   │   │ │
│  │  │  - Transparent window (always-on-top)             │   │ │
│  │  │  - Click-through (mouse passes to app below)      │   │ │
│  │  │  - Renders styled text over original positions    │   │ │
│  │  │  - Morpheme color coding on overlay               │   │ │
│  │  │  - Reading ruler (follows cursor)                 │   │ │
│  │  │  - Font/spacing overrides rendered on overlay     │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Target Deployment

```
                    ┌──────────────────────┐
                    │   SHARED ENGINE       │
                    │   (Pure TypeScript)   │
                    │                        │
                    │   - Tokenizer          │
                    │   - Morpheme Analyzer  │
                    │   - Syllable Splitter  │
                    │   - Word Cache         │
                    │   - Settings           │
                    └───────┬───────────────┘
                            │
              ┌─────────────┼─────────────────┐
              │             │                   │
              ▼             ▼                   ▼
   ┌──────────────┐ ┌──────────────┐  ┌──────────────────┐
   │   DESKTOP    │ │   BROWSER    │  │  (FUTURE)        │
   │   OVERLAY    │ │  EXTENSION   │  │  Mobile App      │
   │   (Tauri)    │ │  (MV3)       │  │  Accessibility   │
   │              │ │              │  │  Service          │
   │  - System    │ │  - DOM-level │  │                    │
   │    tray      │ │    precision │  │  - Android/iOS    │
   │  - UIA/OCR   │ │  - In-page   │  │  - System-wide   │
   │  - Overlay   │ │    modify    │  │    text transform │
   │  - Universal │ │  - Web only  │  │                    │
   └──────────────┘ └──────────────┘  └──────────────────┘
       PRIMARY         SECONDARY           FUTURE
```

---

## 3. Text Detection Architecture

### How We Read Text From Any Application

```
        ┌─────────────────────────────────────────┐
        │        Text Detection Pipeline           │
        └───────────────────┬─────────────────────┘
                            │
                    ┌───────┴───────┐
                    │ Is active app │
                    │ UIA-enabled?  │
                    └───────┬───────┘
                      yes ╱   ╲ no
                         ╱     ╲
              ┌─────────┐       ┌──────────┐
              │ UIA API │       │ OCR Mode │
              │         │       │          │
              │ Read:   │       │ Capture  │
              │ - Text  │       │ screen   │
              │ - Bounds│       │ region → │
              │ - Font  │       │ Tesseract│
              │ - Size  │       │ or Win   │
              └────┬────┘       │ OCR API  │
                   │            └─────┬────┘
                   │                  │
                   └──────┬───────────┘
                          │
                  ┌───────┴────────┐
                  │ Text Regions   │
                  │ with bounding  │
                  │ rectangles     │
                  └───────┬────────┘
                          │
                          ▼
                  ┌────────────────┐
                  │ Morpheme       │
                  │ Engine         │
                  │ (shared core)  │
                  └───────┬────────┘
                          │
                          ▼
                  ┌────────────────┐
                  │ Overlay        │
                  │ Renderer       │
                  │ (position text │
                  │  over originals│
                  │  with styling) │
                  └────────────────┘
```

### Text Detection Methods by Platform

| Platform | Primary Method | Fallback | Notes |
|----------|---------------|----------|-------|
| Windows 10/11 | UI Automation API | Windows.Media.Ocr | UIA gives text + exact bounds from most apps |
| macOS | Accessibility API (AX) | Vision framework OCR | AX works with most Cocoa/AppKit apps |
| Linux | AT-SPI | Tesseract OCR | AT-SPI coverage varies by toolkit |

### What UIA Can Read (Windows)

- Web browsers (Chrome, Firefox, Edge) — full text + DOM structure
- Microsoft Office (Word, Outlook, Teams) — full text
- Electron apps (Slack, Discord, VS Code) — full text via Chromium UIA
- WPF / WinForms / UWP apps — full text
- Win32 apps — partial (depends on implementation)
- Games / custom-rendered — OCR fallback needed

---

## 4. Overlay Rendering

### How the Transparent Overlay Works

```
┌─────────────────────────────────────────────────┐
│                 DISPLAY OUTPUT                   │
│                                                   │
│  Z-order:                                         │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  TOP: MorphemeFlow overlay window            │ │
│  │  - WS_EX_LAYERED + WS_EX_TRANSPARENT        │ │
│  │  - Fully transparent background              │ │
│  │  - Only styled text is visible               │ │
│  │  - Mouse clicks pass through to layer below  │ │
│  │  - Keyboard input passes through             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  BELOW: User's actual applications           │ │
│  │  - Completely unmodified                      │ │
│  │  - Receives all input events normally         │ │
│  │  - No code injection, no DOM manipulation     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Rendering Strategy

**Option A: Canvas Overlay (Preferred for v0.1)**
- Single transparent window covering the screen
- HTML5 Canvas renders styled text at exact positions
- Efficient: only renders text regions, rest is transparent
- Can match font size/position from UIA data

**Option B: WebView Overlay (Richer styling, v0.2+)**
- Overlay window contains a WebView with HTML/CSS
- More flexible styling (CSS gradients, animations)
- Higher overhead but more beautiful

### Overlay Modes

1. **Full Overlay** — All detected text on screen gets morpheme styling
2. **Region Overlay** — User defines a rectangular region to process (like a reading window)
3. **Focus Overlay** — Only processes text near cursor/caret position
4. **Reading Ruler** — A horizontal band that follows the cursor, dimming text above/below

---

## 5. Morpheme Analysis Algorithm

*(Unchanged from v0.1 — this is the shared engine)*

### The Hybrid Approach

```
                    ┌──────────────┐
                    │  Input Word  │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │ Normalize    │  lowercase, strip punctuation
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐     ┌─────────────────┐
                    │ Tier 1:      │────▶│ Common Word      │
                    │ Dictionary   │     │ Dictionary (5K)  │
                    │ Lookup       │     │ Pre-computed,    │
                    └──────┬───────┘     │ hand-verified    │
                           │ miss        └─────────────────┘
                           │
                    ┌──────┴───────┐     ┌─────────────────┐
                    │ Tier 2:      │────▶│ Prefix/Suffix   │
                    │ Rule-Based   │     │ Pattern Tables   │
                    │ Affix Strip  │     │ + Root Validator │
                    └──────┬───────┘     └─────────────────┘
                           │ fail
                           │
                    ┌──────┴───────┐     ┌─────────────────┐
                    │ Tier 3:      │────▶│ Knuth-Liang      │
                    │ Syllable     │     │ Hyphenation       │
                    │ Fallback     │     │ Patterns          │
                    └──────────────┘     └─────────────────┘
```

---

## 6. Technology Stack

### Desktop Overlay App (Primary)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| App framework | **Tauri v2** (Rust + WebView) | ~5MB vs Electron's ~150MB; native performance; transparent window support |
| Text detection | **Windows UI Automation** (Rust bindings) | OS-native; gives text + bounding rects; zero latency |
| OCR fallback | **Windows.Media.Ocr** API | Built into Windows 10/11; fast; no extra dependencies |
| Morpheme engine | **TypeScript** (runs in Tauri WebView) | Shared with browser extension; proven logic |
| Overlay rendering | **HTML5 Canvas** in transparent Tauri window | GPU-accelerated; precise positioning; lightweight |
| Settings storage | **JSON file** (local) | Simple; portable; no cloud |
| Hotkey | **Global hotkey** via Tauri plugin | Toggle on/off from anywhere |
| System tray | **Tauri system tray** | Unobtrusive; always accessible |

### Browser Extension (Secondary)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Manifest | **V3** | Chrome requirement; future-proof |
| Engine | **Same shared TypeScript** | Code reuse |
| DOM layer | **TreeWalker + MutationObserver** | More precise than overlay for web content |
| Build | **Vite** | Fast builds; good extension support |

### Shared Engine (Pure TypeScript)

| Module | Purpose |
|--------|---------|
| `tokenizer.ts` | Word tokenization preserving whitespace/punctuation |
| `morpheme-analyzer.ts` | Hybrid dictionary + rules + fallback |
| `syllable-splitter.ts` | Knuth-Liang wrapper |
| `word-cache.ts` | LRU cache (10K entries) |
| `types.ts` | Shared type definitions |

---

## 7. Project Structure (Monorepo)

```
morphemeflow/
├── packages/
│   ├── engine/                    # SHARED: Pure morpheme engine
│   │   ├── src/
│   │   │   ├── tokenizer.ts
│   │   │   ├── morpheme-analyzer.ts
│   │   │   ├── syllable-splitter.ts
│   │   │   ├── word-cache.ts
│   │   │   └── types.ts
│   │   ├── data/
│   │   │   ├── morpheme-dictionary.json
│   │   │   ├── prefix-rules.ts
│   │   │   ├── suffix-rules.ts
│   │   │   └── root-validator.ts
│   │   └── package.json
│   │
│   ├── overlay/                   # PRIMARY: Tauri desktop overlay
│   │   ├── src-tauri/             # Rust backend
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── text_detection.rs    # UIA + OCR
│   │   │   │   ├── overlay_window.rs    # Transparent window management
│   │   │   │   └── hotkey.rs            # Global hotkey handler
│   │   │   ├── Cargo.toml
│   │   │   └── tauri.conf.json
│   │   ├── src/                   # WebView frontend (overlay UI)
│   │   │   ├── overlay.ts         # Canvas-based text rendering
│   │   │   ├── settings-ui.ts     # Settings window
│   │   │   └── styles.css
│   │   └── package.json
│   │
│   └── extension/                 # SECONDARY: Browser extension
│       ├── src/
│       │   ├── manifest.json
│       │   ├── background/
│       │   ├── content/
│       │   ├── popup/
│       │   └── shared/
│       └── package.json
│
├── public/
│   └── fonts/                     # Bundled accessible fonts
│
├── test/
│   ├── engine/                    # Engine unit tests
│   └── fixtures/
│
├── research/                      # Research documents
├── CLAUDE.md
├── ARCHITECTURE.md
├── PLAN.md
├── package.json                   # Monorepo root
└── LICENSE
```

---

## 8. User Interface

### System Tray + Settings

```
                    ┌──── System Tray ────┐
                    │  [M] MorphemeFlow   │
                    │──────────────────────│
                    │  ◉ Enabled (Ctrl+Shift+M)  │
                    │  ──────────────────  │
                    │  Mode: ○Full ○Region ○Focus  │
                    │  ──────────────────  │
                    │  ⚙ Settings...      │
                    │  ❓ Help             │
                    │  ✕ Quit              │
                    └──────────────────────┘

┌────────────────────── Settings Window ──────────────────────┐
│                                                              │
│  ┌── Features ──────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  ◉ Morpheme Highlighting                             │   │
│  │     Prefix ████  Root ████  Suffix ████               │   │
│  │     Intensity: ──────○────────── 60%                  │   │
│  │                                                       │   │
│  │  ◉ Syllable Spacing                                  │   │
│  │     ──────○──────────── 0.08em                        │   │
│  │                                                       │   │
│  │  ◉ Reading Ruler                                     │   │
│  │     Mode: ○Focus Window  ○Highlight Band  ○Underline │   │
│  │     Height: ──────○─────── 100px                      │   │
│  │                                                       │   │
│  │  ◉ Typography Override                               │   │
│  │     Font: [Lexend ▾]  Size: [18px ▾]                 │   │
│  │     Letter spacing: ──○──── 0.07em                    │   │
│  │     Background: ○Default ○Cream ○Blue ○Dark          │   │
│  │                                                       │   │
│  │  ◉ Text-to-Speech                                    │   │
│  │     ▶ Read selected region    Speed: 1.0x             │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  Presets: [ Subtle ] [ Balanced ] [ Full ]                   │
│                                                              │
│  ┌── Detection ─────────────────────────────────────────┐   │
│  │  Method: ○ Auto  ○ Accessibility API  ○ OCR          │   │
│  │  Process: ○ Full screen  ○ Active window  ○ Region   │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Copyright & IP Strategy

*(Same as v0.1 plus:)*

### Additional Technology — All Open/Free
- Tauri v2 (MIT + Apache 2.0)
- Windows UI Automation API (built into Windows, free to use)
- Windows.Media.Ocr (built into Windows 10+, free to use)
- Tesseract OCR (Apache 2.0) — optional cross-platform fallback

### What Makes This Novel (Original IP, MIT Licensed)
1. **Universal morpheme overlay** — No tool applies morpheme decomposition across all applications
2. **Transparent OS-level dyslexia support** — Accessibility APIs used for reading enhancement, not screen reading
3. **Hybrid text detection** — UIA + OCR combined for universal text access
4. **Morpheme engine** — Dictionary + rules + syllable fallback
5. **Syllable micro-kerning** — Subtle spacing vs. full splitting
6. **Click-through overlay** — Visual enhancement without capturing input

---

## 10. Differentiation (Updated)

| Dimension | Bionic Reading | Helperbird | Immersive Reader | **MorphemeFlow** |
|-----------|---------------|------------|------------------|-----------------|
| **Scope** | Browser only | Browser only | Microsoft apps | **Any application** |
| Core approach | Positional bolding | Feature bundle | Extract & re-render | **Linguistic overlay** |
| Evidence base | None | None | Partial | **Strong** |
| Morpheme awareness | No | No | No | **Yes (core feature)** |
| Works in Word/PDF? | No | No | Yes (MS only) | **Yes (anything)** |
| Works in Slack/Discord? | No | Partial | No | **Yes** |
| Open source | No | No | No | **Fully open** |
| Privacy | API calls | Cloud features | Cloud | **100% local** |
| Price | $3-5/mo | $7/mo | Free in MS | **Free forever** |

---

*This document defines the technical architecture for MorphemeFlow v0.2 (Universal Overlay).*
*The browser extension remains as a secondary deployment target for users who prefer it.*
