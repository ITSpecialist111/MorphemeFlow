import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const root = new URL('../app/build/generated/readerAssets/reader/', import.meta.url);
const html = await readFile(new URL('reader.html', root), 'utf8');
const script = await readFile(new URL('reader.bundle.js', root), 'utf8');

test('the actual Android bundle preserves shared text and highlights word parts', () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  dom.window.eval(script);
  const source = '\tUnhappiness, Reading independently.\n\ud83d\udcd6 <img src=x onerror=alert(1)> & cafe\u0301';
  dom.window.MorphemeFlow.receive(source, 'Shared text');
  const output = dom.window.document.getElementById('reading-text');
  assert.equal(output.textContent, source);
  assert.ok(output.querySelector('.prefix'));
  assert.ok(output.querySelector('.syllable-gap'));
  assert.equal(output.querySelector('img'), null);
  dom.window.close();
});

test('Android bundle handles long tokens without losing text and bounds settings', () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  dom.window.eval(script);
  const source = 'a'.repeat(2000);
  dom.window.MorphemeFlow.receive(source, 'Shared text', { fontSize: 999, morphemesEnabled: false });
  const output = dom.window.document.getElementById('reading-text');
  assert.equal(output.textContent, source);
  assert.equal(output.style.fontSize, '36px');
  assert.ok(output.classList.contains('morphemes-off'));
  assert.throws(() => dom.window.MorphemeFlow.receive('a'.repeat(100001)), /reading limit/);
  dom.window.close();
});