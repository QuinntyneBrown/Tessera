// Finalizes a recorded take: node demo/video-player/finalize.mjs "<run directory>" stage|review|promote
//   stage    measure the raw take, correct chapter times, mux the narration, verify, extract frames
//   review   play the staged WebM at normal speed in Chromium and record playback health
//   promote  after review-approved.json exists, publish the set to docs/demo with backup and restore
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const run = resolve(process.argv[2] || '');
const mode = process.argv[3];
if (
  !run.startsWith(
    join(root, 'demo', '.run', 'video-player') + (process.platform === 'win32' ? '\\' : '/'),
  )
)
  throw new Error('The run directory must be inside demo/.run/video-player.');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const ffprobe = process.env.FFPROBE || 'ffprobe';
const staging = join(run, 'staging');
const review = join(run, 'review');
const published = join(root, 'docs', 'demo');
const slug = 'video-player';
const RATE = 48000;
const FPS = 10;
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function tool(executable, args, { binary = false } = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: binary ? 'buffer' : 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    timeout: 5 * 60_000,
  });
  if (result.error || result.status !== 0)
    throw result.error || new Error(`${executable} failed: ${result.stderr}`);
  return result;
}

/** Mean luminance of each frame sampled at FPS, from a 32 × 18 greyscale decode. */
function luminance(file) {
  const frames = tool(
    ffmpeg,
    ['-v', 'error', '-i', file, '-vf', `fps=${FPS},scale=32:18,format=gray`, '-f', 'rawvideo', '-'],
    { binary: true },
  ).stdout;
  const means = [];
  for (let offset = 0; offset + 576 <= frames.length; offset += 576) {
    let sum = 0;
    for (let i = offset; i < offset + 576; i++) sum += frames[i];
    means.push(sum / 576);
  }
  return means;
}

/** First time within [from, to] whose frame is a dark title card. */
function cardAt(means, from, to) {
  for (
    let index = Math.max(0, Math.floor(from * FPS));
    index <= to * FPS && index < means.length;
    index++
  )
    if (means[index] < 45) return index / FPS;
  return undefined;
}

function decodedDuration(file, stream) {
  const log = tool(ffmpeg, [
    '-hide_banner',
    '-i',
    file,
    '-map',
    `0:${stream}:0`,
    '-f',
    'null',
    '-',
  ]).stderr;
  const times = [...log.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  const [, h, m, s] = times.at(-1);
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function probe(file) {
  return JSON.parse(
    tool(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]).stdout,
  );
}

function frame(file, time, out) {
  tool(ffmpeg, ['-v', 'error', '-y', '-ss', time.toFixed(3), '-i', file, '-frames:v', '1', out]);
}

function stage() {
  const timeline = JSON.parse(readFileSync(join(run, 'timeline.json'), 'utf8'));
  const segments = JSON.parse(readFileSync(join(run, 'segments.json'), 'utf8'));
  mkdirSync(review, { recursive: true });
  const raw = join(staging, `${slug}-raw.webm`);
  const remux = join(run, `${slug}-remux.webm`);
  tool(ffmpeg, ['-v', 'error', '-y', '-i', raw, '-c', 'copy', remux]);
  const rawProbe = probe(remux);
  const video = rawProbe.streams.find((stream) => stream.codec_type === 'video');
  if (video.width !== 1280 || video.height !== 720) throw new Error('Unexpected dimensions');
  const duration = decodedDuration(remux, 'v');

  // Chapter cards locate the browser clock on the encoded timeline.
  const means = luminance(remux);
  const offsets = timeline.chapters.map((chapter) => {
    const hit = cardAt(means, chapter.at - 1, chapter.at + 3);
    if (hit === undefined) throw new Error(`Chapter card missing: ${chapter.title}`);
    return hit - chapter.at;
  });
  const offset = [...offsets].sort((a, b) => a - b)[Math.floor(offsets.length / 2)];
  if (offsets.some((value) => Math.abs(value - offset) > 0.35))
    throw new Error(`Inconsistent chapter offsets: ${offsets.join(', ')}`);
  const chapters = timeline.chapters.map((chapter) => ({
    title: chapter.title,
    at: Number((chapter.at + offset).toFixed(2)),
  }));
  const speech = timeline.speech.map((item) => ({
    ...item,
    at: Number(Math.max(0, item.at + offset).toFixed(3)),
    text: segments.find((segment) => segment.id === item.id).text,
  }));

  // Each clip goes at its caption's time; the gaps stay silent.
  const pcm = Buffer.alloc(Math.ceil(duration * RATE) * 2);
  let previousEnd = 0;
  for (const item of speech) {
    const wav = readFileSync(join(run, 'audio', `${item.id}.wav`));
    const data = wav.subarray(wav.indexOf('data') + 8);
    const start = Math.round(item.at * RATE) * 2;
    if (item.at < previousEnd - 0.05) throw new Error(`Narration overlaps before ${item.id}`);
    if (start + data.length > pcm.length)
      throw new Error(`Narration ${item.id} runs past the footage`);
    data.copy(pcm, start);
    previousEnd = item.at + data.length / 2 / RATE;
  }
  const track = join(run, 'narration.pcm');
  writeFileSync(track, pcm);
  const final = join(staging, `${slug}.webm`);
  tool(ffmpeg, [
    ...[
      '-v',
      'error',
      '-y',
      '-i',
      remux,
      '-f',
      's16le',
      '-ar',
      String(RATE),
      '-ac',
      '1',
      '-i',
      track,
    ],
    ...['-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy'],
    ...[
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-ar',
      String(RATE),
      '-c:a',
      'libopus',
      '-b:a',
      '96k',
    ],
    final,
  ]);

  // The muxed file: one VP8 video stream, one Opus stream, equal lengths, unchanged chapters.
  const finalProbe = probe(final);
  const kinds = finalProbe.streams.map((stream) => `${stream.codec_type}:${stream.codec_name}`);
  if (kinds.join(',') !== 'video:vp8,audio:opus') throw new Error(`Unexpected streams: ${kinds}`);
  const videoDuration = decodedDuration(final, 'v');
  const audioDuration = decodedDuration(final, 'a');
  if (Math.abs(videoDuration - duration) > 0.1 || Math.abs(audioDuration - videoDuration) > 0.25)
    throw new Error(
      `Durations differ: video ${videoDuration}, audio ${audioDuration}, raw ${duration}`,
    );
  const finalMeans = luminance(final);
  for (const chapter of chapters)
    if (Math.abs(cardAt(finalMeans, chapter.at - 0.5, chapter.at + 1) - chapter.at) > 0.25)
      throw new Error(`Chapter moved: ${chapter.title}`);

  // Speech onsets in the muxed audio must start within a second of each caption.
  const silences = tool(ffmpeg, [
    ...[
      '-hide_banner',
      '-i',
      final,
      '-map',
      '0:a:0',
      '-af',
      'silencedetect=n=-40dB:d=0.25',
      '-f',
      'null',
      '-',
    ],
  ]).stderr;
  const onsets = [...silences.matchAll(/silence_end: ([\d.]+)/g)].map((match) => Number(match[1]));
  const alignment = speech.map((item) => {
    const onset = item.at < 0.3 ? item.at : onsets.find((time) => time >= item.at - 0.3);
    const lag = onset === undefined ? Infinity : Number((onset - item.at).toFixed(2));
    return { id: item.id, caption: item.at, onset, lag };
  });
  const late = alignment.filter((item) => !(item.lag <= 1));
  if (late.length) throw new Error(`Narration out of sync: ${JSON.stringify(late)}`);

  // Review frames and the poster, decoded from the final WebM.
  frame(final, 1.5, join(review, 'opening.png'));
  frame(final, videoDuration - 1.5, join(review, 'ending.png'));
  chapters.forEach((chapter, index) =>
    frame(final, chapter.at + 1.2, join(review, `chapter-${index + 1}.png`)),
  );
  for (const item of speech)
    frame(final, item.at + Math.min(2.5, item.duration / 2), join(review, `${item.id}.png`));
  const posterAt = Number((timeline.markers.poster + offset + 1).toFixed(2));
  frame(final, posterAt, join(staging, `${slug}-poster.png`));

  copyFileSync(join(here, 'narration.md'), join(staging, `${slug}-narration.md`));
  copyFileSync(join(here, 'pronunciations.json'), join(staging, 'pronunciations.json'));
  writeFileSync(
    join(staging, `${slug}.chapters.json`),
    JSON.stringify(
      chapters.map(({ title, at }) => ({ title, start: at, time: clock(at) })),
      null,
      2,
    ) + '\n',
  );
  const meta = {
    duration: videoDuration,
    audioDuration,
    width: video.width,
    height: video.height,
    bytes: statSync(final).size,
    audio: 'Opus 48 kHz mono, 96 kb/s, loudness-normalised to -16 LUFS',
    offset,
    offsets,
    posterAt,
    chapters,
    alignment,
    environment: JSON.parse(readFileSync(join(run, 'environment.json'), 'utf8')),
  };
  writeFileSync(join(run, 'meta.json'), JSON.stringify(meta, null, 2));
  writeFileSync(join(staging, 'README-section.md'), readmeSection(meta));
  unlinkSync(remux);
  console.log(
    `Staged ${final}: ${videoDuration.toFixed(1)} s, offset ${offset.toFixed(2)} s, ` +
      `max narration lag ${Math.max(...alignment.map((item) => item.lag)).toFixed(2)} s`,
  );
}

/** Plays the staged video at normal speed and records whether playback stayed healthy. */
async function playback() {
  const file = join(staging, `${slug}.webm`);
  const server = createServer((request, response) => {
    if (request.url === '/')
      return response
        .writeHead(200, { 'Content-Type': 'text/html' })
        .end('<video id="v" preload="auto" style="width:100vw"></video>');
    const size = statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(request.headers.range || '');
    const start = range ? Number(range[1] || 0) : 0;
    const end = range && range[2] ? Number(range[2]) : size - 1;
    response.writeHead(range ? 206 : 200, {
      'Content-Type': 'video/webm',
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    createReadStream(file, { start, end }).pipe(response);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(
      (src) =>
        new Promise((done) => {
          const video = document.getElementById('v');
          const health = { waiting: 0, stalled: 0, errors: [], started: 0, wall: 0 };
          video.onwaiting = () => health.waiting++;
          video.onstalled = () => health.stalled++;
          video.onerror = () => health.errors.push(String(video.error?.message));
          video.onplaying = () => (health.started ||= performance.now());
          video.onended = () =>
            done({
              ...health,
              wall: (performance.now() - health.started) / 1000,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              audioTracks: video.audioTracks?.length ?? null,
            });
          video.src = src;
          video.play().catch((error) => health.errors.push(String(error)));
        }),
      '/video.webm',
    );
    return result;
  } finally {
    await browser.close();
    server.close();
  }
}

function backupAndPublish(files, section) {
  const backup = join(run, 'backup');
  mkdirSync(backup, { recursive: true });
  const readme = join(published, 'README.md');
  const originals = [...files.map(([, name]) => join(published, name)), readme];
  for (const target of originals)
    if (existsSync(target)) copyFileSync(target, join(backup, target.split(/[\\/]/).at(-1)));
  try {
    for (const [source, name] of files) copyFileSync(source, join(published, name));
    const start = '<!-- video-player-demo:start -->';
    const end = '<!-- video-player-demo:end -->';
    const current = readFileSync(readme, 'utf8');
    const block = `${start}\n${section.trim()}\n${end}`;
    const next = current.includes(start)
      ? current.slice(0, current.indexOf(start)) +
        block +
        current.slice(current.indexOf(end) + end.length)
      : `${current.trimEnd()}\n\n${block}\n`;
    writeFileSync(readme, next);
  } catch (error) {
    for (const target of originals) {
      const saved = join(backup, target.split(/[\\/]/).at(-1));
      if (existsSync(saved)) copyFileSync(saved, target);
      else if (existsSync(target) && target !== readme) unlinkSync(target);
    }
    throw error;
  }
}

function readmeSection(meta) {
  const environment = meta.environment;
  const workflows = {
    '1. Watch a live stream':
      'Live state, LIVE badge and running elapsed time; Pause holds the picture and the badge reads "Go to live, n seconds behind"; Play returns within 5 s of the live edge with "Back live."; Unmute announces "Unmuted, volume 100%." and the slider lowers the volume',
    '2. Keyboard and captions':
      'Click the section heading, then Tab lands on Play with a visible focus ring; Space plays; M mutes and unmutes; Arrow Down twice sets 90%; C turns captions on ("Captions on.", active cue); stepping away hides the bar after 3 s and the cue is visible',
    '3. Make it yours':
      'Spanish strings: region "Reproductor de vídeo: Lecture hall A", Play labelled "Reproducir", badge "EN DIRECTO"; themed player accent rgb(122, 62, 157)',
    "4. When the hub can't be reached":
      'Connect to the hub with no hub listening: state error, role="alert" message "The connection was lost and couldn\'t be restored." with Retry',
    '5. Recover from interruptions':
      'Simulated loss: reconnecting, "Reconnecting… attempt 1 of 5", dimmed frame, "Connection lost. Reconnecting."; restore: live, "Reconnected. Live.", state log ends reconnecting → live; an 8-fragment stream ends with "Stream ended" and "Live for 1 minute"',
  };
  const size = (meta.bytes / 1024 / 1024).toFixed(2);
  return `## Narrated video player walkthrough

[Watch the video](video-player.webm) · [Narration](video-player-narration.md) · [Chapter metadata](video-player.chapters.json) · [Pronunciations](pronunciations.json)

![Video player poster](video-player-poster.png)

Recorded ${clock(meta.duration)} (${meta.duration.toFixed(1)} s), ${meta.width} × ${meta.height}, ${size} MiB, VP8 video with one ${meta.audio} narration track. Narrator: Microsoft Edge read-aloud voice \`${environment.voice}\` via edge-tts ${environment.edgeTts}. Each narration paragraph is burned in as the caption while it is spoken. The poster is decoded from the final WebM at ${clock(meta.posterAt)}.

| Time | Chapter | Verified while recording |
|---|---|---|
${meta.chapters.map((chapter) => `| ${clock(chapter.at)} | ${chapter.title} | ${workflows[chapter.title]} |`).join('\n')}

### Applications for this recording

| Application | Status |
|---|---|
| \`e2e-app\` (\`src/e2e-app/\`), screens \`/?screen=video-player-examples\` and \`/video-player\` | Recorded in this take |
| Dev app (\`src/dev-app/\`) | Excluded: without the demonstration backend it shows the same custom-transport example and the shared examples recorded here |
| Demonstration video backend (L2-085 to L2-094) | Not implemented, so nothing to record; the hub example's failure in chapter 4 is real |

The SCORM and combobox recordings are unrelated and unchanged.

### What the recording shows and what it does not

- Every stream is the committed 10.24 s test pattern \`src/e2e-app/public/lecture-10s.fmp4\` replayed in the page as live fMP4 fragments: by the documented \`ReplayVideoStreamTransport\` example in chapters 1 to 3, and by the acceptance app's fixture transport in chapter 5. No video server or SignalR hub runs. Playwright captures video only, so the stream's 440 Hz tone is not in the recording; the only audio is the narration.
- Chapter 5's connection loss and recovery are simulated through the fixture transport's test controls (\`window.__videoFixture.drop()\` and \`restore()\`), which report the same \`reconnecting\` and \`reconnected\` events the SignalR transport would. No network was cut. The fixture's descriptor says the stream started 60 s earlier, which is why it reads "Live for 1 minute".
- **Known issue the recording exposes:** at player widths of 47.5em (760 px) and above the control bar overlays the bottom of the video, and while it is showing it covers the caption cue. The cue becomes visible when the bar hides after 3 s. This is product behaviour, not a recording artefact; a plain \`<video>\` in the same browser shows the cue.
- On the final stream load in chapter 5, Chromium blocked audible autoplay, so the player started muted and showed its Unmute chip. This is the player's documented fallback and is visible but not narrated.
- No screen reader was used. Announcements are verified by reading the player's polite live region and \`role="alert"\`; the manual screen reader matrix is still open. Fullscreen and touch are not shown.

### Reproduce the recording

From \`C:\\projects\\Tessera\`, with Node 22 or later, locked dependencies and Chromium installed (\`corepack pnpm install --frozen-lockfile\`, \`corepack pnpm exec playwright install chromium\`), Python with \`edge-tts\` (\`python -m pip install edge-tts\`), internet access for synthesis, and a full FFmpeg build with ffprobe, libopus and libvpx on \`PATH\`:

\`\`\`
node demo/video-player/run.mjs
node demo/video-player/finalize.mjs "<run directory>" review
node demo/video-player/finalize.mjs "<run directory>" promote
\`\`\`

\`run.mjs\` refuses to start if port 4331 (or \`VIDEO_PLAYER_DEMO_PORT\`) is in use, or if anything listens on port 5180, where the hub example connects. It synthesizes one clip per paragraph of [\`narration.md\`](../../demo/video-player/narration.md) after applying [\`pronunciations.json\`](../../demo/video-player/pronunciations.json), starts \`ng serve e2e-app --host 127.0.0.1 --port 4331\` through Playwright, records one continuous Chromium take with no retries, and runs \`finalize.mjs stage\`. Staging measures the take, locates the chapter cards to correct the browser clock (offset ${meta.offset.toFixed(2)} s for this take), places each clip at its caption time, loudness-normalises and muxes the narration with \`-c:v copy\`, then checks the streams, durations, chapter positions and that every paragraph starts within a second of its caption (largest lag ${Math.max(...meta.alignment.map((item) => item.lag)).toFixed(2)} s). \`review\` plays the staged file at normal speed in Chromium. \`promote\` requires a \`review-approved.json\` in the run directory, backs up the published files and this README, and restores them if publishing fails. Optional variables: \`PYTHON\`, \`EDGE_VOICE\`, \`FFMPEG\`, \`FFPROBE\`, \`VIDEO_PLAYER_DEMO_PORT\`. No credentials, database or demo storage are used. Playwright stops the Angular server on success or failure; clips, the raw take, review frames and traces stay in the ignored \`demo/.run/video-player/<timestamp>/\`.

Sources: [story](../../demo/video-player/record.story.ts), [page object](../../demo/video-player/page.ts), [Playwright config](../../demo/video-player/playwright.config.ts), [runner](../../demo/video-player/run.mjs), [finalizer](../../demo/video-player/finalize.mjs), [caption helper](../../demo/narration.ts), [examples](../../src/components-examples/tessera/video-player/video-player-examples.ts), [acceptance screen](../../src/e2e-app/src/app/video/video-player-fixture.ts). Revision \`${environment.revision}\`${environment.dirty ? ' plus the uncommitted demo files' : ''}; Node ${environment.node}; ${environment.ffmpeg}.
`;
}

if (mode === 'stage') stage();
else if (mode === 'review') {
  const result = await playback();
  writeFileSync(join(run, 'playback.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length || result.waiting > 1 || Math.abs(result.wall - result.duration) > 3)
    throw new Error('Playback was not healthy');
} else if (mode === 'promote') {
  if (!existsSync(join(run, 'review-approved.json')))
    throw new Error('Review the staged video and write review-approved.json first.');
  if (!existsSync(join(run, 'playback.json'))) throw new Error('Run the review step first.');
  backupAndPublish(
    [
      [join(staging, `${slug}.webm`), `${slug}.webm`],
      [join(staging, `${slug}-poster.png`), `${slug}-poster.png`],
      [join(staging, `${slug}-narration.md`), `${slug}-narration.md`],
      [join(staging, `${slug}.chapters.json`), `${slug}.chapters.json`],
      [join(staging, 'pronunciations.json'), 'pronunciations.json'],
    ],
    readFileSync(join(staging, 'README-section.md'), 'utf8'),
  );
  console.log(`Published to ${published}`);
} else throw new Error('Mode must be stage, review or promote.');
