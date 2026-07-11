// MorphemeFlow — Popup Script
// Controls settings and communicates with background/content scripts.

import type { UserSettings, PresetName, PageStats, ExtensionMessage, ThemeName } from "@morphemeflow/engine/types";
import { THEMES } from "@morphemeflow/engine/constants";

let settings: UserSettings | null = null;
let currentHostname = "";

function sendMessage(msg: ExtensionMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(msg);
}

async function init(): Promise<void> {
  settings = (await sendMessage({ type: "GET_SETTINGS" })) as UserSettings;

  // Get current tab hostname for site overrides
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentHostname = new URL(tab.url).hostname;
    }
  } catch {
    // No tab access
  }

  buildThemeGrid();
  bindToggle();
  bindPresets();
  bindFeatureToggles();
  bindSliders();
  bindFontPicker();
  bindThemePicker();
  bindRulerModes();
  bindSiteOverride();
  updateUI();
  fetchStats();
}

// ── Toggle ──────────────────────────────────────────────

function bindToggle(): void {
  const btn = document.getElementById("toggle-btn")!;
  btn.addEventListener("click", async () => {
    if (!settings) return;
    settings.enabled = !settings.enabled;
    await sendMessage({ type: "TOGGLE_EXTENSION", payload: settings.enabled });
    updateUI();
  });
}

// ── Presets ──────────────────────────────────────────────

function bindPresets(): void {
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const preset = (btn as HTMLElement).dataset.preset as PresetName;
      await sendMessage({ type: "APPLY_PRESET", payload: preset });
      settings = (await sendMessage({ type: "GET_SETTINGS" })) as UserSettings;
      updateUI();
    });
  });
}

// ── Feature toggles ─────────────────────────────────────

function bindFeatureToggles(): void {
  const featureMap: Record<string, keyof UserSettings["features"]> = {
    "feat-morpheme": "morphemeHighlight",
    "feat-syllable": "syllableSpacing",
    "feat-reading-env": "readingEnv",
    "feat-ruler": "readingRuler",
  };

  for (const [id, key] of Object.entries(featureMap)) {
    const checkbox = document.getElementById(id) as HTMLInputElement | null;
    if (!checkbox) continue;
    checkbox.addEventListener("change", () => {
      if (!settings) return;
      (settings.features[key] as { enabled: boolean }).enabled = checkbox.checked;
      commitSettings();
    });
  }
}

// ── Sliders ─────────────────────────────────────────────

function bindSliders(): void {
  // Morpheme intensity (0-100 → 0-1)
  bindSlider("slider-morph-intensity", "val-morph-intensity", (v) => {
    if (!settings) return;
    settings.features.morphemeHighlight.intensity = v / 100;
  }, (v) => `${v}%`);

  // Syllable gap (0-20 → 0-0.20 em)
  bindSlider("slider-syllable-gap", "val-syllable-gap", (v) => {
    if (!settings) return;
    settings.features.syllableSpacing.intensity = v / 100;
  }, (v) => `${(v / 100).toFixed(2)}em`);

  // Font size (12-28 px)
  bindSlider("slider-font-size", "val-font-size", (v) => {
    if (!settings) return;
    settings.features.readingEnv.fontSize = v;
  }, (v) => `${v}px`);

  // Letter spacing (0-20 → 0-0.20 em)
  bindSlider("slider-letter-sp", "val-letter-sp", (v) => {
    if (!settings) return;
    settings.features.readingEnv.letterSpacing = v / 100;
  }, (v) => `${(v / 100).toFixed(2)}em`);

  // Word spacing (0-50 → 0-0.50 em)
  bindSlider("slider-word-sp", "val-word-sp", (v) => {
    if (!settings) return;
    settings.features.readingEnv.wordSpacing = v / 100;
  }, (v) => `${(v / 100).toFixed(2)}em`);

  // Line height (12-30 → 1.2-3.0)
  bindSlider("slider-line-h", "val-line-h", (v) => {
    if (!settings) return;
    settings.features.readingEnv.lineHeight = v / 10;
  }, (v) => `${(v / 10).toFixed(1)}`);

  // Line width (40-120 ch)
  bindSlider("slider-line-w", "val-line-w", (v) => {
    if (!settings) return;
    settings.features.readingEnv.maxLineWidth = v;
  }, (v) => `${v}ch`);
}

let sliderDebounce: ReturnType<typeof setTimeout> | null = null;

function bindSlider(
  sliderId: string,
  valueId: string,
  onUpdate: (value: number) => void,
  format: (value: number) => string,
): void {
  const slider = document.getElementById(sliderId) as HTMLInputElement | null;
  const display = document.getElementById(valueId);
  if (!slider) return;

  slider.addEventListener("input", () => {
    const v = Number(slider.value);
    if (display) display.textContent = format(v);
    onUpdate(v);

    // Debounce the settings commit to avoid spamming
    if (sliderDebounce) clearTimeout(sliderDebounce);
    sliderDebounce = setTimeout(() => commitSettings(), 200);
  });
}

// ── Font Picker ─────────────────────────────────────────

function bindFontPicker(): void {
  document.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!settings) return;
      const font = (btn as HTMLElement).dataset.font as UserSettings["features"]["readingEnv"]["font"];
      settings.features.readingEnv.font = font;
      commitSettings();
    });
  });
}

// ── Theme Picker ────────────────────────────────────────

function buildThemeGrid(): void {
  const grid = document.getElementById("theme-grid");
  if (!grid) return;

  for (const [key, theme] of Object.entries(THEMES)) {
    const btn = document.createElement("button");
    btn.className = "picker-item";
    btn.dataset.theme = key;
    btn.setAttribute("aria-label", `${theme.name} theme`);
    btn.innerHTML = `<div class="theme-swatch" style="background:${theme.bg === "inherit" ? "#FFFFFF" : theme.bg}"></div>${theme.name}`;
    grid.appendChild(btn);
  }
}

function bindThemePicker(): void {
  document.getElementById("theme-grid")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-theme]") as HTMLElement | null;
    if (!btn || !settings) return;
    settings.features.readingEnv.theme = btn.dataset.theme as ThemeName;
    commitSettings();
  });
}

// ── Ruler mode buttons ──────────────────────────────────

function bindRulerModes(): void {
  document.querySelectorAll(".ruler-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!settings) return;
      const mode = (btn as HTMLElement).dataset.mode as "focus" | "highlight" | "underline";
      settings.features.readingRuler.mode = mode;
      commitSettings();
    });
  });
}

// ── Site override ───────────────────────────────────────

function bindSiteOverride(): void {
  const btn = document.getElementById("site-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!settings || !currentHostname) return;

    if (settings.siteOverrides[currentHostname]) {
      // Re-enable on this site
      delete settings.siteOverrides[currentHostname];
    } else {
      // Disable all features on this site
      settings.siteOverrides[currentHostname] = {
        morphemeHighlight: { ...settings.features.morphemeHighlight, enabled: false },
        syllableSpacing: { ...settings.features.syllableSpacing, enabled: false },
        readingEnv: { ...settings.features.readingEnv, enabled: false },
        readingRuler: { ...settings.features.readingRuler, enabled: false },
        tts: { ...settings.features.tts, enabled: false },
      };
    }
    await sendMessage({ type: "UPDATE_SETTINGS", payload: settings });
    updateUI();
  });
}

// ── Commit settings ─────────────────────────────────────

async function commitSettings(): Promise<void> {
  if (!settings) return;
  settings.activePreset = "custom";
  await sendMessage({ type: "UPDATE_SETTINGS", payload: settings });
  updateUI();
}

// ── Stats ───────────────────────────────────────────────

async function fetchStats(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const stats = (await chrome.tabs.sendMessage(tab.id, {
        type: "GET_PAGE_STATS",
      })) as PageStats;
      const wordsEl = document.getElementById("stat-words");
      const timeEl = document.getElementById("stat-time");
      if (wordsEl) wordsEl.textContent = String(stats.wordsProcessed);
      if (timeEl) timeEl.textContent = String(Math.round(stats.processingTimeMs));
    }
  } catch {
    // Content script not loaded
  }
}

// ── Update UI ───────────────────────────────────────────

function updateUI(): void {
  if (!settings) return;

  const body = document.getElementById("popup-body");

  // Toggle button
  const toggleBtn = document.getElementById("toggle-btn");
  if (toggleBtn) {
    toggleBtn.textContent = settings.enabled ? "ON" : "OFF";
    toggleBtn.classList.toggle("active", settings.enabled);
  }

  // Disabled state
  if (body) body.classList.toggle("mf-disabled", !settings.enabled);

  // Presets
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    const preset = (btn as HTMLElement).dataset.preset;
    btn.classList.toggle("active", preset === settings!.activePreset);
  });

  // Feature toggles
  setChecked("feat-morpheme", settings.features.morphemeHighlight.enabled);
  setChecked("feat-syllable", settings.features.syllableSpacing.enabled);
  setChecked("feat-reading-env", settings.features.readingEnv.enabled);
  setChecked("feat-ruler", settings.features.readingRuler.enabled);

  // Slider values
  setSlider("slider-morph-intensity", "val-morph-intensity",
    Math.round(settings.features.morphemeHighlight.intensity * 100), (v) => `${v}%`);
  setSlider("slider-syllable-gap", "val-syllable-gap",
    Math.round(settings.features.syllableSpacing.intensity * 100), (v) => `${(v / 100).toFixed(2)}em`);
  setSlider("slider-font-size", "val-font-size",
    settings.features.readingEnv.fontSize, (v) => `${v}px`);
  setSlider("slider-letter-sp", "val-letter-sp",
    Math.round(settings.features.readingEnv.letterSpacing * 100), (v) => `${(v / 100).toFixed(2)}em`);
  setSlider("slider-word-sp", "val-word-sp",
    Math.round(settings.features.readingEnv.wordSpacing * 100), (v) => `${(v / 100).toFixed(2)}em`);
  setSlider("slider-line-h", "val-line-h",
    Math.round(settings.features.readingEnv.lineHeight * 10), (v) => `${(v / 10).toFixed(1)}`);
  setSlider("slider-line-w", "val-line-w",
    settings.features.readingEnv.maxLineWidth, (v) => `${v}ch`);

  // Font picker
  document.querySelectorAll("[data-font]").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.font === settings!.features.readingEnv.font);
  });

  // Theme picker
  document.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.theme === settings!.features.readingEnv.theme);
  });

  // Ruler mode
  document.querySelectorAll(".ruler-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.mode === settings!.features.readingRuler.mode);
  });

  // Sub-controls visibility
  toggleSubControls("morpheme-sliders", settings.features.morphemeHighlight.enabled);
  toggleSubControls("syllable-sliders", settings.features.syllableSpacing.enabled);
  toggleSubControls("ruler-controls", settings.features.readingRuler.enabled);
  toggleSubControls("section-font", settings.features.readingEnv.enabled);
  toggleSubControls("section-typography", settings.features.readingEnv.enabled);
  toggleSubControls("section-theme", settings.features.readingEnv.enabled);

  // Site override button
  const siteBtn = document.getElementById("site-btn");
  if (siteBtn && currentHostname) {
    const isDisabled = Boolean(settings.siteOverrides[currentHostname]);
    siteBtn.textContent = isDisabled ? `Re-enable on ${currentHostname}` : `Disable on ${currentHostname}`;
    siteBtn.classList.toggle("disabled-site", isDisabled);
  } else if (siteBtn) {
    siteBtn.textContent = "Disable on this site";
    siteBtn.setAttribute("disabled", "");
  }
}

function setChecked(id: string, checked: boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.checked = checked;
}

function setSlider(sliderId: string, valueId: string, value: number, format: (v: number) => string): void {
  const slider = document.getElementById(sliderId) as HTMLInputElement | null;
  const display = document.getElementById(valueId);
  if (slider) slider.value = String(value);
  if (display) display.textContent = format(value);
}

function toggleSubControls(id: string, show: boolean): void {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? "" : "none";
}

document.addEventListener("DOMContentLoaded", init);
