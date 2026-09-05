import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

test('real Reader selection, focus overlay, live OCR, source refresh, and stop', { timeout: 60_000 }, async () => {
  const desktop = await chromium.connectOverCDP(process.env.MORPHEMEFLOW_CDP_URL || 'http://127.0.0.1:9225');
  const pages = new Map();
  const errors = [];
  for (const candidate of desktop.contexts()[0].pages()) {
    const role = await candidate.evaluate(() => window.__TAURI__.core.invoke('window_role'));
    pages.set(role, candidate);
    candidate.on('pageerror', (error) => errors.push(String(error)));
  }
  const main = pages.get('main');
  const lens = pages.get('lens');
  const call = (command, args) => main.evaluate(({ command, args }) => window.__TAURI__.core.invoke(command, args), { command, args });
  let fixture;
  const screenshots = path.resolve('test-results/screen-tools');
  await mkdir(screenshots, { recursive: true });
  try {
    await main.waitForSelector('#screen-focus-enabled');
    for (const family of ['Lexend', 'Atkinson Hyperlegible', 'OpenDyslexic']) {
      const loaded = await main.evaluate(async (family) => (await document.fonts.load(`20px "${family}"`)).length, family);
      assert.ok(loaded > 0, `${family} did not load as an actual font`);
    }
    if (await main.locator('#onboarding').isVisible()) {
      for (const id of ['ob-next-1', 'ob-next-2', 'ob-finish']) await main.locator(`#${id}`).click();
    }
    await main.locator('#screen-focus-enabled').check();
    await expect.poll(async () => (await call('get_overlay_settings')).enabled).toBe(true);
    await main.locator('#screen-focus-off').click();
    await expect.poll(async () => (await call('get_overlay_settings')).enabled).toBe(false);
    await expect(main.locator('#screen-focus-off')).toHaveText('Turn off');
    await main.locator('#paste-area').fill('Unhappiness, Reading independently.\nExact text stays unchanged.');
    await main.locator('#analyze-btn').click();
    await expect(main.locator('#reader-output')).toHaveText('Unhappiness, Reading independently.\nExact text stays unchanged.');
    await main.screenshot({ path: path.join(screenshots, 'windows-reader.png') });
    await main.setViewportSize({ width: 360, height: 720 });
    await main.locator('#settings-btn').click();
    assert.ok(await main.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await main.screenshot({ path: path.join(screenshots, 'windows-reader-narrow.png') });
    await main.locator('#settings-btn').click();
    await main.setViewportSize({ width: 480, height: 720 });

    fixture = spawn(path.resolve('target/debug/examples/screen_fixture.exe'), [], { stdio: ['pipe', 'pipe', 'inherit'] });
    const lines = createInterface({ input: fixture.stdout });
    const [ready] = await once(lines, 'line');
    assert.equal(JSON.parse(ready).ready, true);
    assert.equal(JSON.parse(ready).foreground, true, 'Native fixture did not receive foreground input');
    await call('capture_selection_cmd');
    await expect(main.locator('#reader-output')).toHaveText('Reading independently', { timeout: 12_000 });
    await call('set_lens_enabled', { enabled: true });
    await expect(lens.locator('#lens-output')).toHaveText('Reading independently', { timeout: 15_000 });
    const leftAligned = await lens.evaluate(() => {
      const output = document.getElementById('lens-output').getBoundingClientRect();
      const word = document.querySelector('#lens-output .word').getBoundingClientRect();
      return word.left - output.left < 32;
    });
    assert.ok(leftAligned, 'Reading lens text must be left-aligned');
    await lens.screenshot({ path: path.join(screenshots, 'windows-live-lens.png') });
    fixture.stdin.write('next\n');
    await expect(lens.locator('#lens-output')).toHaveText('Understanding information', { timeout: 15_000 });
    await call('set_lens_paused', { paused: true });
    assert.equal((await call('get_lens_state')).paused, true);
    fixture.stdin.write('stop\n');
    await expect.poll(async () => (await call('get_lens_state')).enabled).toBe(false);
    await expect(lens.locator('#lens-output')).toHaveText('');
    assert.equal((await call('get_lens_state')).enabled, false);
    assert.deepEqual(errors, []);
  } finally {
    await call('stop_screen_tools').catch(() => {});
    if (fixture && fixture.exitCode === null) {
      const exit = once(fixture, 'exit');
      fixture.stdin.write('close\n');
      await exit;
    }
    await desktop.close();
  }
});