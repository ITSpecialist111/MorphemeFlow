// MorphemeFlow — Popup Script
// Controls settings and communicates with background/content scripts.

import type { UserSettings, PresetName, PageStats, ExtensionMessage } from "../../../engine/src/types";

let settings: UserSettings | null = null;

function sendMessage(msg: ExtensionMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(msg);
}

async function init(): Promise<void> {
  // Load current settings from background
  settings = (await sendMessage({ type: "GET_SETTINGS" })) as UserSettings;
  updateUI();

  // Toggle switch
  const toggle = document.getElementById("toggle-enabled") as HTMLInputElement;
  toggle.addEventListener("change", async () => {
    if (!settings) return;
    settings.enabled = toggle.checked;
    await sendMessage({ type: "TOGGLE_EXTENSION", payload: settings.enabled });
    updateUI();
  });

  // Preset buttons
  document.querySelectorAll(".mf-preset-btn, .preset-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const preset = (btn as HTMLElement).dataset.preset as PresetName;
      await sendMessage({ type: "APPLY_PRESET", payload: preset });
      settings = (await sendMessage({ type: "GET_SETTINGS" })) as UserSettings;
      updateUI();
    });
  });

  // Feature toggles
  const featureMap: Record<string, keyof UserSettings["features"]> = {
    "feat-morpheme": "morphemeHighlight",
    "feat-syllable": "syllableSpacing",
    "feat-reading-env": "readingEnv",
    "feat-ruler": "readingRuler",
  };

  for (const [id, key] of Object.entries(featureMap)) {
    const checkbox = document.getElementById(id) as HTMLInputElement | null;
    if (!checkbox) continue;
    checkbox.addEventListener("change", async () => {
      if (!settings) return;
      (settings.features[key] as { enabled: boolean }).enabled = checkbox.checked;
      settings.activePreset = "custom";
      await sendMessage({ type: "UPDATE_SETTINGS", payload: settings });
      updateUI();
    });
  }

  // Get page stats from active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const stats = (await chrome.tabs.sendMessage(tab.id, {
        type: "GET_PAGE_STATS",
      })) as PageStats;
      updateStats(stats);
    }
  } catch {
    // Content script not loaded
  }
}

function updateUI(): void {
  if (!settings) return;

  const body = document.getElementById("popup-body");

  // Toggle
  const toggle = document.getElementById("toggle-enabled") as HTMLInputElement | null;
  if (toggle) toggle.checked = settings.enabled;

  // Toggle button (alternate UI)
  const toggleBtn = document.getElementById("toggle-btn");
  if (toggleBtn) {
    toggleBtn.textContent = settings.enabled ? "ON" : "OFF";
    toggleBtn.classList.toggle("active", settings.enabled);
  }

  // Disabled state
  if (body) {
    body.classList.toggle("mf-disabled", !settings.enabled);
  }

  // Preset buttons
  document.querySelectorAll(".mf-preset-btn, .preset-btn").forEach((btn) => {
    const preset = (btn as HTMLElement).dataset.preset;
    btn.classList.toggle("active", preset === settings!.activePreset);
  });

  // Feature toggles
  const featureEls = {
    "feat-morpheme": settings.features.morphemeHighlight.enabled,
    "feat-syllable": settings.features.syllableSpacing.enabled,
    "feat-reading-env": settings.features.readingEnv.enabled,
    "feat-ruler": settings.features.readingRuler.enabled,
  };

  for (const [id, checked] of Object.entries(featureEls)) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = checked;
  }
}

function updateStats(stats: PageStats): void {
  const wordsEl = document.getElementById("stat-words");
  const timeEl = document.getElementById("stat-time");
  const statsEl = document.getElementById("stats");

  if (wordsEl) wordsEl.textContent = String(stats.wordsProcessed);
  if (timeEl) timeEl.textContent = `${Math.round(stats.processingTimeMs)}ms`;
  if (statsEl) {
    statsEl.textContent = `${stats.wordsProcessed} words | ${Math.round(stats.processingTimeMs)}ms`;
  }
}

document.addEventListener("DOMContentLoaded", init);
