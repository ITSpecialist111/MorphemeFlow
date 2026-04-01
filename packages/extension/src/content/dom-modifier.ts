// MorphemeFlow — DOM Modifier
// Replaces text nodes with morpheme-highlighted spans.

import { tokenize, analyzeWord, WordCache } from "../../../engine/src/index";
import type { FeatureSettings, Morpheme } from "../../../engine/src/types";
import { CSS_PREFIX } from "../../../engine/src/constants";
import { collectTextNodes, markProcessed, clearProcessedMarkers, type TextNodeEntry } from "./dom-scanner";

const cache = new WordCache(10_000);

// Track original text for restoration
const originals = new WeakMap<HTMLElement, { html: string }>();

/**
 * Apply morpheme highlighting to all text nodes in the subtree.
 */
export function applyMorphemes(
  settings: FeatureSettings,
  root: Node = document.body,
): number {
  const entries = collectTextNodes(root);
  let wordsProcessed = 0;

  for (const entry of entries) {
    wordsProcessed += processTextNode(entry, settings);
  }

  return wordsProcessed;
}

/**
 * Process a single text node — replace it with morpheme-styled HTML.
 */
function processTextNode(entry: TextNodeEntry, settings: FeatureSettings): number {
  const { node, parent, text } = entry;

  // Save original for undo
  if (!originals.has(parent)) {
    originals.set(parent, { html: parent.innerHTML });
  }

  const tokens = tokenize(text);
  let wordCount = 0;
  const fragments: string[] = [];

  for (const token of tokens) {
    if (token.type !== "word") {
      fragments.push(escapeHtml(token.text));
      continue;
    }

    wordCount++;
    let result = cache.get(token.text);
    if (!result) {
      result = analyzeWord(token.text);
      cache.set(token.text, result);
    }

    if (settings.morphemeHighlight.enabled && result.morphemes.length > 1) {
      fragments.push(renderMorphemes(result.morphemes, settings));
    } else if (settings.syllableSpacing.enabled && result.syllables.length > 1) {
      // Even without morpheme highlighting, add syllable spacing
      fragments.push(renderSyllableSpacing(result.syllables, settings.syllableSpacing.intensity));
    } else {
      fragments.push(escapeHtml(token.text));
    }
  }

  // Replace text node with styled HTML
  const wrapper = document.createElement("span");
  wrapper.className = `${CSS_PREFIX}word-group`;
  wrapper.innerHTML = fragments.join("");
  node.replaceWith(wrapper);
  markProcessed(wrapper);

  return wordCount;
}

/**
 * Render morphemes as styled spans.
 */
function renderMorphemes(morphemes: Morpheme[], settings: FeatureSettings): string {
  const mh = settings.morphemeHighlight;
  const parts: string[] = [];

  for (const m of morphemes) {
    let color: string;
    let fontWeight = "inherit";

    switch (m.type) {
      case "prefix":
        color = mh.prefixColor;
        break;
      case "suffix":
      case "inflection":
        color = mh.suffixColor;
        break;
      case "root":
      default:
        color = mh.rootColor;
        if (mh.rootBold) fontWeight = "bold";
        break;
    }

    const title = m.meaning ? ` title="${m.type}: ${escapeAttr(m.meaning)}"` : ` title="${m.type}"`;
    const style = `color:${color};font-weight:${fontWeight}`;
    parts.push(
      `<span class="${CSS_PREFIX}morpheme ${CSS_PREFIX}${m.type}" style="${style}"${title}>${escapeHtml(m.text)}</span>`
    );
  }

  return `<span class="${CSS_PREFIX}word">${parts.join("")}</span>`;
}

/**
 * Render syllable-spaced word.
 */
function renderSyllableSpacing(syllables: string[], intensity: number): string {
  const spacingEm = intensity;
  return syllables
    .map((s, i) =>
      i < syllables.length - 1
        ? `<span class="${CSS_PREFIX}syllable" style="margin-right:${spacingEm}em">${escapeHtml(s)}</span>`
        : `<span class="${CSS_PREFIX}syllable">${escapeHtml(s)}</span>`
    )
    .join("");
}

/**
 * Remove all morpheme modifications and restore original text.
 */
export function removeMorphemes(root: Node = document.body): void {
  if (!(root instanceof HTMLElement)) return;

  // Find all word groups and restore
  const groups = root.querySelectorAll(`.${CSS_PREFIX}word-group`);
  groups.forEach((group) => {
    const text = group.textContent || "";
    group.replaceWith(document.createTextNode(text));
  });

  clearProcessedMarkers(root);
}

/**
 * Get cache stats.
 */
export function getStats() {
  return {
    cacheSize: cache.size,
    hitRate: cache.hitRate,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
