import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { renderTokens } from '../ui/render.js';
import { DEFAULT_OVERLAY, normalizeOverlay } from '../ui/overlay-settings.js';
import { localEnglishVoice } from '../ui/speech.js';

const word = {
  text: 'unhappiness', token_type: 'word', tier: 'dictionary',
  morphemes: [
    { text: 'un', m_type: 'prefix' },
    { text: 'happi', m_type: 'root' },
    { text: 'ness', m_type: 'suffix' },
  ],
  syllables: ['un', 'hap', 'pi', 'ness'],
};

test('shared reader renderer preserves complete source including whitespace and Unicode', () => {
  const document = new JSDOM('<main></main>').window.document;
  const output = document.querySelector('main');
  const tokens = [{ text: '\t\ud83d\udcd6 ', token_type: 'other' }, word, { text: '\r\n  <script> &', token_type: 'other' }];
  renderTokens(output, tokens);
  assert.equal(output.textContent, tokens.map((token) => token.text).join(''));
  assert.equal(output.querySelectorAll('.syllable-gap').length, 3);
  assert.equal(output.querySelector('.word').dataset.start, '4');
  assert.equal(output.querySelector('script'), null);
  assert.equal(output.querySelector('.prefix').textContent, 'un');
});

test('bad morphological analysis falls back to unchanged source', () => {
  const output = new JSDOM('<main></main>').window.document.querySelector('main');
  renderTokens(output, [{ ...word, morphemes: [{ text: 'wrong', m_type: 'root' }] }]);
  assert.equal(output.textContent, word.text);
  assert.equal(output.querySelectorAll('.morpheme').length, 0);
});

test('bad syllables do not insert incorrect boundaries', () => {
  const output = new JSDOM('<main></main>').window.document.querySelector('main');
  renderTokens(output, [{ ...word, syllables: ['incorrect'] }]);
  assert.equal(output.textContent, word.text);
  assert.equal(output.querySelectorAll('.syllable-gap').length, 0);
  renderTokens(output, []);
  assert.equal(output.textContent, '');
});

test('overlay defaults never enable unattended overlay', () => {
  for (const input of [null, undefined, [], 'invalid', {}, { enabled: 'true' }]) {
    assert.deepEqual(normalizeOverlay(input), DEFAULT_OVERLAY);
  }
});

test('overlay settings are bounded and invalid numbers replaced', () => {
  assert.deepEqual(normalizeOverlay({ enabled: true, bandHeight: Infinity, dimOpacity: 255, tintOpacity: -10, tint: 'invalid' }), {
    ...DEFAULT_OVERLAY, enabled: true, dimOpacity: 70,
  });
  assert.equal(normalizeOverlay({ bandHeight: 40.9 }).bandHeight, 41);
  assert.equal(normalizeOverlay({ bandHeight: -100 }).bandHeight, 40);
  assert.equal(normalizeOverlay({ followPointer: false, tint: 'sky' }).followPointer, false);
});

test('screen stop control cannot enter the hotkey recording flow', async () => {
  const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('#screen-focus-off').matches('.hotkey-btn'), false);
  for (const button of document.querySelectorAll('.hotkey-btn')) {
    assert.ok(['capture', 'ocr'].includes(button.dataset.action));
  }
});

test('Reader speech never selects a remote voice or an unsupported language', () => {
  const local = { lang: 'en-GB', localService: true };
  const cloud = { lang: 'en-US', localService: false };
  assert.equal(localEnglishVoice([cloud, local]), local);
  assert.equal(localEnglishVoice([cloud, { lang: 'fr-FR', localService: true }]), null);
  assert.equal(localEnglishVoice([]), null);
});