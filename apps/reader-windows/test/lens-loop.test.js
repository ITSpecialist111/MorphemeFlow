import assert from 'node:assert/strict';
import test from 'node:test';
import { createLensLoop } from '../ui/lens-loop.js';

function harness(capture, analyze = async (text) => ({ tokens: [{ text }] })) {
  const scheduled = new Map();
  const frames = [];
  const messages = [];
  let nextId = 0;
  const loop = createLensLoop({
    capture, analyze,
    onFrame: (frame) => frames.push(frame),
    onStatus: (message) => messages.push(message),
    schedule: (callback) => { scheduled.set(++nextId, callback); return nextId; },
    cancel: (id) => scheduled.delete(id),
  });
  return {
    loop, frames, messages, scheduled,
    run: () => {
      const [id, callback] = scheduled.entries().next().value;
      scheduled.delete(id);
      return callback();
    },
  };
}

test('lens serializes captures and renders only exact source', async () => {
  const driver = harness(async () => ({ text: 'reading', status: 'Screen OCR' }));
  driver.loop.setActive(true);
  await driver.run();
  assert.deepEqual(driver.frames, [[{ text: 'reading' }]]);
  assert.equal(driver.scheduled.size, 1);
  driver.loop.setActive(false);
  assert.equal(driver.scheduled.size, 0);
});

test('stopping during OCR discards the late result', async () => {
  let finish;
  const driver = harness(() => new Promise((resolve) => { finish = resolve; }));
  driver.loop.setActive(true);
  const request = driver.run();
  driver.loop.setActive(false);
  finish({ text: 'stale text', status: 'Screen OCR' });
  await request;
  assert.deepEqual(driver.frames, []);
  assert.equal(driver.scheduled.size, 0);
});

test('pause and resume cannot resurrect the previous capture', async () => {
  let finish;
  const driver = harness(() => new Promise((resolve) => { finish = resolve; }));
  driver.loop.setActive(true);
  const request = driver.run();
  driver.loop.setActive(false);
  driver.loop.setActive(true);
  assert.equal(driver.scheduled.size, 0);
  finish({ text: 'old screen', status: 'Screen OCR' });
  await request;
  assert.deepEqual(driver.frames, []);
  assert.equal(driver.scheduled.size, 1);
});

test('unstable and empty captures clear old text', async () => {
  const driver = harness(async () => ({ text: null, status: 'Screen changed during capture' }));
  driver.loop.setActive(true);
  await driver.run();
  assert.deepEqual(driver.frames, [null]);
  assert.deepEqual(driver.messages, ['Screen changed during capture']);
});

test('lossy analysis is not displayed', async () => {
  const driver = harness(async () => ({ text: 'source', status: 'Screen OCR' }), async () => ({ tokens: [{ text: 'changed' }] }));
  driver.loop.setActive(true);
  await driver.run();
  assert.deepEqual(driver.frames, [null]);
  assert.match(driver.messages[0], /did not preserve/);
});