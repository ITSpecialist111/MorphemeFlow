export function localEnglishVoice(voices) {
  return voices.find((voice) => voice.localService === true && /^en(?:[-_]|$)/i.test(voice.lang)) || null;
}