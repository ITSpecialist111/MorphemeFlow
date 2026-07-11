// MorphemeFlow — Font Loader
// Injects @font-face declarations for bundled fonts using chrome.runtime.getURL.

import { CSS_PREFIX } from "@morphemeflow/engine/constants";

let injected = false;

/**
 * Inject @font-face rules for all bundled fonts.
 * Safe to call multiple times — only injects once.
 */
export function injectFonts(): void {
  if (injected) return;
  if (!document.head) return;
  injected = true;

  const style = document.createElement("style");
  style.id = `${CSS_PREFIX}fonts`;
  style.textContent = buildFontFaceRules();
  document.head.appendChild(style);
}

/**
 * Remove injected font styles.
 */
export function removeFontStyles(): void {
  const el = document.getElementById(`${CSS_PREFIX}fonts`);
  if (el) el.remove();
  injected = false;
}

function fontURL(path: string): string {
  return chrome.runtime.getURL(`fonts/${path}`);
}

function buildFontFaceRules(): string {
  return `
/* Lexend — Variable weight (100-900) */
@font-face {
  font-family: 'Lexend';
  src: url('${fontURL("lexend/Lexend-Variable.ttf")}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

/* Atkinson Hyperlegible */
@font-face {
  font-family: 'Atkinson Hyperlegible';
  src: url('${fontURL("atkinson/AtkinsonHyperlegible-Regular.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Atkinson Hyperlegible';
  src: url('${fontURL("atkinson/AtkinsonHyperlegible-Bold.ttf")}') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Atkinson Hyperlegible';
  src: url('${fontURL("atkinson/AtkinsonHyperlegible-Italic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}

/* OpenDyslexic */
@font-face {
  font-family: 'OpenDyslexic';
  src: url('${fontURL("opendyslexic/OpenDyslexic-Regular.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'OpenDyslexic';
  src: url('${fontURL("opendyslexic/OpenDyslexic-Bold.otf")}') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'OpenDyslexic';
  src: url('${fontURL("opendyslexic/OpenDyslexic-Italic.otf")}') format('opentype');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
`;
}
