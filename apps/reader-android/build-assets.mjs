import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import '../../scripts/verify-fonts.mjs';

const app = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(app, '../..');
const output = path.join(app, 'app/build/generated/readerAssets/reader');
const readerUi = path.join(root, 'apps/reader-windows/ui');
await mkdir(output, { recursive: true });
await build({
  entryPoints: [path.join(app, 'ui/reader.js')],
  outfile: path.join(output, 'reader.bundle.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome110',
  minify: true,
  legalComments: 'inline',
});
for (const name of ['reader.html', 'reader.css']) {
  await cp(path.join(app, 'ui', name), path.join(output, name));
}
for (const name of ['theme.js', 'clawpilot.css', 'style.css']) {
  await cp(path.join(readerUi, name), path.join(output, name));
}
await cp(path.join(root, 'public/fonts'), path.join(output, 'fonts'), { recursive: true });
await cp(path.join(root, 'LICENSE'), path.join(output, 'LICENSE.txt'));
console.log('Android reading engine, fonts, and notices staged locally.');