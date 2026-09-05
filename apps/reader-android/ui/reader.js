import { analyzeWord, tokenize } from '../../../packages/engine-ts/src/index.ts';
import { renderTokens } from '../../reader-windows/ui/render.js';

const output = document.getElementById('reading-text');
const source = document.getElementById('reading-source');

function preferences(settings = {}) {
  const bounded = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
  const fonts = { lexend: 'Lexend', atkinson: 'Atkinson Hyperlegible', opendyslexic: 'OpenDyslexic', system: 'sans-serif' };
  output.style.fontFamily = `"${fonts[settings.font] || 'Lexend'}", sans-serif`;
  output.style.fontSize = `${bounded(settings.fontSize, 20, 14, 36)}px`;
  output.classList.toggle('morphemes-off', settings.morphemesEnabled === false);
  output.classList.toggle('syllables-off', settings.syllablesEnabled === false);
}

window.MorphemeFlow = Object.freeze({
  receive(text, label = 'Text', settings = {}) {
    if (typeof text !== 'string' || text.length > 100_000) throw new Error('Text exceeds the reading limit');
    const tokens = tokenize(text).map((token) => {
      if (token.type !== 'word' || token.text.length > 128) return { text: token.text, token_type: token.type };
      const result = analyzeWord(token.text);
      return {
        text: token.text,
        token_type: token.type,
        morphemes: result.morphemes.map((part) => ({ text: part.text, m_type: part.type, meaning: part.meaning })),
        syllables: result.syllables,
        tier: result.tier,
      };
    });
    if (tokens.map((token) => token.text).join('') !== text) throw new Error('Text preservation check failed');
    renderTokens(output, tokens);
    preferences(settings);
    source.textContent = label;
    output.scrollTop = 0;
  },
  preferences,
});