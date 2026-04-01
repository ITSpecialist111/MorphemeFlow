# Typography, Color Science, and Readability for Dyslexia
## Comprehensive Research Document

---

## 1. Dyslexia-Specific Open-Source Fonts

### 1.1 OpenDyslexic

**License:** SIL Open Font License 1.1 (free for personal and commercial use)
**Creator:** Abelardo Gonzalez
**Repository:** https://github.com/antijingoist/opendyslexic
**Google Fonts:** Not on Google Fonts; self-hosted or via CDN
**Formats available:** TTF, OTF, WOFF, WOFF2, EOT

**Design Principles:**
- **Weighted bottoms:** Each letter has a heavier bottom portion, creating a visual "gravity" that anchors letters to the baseline. This is intended to prevent the perception of letters rotating, flipping, or swapping.
- **Unique letter shapes:** Letters that are commonly confused (b/d, p/q, m/w) are given distinct shapes so they cannot be mirror images of each other.
- **Increased letter spacing:** Built-in wider spacing compared to standard fonts.
- **Varying stick heights:** Ascenders and descenders have slight variations to make each letter more distinguishable.

**Variants:**
- OpenDyslexic Regular
- OpenDyslexic Bold
- OpenDyslexic Italic
- OpenDyslexic Bold Italic
- OpenDyslexic Mono (monospaced variant for code)
- OpenDyslexic Alta (alternative style with different letterforms)

**Research Evidence:**
- **Rello & Baeza-Yates (2013):** Study found that OpenDyslexic did not significantly improve reading speed for dyslexic users compared to other fonts, but some users reported subjective preference for it.
- **Wery & Diliberto (2017):** Found no statistically significant improvement in reading rate or accuracy with OpenDyslexic vs. Arial or Times New Roman.
- **Kuster et al. (2018):** Similar finding -- no measurable reading speed improvement, but user comfort/preference was noted.
- **Key takeaway:** OpenDyslexic is widely preferred subjectively by many dyslexic readers, even though controlled studies have not consistently shown measurable reading speed improvements. Preference and comfort matter for sustained reading.

**CSS Usage:**
```css
@font-face {
  font-family: 'OpenDyslexic';
  src: url('fonts/OpenDyslexic-Regular.woff2') format('woff2'),
       url('fonts/OpenDyslexic-Regular.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

**CDN Option:**
```css
@import url('https://fonts.cdnfonts.com/css/opendyslexic');
```

---

### 1.2 Lexend Font Family

**License:** SIL Open Font License 1.1
**Creator:** Dr. Bonnie Shaver-Troup, designed by Thomas Jockin
**Google Fonts:** https://fonts.google.com/specimen/Lexend
**Variable Font Support:** Yes -- full variable font with weight axis (100-900)

**Font Sub-families (all on Google Fonts):**
| Font Name | Character | Use Case |
|-----------|-----------|----------|
| Lexend | Default/neutral | General reading |
| Lexend Deca | Slightly condensed | Dense text |
| Lexend Exa | Expanded | Large displays |
| Lexend Giga | More expanded | Headlines |
| Lexend Mega | Most expanded | Maximum readability |
| Lexend Peta | Wide | Display use |
| Lexend Tera | Very wide | Display use |
| Lexend Zetta | Widest | Display/branding |

**Research Behind Lexend:**
- Based on Dr. Bonnie Shaver-Troup's research on "visual crowding" -- the phenomenon where letters that are too close together become harder to distinguish, particularly for struggling readers.
- The original research tested variable letter spacing (called "Lexend Hyperexpansion") and found that customized spacing improved reading fluency for 84% of test subjects.
- The font was designed with built-in optimal spacing derived from reading fluency studies with over 100,000 students.
- Published research: Shaver-Troup, A.M., Hojnoski, R. (EdD dissertation, 2017) on the impact of typeface design on reading fluency.

**Key Design Features:**
- San-serif with clean, open letterforms
- Optimized inter-letter spacing based on fluency research
- Large x-height for improved readability at smaller sizes
- Open apertures (the openings in letters like 'c', 'e', 'a')
- Distinct letterforms to minimize confusion

**CSS Usage (Google Fonts - Variable):**
```css
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap');

body {
  font-family: 'Lexend', sans-serif;
  font-weight: 400; /* or any value 100-900 */
}
```

---

### 1.3 Atkinson Hyperlegible

**License:** SIL Open Font License 1.1 (updated in 2024; originally a custom Braille Institute license)
**Creator:** Braille Institute, designed by Applied Design Works
**Google Fonts:** https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next
**Formats:** TTF, OTF, WOFF, WOFF2
**Variable Font:** The updated "Atkinson Hyperlegible Next" version (2024) supports variable weight.

**Design Principles:**
- **Exaggerated letterform geometry:** Characters that are commonly confused are given exaggerated differences. For example, the capital I has serifs, lowercase l has a tail, 1 has a flag and base.
- **Differentiated similar characters:** Special attention to: I/l/1, O/0, B/8, rn/m, g/q, c/e, a/o.
- **Open apertures:** Letters like 'c', 'e', 's' have wide openings to prevent them from looking like 'o', 'a', 'g'.
- **Angled terminals:** Stroke endings are angled rather than flat, adding distinctiveness.
- **Unambiguous letterforms:** Every character is designed to be recognizable even in poor viewing conditions, at small sizes, or with visual impairments.
- **Generous spacing:** Built-in spacing that improves readability.

**Weights Available (Atkinson Hyperlegible Next):**
- Thin (100) through Black (900) -- full variable range
- Corresponding italic styles

**Research Context:**
- Developed in consultation with the low-vision community
- Designed primarily for visual impairment but has significant crossover benefit for dyslexic readers
- Emphasizes "legibility" (ability to distinguish individual characters) over "readability" (ease of reading blocks of text), though both are improved

**CSS Usage:**
```css
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,200..900;1,200..900&display=swap');

body {
  font-family: 'Atkinson Hyperlegible Next', sans-serif;
}
```

---

### 1.4 Sylexiad

**License:** Free for non-commercial/research use (custom license; not SIL OFL)
**Creator:** Dr. Robert Hillier, Norwich University of the Arts
**Availability:** Limited; available through academic channels

**Design Principles:**
- Created through direct research with dyslexic adults
- Handwriting-inspired to match how dyslexic readers conceptualize letters
- Two variants: Sylexiad Sans and Sylexiad Serif
- Key feature: letters are designed based on what dyslexic readers reported they "expected" letters to look like

**Research:**
- Hillier (2006, 2008): Developed through participatory design with dyslexic adults
- Found that dyslexic readers had preferences for specific letter constructions that differed from typical typographic conventions
- The font incorporates these preferences into a cohesive typeface
- Small-scale studies showed subjective preference but (similar to OpenDyslexic) limited measurable speed gains

**Note:** Due to its limited license and availability, Sylexiad is more of academic interest than a practical choice for web deployment.

---

### 1.5 Other Notable Open-Source Readable Fonts

**Tiresias (now Tiresias Infofont):**
- License: Free (originally created for RNIB)
- Designed for low-vision users; good for on-screen reading
- Especially effective for UI elements and labels

**Luciole:**
- License: CC BY 4.0
- French-designed font for visually impaired users
- Created by the Centre Technique R&gional de la Basse Vision (France)
- Very clear letter differentiation

**Intel One Mono:**
- License: SIL OFL 1.1
- Monospaced font with excellent character differentiation
- Good for code editors used by dyslexic developers

**Readex Pro (Google Fonts):**
- License: SIL OFL 1.1
- Variable font, multi-script (Latin + Arabic)
- Designed for on-screen readability

**Comic Sans MS:**
- Not open-source (Microsoft proprietary) but worth mentioning
- Frequently cited by dyslexic readers as preferred
- Research basis: irregular letterforms prevent pattern-matching confusion
- Open-source alternative: **Comic Neue** (SIL OFL 1.1) at http://comicneue.com/

**Verdana:**
- Not open source but freely available on most systems
- Wide letterforms, large x-height, generous spacing
- One of the BDA (British Dyslexia Association) recommended fonts

**Century Gothic:**
- Often recommended alongside Verdana
- Very clean geometric sans-serif

---

## 2. Typography Best Practices for Dyslexia

### 2.1 Inter-Letter Spacing (Letter-Spacing / Tracking)

**Research:**
- **Zorzi et al. (2012), PNAS:** Landmark study showing that increased letter spacing improved reading speed and accuracy in dyslexic children by approximately 20%. The study used spacing 2.5 points wider than standard.
- **Perea et al. (2012):** Confirmed that slightly increased inter-letter spacing benefits dyslexic readers without hindering typical readers.
- **Theory:** "Crowding effect" -- letters that are too close interfere with each other perceptually, and dyslexic readers are more susceptible to this interference.

**Recommendations:**
| Parameter | Minimum | Optimal | Maximum |
|-----------|---------|---------|---------|
| letter-spacing | 0.05em | 0.07em - 0.12em | 0.2em |

```css
/* Conservative increase */
letter-spacing: 0.05em;

/* Research-supported optimal */
letter-spacing: 0.12em;

/* Maximum before word-shape is disrupted */
letter-spacing: 0.2em;
```

**WCAG 2.1 Success Criterion 1.4.12 (Text Spacing):** Users must be able to set letter spacing to at least 0.12em without loss of content or functionality.

---

### 2.2 Word Spacing

**Research:**
- Increased word spacing helps dyslexic readers distinguish word boundaries
- The BDA recommends at least 3.5x the inter-character spacing
- WCAG 1.4.12 requires support for word spacing of at least 0.16em

**Recommendations:**
```css
/* Standard improvement */
word-spacing: 0.16em;

/* More generous for dyslexic readers */
word-spacing: 0.25em;

/* Maximum recommended */
word-spacing: 0.35em;
```

---

### 2.3 Line Height / Leading

**Research:**
- Generous line spacing reduces "line jumping" -- a common issue where dyslexic readers lose their place between lines
- Schneps et al. (2013): Wider line spacing improved reading comprehension for dyslexic readers
- WCAG 1.4.12 requires support for line-height of at least 1.5x the font size

**Recommendations:**
| Context | line-height value |
|---------|------------------|
| Minimum (body text) | 1.5 |
| Optimal for dyslexia | 1.8 - 2.0 |
| Maximum before text feels disconnected | 2.5 |
| Headings | 1.2 - 1.4 |

```css
body {
  line-height: 1.8; /* Optimal for dyslexic readers */
}

h1, h2, h3 {
  line-height: 1.3;
}

/* WCAG-compliant minimum */
p {
  line-height: 1.5;
}
```

---

### 2.4 Line Length (Characters Per Line / Measure)

**Research:**
- Dyslexic readers benefit from shorter line lengths
- Standard typography recommends 45-75 characters per line (Bringhurst)
- For dyslexic readers, the sweet spot is narrower

**Recommendations:**
| Audience | Characters per line |
|----------|-------------------|
| General typography | 45-75 |
| Dyslexic readers (optimal) | 45-60 |
| Dyslexic readers (maximum) | 70 |
| Minimum before awkward line breaks | 35 |

```css
p {
  max-width: 65ch; /* 65 characters -- good default */
}

/* For dyslexia-optimized view */
.dyslexia-friendly p {
  max-width: 55ch;
}
```

---

### 2.5 Font Size

**Research:**
- BDA recommends minimum 12pt for print, 14pt equivalent for screen
- Rello & Baeza-Yates (2013): Fonts at 18px and above significantly improved readability for dyslexic users
- Larger sizes reduce the crowding effect

**Recommendations:**
| Context | Size |
|---------|------|
| Body text minimum | 16px (1rem) |
| Body text optimal for dyslexia | 18px - 20px (1.125rem - 1.25rem) |
| Small text / captions | Never below 14px (0.875rem) |
| Mobile body text | 18px minimum |

```css
html {
  font-size: 100%; /* 16px base */
}

body {
  font-size: 1.125rem; /* 18px -- optimal */
}

/* User-adjustable with CSS custom properties */
:root {
  --font-size-base: 1.125rem;
  --font-size-scale: 1.2; /* Minor third scale */
}
```

---

### 2.6 Sans-Serif vs. Serif

**Research:**
- **Rello & Baeza-Yates (2013):** Dyslexic readers read faster with sans-serif fonts (Arial, Helvetica, Verdana) compared to serif fonts (Times New Roman, Georgia).
- **De Leeuw (2010):** Found no significant difference between serif and sans-serif for dyslexic readers, but sans-serif was subjectively preferred.
- **BDA Recommendation:** Sans-serif fonts are preferred. Recommended: Arial, Verdana, Century Gothic, Trebuchet MS.
- **Consensus:** Sans-serif is generally recommended, but the evidence is not absolute. The key factors are:
  - Large x-height
  - Open apertures
  - Distinct letterforms
  - Consistent stroke width

**Fonts ranked by dyslexia-research support:**
1. Verdana (large x-height, wide, generous spacing)
2. Arial (ubiquitous, clean)
3. Century Gothic (geometric, very open)
4. Trebuchet MS (humanist, distinct letterforms)
5. Lexend (purpose-built for reading fluency)
6. Atkinson Hyperlegible (purpose-built for legibility)

---

### 2.7 Font Weight

**Research:**
- Slightly bolder text can improve readability by increasing contrast between letterforms and background
- However, true bold (700) can reduce readability for body text due to reduced counter space (the white space inside letters)
- Semi-bold or medium weight is often optimal

**Recommendations:**
| Context | font-weight |
|---------|-------------|
| Body text (standard) | 400 (Regular) |
| Body text (dyslexia-optimized) | 400-500 (Regular to Medium) |
| Emphasis | 600 (Semi-Bold) |
| Headings | 600-700 |

```css
body {
  font-weight: 400;
}

/* Slightly heavier for improved contrast */
.dyslexia-mode body {
  font-weight: 450; /* Only works with variable fonts */
}
```

---

## 3. CSS Techniques for Readability

### 3.1 Core CSS Properties for Dyslexia-Friendly Text

```css
/* Comprehensive dyslexia-friendly text styles */
.dyslexia-friendly {
  /* Font selection with fallback chain */
  font-family: 'Lexend', 'Atkinson Hyperlegible', 'Verdana', 'Arial', sans-serif;

  /* Size and weight */
  font-size: 1.125rem;       /* 18px */
  font-weight: 400;

  /* Spacing */
  letter-spacing: 0.07em;
  word-spacing: 0.16em;
  line-height: 1.8;

  /* Line length */
  max-width: 65ch;

  /* Paragraph spacing */
  margin-bottom: 1.5em;      /* WCAG 1.4.12: at least 2x font size */

  /* Text alignment -- never justify */
  text-align: left;

  /* Prevent hyphenation */
  hyphens: none;
  -webkit-hyphens: none;

  /* Rendering */
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* Prevent text from being too thin on retina displays */
  -webkit-text-stroke: 0.2px;
}
```

### 3.2 Text Alignment

**Critical:** Never use justified text (`text-align: justify`) for dyslexic readers.
- Justified text creates uneven word spacing ("rivers of white space")
- These irregular gaps are highly disruptive to dyslexic readers
- Always use left-aligned (or right-aligned for RTL languages)

```css
/* Always */
text-align: left;

/* Never for body text */
text-align: justify; /* AVOID */
```

### 3.3 Variable Fonts for Dynamic Adjustment

Variable fonts allow real-time adjustment of font properties, making them ideal for user-customizable accessibility settings.

```css
/* Variable font setup with Lexend */
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap');

:root {
  --reading-weight: 400;
  --reading-width: 100;    /* if font supports width axis */
}

body {
  font-family: 'Lexend', sans-serif;
  font-variation-settings:
    'wght' var(--reading-weight);
}

/* JavaScript can dynamically update these values */
/* document.documentElement.style.setProperty('--reading-weight', 450); */
```

**Common Variable Font Axes:**
| Axis | Tag | Description | Dyslexia Use |
|------|-----|-------------|--------------|
| Weight | wght | Thin to Black | Adjust stroke contrast |
| Width | wdth | Condensed to Extended | Reduce crowding |
| Optical Size | opsz | Optimize for display size | Auto-optimize for reading size |
| Grade | GRAD | Adjust weight without changing layout | Subtle readability boost |

### 3.4 CSS font-feature-settings for Accessibility

OpenType features that can improve readability:

```css
.readable-text {
  /* Enable common ligatures (fi, fl) -- usually default */
  font-feature-settings: "liga" 1;

  /* Tabular numbers for data alignment */
  font-variant-numeric: tabular-nums;

  /* Stylistic alternates -- some fonts offer dyslexia-friendly alternates */
  font-feature-settings: "salt" 1;

  /* Case-sensitive forms -- adjusts punctuation for all-caps */
  font-feature-settings: "case" 1;

  /* Slashed zero -- distinguishes 0 from O */
  font-feature-settings: "zero" 1;
}

/* Combined example */
.dyslexia-text {
  font-feature-settings:
    "liga" 1,    /* Standard ligatures */
    "zero" 1,    /* Slashed zero */
    "ss01" 1;    /* Stylistic set 1 (font-dependent) */

  /* Modern CSS alternative */
  font-variant-ligatures: common-ligatures;
  font-variant-numeric: slashed-zero tabular-nums;
}
```

**Note on ligatures for dyslexia:** Some dyslexia researchers recommend DISABLING ligatures, as merged letterforms (like fi, fl) can be confusing. This is a per-user preference.

```css
/* Disable ligatures if they cause confusion */
.no-ligatures {
  font-feature-settings: "liga" 0, "clig" 0;
  font-variant-ligatures: none;
}
```

### 3.5 text-rendering and Font Smoothing

```css
body {
  /* Tells browser to optimize for legibility over speed */
  text-rendering: optimizeLegibility;

  /* macOS font smoothing -- prevents overly thin fonts */
  -webkit-font-smoothing: antialiased;

  /* Firefox on macOS */
  -moz-osx-font-smoothing: grayscale;

  /* Windows -- enable ClearType subpixel rendering */
  /* This is typically handled by the OS, but can hint: */
  font-smooth: always;
}
```

**Caution:** `text-rendering: optimizeLegibility` can cause performance issues with large amounts of text. Consider applying it selectively to headings only on text-heavy pages.

### 3.6 CSS Custom Properties for User Customization

```css
:root {
  /* Typography */
  --dyslexia-font: 'Lexend', sans-serif;
  --dyslexia-font-size: 1.125rem;
  --dyslexia-font-weight: 400;
  --dyslexia-letter-spacing: 0.07em;
  --dyslexia-word-spacing: 0.16em;
  --dyslexia-line-height: 1.8;
  --dyslexia-max-width: 65ch;
  --dyslexia-paragraph-spacing: 1.5em;

  /* Colors */
  --dyslexia-bg: #faf8f5;
  --dyslexia-text: #1a1a2e;
  --dyslexia-link: #2a52be;

  /* Reading ruler */
  --ruler-height: 3em;
  --ruler-color: rgba(255, 255, 0, 0.15);
  --ruler-border-color: rgba(0, 0, 0, 0.1);
}
```

---

## 4. Color Science for Dyslexia

### 4.1 Research on Background Colors

**Key Studies:**

**Rello & Bigham (2017):** "Good Background Colors for Readers: A Study of People with and without Dyslexia"
- Tested reading performance across multiple background colors
- Found that warm, low-saturation background colors improved reading performance
- Pure white (#FFFFFF) backgrounds were among the worst performers
- Cream and soft yellow backgrounds performed well

**Rello et al. (2012):** Text and background color preferences
- Dyslexic readers preferred and performed better with off-white and warm-toned backgrounds
- High-contrast black-on-white was not optimal; slightly reduced contrast performed better
- Color pairs tested: researchers found warm background + dark (but not pure black) text optimal

### 4.2 Meares-Irlen Syndrome and Color Overlays

**Background:**
- Meares-Irlen Syndrome (also called Scotopic Sensitivity Syndrome or Visual Stress) is a condition where the visual system is hypersensitive to certain light wavelengths
- Affects an estimated 12-14% of the general population and up to 46% of people with dyslexia
- Symptoms: text appears to move, blur, or have "rivers" of white; headaches during reading; glare sensitivity

**Color Overlay Evidence:**
- **Wilkins et al. (2001):** Demonstrated that individually-prescribed colored overlays improved reading speed by approximately 8% in affected children
- **Singleton & Henderson (2007a, 2007b):** Found that university students with visual stress showed significant reading improvements with optimal overlay colors
- **The key finding:** The optimal color is highly individual -- there is no single "best" color for all users
- **Mechanism theory:** Colored overlays filter specific wavelengths, reducing hyperexcitation of neurons in the visual cortex

**Common Effective Overlay Colors (from Irlen Institute and research):**
| Color | Hex | Use Case |
|-------|-----|----------|
| Warm Yellow | #FCF5E5 | Most commonly helpful background |
| Soft Peach | #FCEADE | Warm, comfortable reading |
| Light Rose | #F5E6E0 | Reduces glare sensitivity |
| Pale Blue | #E8F0FE | Calming; preferred by some |
| Soft Green | #E8F5E9 | Reduces visual stress for some |
| Lavender | #F0E8F5 | Midpoint between warm and cool |
| Cream | #F5F0E1 | Classic dyslexia-friendly background |

### 4.3 Specific Background Color Palette Recommendations

**Warm Backgrounds (Most Research Support):**
```css
/* Cream -- most widely recommended */
--bg-cream: #FAF8F0;

/* Soft yellow -- strong research backing from Rello & Bigham */
--bg-soft-yellow: #FDF6E3;  /* Similar to Solarized Light */

/* Warm off-white */
--bg-warm-white: #FFFEF9;

/* Peach tint */
--bg-peach: #FFF5EE;

/* Parchment */
--bg-parchment: #F5EDDC;
```

**Cool Backgrounds (Helpful for Some Users):**
```css
/* Pale blue */
--bg-pale-blue: #F0F4FA;

/* Soft green */
--bg-soft-green: #F2F7F2;

/* Light lavender */
--bg-lavender: #F5F0FA;

/* Mist */
--bg-mist: #F0F5F5;
```

**Text Colors (Pair with Backgrounds Above):**
```css
/* Soft black -- reduces glare vs pure black */
--text-dark: #2C2C2C;

/* Dark charcoal */
--text-charcoal: #333333;

/* Dark navy -- good for blue/cream combos */
--text-navy: #1A1A2E;

/* Dark brown -- natural pairing with warm backgrounds */
--text-brown: #3B2F2F;

/* AVOID pure black #000000 on pure white #FFFFFF */
```

### 4.4 Warm vs. Cool Tones

**Research Summary:**
- **Warm tones** (yellow, cream, peach, light orange) have the most research support for improving reading comfort and reducing visual stress
- **Cool tones** (light blue, mint) are preferred by a subset of users, particularly those who are sensitive to warm wavelengths
- **Key principle:** Individual variation is significant. The best approach is to offer a range of options.

**The "ideal" warm palette:**
```css
:root {
  /* Background: warm cream */
  --reading-bg: #FAF4EB;

  /* Text: dark warm gray (not pure black) */
  --reading-text: #2D2D2D;

  /* The contrast ratio of this pair is approximately 13.5:1 */
  /* WCAG AAA requires 7:1, so this is well above minimum */
}
```

### 4.5 Contrast Ratios: What Helps vs. What Hinders

**WCAG Requirements:**
| Level | Normal Text | Large Text (18pt+) |
|-------|-------------|---------------------|
| AA | 4.5:1 | 3:1 |
| AAA | 7:1 | 4.5:1 |

**Dyslexia-Specific Findings:**
- **Maximum contrast (black #000 on white #FFF = 21:1)** can actually cause visual stress for dyslexic readers due to glare
- **Optimal contrast for dyslexia: approximately 10:1 to 15:1** -- high enough for clarity, low enough to reduce glare
- Never drop below WCAG AA (4.5:1) as this impairs readability for everyone

**Recommended Contrast Pairs:**
```css
/* Pair 1: Cream background, dark text -- ~13.5:1 */
.theme-cream {
  background-color: #FAF4EB;
  color: #2D2D2D;
}

/* Pair 2: Soft yellow, charcoal -- ~12.8:1 */
.theme-yellow {
  background-color: #FDF6E3;
  color: #333333;
}

/* Pair 3: Light blue, dark navy -- ~12.2:1 */
.theme-blue {
  background-color: #F0F4FA;
  color: #1A1A2E;
}

/* Pair 4: Peach, dark brown -- ~11.5:1 */
.theme-peach {
  background-color: #FFF5EE;
  color: #3B2F2F;
}

/* Pair 5: Soft green, dark green-gray -- ~11.0:1 */
.theme-green {
  background-color: #F2F7F2;
  color: #2B3B2B;
}

/* Dark mode: muted dark background, light text -- ~10.5:1 */
.theme-dark {
  background-color: #1E1E2E;
  color: #D4D4D8;
}
```

### 4.6 Complete Color Overlay System

```css
/* Color overlay system -- applies tinted transparent layer */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9998;
  mix-blend-mode: multiply;
  transition: background-color 0.3s ease;
}

:root {
  --overlay-yellow:   rgba(255, 255, 150, 0.12);
  --overlay-rose:     rgba(255, 182, 193, 0.12);
  --overlay-blue:     rgba(173, 216, 230, 0.12);
  --overlay-green:    rgba(144, 238, 144, 0.10);
  --overlay-peach:    rgba(255, 218, 185, 0.12);
  --overlay-lavender: rgba(200, 162, 200, 0.10);
  --overlay-aqua:     rgba(127, 255, 212, 0.08);
  --overlay-orange:   rgba(255, 200, 100, 0.10);
}
```

---

## 5. Reading Ruler / Line Focus Techniques

### 5.1 How Digital Reading Rulers Work

A reading ruler (also called a line guide, reading guide, or line focus) is a visual aid that:
1. Highlights the current line of text being read
2. Dims or obscures surrounding text to reduce visual distraction
3. Moves with the reader's focus (via mouse, keyboard, or touch)

**Benefits for dyslexic readers:**
- Reduces "line jumping" (losing place between lines)
- Minimizes visual crowding from surrounding text
- Provides a focal point that guides eye movement
- Can incorporate a colored overlay (combining two interventions)

### 5.2 Implementation Approach: CSS Overlay Method

**Technique:** Use a fixed-position overlay with a transparent "window" that follows the cursor or can be moved with keyboard controls.

```css
/* Reading ruler using CSS gradients to create a transparent band */
.reading-ruler-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  transition: top 0.05s ease-out;
}

/* Three-part gradient: dark top, clear middle, dark bottom */
.reading-ruler-overlay::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, var(--ruler-opacity, 0.5)) 0%,
    rgba(0, 0, 0, var(--ruler-opacity, 0.5)) var(--ruler-top, 40%),
    transparent var(--ruler-top, 40%),
    transparent var(--ruler-bottom, 55%),
    rgba(0, 0, 0, var(--ruler-opacity, 0.5)) var(--ruler-bottom, 55%),
    rgba(0, 0, 0, var(--ruler-opacity, 0.5)) 100%
  );
}

/* Ruler window with color tint */
.reading-ruler-window {
  position: fixed;
  left: 0;
  width: 100%;
  pointer-events: none;
  z-index: 9999;
  /* Configurable properties */
  height: var(--ruler-height, 4em);
  background-color: var(--ruler-tint, rgba(255, 255, 100, 0.1));
  border-top: 1px solid var(--ruler-border, rgba(0, 0, 0, 0.15));
  border-bottom: 1px solid var(--ruler-border, rgba(0, 0, 0, 0.15));
  transition: top 0.08s ease-out;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
}
```

### 5.3 Implementation Approach: JavaScript-Controlled Ruler

```javascript
/* Conceptual JavaScript for a reading ruler */
class ReadingRuler {
  constructor(options = {}) {
    this.height = options.height || 80;         // pixels
    this.opacity = options.opacity || 0.5;      // overlay darkness
    this.tintColor = options.tintColor || 'rgba(255, 255, 100, 0.1)';
    this.mode = options.mode || 'focus';        // 'focus', 'underline', 'highlight'
  }

  // Mode 1: Focus strip -- dims everything except current line area
  // Mode 2: Underline -- thin colored line below text
  // Mode 3: Highlight -- colored band across the line
}
```

### 5.4 Ruler Modes

**Mode 1: Focus Window (most common)**
- Darkened overlay above and below a transparent strip
- Strip follows cursor Y position
- Best for: severe line-tracking difficulties

**Mode 2: Highlight Band**
- Semi-transparent colored band across the page
- No overlay above/below
- Best for: mild visual stress, color overlay benefit

**Mode 3: Underline Guide**
- Simple horizontal line that follows reading position
- Least intrusive
- Best for: readers who need a subtle guide

**Mode 4: Spotlight / Paragraph Focus**
- Highlights entire paragraph, dims everything else
- Useful for longer content

### 5.5 Adjustable Ruler Parameters

```css
:root {
  /* Ruler dimensions */
  --ruler-height: 4em;         /* Height of visible window */
  --ruler-min-height: 1.5em;   /* Minimum (single line) */
  --ruler-max-height: 10em;    /* Maximum (multi-line) */

  /* Ruler appearance */
  --ruler-tint: rgba(255, 255, 100, 0.1);  /* Yellow tint in window */
  --ruler-overlay-color: rgba(0, 0, 0, 0.5); /* Darkness of dimmed area */
  --ruler-border-width: 1px;
  --ruler-border-color: rgba(0, 0, 0, 0.15);

  /* Ruler behavior */
  --ruler-transition-speed: 0.08s;  /* How fast ruler follows cursor */
  --ruler-snap-to-line: false;      /* Snap to nearest text line */
}
```

### 5.6 Reading Ruler Color Options

```css
/* Ruler tint presets matching overlay research */
:root {
  --ruler-tint-none:     transparent;
  --ruler-tint-yellow:   rgba(255, 255, 100, 0.12);
  --ruler-tint-blue:     rgba(100, 149, 237, 0.10);
  --ruler-tint-green:    rgba(144, 238, 144, 0.10);
  --ruler-tint-pink:     rgba(255, 182, 193, 0.10);
  --ruler-tint-peach:    rgba(255, 218, 185, 0.12);
  --ruler-tint-lavender: rgba(200, 162, 200, 0.08);
  --ruler-tint-gray:     rgba(128, 128, 128, 0.08);
}
```

---

## 6. Summary: Key Metrics and Values Reference

### 6.1 Typography Quick Reference

| Property | CSS Property | Recommended Value | WCAG Requirement |
|----------|-------------|-------------------|------------------|
| Font family | font-family | Lexend, Atkinson Hyperlegible, Verdana | User choice |
| Font size | font-size | 18px (1.125rem) | Resizable to 200% |
| Font weight | font-weight | 400-500 | -- |
| Letter spacing | letter-spacing | 0.07em - 0.12em | Support 0.12em+ |
| Word spacing | word-spacing | 0.16em - 0.25em | Support 0.16em+ |
| Line height | line-height | 1.8 | Support 1.5+ |
| Line length | max-width | 55-65ch | -- |
| Paragraph spacing | margin-bottom | 1.5em - 2em | Support 2x font size |
| Text alignment | text-align | left | Never justify |
| Hyphenation | hyphens | none | -- |

### 6.2 Color Quick Reference

| Element | Hex Value | Description |
|---------|-----------|-------------|
| Background (warm cream) | #FAF4EB | Most supported by research |
| Background (soft yellow) | #FDF6E3 | Solarized-like, calming |
| Background (pale blue) | #F0F4FA | Cool alternative |
| Background (peach) | #FFF5EE | Warm alternative |
| Background (green) | #F2F7F2 | Cool alternative |
| Text (soft black) | #2D2D2D | Primary text |
| Text (charcoal) | #333333 | Alternative |
| Text (dark navy) | #1A1A2E | For blue backgrounds |
| AVOID | #000 on #FFF | Too much contrast/glare |

### 6.3 Font Availability Summary

| Font | License | Google Fonts | Variable | Best For |
|------|---------|-------------|----------|----------|
| OpenDyslexic | SIL OFL 1.1 | No | No | User preference / dyslexia-specific |
| Lexend | SIL OFL 1.1 | Yes | Yes (wght) | General reading fluency |
| Atkinson Hyperlegible Next | SIL OFL 1.1 | Yes | Yes (wght) | Character legibility |
| Comic Neue | SIL OFL 1.1 | Yes | No | Informal/accessible |
| Luciole | CC BY 4.0 | No | No | Low vision / legibility |
| Intel One Mono | SIL OFL 1.1 | No | Yes | Code / monospace needs |

---

## 7. Key Research References

1. **Zorzi, M., et al. (2012).** "Extra-large letter spacing improves reading in dyslexia." *PNAS*, 109(28), 11455-11459.
2. **Rello, L. & Baeza-Yates, R. (2013).** "Good fonts for dyslexia." *ASSETS '13: Proceedings of the 15th International ACM SIGACCESS Conference on Computers and Accessibility.*
3. **Rello, L. & Bigham, J.P. (2017).** "Good Background Colors for Readers: A Study of People with and without Dyslexia." *ASSETS '17.*
4. **Schneps, M.H., et al. (2013).** "E-readers are more effective than paper for some with dyslexia." *PLoS ONE*, 8(9).
5. **Wilkins, A.J., et al. (2001).** "Coloured overlays and their benefit for reading." *Journal of Research in Reading*, 24(1), 41-64.
6. **Wery, J.J. & Diliberto, J.A. (2017).** "The effect of a specialized dyslexia font, OpenDyslexic, on reading rate and accuracy." *Annals of Dyslexia*, 67(2), 114-127.
7. **Kuster, S.M., et al. (2018).** "Dyslexie font does not benefit reading in children with or without dyslexia." *Annals of Dyslexia*, 68(1), 25-42.
8. **Hillier, R. (2008).** "Sylexiad. A typeface for the adult dyslexic reader." *Journal of Writing in Creative Practice*, 1(3), 275-291.
9. **Perea, M., et al. (2012).** "Increasing interletter spacing facilitates reading in children." *Psicothema*, 24(4), 572-576.
10. **British Dyslexia Association.** "Dyslexia friendly style guide." *bdadyslexia.org.uk*.
11. **WCAG 2.1.** "Success Criterion 1.4.12 Text Spacing." *W3C Recommendation.*
12. **Singleton, C. & Henderson, L.M. (2007).** "Computerized screening for visual stress in children with dyslexia." *Dyslexia*, 13(2), 130-151.

---

*This document is research only. No implementation decisions have been made.*
*Compiled from published research, font documentation, and web accessibility standards.*
