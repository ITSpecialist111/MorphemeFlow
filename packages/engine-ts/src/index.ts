// MorphemeFlow Engine — Barrel Export
// Pure TypeScript morpheme engine, shared by all deployment targets.

export { tokenize, reconstructText } from "./tokenizer";
export { analyzeWord, analyzeWords, getDictionarySize } from "./morpheme-analyzer";
export { splitSyllables, countSyllables } from "./syllable-splitter";
export { WordCache } from "./word-cache";
export type { CacheStorage } from "./word-cache";
export { getDefaultSettings, getPreset, getEffectiveSettings } from "./settings";
export {
  EXTENSION_NAME,
  CSS_PREFIX,
  DEFAULT_PREFIX_COLOR,
  DEFAULT_ROOT_COLOR,
  DEFAULT_SUFFIX_COLOR,
  THEMES,
  FONTS,
  OVERLAY_DEBOUNCE_MS,
  OVERLAY_SCAN_INTERVAL_MS,
} from "./constants";

export type {
  Token,
  Morpheme,
  MorphemeResult,
  UserSettings,
  FeatureSettings,
  PresetName,
  MorphemeHighlightSettings,
  SyllableSpacingSettings,
  ReadingEnvironmentSettings,
  ReadingRulerSettings,
  TTSSettings,
  ThemeName,
  PageStats,
} from "./types";
