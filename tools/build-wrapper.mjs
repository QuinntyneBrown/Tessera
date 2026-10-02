// Bundles the course wrapper that the host serves on the isolated course origin.
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

const out = process.argv[2] ?? 'dist/wrapper';
await mkdir(out, { recursive: true });
await build({
  entryPoints: ['src/scorm-player/runtime/wrapper/wrapper.ts'],
  outfile: `${out}/wrapper.js`,
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
});
await copyFile('src/scorm-player/runtime/wrapper/wrapper.html', `${out}/wrapper.html`);
