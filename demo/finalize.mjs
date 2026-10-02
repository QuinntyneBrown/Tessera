// Inspects a recorded demo by decoding it in Chromium (no ffmpeg needed), then publishes it.
//   node demo/finalize.mjs stage     measure, locate chapter cards, extract the poster and review frames
//   node demo/finalize.mjs promote   copy the reviewed set into docs/demo and write its README
import { chromium } from '@playwright/test';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync,
  renameSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const staging = join(here, '.run', 'staging');
const review = join(here, '.run', 'review');
const published = join(here, '..', 'docs', 'demo');
const SLUG = 'scorm-player-dev-app';

const mode = process.argv[2];

/** Serves the video with Range support so the browser can seek. */
function serve(file) {
  const server = createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      return response.end('<video id="v" muted preload="auto"></video><canvas id="c"></canvas>');
    }
    const size = statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(request.headers.range ?? '');
    if (range) {
      const start = Number(range[1] || 0);
      const end = range[2] ? Number(range[2]) : size - 1;
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
        'Accept-Ranges': 'bytes',
        'Content-Length': size,
      });
      createReadStream(file).pipe(response);
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function stage() {
  const file = join(staging, `${SLUG}.webm`);
  const { chapters, markers } = JSON.parse(
    readFileSync(join(staging, `${SLUG}.chapters.json`), 'utf8'),
  );
  mkdirSync(review, { recursive: true });
  const server = await serve(file);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const url = `http://127.0.0.1:${server.address().port}/video.webm`;

    const measured = await page.evaluate(async (src) => {
      const video = document.getElementById('v');
      video.src = src;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('the browser could not decode the video'));
      });
      if (!Number.isFinite(video.duration)) {
        // A WebM without a duration reports Infinity until the end has been seeked to.
        video.currentTime = 1e7;
        await new Promise((resolve) => (video.onseeked = resolve));
      }
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
    }, url);

    const frameAt = (time) =>
      page.evaluate(async (t) => {
        const video = document.getElementById('v');
        video.currentTime = Math.max(0, Math.min(t, video.duration - 0.05));
        await new Promise((resolve) => (video.onseeked = resolve));
        const canvas = document.getElementById('c');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0);
        const small = document.createElement('canvas');
        small.width = 32;
        small.height = 18;
        const sctx = small.getContext('2d');
        sctx.drawImage(video, 0, 0, 32, 18);
        const pixels = sctx.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        for (let i = 0; i < pixels.length; i += 4)
          sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        return { luminance: sum / (pixels.length / 4), png: canvas.toDataURL('image/png') };
      }, time);

    const save = (name, dataUrl) =>
      writeFileSync(join(review, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

    // Locate each chapter's title card (a dark full-screen card) to correct the wall-clock offset.
    // The first chapter follows the dark opening card, so its card cannot be told apart by luminance:
    // it takes the median offset of the others.
    const detected = [];
    for (const chapter of chapters.slice(1)) {
      let hit = null;
      for (let t = chapter.at - 1; t < chapter.at + 10 && hit === null; t += 0.25) {
        if ((await frameAt(t)).luminance < 40) hit = t;
      }
      if (hit === null) throw new Error(`no title card found near ${chapter.title}`);
      detected.push(hit - chapter.at);
    }
    const offset = [...detected].sort((a, b) => a - b)[Math.floor(detected.length / 2)];
    const found = chapters.map((chapter, index) => ({
      title: chapter.title,
      at: index === 0 ? chapter.at + offset : chapter.at + detected[index - 1],
    }));

    // Review frames: each chapter card and just after it, the poster candidate, and the ending.
    for (const [index, chapter] of found.entries()) {
      save(`chapter-${index + 1}-card.png`, (await frameAt(chapter.at + 1.5)).png);
      save(`chapter-${index + 1}-content.png`, (await frameAt(chapter.at + 6)).png);
    }
    save('opening.png', (await frameAt(1.5)).png);
    save('ending.png', (await frameAt(measured.duration - 1.5)).png);

    const posterAt = markers.poster + offset + 2.5;
    const poster = await frameAt(posterAt);
    writeFileSync(
      join(staging, `${SLUG}-poster.png`),
      Buffer.from(poster.png.split(',')[1], 'base64'),
    );

    const meta = {
      ...measured,
      bytes: statSync(file).size,
      offset,
      posterAt,
      chapters: found,
    };
    writeFileSync(join(staging, `${SLUG}.meta.json`), JSON.stringify(meta, null, 2));
    console.log(JSON.stringify(meta, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

function promote() {
  const meta = JSON.parse(readFileSync(join(staging, `${SLUG}.meta.json`), 'utf8'));
  mkdirSync(published, { recursive: true });
  const files = [`${SLUG}.webm`, `${SLUG}-poster.png`];
  const backups = [];
  try {
    for (const name of files) {
      const target = join(published, name);
      if (existsSync(target)) {
        renameSync(target, `${target}.bak`);
        backups.push(target);
      }
      copyFileSync(join(staging, name), target);
    }
    writeFileSync(join(published, 'README.md'), readme(meta));
  } catch (error) {
    for (const target of backups) renameSync(`${target}.bak`, target);
    throw error;
  }
  for (const target of backups) renameSync(`${target}.bak`, `${target}.old`);
}

function readme(meta) {
  const chapters = meta.chapters
    .map((chapter) => `| ${clock(chapter.at)} | ${chapter.title} |`)
    .join('\n');
  return `# Demo videos

Silent, captioned recordings of Tessera's executable application, made by driving the real app in Chromium.

## Applications

| Application | Purpose | Status |
|-------------|---------|--------|
| [Dev app](../../src/dev-app/) | Playground that hosts the SCORM player with an example LMS host | Recorded: [\`${SLUG}.webm\`](${SLUG}.webm) |
| \`e2e-app\` (\`src/e2e-app/\`) | Host used by the acceptance tests | Excluded: a test harness, not a product application |
| \`tools/course-server.mjs\` | Serves the isolated course origin the dev app needs | Excluded: supporting tooling, started for the recording |

## ${SLUG}

![Poster](${SLUG}-poster.png)

- Video: [\`${SLUG}.webm\`](${SLUG}.webm), ${clock(meta.duration)} (${meta.duration.toFixed(1)} s), ${meta.width} × ${meta.height}, ${(meta.bytes / 1024 / 1024).toFixed(1)} MB
- Poster: [\`${SLUG}-poster.png\`](${SLUG}-poster.png), a frame decoded from the video at ${clock(meta.posterAt)}

| Time | Chapter |
|------|---------|
${chapters}

Each chapter was asserted while recording: the course title, edition and outline load; the lesson's API calls
return \`true\` and the player shows status completed, score 85 and "Progress saved" with one save and one outcome
event; Next, Previous and the outline move between lessons with focus on the new heading and a blocked Next on
the last lesson explained in text; the first lesson reads its saved status and score back; Exit reaches the host
as one exit event.

### What the recording shows and what it does not

- The lesson content is the repository's **probe** fixture (\`test/fixtures/courses/multi-sco-12\`), a page that
  runs the SCORM API calls typed into it. It is not a real course.
- The host is the dev app's in-memory example (\`src/components-examples/tessera/scorm-player/\`). Saved state lives
  only for the page's lifetime, so "come back to a lesson" is within one session, not a reload.
- Only SCORM 1.2 is implemented. SCORM 2004 courses are recognised and refused; ZIP loading, save failure and
  retry, and the narrow-screen layout exist and are covered by the acceptance tests but are not in this recording.
- **Known behaviour the recording exposes:** the Status and Score panel shows the outcome of the last saved lesson. After moving
  to Lesson two it still reads "completed, 85", which belongs to Lesson one. This is a limitation of the current SCORM 1.2
  outcome rule (it uses the saved activity), not something the video hides.
- The player is unstyled apart from layout, so it looks plain. No screen reader was used; accessibility is only
  covered by automated checks and keyboard tests.

## Rerun

Prerequisites: Node 24, \`corepack pnpm install\` run once, and Chromium installed for Playwright
(\`corepack pnpm exec playwright install chromium\`). Ports 4200 and 4300 must be free: the recording refuses to
reuse a server it did not start. Run from the repository root:

\`\`\`
node demo/run.mjs
\`\`\`

This starts the dev app (\`ng serve dev-app\`, port 4200) and the course server (\`tools/course-server.mjs\`, port
4300, after bundling the wrapper into \`dist/wrapper\`), records one continuous take with
\`demo/playwright.config.ts\` and \`demo/scorm-player-dev-app.demo.ts\`, then decodes the video in Chromium with
\`demo/finalize.mjs\` (no ffmpeg is required) to measure it, locate the chapter cards, extract the poster, and
publish the files here. Playwright stops both servers when the take ends. Intermediate files, review frames and
traces stay in the ignored \`demo/.run/\` and \`test-results/\` folders. The demo needs no credentials or
configuration variables and uses no database.

Pass \`--stage-only\` to \`node demo/run.mjs\` to record and inspect without publishing; then run
\`node demo/finalize.mjs promote\` after reviewing \`demo/.run/review/\`.

Recording source: [\`demo/scorm-player-dev-app.demo.ts\`](../../demo/scorm-player-dev-app.demo.ts),
[\`demo/narration.ts\`](../../demo/narration.ts).
`;
}

if (mode === 'stage') await stage();
else if (mode === 'promote') promote();
else throw new Error('usage: node demo/finalize.mjs stage|promote');
