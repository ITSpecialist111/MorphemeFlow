export function createLensLoop({ capture, analyze, onFrame, onStatus, schedule = setTimeout, cancel = clearTimeout }) {
  let active = false;
  let revision = 0;
  let busy = false;
  let timer = null;

  const queue = (delay = 700) => { timer = schedule(tick, delay); };
  const tick = async () => {
    timer = null;
    if (!active || busy) return;
    busy = true;
    const requestRevision = revision;
    const current = () => active && revision === requestRevision;
    try {
      const frame = await capture();
      if (!current()) return;
      if (!frame.text) {
        onFrame(null);
        onStatus(frame.status);
        return;
      }
      const result = await analyze(frame.text);
      if (!current()) return;
      if (result.tokens.map((token) => token.text).join('') !== frame.text) {
        throw new Error('Analysis did not preserve the recognized text');
      }
      onFrame(result.tokens);
      onStatus(frame.status);
    } catch (error) {
      if (current()) {
        onFrame(null);
        onStatus(String(error));
      }
    } finally {
      busy = false;
      if (active) queue();
    }
  };
  return {
    setActive(next) {
      active = next;
      revision += 1;
      if (timer !== null) cancel(timer);
      timer = null;
      if (active && !busy) queue(0);
    },
  };
}