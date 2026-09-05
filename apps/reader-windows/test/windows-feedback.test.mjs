import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { chromium, expect } from '@playwright/test';

test('Windows Close exits, lens Close reopens, and reading preferences change the actual text layout', { timeout: 120_000 }, async () => {
  const portReservation = createServer();
  portReservation.listen(0, '127.0.0.1');
  await once(portReservation, 'listening');
  const port = portReservation.address().port;
  await new Promise((resolve) => portReservation.close(resolve));
  const profile = await mkdtemp(path.join(tmpdir(), 'morphemeflow-feedback-'));
  const executable = path.resolve(process.env.MORPHEMEFLOW_READER_EXE || 'target/debug/reader-windows.exe');
  const app = spawn(executable, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
      WEBVIEW2_USER_DATA_FOLDER: profile,
    },
    stdio: 'ignore',
  });
  let browser;
  let fixture;
  let main;
  let lens;
  const screenshots = path.resolve('test-results/windows-feedback');
  const errors = [];
  const call = (command, args) => main.evaluate(({ command, args }) => window.__TAURI__.core.invoke(command, args), { command, args });
  const layout = (page, selector) => page.locator(selector).evaluate((output) => {
    const css = getComputedStyle(output);
    return {
      font: css.fontFamily, size: css.fontSize, letter: css.letterSpacing,
      word: css.wordSpacing, line: css.lineHeight,
      gap: css.getPropertyValue('--syllable-gap'), intensity: css.getPropertyValue('--highlight-intensity'),
    };
  });
  try {
    await mkdir(screenshots, { recursive: true });
    await expect.poll(async () => {
      assert.equal(app.exitCode, null, 'Reader exited before its UI was ready');
      return fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.ok).catch(() => false);
    }, { timeout: 30_000 }).toBe(true);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    await expect.poll(async () => {
      for (const page of browser.contexts()[0].pages()) {
        const role = await page.evaluate(() => window.__TAURI__?.core.invoke('window_role')).catch(() => null);
        if (role === 'main') main = page;
        if (role === 'lens') lens = page;
      }
      return Boolean(main && lens);
    }).toBe(true);
    for (const page of [main, lens]) page.on('pageerror', (error) => errors.push(error.message));
    await main.waitForSelector('#screen-focus-enabled');
    if (await main.locator('#onboarding').isVisible()) {
      for (const id of ['ob-next-1', 'ob-next-2', 'ob-finish']) await main.locator(`#${id}`).click();
    }
    const paragraph = 'Reading independently.\nUnderstanding unfamiliar information takes concentration.\nUnhappiness and misunderstanding are different experiences.';
    await main.locator('#paste-area').fill(paragraph);
    await main.locator('#analyze-btn').click();
    await expect(main.locator('#reader-output')).toHaveText(paragraph);
    await main.locator('#reading-style').selectOption('plain');
    const plain = await layout(main, '#reader-output');
    assert.equal(plain.size, '16px');
    await main.screenshot({ path: path.join(screenshots, 'plain.png') });
    await main.locator('#reading-style').selectOption('full');
    const assisted = await layout(main, '#reader-output');
    assert.equal(assisted.size, '24px');
    assert.equal(assisted.line, '57.6px');
    assert.match(assisted.font, /Lexend/);
    assert.notEqual(assisted.letter, plain.letter);
    assert.notEqual(assisted.word, plain.word);
    assert.equal(await main.locator('#reader-output').textContent(), paragraph);
    await main.screenshot({ path: path.join(screenshots, 'spacious.png') });

    fixture = spawn(path.resolve('target/debug/examples/screen_fixture.exe'), [String(app.pid)], { stdio: ['pipe', 'pipe', 'inherit'] });
    const lines = createInterface({ input: fixture.stdout });
    const [ready] = await once(lines, 'line');
    assert.equal(JSON.parse(ready).foreground, true);
    await call('capture_selection_cmd');
    await expect(main.locator('#reader-output')).toHaveText('Reading independently');
    await call('set_lens_enabled', { enabled: true });
    await expect(lens.locator('#lens-output')).toHaveText('Reading independently', { timeout: 20_000 });
    await lens.locator('#lens-pause').click();
    await expect.poll(async () => (await call('get_lens_state')).paused).toBe(true);

    await main.locator('#settings-btn').click();
    for (const [id, value] of Object.entries({
      'slider-font-size': 28, 'slider-letter-sp': 12, 'slider-word-sp': 30,
      'slider-syllable-gap': 18, 'slider-line-h': 26, 'slider-intensity': 25,
    })) {
      await main.locator(`#${id}`).evaluate((input, value) => {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
    }
    await expect.poll(() => layout(lens, '#lens-output')).toEqual(await layout(main, '#reader-output'));
    const pausedLayout = await layout(lens, '#lens-output');
    assert.equal(pausedLayout.size, '28px');
    assert.equal(pausedLayout.gap, '0.18em');
    assert.equal(pausedLayout.intensity, '25%');
    assert.equal((await call('get_lens_state')).paused, true);
    await lens.locator('#reading-style').selectOption('plain');
    await expect(main.locator('#reading-style')).toHaveValue('plain');
    assert.equal((await layout(lens, '#lens-output')).size, '16px');
    assert.equal(await lens.locator('#lens-output').textContent(), 'Reading independently');
    await main.locator('#slider-font-size').evaluate((input) => {
      input.value = '26';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(main.locator('#reading-style')).toHaveValue('custom');
    await expect.poll(async () => (await layout(lens, '#lens-output')).size).toBe('26px');
    await lens.locator('#reading-style').selectOption('full');
    await expect(main.locator('#reading-style')).toHaveValue('full');
    await expect.poll(async () => (await layout(lens, '#lens-output')).size).toBe('24px');
    await lens.screenshot({ path: path.join(screenshots, 'lens-spacious.png') });

    await lens.locator('#lens-close').click();
    await expect.poll(async () => (await call('get_lens_state')).enabled).toBe(false);
    await expect(lens.locator('#lens-output')).toHaveText('');
    assert.equal(await lens.evaluate(() => window.__TAURI__.window.getCurrentWindow().isVisible()), false);
    await call('set_lens_enabled', { enabled: true });
    await expect(lens.locator('#lens-output')).toHaveText('Reading independently', { timeout: 20_000 });
    await main.locator('#settings-btn').click();
    await main.setViewportSize({ width: 360, height: 720 });
    const overflow = await main.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false);
    await main.screenshot({ path: path.join(screenshots, 'reader-narrow.png') });
    const focusSettings = await call('get_overlay_settings');
    await call('set_overlay_settings', { settings: { ...focusSettings, enabled: true } });
    assert.equal((await call('get_lens_state')).enabled, true);
    fixture.stdin.write('close-reader\n');
    await expect.poll(() => app.exitCode, { timeout: 10_000 }).toBe(0);
    await expect.poll(() => browser.isConnected()).toBe(false);
    assert.deepEqual(errors, []);
  } finally {
    if (fixture?.exitCode === null) {
      const exited = once(fixture, 'exit');
      fixture.stdin.write('close\n');
      await exited;
    }
    if (app.exitCode === null) {
      const exited = once(app, 'exit');
      app.kill();
      await exited;
    }
    await browser?.close().catch(() => {});
    await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
});