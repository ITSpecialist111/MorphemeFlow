import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../public/fonts/', import.meta.url));
let count = 0;
for (const name of await readdir(root, { recursive: true })) {
  if (!/\.(?:ttf|otf)$/.test(name)) continue;
  const data = await readFile(path.join(root, name));
  const signature = data.readUInt32BE(0);
  assert.ok(signature === 0x00010000 || signature === 0x4f54544f, `${name} is not an OpenType/TrueType font`);
  assert.ok(data.readUInt16BE(4) > 0, `${name} has no font tables`);
  count += 1;
}
assert.ok(count >= 5, 'Expected all bundled reading fonts');
console.log(`Verified ${count} bundled font files.`);