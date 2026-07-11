// MorphemeFlow — DOM Modifier
// Replaces text nodes with morpheme-highlighted spans.
// Preserves original text for copy/paste via data-mf-original-text.

import { tokenize, analyzeWord, WordCache } from "@morphemeflow/engine";
import type { FeatureSettings, Morpheme } from "@morphemeflow/engine/types";
import type { CacheStorage } from "@morphemeflow/engine";
import { CSS_PREFIX } from "@morphemeflow/engine/constants";
import { collectTextNodes, markProcessed, clearProcessedMarkers, type TextNodeEntry } from "./dom-scanner";

const CACHE_STORAGE_KEY = "mf-word-cache";
const cache = new WordCache(10_000);

const chromeStorage: CacheStorage = {
  async get(key: string): Promise<unknown> {
    const stored = await chrome.storage.local.get(key);
    return stored[key];
  },
  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
};

/**
 * Restore cache from chrome.storage.local. Call once on init.
 */
export async function restoreCache(): Promise<void> {
  await cache.restore(chromeStorage, CACHE_STORAGE_KEY);
}

/**
 * Persist cache to chrome.storage.local. Call periodically.
 */
export async function persistCache(): Promise<void> {
  await cache.persist(chromeStorage, CACHE_STORAGE_KEY, 5000);
}

/**
 * Apply morpheme highlighting to all text nodes in the subtree.
 */
export function applyMorphemes(
  settings: FeatureSettings,
  root: Node = document.body,
): number {
  const entries = collectTextNodes(root);
  let wordsProcessed = 0;

  const replacements: Array<{ node: Text; wrapper: HTMLSpanElement; count: number }> = [];

  for (const entry of entries) {
    const result = processTextNode(entry, settings);
    if (result) {
      replacements.push(result);
      wordsProcessed += result.count;
    }
  }

  // Apply all replacements
  for (const { node, wrapper } of replacements) {
    node.replaceWith(wrapper);
  }

  return wordsProcessed;
}

/**
 * Process a single text node — replace it with morpheme-styled HTML.
 */
function processTextNode(
  entry: TextNodeEntry,
  settings: FeatureSettings,
): { node: Text; wrapper: HTMLSpanElement; count: number } | null {
  const { node, parent, text } = entry;
  if (parent.closest(`.${CSS_PREFIX}word-group`)) return null;

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
      fragments.push(renderMorphemes(
        result.morphemes,
        settings,
        result.confidence,
        window.getComputedStyle(parent).color,
        result.syllables,
      ));
    } else if (settings.syllableSpacing.enabled && result.syllables.length > 1) {
      fragments.push(renderSyllableSpacing(result.syllables, settings.syllableSpacing.intensity));
    } else {
      fragments.push(escapeHtml(token.text));
    }
  }

  if (wordCount === 0) return null;

  // Create wrapper with original text for copy/paste
  const wrapper = document.createElement("span");
  wrapper.className = `${CSS_PREFIX}word-group`;
  wrapper.setAttribute("data-mf-original-text", text);
  wrapper.innerHTML = fragments.join("");
  markProcessed(wrapper);

  return { node, wrapper, count: wordCount };
}

/**
 * Render morphemes as styled spans.
 */
function renderMorphemes(
  morphemes: Morpheme[],
  settings: FeatureSettings,
  tier: string,
  baseColor: string,
  syllables: string[],
): string {
  const mh = settings.morphemeHighlight;
  const parts: string[] = [];
  const surfaceWord = morphemes.map((morpheme) => morpheme.text).join("");
  const boundaries = new Set<number>();
  if (settings.syllableSpacing.enabled && syllables.join("") === surfaceWord) {
    let boundary = 0;
    for (const syllable of syllables.slice(0, -1)) {
      boundary += syllable.length;
      boundaries.add(boundary);
    }
  }
  let wordOffset = 0;

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
    const intensity = Math.round(Math.max(0, Math.min(1, mh.intensity)) * 100);
    const mixedColor = `color-mix(in srgb, ${color} ${intensity}%, ${baseColor})`;
    const style = `color:${mixedColor};font-weight:${fontWeight}`;
    let renderedText = "";
    for (const character of m.text) {
      renderedText += escapeHtml(character);
      wordOffset += character.length;
      if (boundaries.has(wordOffset)) {
        renderedText += `<span class="${CSS_PREFIX}syllable-gap" style="inline-size:${settings.syllableSpacing.intensity}em" aria-hidden="true"></span>`;
      }
    }
    parts.push(
      `<span class="${CSS_PREFIX}morpheme ${CSS_PREFIX}${m.type}" style="${style}"${title}>${renderedText}</span>`,
    );
  }

  return `<span class="${CSS_PREFIX}word" data-mf-tier="${tier}">${parts.join("")}</span>`;
}

/**
 * Render syllable-spaced word.
 */
function renderSyllableSpacing(syllables: string[], intensity: number): string {
  const spacingEm = intensity;
  return syllables
    .map((s, i) =>
      i < syllables.length - 1
        ? `<span class="${CSS_PREFIX}syllable" style="margin-inline-end:${spacingEm}em">${escapeHtml(s)}</span>`
        : `<span class="${CSS_PREFIX}syllable">${escapeHtml(s)}</span>`,
    )
    .join("");
}

/**
 * Remove all morpheme modifications and restore original text.
 */
export function removeMorphemes(root: Node = document.body): void {
  if (!(root instanceof HTMLElement)) return;

  const groups = root.querySelectorAll(`.${CSS_PREFIX}word-group`);
  groups.forEach((group) => {
    const original = group.getAttribute("data-mf-original-text");
    const text = original || group.textContent || "";
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

/**
 * Install copy event handler to restore original text on copy.
 */
export function installCopyHandler(): void {
  document.addEventListener("copy", (e) => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Check if the selection contains any morpheme-processed content
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const el = container instanceof HTMLElement ? container : container.parentElement;
    if (!el?.querySelector?.(`.${CSS_PREFIX}word-group`)) return;

    // Build clean text from the selection, using original text where available
    const fragment = range.cloneContents();
    const groups = fragment.querySelectorAll(`.${CSS_PREFIX}word-group`);
    groups.forEach((group) => {
      const original = group.getAttribute("data-mf-original-text");
      if (original) {
        group.replaceWith(document.createTextNode(original));
      }
    });

    const cleanText = fragment.textContent || "";
    if (cleanText && e.clipboardData) {
      e.clipboardData.setData("text/plain", cleanText);
      e.preventDefault();
    }
  });
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
