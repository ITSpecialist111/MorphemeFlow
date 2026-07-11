// MorphemeFlow — Reading Ruler
// Provides a visual reading guide that follows the cursor.
// Three modes: focus (dim panels), highlight (tinted band), underline (thin line).

import type { ReadingRulerSettings } from "@morphemeflow/engine/types";
import { CSS_PREFIX } from "@morphemeflow/engine/constants";

let elements: HTMLElement[] = [];
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Enable the reading ruler with the given settings.
 */
export function enableRuler(settings: ReadingRulerSettings): void {
  disableRuler();

  if (!settings.enabled) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  switch (settings.mode) {
    case "focus":
      createFocusRuler(settings, prefersReducedMotion);
      break;
    case "highlight":
      createHighlightRuler(settings, prefersReducedMotion);
      break;
    case "underline":
      createUnderlineRuler(settings, prefersReducedMotion);
      break;
  }
}

/**
 * Disable and clean up the reading ruler.
 */
export function disableRuler(): void {
  for (const el of elements) {
    el.remove();
  }
  elements = [];
  if (mouseMoveHandler) {
    document.removeEventListener("mousemove", mouseMoveHandler);
    mouseMoveHandler = null;
  }
}

/**
 * Focus mode: top + bottom dim panels with a clear reading strip.
 */
function createFocusRuler(settings: ReadingRulerSettings, noTransition: boolean): void {
  const top = document.createElement("div");
  top.className = `${CSS_PREFIX}ruler-top`;
  top.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 0;
    background: rgba(0,0,0,${settings.opacity * 2});
    pointer-events: none; z-index: 2147483646;
    ${noTransition ? "" : "transition: height 0.05s linear;"}
  `;

  const bottom = document.createElement("div");
  bottom.className = `${CSS_PREFIX}ruler-bottom`;
  bottom.style.cssText = `
    position: fixed; bottom: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,${settings.opacity * 2});
    pointer-events: none; z-index: 2147483646;
    ${noTransition ? "" : "transition: height 0.05s linear;"}
  `;

  document.body.appendChild(top);
  document.body.appendChild(bottom);
  elements.push(top, bottom);

  const halfHeight = settings.height / 2;
  mouseMoveHandler = (e: MouseEvent) => {
    const y = e.clientY;
    top.style.height = `${Math.max(0, y - halfHeight)}px`;
    bottom.style.height = `${Math.max(0, window.innerHeight - y - halfHeight)}px`;
  };
  document.addEventListener("mousemove", mouseMoveHandler);
}

/**
 * Highlight mode: colored tinted band following the cursor.
 */
function createHighlightRuler(settings: ReadingRulerSettings, noTransition: boolean): void {
  const band = document.createElement("div");
  band.className = `${CSS_PREFIX}ruler-highlight`;
  band.style.cssText = `
    position: fixed; left: 0; width: 100%;
    height: ${settings.height}px;
    background-color: ${settings.tintColor};
    opacity: ${settings.opacity};
    pointer-events: none; z-index: 2147483646;
    ${noTransition ? "" : "transition: top 0.05s linear;"}
  `;

  document.body.appendChild(band);
  elements.push(band);

  mouseMoveHandler = (e: MouseEvent) => {
    band.style.top = `${e.clientY - settings.height / 2}px`;
  };
  document.addEventListener("mousemove", mouseMoveHandler);
}

/**
 * Underline mode: thin line under the reading line.
 */
function createUnderlineRuler(settings: ReadingRulerSettings, noTransition: boolean): void {
  const line = document.createElement("div");
  line.className = `${CSS_PREFIX}ruler-underline`;
  line.style.cssText = `
    position: fixed; left: 0; width: 100%;
    height: 2px;
    background-color: ${settings.tintColor};
    opacity: 0.6;
    pointer-events: none; z-index: 2147483646;
    ${noTransition ? "" : "transition: top 0.05s linear;"}
  `;

  document.body.appendChild(line);
  elements.push(line);

  mouseMoveHandler = (e: MouseEvent) => {
    line.style.top = `${e.clientY + 4}px`;
  };
  document.addEventListener("mousemove", mouseMoveHandler);
}
