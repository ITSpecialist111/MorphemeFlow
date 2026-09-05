export const DEFAULT_OVERLAY = Object.freeze({
  enabled: false,
  bandHeight: 100,
  dimOpacity: 35,
  tintOpacity: 0,
  tint: 'warm',
  followPointer: true,
});

export function normalizeOverlay(value) {
  const source = value && typeof value === 'object' ? value : {};
  const bounded = (key, min, max) => {
    const number = source[key];
    return typeof number === 'number' && Number.isFinite(number)
      ? Math.round(Math.min(max, Math.max(min, number)))
      : DEFAULT_OVERLAY[key];
  };
  return {
    enabled: source.enabled === true,
    bandHeight: bounded('bandHeight', 40, 320),
    dimOpacity: bounded('dimOpacity', 0, 70),
    tintOpacity: bounded('tintOpacity', 0, 30),
    tint: ['warm', 'rose', 'mint', 'sky'].includes(source.tint) ? source.tint : 'warm',
    followPointer: source.followPointer !== false,
  };
}