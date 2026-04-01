// MorphemeFlow — DOM Scanner
// Walks the DOM to find text nodes, skipping scripts, styles, and already-processed nodes.

import { CSS_PREFIX } from "../../../engine/src/constants";

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT",
  "CODE", "PRE", "SVG", "CANVAS", "VIDEO", "AUDIO", "IFRAME",
  "MATH", "HEAD", "TEMPLATE",
]);

const PROCESSED_ATTR = `data-${CSS_PREFIX}processed`;

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
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`[${PROCESSED_ATTR}]`)) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;

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

  return entries;
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
