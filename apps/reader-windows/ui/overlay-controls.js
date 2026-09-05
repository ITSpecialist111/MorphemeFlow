import { DEFAULT_OVERLAY, normalizeOverlay } from './overlay-settings.js';

export async function initOverlayControls({ invoke, listen, showStatus }) {
  const byId = (id) => document.getElementById(id);
  const storageKey = 'screen-focus-settings-v1';
  let current = { ...DEFAULT_OVERLAY };
  let timer;
  let pending = null;
  let applying = false;

  const render = () => {
    byId('screen-focus-enabled').checked = current.enabled;
    byId('focus-follow-pointer').checked = current.followPointer;
    byId('focus-tint').value = current.tint;
    for (const [id, key, unit] of [
      ['focus-height', 'bandHeight', 'px'],
      ['focus-dim', 'dimOpacity', '%'],
      ['focus-tint-opacity', 'tintOpacity', '%'],
    ]) {
      byId(id).value = String(current[key]);
      byId(`${id}-value`).textContent = `${current[key]}${unit}`;
    }
  };
  const apply = async () => {
    pending = { ...current };
    if (applying) return;
    applying = true;
    try {
      while (pending) {
        const next = pending;
        pending = null;
        await invoke('set_overlay_settings', { settings: next });
        try {
          localStorage.setItem(storageKey, JSON.stringify({ ...next, enabled: false }));
        } catch {
          showStatus('Screen focus settings could not be saved', 'warning');
        }
      }
    } catch (error) {
      pending = null;
      current = normalizeOverlay(await invoke('get_overlay_settings').catch(() => DEFAULT_OVERLAY));
      render();
      showStatus(String(error), 'error');
    } finally {
      applying = false;
    }
  };
  const change = (key, value, debounce = false) => {
    current = normalizeOverlay({ ...current, [key]: value });
    render();
    clearTimeout(timer);
    if (debounce) timer = setTimeout(apply, 100);
    else void apply();
  };

  byId('screen-focus-enabled').addEventListener('change', (event) => change('enabled', event.target.checked));
  byId('focus-follow-pointer').addEventListener('change', (event) => change('followPointer', event.target.checked));
  byId('focus-tint').addEventListener('change', (event) => change('tint', event.target.value));
  byId('screen-focus-off').addEventListener('click', async () => {
    clearTimeout(timer);
    pending = null;
    current.enabled = false;
    render();
    try { await invoke('stop_screen_tools'); } catch (error) { showStatus(String(error), 'error'); }
  });
  byId('live-lens-enabled').addEventListener('change', async (event) => {
    try {
      await invoke('set_lens_enabled', { enabled: event.target.checked });
    } catch (error) {
      event.target.checked = false;
      showStatus(String(error), 'error');
    }
  });
  await listen('lens-state-changed', (event) => { byId('live-lens-enabled').checked = event.payload.enabled; });
  await listen('screen-tools-stopped', () => {
    clearTimeout(timer);
    pending = null;
    current.enabled = false;
    byId('live-lens-enabled').checked = false;
    render();
  });
  for (const [id, key] of [['focus-height', 'bandHeight'], ['focus-dim', 'dimOpacity'], ['focus-tint-opacity', 'tintOpacity']]) {
    byId(id).addEventListener('input', (event) => change(key, Number(event.target.value), true));
  }
  await listen('overlay-settings-changed', (event) => {
    if (applying || pending) return;
    clearTimeout(timer);
    current = normalizeOverlay(event.payload);
    render();
  });
  try {
    const live = await invoke('get_overlay_settings');
    const lens = await invoke('get_lens_state');
    byId('live-lens-enabled').checked = lens.enabled;
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    current = normalizeOverlay({ ...(saved || live), enabled: live.enabled });
    render();
    await apply();
  } catch (error) {
    render();
    showStatus(`Screen focus unavailable: ${error}`, 'warning');
  }
}