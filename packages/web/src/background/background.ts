// MorphemeFlow — Background Service Worker
// Manages settings persistence and coordinates between popup and content scripts.

import type { ExtensionMessage, UserSettings, PresetName } from "@morphemeflow/engine/types";
import { getDefaultSettings, getPreset } from "@morphemeflow/engine/settings";

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await loadSettings();
  await saveSettings(settings);
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(msg).then(sendResponse);
    return true; // async response
  },
);

async function handleMessage(msg: ExtensionMessage): Promise<unknown> {
  switch (msg.type) {
    case "GET_SETTINGS": {
      return loadSettings();
    }

    case "UPDATE_SETTINGS": {
      const newSettings = msg.payload as UserSettings;
      await saveSettings(newSettings);
      // Forward to all content scripts
      broadcastToTabs(msg);
      return { ok: true };
    }

    case "TOGGLE_EXTENSION": {
      const enabled = msg.payload as boolean;
      const settings = await loadSettings();
      settings.enabled = enabled;
      await saveSettings(settings);
      broadcastToTabs({ type: "TOGGLE_EXTENSION", payload: enabled });
      return { ok: true, enabled };
    }

    case "APPLY_PRESET": {
      const presetName = msg.payload as PresetName;
      const settings = await loadSettings();
      settings.features = getPreset(presetName);
      settings.activePreset = presetName;
      await saveSettings(settings);
      broadcastToTabs({ type: "UPDATE_SETTINGS", payload: settings });
      return { ok: true };
    }

    default:
      return { error: "Unknown message type" };
  }
}

/**
 * Send a message to all tabs' content scripts.
 */
function broadcastToTabs(msg: ExtensionMessage): void {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {
          // Tab might not have content script loaded
        });
      }
    }
  });
}

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-morphemeflow") {
    const settings = await loadSettings();
    settings.enabled = !settings.enabled;
    await saveSettings(settings);
    broadcastToTabs({ type: "TOGGLE_EXTENSION", payload: settings.enabled });
  }
});

// Handle settings storage with sync → local fallback
async function saveSettings(settings: UserSettings): Promise<void> {
  try {
    await chrome.storage.sync.set({ settings });
  } catch {
    // Quota exceeded or sync unavailable — fall back to local
    await chrome.storage.local.set({ settings });
  }
}

async function loadSettings(): Promise<UserSettings> {
  try {
    const stored = await chrome.storage.sync.get("settings");
    if (stored.settings) return stored.settings as UserSettings;
  } catch {
    // Try local fallback
  }
  try {
    const stored = await chrome.storage.local.get("settings");
    if (stored.settings) return stored.settings as UserSettings;
  } catch {
    // Use defaults
  }
  return getDefaultSettings();
}
