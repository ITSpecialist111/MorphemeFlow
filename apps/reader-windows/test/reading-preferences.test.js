import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { applyReadingPreferences, normalizeReadingPreferences, READING_PRESETS, selectReadingStyle } from '../ui/reading-preferences.js';
import { renderTokens } from '../ui/render.js';

function surface() {
  return new JSDOM('<main class="reader-output"></main>').window.document.querySelector('main');
}

test('Reader and lens apply every text setting identically', () => {
  const reader = surface();
  const lens = surface();
  const preferences = { ...READING_PRESETS.full, theme: 'dark', preset: 'full', morphemesEnabled: false, syllablesEnabled: false };
  applyReadingPreferences(reader, preferences);
  applyReadingPreferences(lens, preferences);
  assert.equal(reader.ownerDocument.documentElement.style.cssText, lens.ownerDocument.documentElement.style.cssText);
  const css = lens.ownerDocument.documentElement.style;
  for (const [property, value] of Object.entries({
    '--font-size': '24px', '--letter-spacing': '0.10em', '--word-spacing': '0.24em',
    '--syllable-gap': '0.14em', '--line-height': '2.4', '--highlight-intensity': '90%',
  })) assert.equal(css.getPropertyValue(property), value);
  assert.match(css.getPropertyValue('--font-family'), /Lexend/);
  assert.equal(lens.ownerDocument.documentElement.dataset.theme, 'dark');
  assert.ok(lens.classList.contains('morphemes-off'));
  assert.ok(lens.classList.contains('syllables-off'));
});

test('zero-valued reading settings remain zero', () => {
  const output = surface();
  applyReadingPreferences(output, { letterSpacing: 0, wordSpacing: 0, syllableGap: 0, intensity: 0 });
  const css = output.ownerDocument.documentElement.style;
  assert.equal(css.getPropertyValue('--syllable-gap'), '0.00em');
  assert.equal(css.getPropertyValue('--highlight-intensity'), '0%');
});

test('plain comparison preserves the text, selection nodes, and saved assisted settings', () => {
  const output = surface();
  const text = 'Reading independently.\nUnhappiness and understanding.';
  renderTokens(output, [{ text, token_type: 'other' }]);
  const textNode = output.firstChild;
  const assisted = selectReadingStyle({}, 'full');
  const plain = selectReadingStyle(assisted, 'plain');
  applyReadingPreferences(output, plain);
  assert.equal(output.textContent, text);
  assert.equal(output.firstChild, textNode);
  assert.equal(output.ownerDocument.documentElement.style.getPropertyValue('--font-size'), '16px');
  assert.ok(output.classList.contains('morphemes-off'));
  assert.ok(output.classList.contains('syllables-off'));
  assert.equal(plain.fontSize, 24);
  applyReadingPreferences(output, selectReadingStyle(plain, 'full'));
  assert.equal(output.firstChild, textNode);
  assert.equal(output.ownerDocument.documentElement.style.getPropertyValue('--font-size'), '24px');
  assert.equal(output.classList.contains('syllables-off'), false);
});

test('new reading defaults use a bundled font without overriding valid saved choices', () => {
  assert.equal(normalizeReadingPreferences().font, 'atkinson');
  assert.equal(normalizeReadingPreferences({ font: 'system' }).font, 'system');
  assert.equal(normalizeReadingPreferences({ fontSize: Infinity, intensity: -50 }).fontSize, 20);
  assert.equal(normalizeReadingPreferences({ fontSize: 100, intensity: -50 }).fontSize, 36);
  assert.equal(normalizeReadingPreferences({ intensity: -50 }).intensity, 0);
});