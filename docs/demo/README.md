# Demo videos

Recordings made by driving Tessera's real components in Chromium. The SCORM walkthrough is silent and captioned; the combobox walkthrough includes spoken narration.

## Applications

| Application | Purpose | Status |
|-------------|---------|--------|
| [Dev app](../../src/dev-app/) | Playground that hosts the SCORM player with an example LMS host | Recorded: [`scorm-player-dev-app.webm`](scorm-player-dev-app.webm) |
| `e2e-app` (`src/e2e-app/`) | Hosts acceptance scenarios and shared combobox examples | Combobox examples recorded: [`combobox.webm`](combobox.webm); excluded from the SCORM take |
| `tools/course-server.mjs` | Serves the isolated course origin the dev app needs | Excluded: supporting tooling, started for the recording |

## scorm-player-dev-app

![Poster](scorm-player-dev-app-poster.png)

- Video: [`scorm-player-dev-app.webm`](scorm-player-dev-app.webm), 1:35 (95.2 s), 1280 × 720, 2.1 MB
- Poster: [`scorm-player-dev-app-poster.png`](scorm-player-dev-app-poster.png), a frame decoded from the video at 0:37

| Time | Chapter |
|------|---------|
| 0:04 | 1. Load the course |
| 0:19 | 2. A lesson reports progress |
| 0:46 | 3. Move between lessons |
| 1:07 | 4. Come back to a lesson |
| 1:17 | 5. Leave the course |

Each chapter was asserted while recording: the course title, edition and outline load; the lesson's API calls
return `true` and the player shows status completed, score 85 and "Progress saved" with one save and one outcome
event; Next, Previous and the outline move between lessons with focus on the new heading and a blocked Next on
the last lesson explained in text; the first lesson reads its saved status and score back; Exit reaches the host
as one exit event.

### What the recording shows and what it does not

- The lesson content is the repository's **probe** fixture (`test/fixtures/courses/multi-sco-12`), a page that
  runs the SCORM API calls typed into it. It is not a real course.
- The host is the dev app's in-memory example (`src/components-examples/tessera/scorm-player/`). Saved state lives
  only for the page's lifetime, so "come back to a lesson" is within one session, not a reload.
- Only SCORM 1.2 is implemented. SCORM 2004 courses are recognised and refused; ZIP loading, save failure and
  retry, and the narrow-screen layout exist and are covered by the acceptance tests but are not in this recording.
- **Known behaviour the recording exposes:** the Status and Score panel shows the outcome of the last saved lesson. After moving
  to Lesson two it still reads "completed, 85", which belongs to Lesson one. This is a limitation of the current SCORM 1.2
  outcome rule (it uses the saved activity), not something the video hides.
- The player is unstyled apart from layout, so it looks plain. No screen reader was used; accessibility is only
  covered by automated checks and keyboard tests.

## Rerun

Prerequisites: Node 24, `corepack pnpm install` run once, and Chromium installed for Playwright
(`corepack pnpm exec playwright install chromium`). Ports 4200 and 4300 must be free: the recording refuses to
reuse a server it did not start. Run from the repository root:

```
node demo/run.mjs
```

This starts the dev app (`ng serve dev-app`, port 4200) and the course server (`tools/course-server.mjs`, port
4300, after bundling the wrapper into `dist/wrapper`), records one continuous take with
`demo/playwright.config.ts` and `demo/scorm-player-dev-app.demo.ts`, then decodes the video in Chromium with
`demo/finalize.mjs` (no ffmpeg is required) to measure it, locate the chapter cards, extract the poster, and
publish the files here. Playwright stops both servers when the take ends. Intermediate files, review frames and
traces stay in the ignored `demo/.run/` and `test-results/` folders. The demo needs no credentials or
configuration variables and uses no database.

Pass `--stage-only` to `node demo/run.mjs` to record and inspect without publishing; then run
`node demo/finalize.mjs promote` after reviewing `demo/.run/review/`.

Recording source: [`demo/scorm-player-dev-app.demo.ts`](../../demo/scorm-player-dev-app.demo.ts),
[`demo/narration.ts`](../../demo/narration.ts).

<!-- combobox-demo:start -->
## Narrated combobox walkthrough

[Watch the video](combobox.webm) · [Captions](combobox.vtt) · [Chapter metadata](combobox.chapters.json)

![Combobox poster](combobox-poster.png)

Recorded 4:03 (243.5 seconds), 1280 × 720, 9.73 MiB. Spoken narration uses the local Microsoft Zira Desktop synthetic voice. The poster is decoded from the final encoded WebM at 0:47. Short outcome captions are burned into the footage; the WebVTT file contains the complete spoken narration.

| Time | Verified workflow |
|---|---|
| 0:19 | 1. Search and select |
| 1:04 | 2. Keyboard and removal |
| 1:54 | 3. Angular binding patterns |
| 2:23 | 4. Custom content |
| 2:56 | 5. Paged results |

This recording uses the real component and the five shared adoption examples at the acceptance app's `/?screen=combobox-examples` route. The existing in-memory learner source provides synthetic names and a 150 ms delay; no network responses or selection state are injected. Selections live for this page session and are not persisted to an LMS. Narration is prerecorded and synchronized to recorded caption timestamps. No screen reader is used; manual accessibility, actual zoom and real touch-keyboard release checks remain pending.

Documentation discrepancy: the root README still contains a historical design-stage status paragraph. This video demonstrates the implemented component from the current working tree.

Application inventory for this request: the acceptance app hosts the in-scope combobox examples (recorded); the dev app hosts the same examples plus SCORM (excluded from this take to keep scope on combobox); the SCORM player story and course-server tooling are excluded and their prior recording is preserved. Neither host requires authentication or a database. There are no separate first-party API or worker applications.

### Reproduce the narrated recording

From `C:\projects\Tessera`, install locked dependencies and Chromium with `pnpm install --frozen-lockfile` and `pnpm exec playwright install chromium`. Narration preparation needs Windows PowerShell with System.Speech and an installed SAPI voice; this run used Microsoft Zira Desktop, rate 0. A full FFmpeg build with libopus is required. Set `COMBOBOX_DEMO_FFMPEG` to its executable path, or install the isolated binary used here:

```powershell
python -m pip install --target demo/.run/combobox-tools --platform win_amd64 --only-binary=:all: imageio-ffmpeg==0.6.0
node demo/combobox/run.mjs
```

The recording command starts `ng serve e2e-app --host 127.0.0.1 --port 4321`, checks readiness, records one continuous Chromium take with no retries, synthesizes and mixes narration, validates decoded dimensions/audio and chapter cards, and stages media plus review frames under ignored `demo/.run/combobox/<timestamp>/`. Port 4321 must be free; `COMBOBOX_DEMO_PORT` chooses another port. `COMBOBOX_DEMO_VOICE` chooses an installed voice. No course server is needed. Playwright owns and stops the Angular process on success or failure; all subprocesses launch with hidden Windows windows and finite deadlines. Other processes and environment settings are untouched. No demo storage is reset.

Run `node demo/combobox/finalize.mjs "<absolute run directory>" review` to play the encoded video from beginning to end at normal speed and record playback health. Inspect the chapter frames, caption readability and narration timing as well. Write `review-approved.json` in that run directory with the reviewer and observations, then promote:

```powershell
node demo/combobox/finalize.mjs "<absolute run directory>" promote
```

Promotion backs up and replaces this video's WebM, poster, captions, chapter metadata and this marked README section as one set; it restores the prior set if promotion fails. Unrelated demo files and manual README text are preserved. Failed captures remain in the ignored run directory and do not replace the published recording.

Sources: [recording](../../demo/combobox/record.story.ts), [page object](../../demo/combobox/page.ts), [narration script](../../demo/combobox/storyboard.json), [finalizer](../../demo/combobox/finalize.mjs), [component examples](../../src/components-examples/tessera/combobox/combobox-examples.ts), [acceptance scenario](../../test/e2e/combobox-examples.spec.ts). Revision `4f4ea1c34302c480d86d8258285db1cd875c77b9` plus uncommitted combobox and demo changes; Node v22.23.2. Recording order has no dependency on the SCORM demo.
<!-- combobox-demo:end -->
