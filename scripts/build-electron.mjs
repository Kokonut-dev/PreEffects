import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-electron');
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [
    path.join(rootDir, 'src/main/main.ts'),
    path.join(rootDir, 'src/main/preload.ts'),
  ],
  outdir: outDir,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});

console.log('Built Electron main & preload bundles into dist-electron/');
