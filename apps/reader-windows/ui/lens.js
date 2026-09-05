import { renderTokens } from './render.js';
import { createLensLoop } from './lens-loop.js';
import { applyReadingPreferences, normalizeReadingPreferences, READER_SETTINGS_KEY, selectReadingStyle } from './reading-preferences.js';

const { invoke } = window.__TAURI__.core;
const { listen, emit } = window.__TAURI__.event;
const output = document.getElementById('lens-output');
const status = document.getElementById('lens-status');
const pause = document.getElementById('lens-pause');
const reader = document.getElementById('lens-reader');
const style = document.getElementById('reading-style');
let state = { enabled: false, paused: false };
let hovering = false;
let text = '';
let preferences = normalizeReadingPreferences();

function applyPreferences(value = preferences) {
  preferences = applyReadingPreferences(output, value);
  style.value = preferences.readingMode === 'plain' ? 'plain' : preferences.preset;
}

const loop = createLensLoop({
  capture: () => invoke('capture_lens'),
  analyze: (source) => invoke('analyze_text', { text: source }),
  onFrame: (tokens) => {
    const next = tokens?.map((token) => token.text).join('') || '';
    applyPreferences();
    if (next !== text) {
      renderTokens(output, tokens || []);
      output.scrollTop = 0;
      text = next;
    }
    reader.disabled = !text;
  },
  onStatus: (message) => { status.textContent = message; },
});

function update() {
  loop.setActive(state.enabled && !state.paused && !hovering);
  pause.textContent = state.paused ? 'Resume' : 'Pause';
  pause.setAttribute('aria-pressed', String(state.paused));
  if (!state.enabled) {
    hovering = false;
    output.replaceChildren();
    text = '';
    reader.disabled = true;
  }
  status.textContent = state.paused || hovering ? 'Paused snapshot' : 'Screen OCR';
}

async function command(name, args) {
  try { await invoke(name, args); } catch (error) { status.textContent = String(error); }
}

pause.addEventListener('click', () => command('set_lens_paused', { paused: !state.paused }));
style.addEventListener('change', async () => {
  const previous = preferences;
  const selected = style.value;
  applyPreferences(selectReadingStyle(preferences, selected));
  try {
    await emit('reader-style-selected', selected);
  } catch (error) {
    applyPreferences(previous);
    status.textContent = String(error);
  }
});
reader.addEventListener('click', () => command('open_lens_in_reader', { text }));
document.getElementById('lens-close').addEventListener('click', () => command('set_lens_enabled', { enabled: false }));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') void command('set_lens_enabled', { enabled: false });
});
document.addEventListener('pointerenter', () => { hovering = true; update(); });
document.addEventListener('pointerleave', () => { hovering = false; update(); });
await listen('lens-state-changed', (event) => { state = event.payload; update(); });
await listen('reader-preferences-changed', (event) => applyPreferences(event.payload));
window.addEventListener('storage', (event) => {
  if (event.key === READER_SETTINGS_KEY) {
    try { applyPreferences(JSON.parse(event.newValue || 'null')); } catch { applyPreferences(); }
  }
});
try { applyPreferences(JSON.parse(localStorage.getItem(READER_SETTINGS_KEY) || 'null')); } catch { applyPreferences(); }
await emit('reader-preferences-requested');
state = await invoke('get_lens_state');
update();