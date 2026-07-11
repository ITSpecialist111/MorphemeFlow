// MorphemeFlow — Content Script Entry Point
// Runs on every page, applies morpheme highlighting via DOM modification.

import type { FeatureSettings, UserSettings, PageStats, ExtensionMessage } from "@morphemeflow/engine/types";
import { FONTS, THEMES, CSS_PREFIX } from "@morphemeflow/engine/constants";
import { getDefaultSettings, getEffectiveSettings } from "@morphemeflow/engine/settings";
import { applyMorphemes, removeMorphemes, getStats, installCopyHandler, restoreCache, persistCache } from "./dom-modifier";
import { enableRuler, disableRuler } from "../features/reading-ruler";
import { injectFonts, removeFontStyles } from "../features/font-loader";

let settings: UserSettings = getDefaultSettings();
let processingTimeMs = 0;
let wordsProcessed = 0;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingRoots = new Set<HTMLElement>();

/**
 * Initialize the content script.
 */
async function init(): Promise<void> {
  // Restore cached analysis results from previous page loads
  await restoreCache();

  // Load settings from chrome.storage
  try {
    const stored = await chrome.storage.sync.get("settings");
    if (stored.settings) {
      settings = stored.settings as UserSettings;
    } else {
      const local = await chrome.storage.local.get("settings");
      if (local.settings) settings = local.settings as UserSettings;
    }
  } catch {
    try {
      const local = await chrome.storage.local.get("settings");
      if (local.settings) settings = local.settings as UserSettings;
    } catch {
      // Use defaults
    }
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessage);

  // Apply if enabled; with document_start injection body may not exist yet.
  const startIfEnabled = () => {
    if (!settings.enabled) return;
    apply();
    startObserver();
    installCopyHandler();
  };

  if (document.body) {
    startIfEnabled();
  } else {
    document.addEventListener("DOMContentLoaded", startIfEnabled, { once: true });
  }

  // Persist cache periodically (every 30s) and before unload
  setInterval(() => persistCache(), 30_000);
  window.addEventListener("beforeunload", () => persistCache());
}

/**
 * Apply all features based on current settings.
 */
function apply(): void {
  const t0 = performance.now();
  const features = getPageFeatures();

  // Inject bundled fonts (once)
  injectFonts();

  // Apply reading environment (font, spacing, theme)
  if (features.readingEnv.enabled) {
    applyReadingEnvironment(features.readingEnv);
  }

  // Apply morpheme highlighting and syllable spacing
  if (features.morphemeHighlight.enabled || features.syllableSpacing.enabled) {
    wordsProcessed = applyMorphemes(features);
  }

  // Apply reading ruler
  enableRuler(features.readingRuler);

  processingTimeMs = performance.now() - t0;
}

function getPageFeatures(): FeatureSettings {
  return getEffectiveSettings(settings, window.location.hostname);
}

/**
 * Apply reading environment styles to the page.
 */
function applyReadingEnvironment(env: FeatureSettings["readingEnv"]): void {
  if (!document.head) return;
  let styleEl = document.getElementById(`${CSS_PREFIX}env-style`) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = `${CSS_PREFIX}env-style`;
    document.head.appendChild(styleEl);
  }

  const fontEntry = FONTS[env.font];
  const fontFamily = fontEntry ? fontEntry.family : "inherit";
  const theme = THEMES[env.theme] || THEMES.default;
  const preferredScope = "main, article, [role='main'], [itemprop='articleBody']";
  const hasPreferredScope = Boolean(document.body?.querySelector(preferredScope));
  const contentScope = hasPreferredScope ? preferredScope : `.${CSS_PREFIX}word-group`;
  const contentLayout = hasPreferredScope
    ? `
      ${preferredScope} {
        background-color: ${theme.bg} !important;
        color: ${theme.text} !important;
        max-width: ${env.maxLineWidth}ch;
        margin-left: auto;
        margin-right: auto;
      }
    `
    : "";

  styleEl.textContent = `
    ${contentScope} {
      font-family: ${fontFamily} !important;
      font-size: ${env.fontSize}px !important;
      letter-spacing: ${env.letterSpacing}em !important;
      word-spacing: ${env.wordSpacing}em !important;
      line-height: ${env.lineHeight} !important;
    }
    ${hasPreferredScope ? `${contentScope} p, ${contentScope} li, ${contentScope} td, ${contentScope} th,
    ${contentScope} span, ${contentScope} div, ${contentScope} h1, ${contentScope} h2,
    ${contentScope} h3, ${contentScope} h4, ${contentScope} h5, ${contentScope} h6,
    ${contentScope} a` : contentScope} {
      letter-spacing: ${env.letterSpacing}em !important;
      word-spacing: ${env.wordSpacing}em !important;
      line-height: ${env.lineHeight} !important;
    }
    ${contentLayout}
  `;
}

/**
 * Remove all MorphemeFlow modifications from the page.
 */
function removeAll(): void {
  removeMorphemes();
  disableRuler();
  removeFontStyles();

  const styleEl = document.getElementById(`${CSS_PREFIX}env-style`);
  if (styleEl) styleEl.remove();

  wordsProcessed = 0;
  processingTimeMs = 0;
}

/**
 * MutationObserver — reprocess new content as the page changes.
 */
function startObserver(): void {
  if (observer) return;
  if (!document.body) return;

  observer = new MutationObserver((mutations) => {
    if (!settings.enabled) return;

    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        const element = added.nodeType === Node.ELEMENT_NODE
          ? added as HTMLElement
          : added.parentElement;
        if (!element) continue;
        if (element.closest("header, nav, footer, aside, [role='navigation'], [role='complementary']")) {
          continue;
        }
        if (!element.closest(`.${CSS_PREFIX}word-group`)) {
          pendingRoots.add(element);
        }
      }
    }

    // Debounce to avoid thrashing on rapid mutations
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const features = getPageFeatures();
      if (!features.morphemeHighlight.enabled && !features.syllableSpacing.enabled) {
        pendingRoots.clear();
        return;
      }

      const roots = [...pendingRoots].filter((root, index, all) =>
        !all.some((candidate, candidateIndex) => candidateIndex !== index && candidate.contains(root)),
      );
      pendingRoots.clear();
      const started = performance.now();
      for (const root of roots.slice(0, 100)) {
        if (root.isConnected) {
          wordsProcessed += applyMorphemes(features, root);
      }
      }
      processingTimeMs += performance.now() - started;
    }, 150);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function stopObserver(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingRoots.clear();
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

/**
 * Handle messages from popup / background.
 */
function handleMessage(
  msg: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): boolean {
  switch (msg.type) {
    case "GET_SETTINGS":
      sendResponse(settings);
      return false;

    case "UPDATE_SETTINGS":
      settings = msg.payload as UserSettings;
      removeAll();
      if (settings.enabled) {
        apply();
        startObserver();
      } else {
        stopObserver();
      }
      sendResponse({ ok: true });
      return false;

    case "TOGGLE_EXTENSION": {
      settings.enabled = msg.payload as boolean;
      if (settings.enabled) {
        apply();
        startObserver();
      } else {
        removeAll();
        stopObserver();
      }
      sendResponse({ ok: true, enabled: settings.enabled });
      return false;
    }

    case "APPLY_PRESET":
      // Handled by background — we'll get UPDATE_SETTINGS after
      return false;

    case "GET_PAGE_STATS": {
      const stats = getStats();
      const pageStats: PageStats = {
        wordsProcessed,
        cacheHits: Math.round(stats.hitRate * stats.cacheSize),
        processingTimeMs: Math.round(processingTimeMs),
      };
      sendResponse(pageStats);
      return false;
    }

    default:
      return false;
  }
}

// Listen for storage changes (settings updated from another tab/popup)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    settings = changes.settings.newValue as UserSettings;
    removeAll();
    if (settings.enabled) {
      apply();
      startObserver();
    } else {
      stopObserver();
    }
  }
});

// Start
init();
