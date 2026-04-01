// MorphemeFlow — Settings Management
// Platform-agnostic settings with presets.

import type { UserSettings, FeatureSettings, PresetName } from "./types";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Default colors
const DEFAULT_PREFIX_COLOR = "#5B21B6"; // indigo-800
const DEFAULT_ROOT_COLOR = "#1E293B";   // slate-800
const DEFAULT_SUFFIX_COLOR = "#047857"; // emerald-700

const SUBTLE_SETTINGS: FeatureSettings = {
  morphemeHighlight: {
    enabled: true,
    prefixColor: DEFAULT_PREFIX_COLOR,
    rootColor: DEFAULT_ROOT_COLOR,
    suffixColor: DEFAULT_SUFFIX_COLOR,
    rootBold: true,
    intensity: 0.3,
  },
  syllableSpacing: { enabled: true, intensity: 0.04 },
  readingEnv: {
    enabled: true,
    font: "system",
    fontSize: 16,
    letterSpacing: 0.05,
    wordSpacing: 0.1,
    lineHeight: 1.6,
    theme: "default",
    maxLineWidth: 75,
  },
  readingRuler: {
    enabled: false,
    mode: "focus",
    height: 80,
    tintColor: "#FBBF24",
    opacity: 0.15,
  },
  tts: { enabled: false, rate: 1.0, voice: "", highlightCurrent: true },
};

const BALANCED_SETTINGS: FeatureSettings = {
  morphemeHighlight: {
    enabled: true,
    prefixColor: DEFAULT_PREFIX_COLOR,
    rootColor: DEFAULT_ROOT_COLOR,
    suffixColor: DEFAULT_SUFFIX_COLOR,
    rootBold: true,
    intensity: 0.6,
  },
  syllableSpacing: { enabled: true, intensity: 0.08 },
  readingEnv: {
    enabled: true,
    font: "lexend",
    fontSize: 18,
    letterSpacing: 0.07,
    wordSpacing: 0.16,
    lineHeight: 1.8,
    theme: "cream",
    maxLineWidth: 70,
  },
  readingRuler: {
    enabled: true,
    mode: "focus",
    height: 100,
    tintColor: "#FBBF24",
    opacity: 0.2,
  },
  tts: { enabled: false, rate: 0.9, voice: "", highlightCurrent: true },
};

const FULL_SETTINGS: FeatureSettings = {
  morphemeHighlight: {
    enabled: true,
    prefixColor: DEFAULT_PREFIX_COLOR,
    rootColor: DEFAULT_ROOT_COLOR,
    suffixColor: DEFAULT_SUFFIX_COLOR,
    rootBold: true,
    intensity: 1.0,
  },
  syllableSpacing: { enabled: true, intensity: 0.14 },
  readingEnv: {
    enabled: true,
    font: "lexend",
    fontSize: 20,
    letterSpacing: 0.1,
    wordSpacing: 0.25,
    lineHeight: 2.0,
    theme: "cream",
    maxLineWidth: 65,
  },
  readingRuler: {
    enabled: true,
    mode: "highlight",
    height: 120,
    tintColor: "#FBBF24",
    opacity: 0.25,
  },
  tts: { enabled: false, rate: 0.8, voice: "", highlightCurrent: true },
};

const PRESETS: Record<PresetName, FeatureSettings> = {
  subtle: SUBTLE_SETTINGS,
  balanced: BALANCED_SETTINGS,
  full: FULL_SETTINGS,
  custom: BALANCED_SETTINGS,
};

export function getDefaultSettings(): UserSettings {
  return {
    enabled: false,
    features: deepClone(BALANCED_SETTINGS),
    activePreset: "balanced",
    siteOverrides: {},
  };
}

export function getPreset(name: PresetName): FeatureSettings {
  return deepClone(PRESETS[name]);
}

export function getEffectiveSettings(
  settings: UserSettings,
  hostname: string,
): FeatureSettings {
  const base = settings.features;
  const overrides = settings.siteOverrides[hostname];
  if (!overrides) return base;
  return { ...base, ...overrides };
}
