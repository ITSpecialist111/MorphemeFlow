export const READER_SETTINGS_KEY = 'reader-settings-v1';

export const READING_PRESETS = {
  subtle: { font: 'atkinson', fontSize: 18, letterSpacing: 3, wordSpacing: 10, syllableGap: 4, lineHeight: 16, intensity: 30, ttsRate: 10 },
  balanced: { font: 'atkinson', fontSize: 20, letterSpacing: 5, wordSpacing: 16, syllableGap: 8, lineHeight: 20, intensity: 60, ttsRate: 9 },
  full: { font: 'lexend', fontSize: 24, letterSpacing: 10, wordSpacing: 24, syllableGap: 14, lineHeight: 24, intensity: 90, ttsRate: 8 },
};

const FONT_FAMILIES = {
  system: "'Segoe UI', system-ui, sans-serif",
  lexend: "'Lexend', 'Segoe UI', sans-serif",
  atkinson: "'Atkinson Hyperlegible', 'Segoe UI', sans-serif",
  verdana: 'Verdana, Geneva, sans-serif',
  opendyslexic: "'OpenDyslexic', 'Segoe UI', sans-serif",
};
const THEMES = ['cream', 'light', 'soft-gray', 'blue-wash', 'green-tint', 'peach', 'dark'];

export function normalizeReadingPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  const bounded = (key, min, max) => typeof source[key] === 'number' && Number.isFinite(source[key])
    ? Math.min(max, Math.max(min, source[key])) : READING_PRESETS.balanced[key];
  return {
    font: Object.hasOwn(FONT_FAMILIES, source.font) ? source.font : 'atkinson',
    theme: THEMES.includes(source.theme) ? source.theme : 'cream',
    preset: Object.hasOwn(READING_PRESETS, source.preset) || source.preset === 'custom' ? source.preset : 'balanced',
    readingMode: source.readingMode === 'plain' ? 'plain' : 'assisted',
    fontSize: bounded('fontSize', 14, 36),
    letterSpacing: bounded('letterSpacing', 0, 20),
    wordSpacing: bounded('wordSpacing', 0, 40),
    syllableGap: bounded('syllableGap', 0, 20),
    lineHeight: bounded('lineHeight', 14, 30),
    intensity: bounded('intensity', 0, 100),
    ttsRate: bounded('ttsRate', 5, 18),
    morphemesEnabled: source.morphemesEnabled !== false,
    syllablesEnabled: source.syllablesEnabled !== false,
  };
}

export function selectReadingStyle(value, style) {
  const preferences = normalizeReadingPreferences(value);
  if (style === 'plain') return { ...preferences, readingMode: 'plain' };
  if (style === 'custom') return { ...preferences, readingMode: 'assisted', preset: 'custom' };
  if (!Object.hasOwn(READING_PRESETS, style)) return preferences;
  return { ...preferences, ...READING_PRESETS[style], readingMode: 'assisted', preset: style };
}

export function applyReadingPreferences(output, value) {
  const preferences = normalizeReadingPreferences(value);
  const plain = preferences.readingMode === 'plain';
  const effective = plain ? {
    ...preferences, font: 'system', fontSize: 16, theme: 'light', letterSpacing: 0,
    wordSpacing: 0, syllableGap: 0, lineHeight: 15, intensity: 0,
  } : preferences;
  const document = output.ownerDocument;
  const root = document.documentElement.style;
  root.setProperty('--font-family', FONT_FAMILIES[effective.font]);
  root.setProperty('--font-size', `${effective.fontSize}px`);
  root.setProperty('--letter-spacing', `${(effective.letterSpacing / 100).toFixed(2)}em`);
  root.setProperty('--word-spacing', `${(effective.wordSpacing / 100).toFixed(2)}em`);
  root.setProperty('--syllable-gap', `${(effective.syllableGap / 100).toFixed(2)}em`);
  root.setProperty('--line-height', (effective.lineHeight / 10).toFixed(1));
  root.setProperty('--highlight-intensity', `${effective.intensity}%`);
  root.setProperty('--root-color', 'var(--fg)');
  document.body.classList.remove(...THEMES.map((theme) => `theme-${theme}`));
  document.body.classList.add(`theme-${effective.theme}`);
  document.documentElement.dataset.theme = effective.theme === 'dark' ? 'dark' : 'light';
  output.classList.toggle('morphemes-off', plain || !preferences.morphemesEnabled);
  output.classList.toggle('syllables-off', plain || !preferences.syllablesEnabled);
  output.classList.toggle('reading-plain', plain);
  return preferences;
}