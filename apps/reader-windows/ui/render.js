export function renderTokens(output, tokens) {
  const document = output.ownerDocument;
  const fragment = document.createDocumentFragment();
  let sourceOffset = 0;
  for (const token of tokens) {
    if (token.token_type === 'word' && Array.isArray(token.morphemes)) {
      const word = document.createElement('span');
      word.className = 'word';
      word.dataset.start = String(sourceOffset);
      word.dataset.end = String(sourceOffset + token.text.length);
      word.dataset.tier = token.tier || '';
      renderWord(word, token);
      fragment.appendChild(word);
    } else {
      fragment.appendChild(document.createTextNode(token.text));
    }
    sourceOffset += token.text.length;
  }
  output.replaceChildren(fragment);
}

function renderWord(container, token) {
  const document = container.ownerDocument;
  if (token.morphemes.map((morpheme) => morpheme.text).join('') !== token.text) {
    container.textContent = token.text;
    return;
  }
  const syllables = Array.isArray(token.syllables) ? token.syllables : [];
  const boundaries = new Set();
  if (syllables.join('') === token.text) {
    let offset = 0;
    for (const syllable of syllables.slice(0, -1)) {
      offset += syllable.length;
      boundaries.add(offset);
    }
  }
  let wordOffset = 0;
  for (const morpheme of token.morphemes) {
    const span = document.createElement('span');
    span.className = `morpheme ${morpheme.m_type}`;
    if (morpheme.meaning) span.title = morpheme.meaning;
    let buffer = '';
    for (const character of morpheme.text) {
      buffer += character;
      wordOffset += character.length;
      if (boundaries.has(wordOffset)) {
        span.appendChild(document.createTextNode(buffer));
        buffer = '';
        const gap = document.createElement('span');
        gap.className = 'syllable-gap';
        gap.setAttribute('aria-hidden', 'true');
        span.appendChild(gap);
      }
    }
    if (buffer) span.appendChild(document.createTextNode(buffer));
    container.appendChild(span);
  }
}