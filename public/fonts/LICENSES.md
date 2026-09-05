# Font Licenses

All fonts bundled with MorphemeFlow are licensed under the SIL Open Font License 1.1 (OFL),
which permits free use, modification, and redistribution.

## Lexend
- **Designer:** Bonnie Shaver-Troup & Thomas Jockin
- **License:** SIL OFL 1.1
- **Source:** https://github.com/googlefonts/lexend
- **Purpose:** Designed specifically to reduce visual stress and improve reading proficiency.
- **Bundled licence:** `lexend/OFL.txt`. Binary retrieved from the Google Fonts `ofl/lexend` distribution.

## Atkinson Hyperlegible
- **Designer:** Braille Institute of America
- **License:** SIL OFL 1.1
- **Source:** https://brailleinstitute.org/freefont
- **Purpose:** Focuses on letter differentiation to increase legibility. Characters like
  'I', 'l', and '1' are made visually distinct to prevent confusion.
- **Bundled licence:** `atkinson/OFL.txt`.

## OpenDyslexic
- **Designer:** Abbie Gonzalez
- **License:** SIL OFL 1.1
- **Source:** https://opendyslexic.org/
- **Purpose:** Distinctive letter shapes offered as an individual reading preference, not a validated treatment claim.
- **Bundled licence:** `opendyslexic/OFL.txt`. Binaries retrieved from the project's official `compiled` directory.

Run `npm run test:fonts` to reject non-font assets. The September 2026 validation found that Lexend and three OpenDyslexic files had been HTML pages saved with font extensions. Those files were replaced with actual upstream fonts and checked in the browser runtime.
