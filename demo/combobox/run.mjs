import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pcmWave } from './media.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
if (process.platform !== 'win32')
  throw new Error('Narration preparation requires Windows System.Speech. See docs/demo/README.md.');
const run = join(root, 'demo', '.run', 'combobox', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(run, { recursive: true });
const audio = join(run, 'audio');
const voice = process.env.COMBOBOX_DEMO_VOICE || 'Microsoft Zira Desktop';
const ffmpeg =
  process.env.COMBOBOX_DEMO_FFMPEG ||
  join(
    root,
    'demo',
    '.run',
    'combobox-tools',
    'imageio_ffmpeg',
    'binaries',
    'ffmpeg-win-x86_64-v7.1.exe',
  );
if (!existsSync(ffmpeg))
  throw new Error(
    'Set COMBOBOX_DEMO_FFMPEG to a full FFmpeg executable, or install imageio-ffmpeg using the documented command.',
  );
const env = { ...process.env, COMBOBOX_DEMO_RUN: run, COMBOBOX_DEMO_FFMPEG: ffmpeg };
function execute(executable, args, timeout) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true,
    timeout,
  });
  if (result.error || result.status !== 0)
    throw (
      result.error ||
      new Error(`${executable} exited ${result.status}; artifacts retained in ${run}`)
    );
}
writeFileSync(
  join(run, 'environment.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      voice,
      node: process.version,
      port: env.COMBOBOX_DEMO_PORT || '4321',
      revision: spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      }).stdout.trim(),
      dirty: !!spawnSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      }).stdout.trim(),
    },
    null,
    2,
  ),
);
console.log(`Run directory: ${run}`);
execute(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(here, 'narrate.ps1'),
    '-Destination',
    audio,
    '-Voice',
    voice,
  ],
  120_000,
);
const segments = JSON.parse(readFileSync(join(here, 'storyboard.json'), 'utf8'));
writeFileSync(
  join(audio, 'durations.json'),
  JSON.stringify(
    Object.fromEntries(
      segments.map((item) => [item.id, pcmWave(join(audio, `${item.id}.wav`)).duration]),
    ),
    null,
    2,
  ),
);
execute(
  process.execPath,
  [
    join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
    'test',
    '-c',
    join(here, 'playwright.config.ts'),
  ],
  12 * 60_000,
);
execute(process.execPath, [join(here, 'finalize.mjs'), run, 'stage'], 120_000);
console.log(
  `Review the encoded video and frames in ${run}; then promote with:\nnode demo/combobox/finalize.mjs "${run}" promote`,
);
