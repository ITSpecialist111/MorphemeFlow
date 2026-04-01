// MorphemeFlow — Shared Constants

export const EXTENSION_NAME = "MorphemeFlow";

// Performance targets
export const MAX_INITIAL_PROCESSING_MS = 200;
export const MAX_INCREMENTAL_PROCESSING_MS = 50;
export const CACHE_MAX_ENTRIES = 10_000;

// CSS class prefix to avoid conflicts
export const CSS_PREFIX = "mf-";

// Morpheme colors (defaults)
export const DEFAULT_PREFIX_COLOR = "#5B21B6"; // indigo-800
export const DEFAULT_ROOT_COLOR = "#1E293B";   // slate-800
export const DEFAULT_SUFFIX_COLOR = "#047857"; // emerald-700

// Theme background colors (based on dyslexia research)
export const THEMES: Record<string, { bg: string; text: string; name: string }> = {
  default: { bg: "inherit", text: "inherit", name: "Default" },
  cream: { bg: "#FAF4EB", text: "#2D2D2D", name: "Warm Cream" },
  "soft-yellow": { bg: "#FFF9E6", text: "#2D2D2D", name: "Soft Yellow" },
  "pale-blue": { bg: "#EFF6FF", text: "#1E293B", name: "Pale Blue" },
  peach: { bg: "#FFF1E6", text: "#2D2D2D", name: "Peach" },
  "soft-green": { bg: "#ECFDF5", text: "#1E293B", name: "Soft Green" },
  dark: { bg: "#1A1A2E", text: "#E0E0E0", name: "Dark Mode" },
};

// Font families — ordered by research evidence
// Research (pimpmytype.com/dyslexia-fonts, Readability Group 2022 survey of 2,022 participants):
// - Standard well-designed fonts outperform "dyslexia" fonts (SF Pro, Verdana, Segoe UI top performers)
// - OpenDyslexic does NOT improve reading rate or accuracy vs Arial (2016, 2017 studies)
// - What matters: good spacing, open letterforms, character differentiation (l/I/1, O/0)
// - Italic fonts significantly reduce readability for dyslexic readers — NEVER use as default
// - Lexend: validated — designed specifically to reduce visual stress
// - Atkinson Hyperlegible: validated — excellent character differentiation
export const FONTS: Record<string, { family: string; name: string; evidence: string }> = {
  system: {
    family: "system-ui, 'Segoe UI', -apple-system, sans-serif",
    name: "System Default",
    evidence: "Strong — SF Pro, Segoe UI top performers in 2022 survey",
  },
  lexend: {
    family: "'Lexend', sans-serif",
    name: "Lexend",
    evidence: "Strong — designed to reduce visual stress, good spacing",
  },
  atkinson: {
    family: "'Atkinson Hyperlegible', sans-serif",
    name: "Atkinson Hyperlegible",
    evidence: "Strong — superior character differentiation (Braille Institute)",
  },
  verdana: {
    family: "Verdana, Geneva, sans-serif",
    name: "Verdana",
    evidence: "Strong — top 3 in 2022 survey, wide spacing, open forms",
  },
  opendyslexic: {
    family: "'OpenDyslexic', sans-serif",
    name: "OpenDyslexic",
    evidence: "Weak — no benefit over Arial in studies; included for user choice per UDL",
  },
};

// Overlay-specific
export const OVERLAY_DEBOUNCE_MS = 150;
export const OVERLAY_SCAN_INTERVAL_MS = 500;
