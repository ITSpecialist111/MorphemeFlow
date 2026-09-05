// MorphemeFlow Reader — integrated Reader and OCR selector frontend

import { renderTokens } from './render.js';
import { initOverlayControls } from './overlay-controls.js';
import { localEnglishVoice } from './speech.js';
import { applyReadingPreferences, normalizeReadingPreferences, READER_SETTINGS_KEY, READING_PRESETS, selectReadingStyle } from './reading-preferences.js';

const tauri = window.__TAURI__ || {};
const internals = window.__TAURI_INTERNALS__ || {};
const invoke = tauri.core?.invoke || internals.invoke || (async (command) => {
  throw new Error(`Tauri backend is unavailable (${command})`);
});
const listen = tauri.event?.listen || (async () => () => {});

const SETTINGS_KEY = READER_SETTINGS_KEY;
const DEFAULT_HOTKEYS = {
  capture: 'Ctrl+Shift+M',
  ocr: 'Ctrl+Shift+R',
};
const PRESETS = READING_PRESETS;
const THEMES = [
  { id: 'cream', label: 'Cream', color: '#FDF6E3' },
  { id: 'light', label: 'Light', color: '#FFFFFF' },
  { id: 'soft-gray', label: 'Gray', color: '#F1F5F9' },
  { id: 'blue-wash', label: 'Blue', color: '#EFF6FF' },
  { id: 'green-tint', label: 'Green', color: '#F0FDF4' },
  { id: 'peach', label: 'Peach', color: '#FFF7ED' },
  { id: 'dark', label: 'Dark', color: '#1E293B' },
];
const DEFAULT_SETTINGS = {
  theme: 'cream',
  font: 'atkinson',
  preset: 'balanced',
  readingMode: 'assisted',
  pinned: false,
  morphemesEnabled: true,
  syllablesEnabled: true,
  rulerEnabled: false,
  onboardingComplete: false,
  hotkeys: { ...DEFAULT_HOTKEYS },
  ...PRESETS.balanced,
};

let settings = structuredClone(DEFAULT_SETTINGS);
let settingsStore = null;
let statusTimer = null;
let saveTimer = null;
let currentPlainText = '';
let ttsUtterance = null;
let isSpeaking = false;
let ruler = null;

const byId = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

async function start() {
  let role = 'main';
  try {
    role = await invoke('window_role');
  } catch (error) {
    console.error('[MorphemeFlow] Could not identify window role', error);
  }

  if (role === 'ocr') {
    await initOcrWindow();
  } else {
    await initReaderWindow();
  }
}

async function initReaderWindow() {
  buildThemeGrid();
  bindSettings();
  bindInputActions();
  bindTts();
  bindRuler();
  bindOnboarding();
  await loadSettings();
  applySettings();
  await restoreHotkeys();
  await bindBackendEvents();
  await initOverlayControls({ invoke, listen, showStatus });
  showOnboardingIfNeeded();
}

async function loadSettings() {
  let stored = null;
  try {
    const Store = window.__TAURI__?.store;
    if (Store?.load) {
      settingsStore = await Store.load('settings.json', { autoSave: true });
      stored = await settingsStore.get(SETTINGS_KEY);
    }
  } catch (error) {
    console.warn('[MorphemeFlow] Tauri settings store unavailable', error);
  }

  if (!stored) {
    try {
      stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    } catch {
      stored = null;
    }
  }

  if (stored && typeof stored === 'object') {
    settings = {
      ...settings,
      ...stored,
      hotkeys: { ...DEFAULT_HOTKEYS, ...(stored.hotkeys || {}) },
    };
  }
  sanitizeSettings();
}

function sanitizeSettings() {
  Object.assign(settings, normalizeReadingPreferences(settings));
  const themeIds = new Set(THEMES.map((theme) => theme.id));
  const fonts = new Set(['system', 'lexend', 'atkinson', 'verdana', 'opendyslexic']);
  if (!themeIds.has(settings.theme)) settings.theme = DEFAULT_SETTINGS.theme;
  if (!fonts.has(settings.font)) settings.font = DEFAULT_SETTINGS.font;
  if (!Object.hasOwn(PRESETS, settings.preset) && settings.preset !== 'custom') {
    settings.preset = 'balanced';
  }

  settings.fontSize = clamp(Number(settings.fontSize) || 20, 14, 36);
  settings.letterSpacing = clamp(Number(settings.letterSpacing) || 0, 0, 20);
  settings.wordSpacing = clamp(Number(settings.wordSpacing) || 0, 0, 40);
  settings.syllableGap = clamp(Number(settings.syllableGap) || 0, 0, 20);
  settings.lineHeight = clamp(Number(settings.lineHeight) || 20, 14, 30);
  settings.intensity = clamp(Number(settings.intensity) || 0, 0, 100);
  settings.ttsRate = clamp(Number(settings.ttsRate) || 9, 5, 18);
  settings.pinned = Boolean(settings.pinned);
  settings.morphemesEnabled = settings.morphemesEnabled !== false;
  settings.syllablesEnabled = settings.syllablesEnabled !== false;
  settings.rulerEnabled = Boolean(settings.rulerEnabled);
  settings.onboardingComplete = Boolean(settings.onboardingComplete);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettings, 100);
}

async function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('[MorphemeFlow] localStorage save failed', error);
  }

  if (settingsStore) {
    try {
      await settingsStore.set(SETTINGS_KEY, settings);
      if (settingsStore.save) await settingsStore.save();
    } catch (error) {
      console.warn('[MorphemeFlow] settings store save failed', error);
    }
  }
  await publishReadingPreferences();
}

async function publishReadingPreferences() {
  try {
    await tauri.event?.emit('reader-preferences-changed', normalizeReadingPreferences(settings));
  } catch (error) {
    console.warn('[MorphemeFlow] Could not update the reading lens preferences', error);
  }
}

function buildThemeGrid() {
  const grid = byId('theme-grid');
  grid.replaceChildren();
  for (const theme of THEMES) {
    const button = document.createElement('button');
    button.className = 'theme-btn';
    button.dataset.theme = theme.id;
    button.setAttribute('aria-label', `${theme.label} theme`);

    const swatch = document.createElement('span');
    swatch.className = 'theme-swatch';
    swatch.style.background = theme.color;
    button.append(swatch, document.createTextNode(theme.label));
    button.addEventListener('click', () => {
      settings.theme = theme.id;
      settings.preset = 'custom';
      settings.readingMode = 'assisted';
      applySettings();
      scheduleSave();
    });
    grid.appendChild(button);
  }
}

function bindSettings() {
  byId('settings-btn').addEventListener('click', () => toggleSettings());
  byId('new-btn').addEventListener('click', showInput);
  byId('reading-style').addEventListener('change', (event) => changeReadingStyle(event.target.value));

  byId('pin-btn').addEventListener('click', async () => {
    const next = !settings.pinned;
    try {
      await invoke('set_pinned', { pinned: next });
      settings.pinned = next;
      applySettings();
      scheduleSave();
    } catch (error) {
      showStatus(String(error), 'error');
    }
  });

  document.querySelectorAll('.picker-btn[data-font]').forEach((button) => {
    button.addEventListener('click', () => {
      settings.font = button.dataset.font;
      settings.preset = 'custom';
      settings.readingMode = 'assisted';
      applySettings();
      scheduleSave();
    });
  });

  document.querySelectorAll('.picker-btn[data-preset]').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  const toggles = {
    'toggle-morphemes': 'morphemesEnabled',
    'toggle-syllables': 'syllablesEnabled',
    'toggle-ruler': 'rulerEnabled',
  };
  for (const [id, key] of Object.entries(toggles)) {
    byId(id).addEventListener('change', (event) => {
      settings[key] = event.target.checked;
      settings.preset = 'custom';
      settings.readingMode = 'assisted';
      applySettings();
      scheduleSave();
    });
  }

  const sliders = [
    ['slider-font-size', 'fontSize'],
    ['slider-letter-sp', 'letterSpacing'],
    ['slider-word-sp', 'wordSpacing'],
    ['slider-syllable-gap', 'syllableGap'],
    ['slider-line-h', 'lineHeight'],
    ['slider-intensity', 'intensity'],
    ['slider-tts-rate', 'ttsRate'],
  ];
  for (const [id, key] of sliders) {
    byId(id).addEventListener('input', (event) => {
      settings[key] = Number(event.target.value);
      settings.preset = 'custom';
      settings.readingMode = 'assisted';
      applySettings();
      scheduleSave();
    });
  }

  document.querySelectorAll('.hotkey-btn').forEach((button) => {
    button.addEventListener('click', () => recordHotkey(button));
  });
}

function toggleSettings(force) {
  const panel = byId('settings-panel');
  const show = force ?? panel.hidden;
  panel.hidden = !show;
  byId('settings-btn').classList.toggle('active', show);
  byId('settings-btn').setAttribute('aria-expanded', String(show));
}

function applyPreset(name, persist = true) {
  if (!PRESETS[name]) return;
  Object.assign(settings, selectReadingStyle(settings, name));
  applySettings();
  if (persist) scheduleSave();
}

function changeReadingStyle(style) {
  Object.assign(settings, selectReadingStyle(settings, style));
  applySettings();
  scheduleSave();
}

function applySettings() {
  applyReadingPreferences(byId('reader-output'), settings);
  byId('reading-style').value = settings.readingMode === 'plain' ? 'plain' : settings.preset;

  setSlider('slider-font-size', 'val-font-size', settings.fontSize, `${settings.fontSize}px`);
  setSlider('slider-letter-sp', 'val-letter-sp', settings.letterSpacing, `${(settings.letterSpacing / 100).toFixed(2)}em`);
  setSlider('slider-word-sp', 'val-word-sp', settings.wordSpacing, `${(settings.wordSpacing / 100).toFixed(2)}em`);
  setSlider('slider-syllable-gap', 'val-syllable-gap', settings.syllableGap, `${(settings.syllableGap / 100).toFixed(2)}em`);
  setSlider('slider-line-h', 'val-line-h', settings.lineHeight, (settings.lineHeight / 10).toFixed(1));
  setSlider('slider-intensity', 'val-intensity', settings.intensity, `${settings.intensity}%`);
  setSlider('slider-tts-rate', 'val-tts-rate', settings.ttsRate, `${(settings.ttsRate / 10).toFixed(1)}×`);

  byId('toggle-morphemes').checked = settings.morphemesEnabled;
  byId('toggle-syllables').checked = settings.syllablesEnabled;
  byId('toggle-ruler').checked = settings.rulerEnabled;
  byId('pin-btn').classList.toggle('active', settings.pinned);
  byId('ruler-btn').classList.toggle('active', settings.rulerEnabled);

  document.querySelectorAll('[data-font]').forEach((button) => {
    button.classList.toggle('active', button.dataset.font === settings.font);
  });
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === settings.preset);
  });
  document.querySelectorAll('[data-theme]').forEach((button) => {
    button.classList.toggle('active', button.dataset.theme === settings.theme);
  });

  if (ruler) ruler.hidden = !settings.rulerEnabled || settings.readingMode === 'plain';
}

function setSlider(inputId, valueId, value, label) {
  byId(inputId).value = String(value);
  byId(valueId).textContent = label;
}

async function restoreHotkeys() {
  for (const action of ['capture', 'ocr']) {
    const button = byId(`hotkey-${action}`);
    const shortcut = settings.hotkeys[action] || DEFAULT_HOTKEYS[action];
    button.textContent = shortcut;
    try {
      await invoke('set_hotkey', { action, shortcut });
    } catch (error) {
      settings.hotkeys[action] = DEFAULT_HOTKEYS[action];
      button.textContent = DEFAULT_HOTKEYS[action];
      showStatus(`Could not restore ${action} hotkey: ${error}`, 'warning');
    }
  }
  scheduleSave();
}

function recordHotkey(button) {
  if (button.classList.contains('recording')) return;
  const action = button.dataset.action;
  const previous = settings.hotkeys[action] || DEFAULT_HOTKEYS[action];
  button.classList.add('recording');
  button.textContent = 'Press shortcut…';

  const cleanup = () => {
    button.classList.remove('recording');
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', onBlur, true);
  };
  const cancel = () => {
    cleanup();
    button.textContent = previous;
  };
  const onBlur = () => cancel();
  const onKey = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      cancel();
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;

    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (parts.length === 0) {
      button.textContent = 'Add Ctrl, Alt, or Shift';
      return;
    }

    const keyAliases = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
    const key = keyAliases[event.key] || (event.key.length === 1 ? event.key.toUpperCase() : event.key);
    const shortcut = [...parts, key].join('+');
    cleanup();

    try {
      await invoke('set_hotkey', { action, shortcut });
      settings.hotkeys[action] = shortcut;
      button.textContent = shortcut;
      await saveSettings();
      showStatus(`${action === 'capture' ? 'Capture' : 'OCR'} shortcut set to ${shortcut}`, 'success');
    } catch (error) {
      button.textContent = previous;
      showStatus(String(error), 'error');
    }
  };

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', onBlur, true);
}

function bindInputActions() {
  byId('analyze-btn').addEventListener('click', () => analyzeFromInput());
  byId('paste-area').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      analyzeFromInput();
    }
  });
  byId('ocr-btn').addEventListener('click', startOcrSelection);
}

function analyzeFromInput() {
  const text = byId('paste-area').value;
  if (text.trim()) analyzeText(text);
}

async function startOcrSelection() {
  try {
    await invoke('start_ocr_selection');
  } catch (error) {
    showStatus(String(error), 'error');
  }
}

async function analyzeText(text) {
  stopSpeech();
  const button = byId('analyze-btn');
  button.disabled = true;
  button.textContent = 'Analyzing…';
  try {
    const result = await invoke('analyze_text', { text });
    if (!result?.tokens) throw new Error('The analysis engine returned no tokens');
    const reconstructed = result.tokens.map((token) => token.text).join('');
    if (reconstructed !== text) {
      throw new Error('Safety check failed: analysis did not preserve the original text');
    }
    renderResult(result);
  } catch (error) {
    showStatus(`Analysis failed: ${error}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Analyze';
  }
}

function renderResult(result) {
  const output = byId('reader-output');
  renderTokens(output, result.tokens);

  currentPlainText = result.tokens.map((token) => token.text).join('');
  byId('empty-state').hidden = true;
  byId('reading-tools').hidden = false;
  output.hidden = false;
  byId('new-btn').hidden = false;
  byId('word-count').textContent = `${result.word_count} ${result.word_count === 1 ? 'word' : 'words'}`;
  byId('analysis-time').textContent = `${Number(result.analysis_ms).toFixed(1)}ms`;
  byId('tts-play').disabled = !supportsSpeech();
  byId('tts-stop').disabled = true;
  applySettings();
}

function showInput() {
  stopSpeech();
  byId('reading-tools').hidden = true;
  byId('reader-output').hidden = true;
  byId('empty-state').hidden = false;
  byId('new-btn').hidden = true;
  byId('paste-area').focus();
}

async function bindBackendEvents() {
  await listen('reader-style-selected', (event) => changeReadingStyle(event.payload));
  await listen('reader-preferences-requested', publishReadingPreferences);
  await listen('selection-captured', (event) => {
    if (event.payload?.text) analyzeText(event.payload.text);
  });
  await listen('reader-status', (event) => {
    if (event.payload?.message) showStatus(event.payload.message, event.payload.kind);
  });
  await listen('open-settings', () => toggleSettings(true));
}

function showStatus(message, kind = 'info') {
  const toast = byId('status-toast');
  if (!toast) return;
  clearTimeout(statusTimer);
  toast.textContent = message;
  toast.className = `status-toast ${kind}`;
  toast.hidden = false;
  statusTimer = setTimeout(() => {
    toast.hidden = true;
  }, kind === 'error' ? 8000 : 4500);
}

function supportsSpeech() {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function bindTts() {
  const play = byId('tts-play');
  const stop = byId('tts-stop');
  if (!supportsSpeech()) {
    play.title = 'Text-to-speech is unavailable on this system';
    return;
  }

  play.addEventListener('click', () => {
    if (!currentPlainText) return;
    if (isSpeaking) {
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
        play.title = 'Pause';
        play.setAttribute('aria-label', 'Pause text-to-speech');
      } else {
        speechSynthesis.pause();
        play.title = 'Resume';
        play.setAttribute('aria-label', 'Resume text-to-speech');
      }
      return;
    }

    const voice = localEnglishVoice(speechSynthesis.getVoices());
    if (!voice) {
      showStatus('No offline English voice is available. Install one in Windows speech settings, then try again.', 'warning');
      return;
    }
    speechSynthesis.cancel();
    ttsUtterance = new SpeechSynthesisUtterance(currentPlainText);
    ttsUtterance.voice = voice;
    ttsUtterance.lang = voice.lang;
    ttsUtterance.rate = settings.ttsRate / 10;
    ttsUtterance.pitch = 1;
    ttsUtterance.onboundary = (event) => highlightWordAtOffset(event.charIndex);
    ttsUtterance.onend = resetSpeechControls;
    ttsUtterance.onerror = (event) => {
      resetSpeechControls();
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        showStatus(`Text-to-speech stopped: ${event.error}`, 'warning');
      }
    };

    speechSynthesis.speak(ttsUtterance);
    isSpeaking = true;
    play.title = 'Pause';
    play.setAttribute('aria-label', 'Pause text-to-speech');
    stop.disabled = false;
  });
  stop.addEventListener('click', stopSpeech);
}

function highlightWordAtOffset(charIndex) {
  clearSpeechHighlight();
  const words = byId('reader-output').querySelectorAll('.word');
  for (const word of words) {
    const start = Number(word.dataset.start);
    const end = Number(word.dataset.end);
    if (charIndex >= start && charIndex < end) {
      word.classList.add('tts-active');
      word.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
      break;
    }
  }
}

function stopSpeech() {
  if (supportsSpeech()) speechSynthesis.cancel();
  resetSpeechControls();
}

function resetSpeechControls() {
  isSpeaking = false;
  ttsUtterance = null;
  clearSpeechHighlight();
  const play = byId('tts-play');
  const stop = byId('tts-stop');
  if (play) {
    play.title = 'Read aloud';
    play.setAttribute('aria-label', 'Play text-to-speech');
  }
  if (stop) stop.disabled = true;
}

function clearSpeechHighlight() {
  document.querySelectorAll('.tts-active').forEach((element) => element.classList.remove('tts-active'));
}

function bindRuler() {
  const content = byId('content');
  ruler = document.createElement('div');
  ruler.className = 'reading-ruler';
  ruler.hidden = true;
  ruler.setAttribute('aria-hidden', 'true');
  content.appendChild(ruler);

  content.addEventListener('pointermove', (event) => {
    if (ruler.hidden) return;
    const bounds = content.getBoundingClientRect();
    ruler.style.top = `${event.clientY - bounds.top + content.scrollTop - 20}px`;
  });
  byId('ruler-btn').addEventListener('click', () => setRulerEnabled(!settings.rulerEnabled));
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'r' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    setRulerEnabled(!settings.rulerEnabled);
  });
}

function setRulerEnabled(enabled) {
  settings.rulerEnabled = enabled;
  settings.preset = 'custom';
  applySettings();
  scheduleSave();
}

function bindOnboarding() {
  const overlay = byId('onboarding');
  const showStep = (number) => {
    overlay.querySelectorAll('.onboarding-step').forEach((step, index) => {
      step.hidden = index !== number;
    });
    overlay.querySelectorAll('.dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === number);
    });
  };

  overlay.addEventListener('click', (event) => {
    const preset = event.target.closest('[data-ob-preset]');
    if (preset) {
      overlay.querySelectorAll('[data-ob-preset]').forEach((button) => button.classList.remove('active'));
      preset.classList.add('active');
      return;
    }
    if (event.target.id === 'ob-next-1') showStep(1);
    if (event.target.id === 'ob-next-2') showStep(2);
    if (event.target.id === 'ob-finish') finishOnboarding();
  });
}

function showOnboardingIfNeeded() {
  byId('onboarding').hidden = settings.onboardingComplete;
}

function finishOnboarding() {
  const selected = byId('onboarding').querySelector('[data-ob-preset].active')?.dataset.obPreset || 'balanced';
  applyPreset(selected, false);
  settings.onboardingComplete = true;
  byId('onboarding').hidden = true;
  scheduleSave();
}

async function initOcrWindow() {
  document.body.classList.add('ocr-window');
  const overlay = byId('ocr-overlay');
  const selection = byId('ocr-selection');
  const dimensions = byId('ocr-dimensions');
  const instructions = byId('ocr-instructions');
  const processing = byId('ocr-processing');
  let startPoint = null;
  let rectangle = null;
  let maxCssDimension = 2600;
  let busy = false;

  const reset = () => {
    startPoint = null;
    rectangle = null;
    busy = false;
    overlay.classList.remove('selecting');
    selection.hidden = true;
    processing.hidden = true;
    instructions.hidden = false;
    instructions.querySelector('strong').textContent = 'Draw around the text to read';
  };

  const updateRectangle = (x, y) => {
    const left = Math.min(startPoint.x, x);
    const top = Math.min(startPoint.y, y);
    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);
    rectangle = { x: left, y: top, width, height };
    selection.style.left = `${left}px`;
    selection.style.top = `${top}px`;
    selection.style.width = `${width}px`;
    selection.style.height = `${height}px`;
    dimensions.textContent = `${Math.round(width)} × ${Math.round(height)}`;
  };

  overlay.addEventListener('pointerdown', (event) => {
    if (busy || event.button !== 0) return;
    event.preventDefault();
    overlay.setPointerCapture(event.pointerId);
    startPoint = { x: event.clientX, y: event.clientY };
    overlay.classList.add('selecting');
    selection.hidden = false;
    instructions.hidden = true;
    updateRectangle(event.clientX, event.clientY);
  });

  overlay.addEventListener('pointermove', (event) => {
    if (!startPoint || busy) return;
    updateRectangle(event.clientX, event.clientY);
  });

  overlay.addEventListener('pointerup', async (event) => {
    if (!startPoint || busy) return;
    updateRectangle(event.clientX, event.clientY);
    startPoint = null;
    if (!rectangle || rectangle.width < 8 || rectangle.height < 8) {
      reset();
      instructions.querySelector('strong').textContent = 'Select a larger rectangle';
      return;
    }
    if (rectangle.width > maxCssDimension || rectangle.height > maxCssDimension) {
      reset();
      instructions.querySelector('strong').textContent = `Region too large — keep each side under ${Math.floor(maxCssDimension)} px`;
      return;
    }

    busy = true;
    instructions.hidden = true;
    processing.hidden = false;
    try {
      await invoke('complete_ocr_selection', rectangle);
    } catch (error) {
      console.error('[MorphemeFlow] OCR failed', error);
      try { await invoke('cancel_ocr_selection'); } catch {}
    } finally {
      overlay.hidden = true;
      reset();
    }
  });

  overlay.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('keydown', async (event) => {
    if (event.key !== 'Escape' || overlay.hidden || busy) return;
    overlay.hidden = true;
    reset();
    try {
      await invoke('cancel_ocr_selection');
    } catch (error) {
      console.error('[MorphemeFlow] Could not cancel OCR selection', error);
    }
  });

  await listen('ocr-selection-started', (event) => {
    const maxDimension = Number(event.payload?.maxImageDimension) || 2600;
    const scaleFactor = Number(event.payload?.scaleFactor) || 1;
    maxCssDimension = maxDimension / scaleFactor;
    reset();
    overlay.hidden = false;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
