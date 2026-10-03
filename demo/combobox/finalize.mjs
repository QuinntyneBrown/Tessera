import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import {
  createReadStream,
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  unlinkSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pcmWave, waveFile } from './media.mjs';
import { createRequire } from 'node:module';
import { release } from 'node:os';
const mediaRequire = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../..');
const run = resolve(process.argv[2] || '');
const allowed = join(root, 'demo', '.run', 'combobox');
if (!run.startsWith(allowed + (process.platform === 'win32' ? '\\' : '/')))
  throw new Error('Run directory must be inside demo/.run/combobox.');
const staging = join(run, 'staging'),
  review = join(run, 'review'),
  published = join(root, 'docs', 'demo');
const slug = 'combobox',
  mode = process.argv[3];
const timeline = JSON.parse(readFileSync(join(run, 'timeline.json'), 'utf8'));
const environment = JSON.parse(readFileSync(join(run, 'environment.json'), 'utf8'));
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
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const vttTime = (seconds) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
function encode(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-y', ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  });
  writeFileSync(join(run, 'ffmpeg.log'), result.stderr || '');
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr);
  return result.stderr;
}
async function serve(file) {
  const server = createServer((request, response) => {
    if (request.url === '/')
      return response
        .writeHead(200, { 'Content-Type': 'text/html' })
        .end(
          '<style>body{margin:0;background:#111827}video{width:100vw;height:100vh}</style><video id="v" controls preload="auto"></video><canvas id="c" hidden></canvas>',
        );
    const size = statSync(file).size,
      range = /bytes=(\d*)-(\d*)/.exec(request.headers.range || '');
    if (range) {
      const start = Number(range[1] || 0),
        end = Math.min(size - 1, range[2] ? Number(range[2]) : size - 1);
      response.writeHead(206, {
        'Content-Type': 'video/webm',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
      });
      createReadStream(file, { start, end }).pipe(response);
    } else {
      response.writeHead(200, {
        'Content-Type': 'video/webm',
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
      });
      createReadStream(file).pipe(response);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}
async function decode(file, inspect) {
  const server = await serve(file);
  let browser;
  const deadline = setTimeout(
    () => browser?.close().catch(() => {}),
    mode === 'review' ? 12 * 60_000 : 90_000,
  );
  try {
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const measured = await page.evaluate(async (src) => {
      const video = document.getElementById('v');
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('Video decoding failed'));
        video.src = src;
      });
      if (!Number.isFinite(video.duration)) {
        video.currentTime = 1e7;
        await new Promise((resolve) => (video.onseeked = resolve));
      }
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
    }, `http://127.0.0.1:${server.address().port}/video.webm`);
    measured.chromium = browser.version();
    const frameAt = (time) =>
      page.evaluate(async (time) => {
        const video = document.getElementById('v');
        const target = Math.max(0.05, Math.min(time, video.duration - 0.05));
        if (Math.abs(video.currentTime - target) > 0.001)
          await new Promise((resolve, reject) => {
            video.onseeked = resolve;
            video.onerror = reject;
            video.currentTime = target;
          });
        const canvas = document.getElementById('c');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0);
        const small = document.createElement('canvas');
        small.width = 32;
        small.height = 18;
        const smallContext = small.getContext('2d');
        smallContext.drawImage(video, 0, 0, 32, 18);
        const pixels = smallContext.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        for (let i = 0; i < pixels.length; i += 4)
          sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        return { luminance: sum / 576, png: canvas.toDataURL('image/png') };
      }, time);
    return await inspect({ page, frameAt, measured });
  } finally {
    clearTimeout(deadline);
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
async function stage() {
  mkdirSync(review, { recursive: true });
  const raw = join(staging, 'combobox-raw.webm');
  const inspected = await decode(raw, async ({ frameAt, measured }) => {
    if (measured.width !== 1280 || measured.height !== 720 || measured.duration < 90)
      throw new Error('Unexpected dimensions or duration');
    const offsets = [];
    for (const chapter of timeline.chapters.slice(1)) {
      let hit;
      for (let time = chapter.at - 1; time <= chapter.at + 3; time += 0.2)
        if ((await frameAt(time)).luminance < 45) {
          hit = time;
          break;
        }
      if (hit === undefined) throw new Error(`Chapter card missing: ${chapter.title}`);
      offsets.push(hit - chapter.at);
    }
    const offset = offsets.sort((a, b) => a - b)[Math.floor(offsets.length / 2)];
    return { ...measured, offset };
  });
  const pcm = Buffer.alloc(Math.ceil(inspected.duration * 22050) * 2);
  const speech = timeline.speech.map((segment) => ({
    ...segment,
    at: Math.max(0, segment.at + inspected.offset),
  }));
  for (const segment of speech) {
    const clip = pcmWave(join(run, 'audio', `${segment.id}.wav`));
    const offset = Math.round(segment.at * 22050) * 2;
    if (offset + clip.data.length > pcm.length) throw new Error('Narration exceeds footage');
    clip.data.copy(pcm, offset);
  }
  const mix = join(run, 'narration.wav');
  writeFileSync(mix, waveFile(pcm));
  const final = join(staging, `${slug}.webm`);
  encode([
    '-i',
    raw,
    '-i',
    mix,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-shortest',
    final,
  ]);
  const chapters = timeline.chapters.map((item) => ({ ...item, at: item.at + inspected.offset }));
  const posterAt = timeline.markers.poster + inspected.offset - 2;
  const save = (file, frame) => writeFileSync(file, Buffer.from(frame.png.split(',')[1], 'base64'));
  const meta = await decode(final, async ({ frameAt, measured, page }) => {
    save(join(review, 'opening.png'), await frameAt(2));
    save(join(review, 'ending.png'), await frameAt(measured.duration - 2));
    for (const [index, chapter] of chapters.entries()) {
      save(join(review, `chapter-${index + 1}-card.png`), await frameAt(chapter.at + 1.5));
      save(join(review, `chapter-${index + 1}-content.png`), await frameAt(chapter.at + 8));
    }
    for (const segment of speech)
      save(
        join(review, `${segment.id}.png`),
        await frameAt(segment.at + Math.min(3, segment.duration / 2)),
      );
    save(join(staging, `${slug}-poster.png`), await frameAt(posterAt));
    const audio = await page.evaluate(async () => {
      const response = await fetch('/video.webm');
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      let energy = 0,
        peak = 0;
      const samples = buffer.getChannelData(0);
      for (const sample of samples) {
        energy += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      await context.close();
      return {
        channels: buffer.numberOfChannels,
        rate: buffer.sampleRate,
        duration: buffer.duration,
        rms: Math.sqrt(energy / samples.length),
        peak,
      };
    });
    if (audio.rms < 0.01 || audio.peak > 1.001 || Math.abs(audio.duration - measured.duration) > 1)
      throw new Error('Audio track validation failed');
    return {
      ...measured,
      audio,
      bytes: statSync(final).size,
      posterAt,
      chapters,
      speech,
      environment,
      tools: {
        playwright: mediaRequire('@playwright/test/package.json').version,
        chromium: measured.chromium,
        windows: release(),
        ffmpeg: spawnSync(ffmpeg, ['-version'], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 10_000,
        }).stdout.split(/\r?\n/)[0],
      },
      offset: inspected.offset,
      reviewStatus: 'Awaiting encoded playback and visual review',
    };
  });
  writeFileSync(join(staging, `${slug}.chapters.json`), JSON.stringify(meta, null, 2));
  writeFileSync(
    join(staging, `${slug}.vtt`),
    'WEBVTT\n\n' +
      speech
        .map(
          (segment, index) =>
            `${index + 1}\n${vttTime(segment.at)} --> ${vttTime(segment.at + segment.duration)}\n${segment.text}\n`,
        )
        .join('\n'),
  );
  console.log(
    JSON.stringify(
      {
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        bytes: meta.bytes,
        audio: meta.audio,
        chapters,
      },
      null,
      2,
    ),
  );
}
async function playbackReview() {
  const meta = JSON.parse(readFileSync(join(staging, `${slug}.chapters.json`), 'utf8'));
  const result = await decode(join(staging, `${slug}.webm`), async ({ page, measured }) => {
    const progress = setInterval(async () => {
      try {
        const time = await page.evaluate(() => document.getElementById('v').currentTime);
        console.log(`Encoded playback review: ${clock(time)} / ${clock(measured.duration)}`);
      } catch {
        /* The page is closed after the review completes. */
      }
    }, 15_000);
    try {
      return await page.evaluate(async (expected) => {
        const video = document.getElementById('v');
        video.currentTime = 0;
        video.muted = false;
        video.volume = 1;
        video.playbackRate = 1;
        let waiting = 0,
          frames = 0,
          lastMediaTime = -1,
          regressions = 0;
        video.addEventListener('waiting', () => waiting++);
        const sample = (_now, metadata) => {
          if (metadata.mediaTime < lastMediaTime) regressions++;
          lastMediaTime = metadata.mediaTime;
          frames++;
          if (!video.ended) video.requestVideoFrameCallback(sample);
        };
        video.requestVideoFrameCallback(sample);
        const started = performance.now();
        const ended = new Promise((resolve, reject) => {
          const deadline = setTimeout(
            () => reject(new Error('Encoded playback deadline exceeded')),
            (expected + 20) * 1000,
          );
          video.onended = () => {
            clearTimeout(deadline);
            resolve();
          };
          video.onerror = () => {
            clearTimeout(deadline);
            reject(new Error('Encoded playback failed'));
          };
        });
        await video.play();
        await ended;
        const quality = video.getVideoPlaybackQuality();
        return {
          rate: video.playbackRate,
          elapsed: (performance.now() - started) / 1000,
          playedUntil: video.currentTime,
          frames,
          waiting,
          regressions,
          quality: {
            totalVideoFrames: quality.totalVideoFrames,
            droppedVideoFrames: quality.droppedVideoFrames,
            corruptedVideoFrames: quality.corruptedVideoFrames,
          },
        };
      }, measured.duration);
    } finally {
      clearInterval(progress);
    }
  });
  if (
    result.rate !== 1 ||
    result.frames < meta.duration * 10 ||
    result.regressions ||
    Math.abs(result.elapsed - meta.duration) > 5
  )
    throw new Error(`Playback review failed: ${JSON.stringify(result)}`);
  writeFileSync(join(run, 'playback-review.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
function promote() {
  const meta = JSON.parse(readFileSync(join(staging, `${slug}.chapters.json`), 'utf8'));
  if (!existsSync(join(run, 'review-approved.json')))
    throw new Error(
      'Review encoded playback and frames, then record review-approved.json before promotion.',
    );
  meta.reviewStatus = JSON.parse(readFileSync(join(run, 'review-approved.json'), 'utf8'));
  writeFileSync(join(staging, `${slug}.chapters.json`), JSON.stringify(meta, null, 2));
  mkdirSync(published, { recursive: true });
  const readme = join(published, 'README.md');
  const original = readFileSync(readme, 'utf8')
    .replace(
      "Silent, captioned recordings of Tessera's executable application, made by driving the real app in Chromium.",
      "Recordings made by driving Tessera's real components in Chromium. The SCORM walkthrough is silent and captioned; the combobox walkthrough includes spoken narration.",
    )
    .replace(
      '| `e2e-app` (`src/e2e-app/`) | Host used by the acceptance tests | Excluded: a test harness, not a product application |',
      '| `e2e-app` (`src/e2e-app/`) | Hosts acceptance scenarios and shared combobox examples | Combobox examples recorded: [`combobox.webm`](combobox.webm); excluded from the SCORM take |',
    );
  const section = `\n<!-- combobox-demo:start -->\n## Narrated combobox walkthrough\n\n[Watch the video](combobox.webm) · [Captions](combobox.vtt) · [Chapter metadata](combobox.chapters.json)\n\n![Combobox poster](combobox-poster.png)\n\nRecorded ${clock(meta.duration)} (${meta.duration.toFixed(1)} seconds), ${meta.width} × ${meta.height}, ${(meta.bytes / 1024 / 1024).toFixed(2)} MiB. Spoken narration uses the local ${environment.voice} synthetic voice. The poster is decoded from the final encoded WebM at ${clock(meta.posterAt)}. Short outcome captions are burned into the footage; the WebVTT file contains the complete spoken narration.\n\n| Time | Verified workflow |\n|---|---|\n${chaptersForReadme(meta)}\n\nThis recording uses the real component and the five shared adoption examples at the acceptance app's \`/?screen=combobox-examples\` route. The existing in-memory learner source provides synthetic names and a 150 ms delay; no network responses or selection state are injected. Selections live for this page session and are not persisted to an LMS. Narration is prerecorded and synchronized to recorded caption timestamps. No screen reader is used; manual accessibility, actual zoom and real touch-keyboard release checks remain pending.\n\nApplication inventory for this request: the acceptance app hosts the in-scope combobox examples (recorded); the dev app hosts the same examples plus SCORM (excluded from this take to keep scope on combobox); the SCORM player story and course-server tooling are excluded and their prior recording is preserved. Neither host requires authentication or a database. There are no separate first-party API or worker applications.\n\n### Reproduce the narrated recording\n\nFrom \`C:\\projects\\Tessera\`, install locked dependencies and Chromium with \`pnpm install --frozen-lockfile\` and \`pnpm exec playwright install chromium\`. Narration preparation needs Windows PowerShell with System.Speech and an installed SAPI voice; this run used ${environment.voice}, rate 0. A full FFmpeg build with libopus is required. Set \`COMBOBOX_DEMO_FFMPEG\` to its executable path, or install the isolated binary used here:\n\n\`\`\`powershell\npython -m pip install --target demo/.run/combobox-tools --platform win_amd64 --only-binary=:all: imageio-ffmpeg==0.6.0\nnode demo/combobox/run.mjs\n\`\`\`\n\nThe recording command starts \`ng serve e2e-app --host 127.0.0.1 --port 4321\`, checks readiness, records one continuous Chromium take with no retries, synthesizes and mixes narration, validates decoded dimensions/audio and chapter cards, and stages media plus review frames under ignored \`demo/.run/combobox/<timestamp>/\`. Port 4321 must be free; \`COMBOBOX_DEMO_PORT\` chooses another port. \`COMBOBOX_DEMO_VOICE\` chooses an installed voice. No course server is needed. Playwright owns and stops the Angular process on success or failure; all subprocesses launch with hidden Windows windows and finite deadlines. Other processes and environment settings are untouched. No demo storage is reset.\n\nReview the staged encoded video at normal speed, chapter frames and audio. Write \`review-approved.json\` in that run directory with the reviewer and observations, then promote:\n\n\`\`\`powershell\nnode demo/combobox/finalize.mjs "<absolute run directory>" promote\n\`\`\`\n\nPromotion backs up and replaces this video's WebM, poster, captions, chapter metadata and this marked README section as one set; it restores the prior set if promotion fails. Unrelated demo files and manual README text are preserved. Failed captures remain in the ignored run directory and do not replace the published recording.\n\nSources: [recording](../../demo/combobox/record.story.ts), [page object](../../demo/combobox/page.ts), [narration script](../../demo/combobox/storyboard.json), [finalizer](../../demo/combobox/finalize.mjs), [component examples](../../src/components-examples/tessera/combobox/combobox-examples.ts), [acceptance scenario](../../test/e2e/combobox-examples.spec.ts). Revision \`${environment.revision}\` plus uncommitted combobox and demo changes; Node ${environment.node}. Recording order has no dependency on the SCORM demo.\n<!-- combobox-demo:end -->\n`;
  const documentedSection = section
    .replace('C:\\\\projects\\\\Tessera', root)
    .replace(
      'Application inventory for this request:',
      'Documentation discrepancy: the root README still contains a historical design-stage status paragraph. This video demonstrates the implemented component from the current working tree.\n\nApplication inventory for this request:',
    )
    .replace(
      'Review the staged encoded video at normal speed, chapter frames and audio.',
      'Run `node demo/combobox/finalize.mjs "<absolute run directory>" review` to play the encoded video from beginning to end at normal speed and record playback health. Inspect the chapter frames, caption readability and narration timing as well.',
    );
  const next = original.includes('<!-- combobox-demo:start -->')
    ? original.replace(
        /<!-- combobox-demo:start -->[\s\S]*?<!-- combobox-demo:end -->/,
        documentedSection.trim(),
      )
    : original + documentedSection;
  writeFileSync(join(staging, 'README.md'), next);
  const names = [
    `${slug}.webm`,
    `${slug}-poster.png`,
    `${slug}.vtt`,
    `${slug}.chapters.json`,
    'README.md',
  ];
  const backup = join(run, 'backup');
  mkdirSync(backup, { recursive: true });
  const promoted = [];
  try {
    for (const name of names) {
      const target = join(published, name);
      if (existsSync(target)) copyFileSync(target, join(backup, name));
      promoted.push(name);
      copyFileSync(join(staging, name), target);
    }
  } catch (error) {
    for (const name of promoted) {
      const saved = join(backup, name),
        target = join(published, name);
      if (existsSync(saved)) copyFileSync(saved, target);
      else if (existsSync(target)) unlinkSync(target);
    }
    throw error;
  }
  console.log(`Promoted reviewed ${slug} video set into ${published}`);
}
function chaptersForReadme(meta) {
  return meta.chapters.map((item) => `| ${clock(item.at)} | ${item.title} |`).join('\n');
}
if (mode === 'stage') await stage();
else if (mode === 'review') await playbackReview();
else if (mode === 'promote') promote();
else throw new Error('Usage: node demo/combobox/finalize.mjs <run-directory> stage|review|promote');
