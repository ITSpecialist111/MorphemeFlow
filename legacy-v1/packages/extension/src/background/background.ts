// MorphemeFlow — Background Service Worker
// Manages settings persistence and coordinates between popup and content scripts.

import type { ExtensionMessage, UserSettings, PresetName } from "../../../engine/src/types";
import { getDefaultSettings, getPreset } from "../../../engine/src/settings";

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get("settings");
  if (!stored.settings) {
    await chrome.storage.sync.set({ settings: getDefaultSettings() });
  }
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
      const stored = await chrome.storage.sync.get("settings");
      return stored.settings || getDefaultSettings();
    }

    case "UPDATE_SETTINGS": {
      const newSettings = msg.payload as UserSettings;
      await chrome.storage.sync.set({ settings: newSettings });
      // Forward to all content scripts
      broadcastToTabs(msg);
      return { ok: true };
    }

    case "TOGGLE_EXTENSION": {
      const enabled = msg.payload as boolean;
      const stored = await chrome.storage.sync.get("settings");
      const settings = (stored.settings || getDefaultSettings()) as UserSettings;
      settings.enabled = enabled;
      await chrome.storage.sync.set({ settings });
      broadcastToTabs({ type: "TOGGLE_EXTENSION", payload: enabled });
      return { ok: true, enabled };
    }

    case "APPLY_PRESET": {
      const presetName = msg.payload as PresetName;
      const stored = await chrome.storage.sync.get("settings");
      const settings = (stored.settings || getDefaultSettings()) as UserSettings;
      settings.features = getPreset(presetName);
      settings.activePreset = presetName;
      await chrome.storage.sync.set({ settings });
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
