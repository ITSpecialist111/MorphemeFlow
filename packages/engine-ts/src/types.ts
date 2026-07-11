// MorphemeFlow — Core Type Definitions

export interface Morpheme {
  text: string;
  type: "prefix" | "root" | "suffix" | "inflection";
  meaning?: string;
}

export interface MorphemeResult {
  word: string;
  morphemes: Morpheme[];
  syllables: string[];
  confidence: "dictionary" | "rule-based" | "syllable-only";
  tier?: "dictionary" | "rule" | "syllable";
  ruleApplied?: string;
}

export interface Token {
  text: string;
  type: "word" | "whitespace" | "punctuation" | "url" | "email" | "number" | "symbol" | "other";
}

export type PresetName = "subtle" | "balanced" | "full" | "custom";

export interface MorphemeHighlightSettings {
  enabled: boolean;
  prefixColor: string;
  rootColor: string;
  suffixColor: string;
  rootBold: boolean;
  intensity: number; // 0-1
}

export interface SyllableSpacingSettings {
  enabled: boolean;
  intensity: number; // 0 = off, 0.04 = subtle, 0.08 = default, 0.2 = strong
}

export interface ReadingEnvironmentSettings {
  enabled: boolean;
  font: "lexend" | "atkinson" | "opendyslexic" | "verdana" | "system";
  fontSize: number; // px
  letterSpacing: number; // em
  wordSpacing: number; // em
  lineHeight: number;
  theme: ThemeName;
  maxLineWidth: number; // ch
}

export type ThemeName =
  | "default"
  | "cream"
  | "soft-yellow"
  | "pale-blue"
  | "peach"
  | "soft-green"
  | "dark";

export interface ReadingRulerSettings {
  enabled: boolean;
  mode: "focus" | "highlight" | "underline";
  height: number; // px
  tintColor: string;
  opacity: number; // 0-1
}

export interface TTSSettings {
  enabled: boolean;
  rate: number; // 0.5-2.0
  voice: string;
  highlightCurrent: boolean;
}

export interface FeatureSettings {
  morphemeHighlight: MorphemeHighlightSettings;
  syllableSpacing: SyllableSpacingSettings;
  readingEnv: ReadingEnvironmentSettings;
  readingRuler: ReadingRulerSettings;
  tts: TTSSettings;
}

export interface UserSettings {
  enabled: boolean;
  features: FeatureSettings;
  activePreset: PresetName;
  siteOverrides: Record<string, Partial<FeatureSettings>>;
}

// Messages between popup, background, and content scripts
export type MessageType =
  | "GET_SETTINGS"
  | "UPDATE_SETTINGS"
  | "TOGGLE_EXTENSION"
  | "APPLY_PRESET"
  | "GET_PAGE_STATS";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface PageStats {
  wordsProcessed: number;
  cacheHits: number;
  processingTimeMs: number;
}
