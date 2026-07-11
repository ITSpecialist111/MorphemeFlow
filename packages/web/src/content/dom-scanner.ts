// MorphemeFlow — DOM Scanner
// Walks the DOM to find text nodes, skipping scripts, styles, and already-processed nodes.
// Favors semantic reading roots and falls back to prose containers only.

import { CSS_PREFIX } from "@morphemeflow/engine/constants";

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT",
  "CODE", "PRE", "SVG", "CANVAS", "VIDEO", "AUDIO", "IFRAME",
  "MATH", "HEAD", "TEMPLATE", "KBD", "SAMP", "VAR",
]);

const PROCESSED_ATTR = `data-${CSS_PREFIX}processed`;
const CONTENT_ROOT_SELECTORS = [
  "main",
  "article",
  "[role='main']",
  "[itemprop='articleBody']",
];
const UI_CONTAINER_SELECTORS = [
  "header",
  "footer",
  "nav",
  "aside",
  "menu",
  "form",
  "dialog",
  "[role='navigation']",
  "[role='menu']",
  "[role='menubar']",
  "[role='complementary']",
  "[aria-hidden='true']",
  "[contenteditable]",
  "[contenteditable='true']",
  "[role='textbox']",
  "[role='combobox']",
  "picture > *",
  "figure > svg",
  ".MathJax",
  ".MathJax_Display",
  ".katex",
];
const PROSE_SELECTOR = [
  "p", "li", "blockquote", "dd", "dt", "figcaption",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "article", "[role='article']", "[itemprop='articleBody']",
  "td", "th",
].join(",");

export interface TextNodeEntry {
  node: Text;
  parent: HTMLElement;
  text: string;
}

/**
 * Collect all visible text nodes in the document (or subtree).
 */
export function collectTextNodes(root: Node = document.body): TextNodeEntry[] {
  const entries: TextNodeEntry[] = [];
  const scanRoots = getScanRoots(root);
  const hasSemanticRoot = Boolean(document.body?.querySelector(CONTENT_ROOT_SELECTORS.join(",")));

  for (const scanRoot of scanRoots) {
    const walker = document.createTreeWalker(scanRoot, NodeFilter.SHOW_TEXT, {
      acceptNode(node: Text) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`[${PROCESSED_ATTR}]`)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`.${CSS_PREFIX}word-group`)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(UI_CONTAINER_SELECTORS.join(","))) return NodeFilter.FILTER_REJECT;
        if (!hasSemanticRoot && !parent.closest(PROSE_SELECTOR)) return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (!isLikelyVisible(parent)) return NodeFilter.FILTER_REJECT;

        const text = node.textContent?.trim();
        if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      entries.push({
        node,
        parent: node.parentElement!,
        text: node.textContent!,
      });
    }
  }

  return entries;
}

function getScanRoots(root: Node): Node[] {
  if (root !== document.body) return [root];
  if (!(root instanceof HTMLElement)) return [root];

  const contentRoots = CONTENT_ROOT_SELECTORS
    .flatMap((selector) => Array.from(root.querySelectorAll(selector)))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .filter((el) => !el.closest(UI_CONTAINER_SELECTORS.join(",")));

  if (contentRoots.length === 0) return [root];
  return [...new Set(contentRoots)];
}

function isLikelyVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  return true;
}

/**
 * Mark an element as processed so we don't re-scan it.
 */
export function markProcessed(el: HTMLElement): void {
  el.setAttribute(PROCESSED_ATTR, "1");
}

/**
 * Check if an element has been processed.
 */
export function isProcessed(el: HTMLElement): boolean {
  return el.hasAttribute(PROCESSED_ATTR);
}

/**
 * Remove processed markers (for re-processing after settings change).
 */
export function clearProcessedMarkers(root: Node = document.body): void {
  if (root instanceof HTMLElement) {
    root.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => {
      el.removeAttribute(PROCESSED_ATTR);
    });
  }
}
