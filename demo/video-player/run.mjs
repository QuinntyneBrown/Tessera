// Records the narrated video player walkthrough into an ignored run directory.
// Usage, from the repository root: node demo/video-player/run.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const run = join(
  root,
  'demo',
  '.run',
  'video-player',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
const audio = join(run, 'audio');
mkdirSync(audio, { recursive: true });
const python = process.env.PYTHON || 'python';
const voice = process.env.EDGE_VOICE || 'en-US-AndrewMultilingualNeural';
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const ffprobe = process.env.FFPROBE || 'ffprobe';
const port = Number(process.env.VIDEO_PLAYER_DEMO_PORT || 4331);
const env = { ...process.env, VIDEO_PLAYER_DEMO_RUN: run, VIDEO_PLAYER_DEMO_PORT: String(port) };

function execute(executable, args, timeout, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    windowsHide: true,
    timeout,
  });
  if (result.error || result.status !== 0)
    throw (
      result.error ||
      new Error(`${executable} exited ${result.status}: ${result.stderr || ''}\nRun: ${run}`)
    );
  return result.stdout;
}

/** Resolves true when something accepts a TCP connection on the port. */
function listening(host, port) {
  return new Promise((done) => {
    const socket = createConnection({ host, port });
    socket.setTimeout(1000);
    socket.once('connect', () => (socket.destroy(), done(true)));
    socket.once('timeout', () => (socket.destroy(), done(false)));
    socket.once('error', () => done(false));
  });
}

// The story records the hub example failing because no hub is running; a listener on 5180
// would be someone else's server. The recording also refuses to reuse a server on its own port.
for (const host of ['127.0.0.1', '::1']) {
  if (await listening(host, 5180))
    throw new Error(`Port 5180 on ${host} is in use; stop that server before recording.`);
  if (await listening(host, port))
    throw new Error(
      `Port ${port} on ${host} is in use; set VIDEO_PLAYER_DEMO_PORT to a free port.`,
    );
}

/** Tagged paragraphs from narration.md, in capture order. */
const paragraphs = readFileSync(join(here, 'narration.md'), 'utf8')
  .split(/\r?\n/)
  .map((line) => /^\[([a-z0-9-]+)\] (.+)$/.exec(line))
  .filter(Boolean)
  .map(([, id, text]) => ({ id, text }));
const lexicon = JSON.parse(readFileSync(join(here, 'pronunciations.json'), 'utf8'));
const spoken = (text) =>
  Object.entries(lexicon).reduce(
    (result, [written, said]) =>
      result.replace(
        new RegExp(`\\b${written.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
        said,
      ),
    text,
  );

writeFileSync(
  join(run, 'environment.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      voice,
      port,
      node: process.version,
      edgeTts: execute(python, ['-c', 'import edge_tts; print(edge_tts.__version__)'], 30_000, {
        capture: true,
      }).trim(),
      ffmpeg: execute(ffmpeg, ['-version'], 30_000, { capture: true }).split('\n')[0],
      revision: execute('git', ['rev-parse', 'HEAD'], 30_000, { capture: true }).trim(),
      dirty: !!execute('git', ['status', '--porcelain'], 30_000, { capture: true }).trim(),
    },
    null,
    2,
  ),
);
console.log(`Run directory: ${run}`);

// One clip per paragraph, normalised to 48 kHz mono PCM and measured before recording.
const segments = [];
for (const { id, text } of paragraphs) {
  const mp3 = join(audio, `${id}.mp3`);
  const wav = join(audio, `${id}.wav`);
  execute(
    python,
    ['-m', 'edge_tts', '--voice', voice, '--text', spoken(text), '--write-media', mp3],
    90_000,
    {
      capture: true,
    },
  );
  execute(
    ffmpeg,
    [
      '-hide_banner',
      '-y',
      '-i',
      mp3,
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      '-ar',
      '48000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      wav,
    ],
    60_000,
    {
      capture: true,
    },
  );
  const duration = Number(
    execute(
      ffprobe,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
      30_000,
      {
        capture: true,
      },
    ).trim(),
  );
  if (!(duration > 0.5)) throw new Error(`Narration clip ${id} is empty`);
  segments.push({ id, text, spoken: spoken(text), duration });
  console.log(`Synthesized ${id}: ${duration.toFixed(2)} s`);
}
writeFileSync(join(run, 'segments.json'), JSON.stringify(segments, null, 2));

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
execute(process.execPath, [join(here, 'finalize.mjs'), run, 'stage'], 10 * 60_000);
console.log(
  `Staged in ${join(run, 'staging')}. Review it, then:\n` +
    `  node demo/video-player/finalize.mjs "${run}" review\n` +
    `  node demo/video-player/finalize.mjs "${run}" promote`,
);
