// Acceptance tests. Traces to L2-079.
// Measured budgets; run alone with `pnpm e2e:performance` (one worker). Titles end with
// "performance budget" so the parallel `pnpm e2e` run leaves them out.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

test.describe.configure({ mode: 'serial', timeout: 600_000 });

test('shows the first frame within 2000 ms at 4x CPU slowdown in 95 of 100 runs (performance budget)', async ({
  page,
}, testInfo) => {
  // L2-079 AC1: readyState of at least 2 and currentTime above 0 within 2000 ms of mounting.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.unmountPlayer();
  const durations = await player.measureFirstFrames(100, 4);
  await testInfo.attach('first-frame-ms.json', { body: JSON.stringify(durations) });
  player.expectWithinBudget(durations, 2000, 95);
});

test('keeps the buffer window bounded over ten media minutes (performance budget)', async ({
  page,
}, testInfo) => {
  // L2-079 AC2: buffered media behind the playhead never exceeds 60 s plus one fragment, and the
  // heap does not grow monotonically after the second minute.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { rate: 20 } });
  await player.expectState('live');
  const samples = await player.sampleBufferAndHeap(10, 3000);
  await testInfo.attach('buffer-and-heap.json', { body: JSON.stringify(samples) });
  player.expectBoundedBuffer(samples, 61.1);
  player.expectHeapNotMonotonic(samples.slice(2));
});

test('appends 200 KB chunks without long tasks in 95 of 100 appends (performance budget)', async ({
  page,
}, testInfo) => {
  // L2-079 AC3: no long task over 50 ms during 95 of 100 appends of 200 KB chunks.
  const player = new VideoPlayerPage(page);
  await player.observeLongTasks();
  await player.open('live', { realTime: true, extra: { rate: 5, chunkKb: 200 } });
  await player.expectState('live');
  const result = await player.measureLongTasksOverAppends(100);
  await testInfo.attach('long-tasks.json', { body: JSON.stringify(result) });
  player.expectAppendsWithoutLongTasks(result, 95);
});

test('fires only the 1 Hz statistics tick while paused for 10 s (performance budget)', async ({
  page,
}, testInfo) => {
  // L2-079 AC4: while paused, the only component-owned timer that fires is the statistics tick,
  // and no requestAnimationFrame loop runs.
  const player = new VideoPlayerPage(page);
  await player.countComponentTimers();
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.clickPlayPause();
  await player.expectState('paused');
  const fired = await player.componentTimersFiredOver(10000);
  await testInfo.attach('paused-timers.json', { body: JSON.stringify(fired) });
  player.expectOnlyStatisticsTick(fired, 10);
});

test('shows and hides the controls within one animation frame at 200% text (performance budget)', async ({
  page,
}, testInfo) => {
  // L2-079 AC5: with 200% text and the bar visible, show and hide complete within one frame.
  const player = new VideoPlayerPage(page);
  // At 200% text, 47.5em is 1520 px; a 1920 px viewport keeps the bar overlaid and auto-hiding.
  await player.useViewport(1920);
  await player.open('live', { realTime: true });
  await player.enlargeText();
  await player.expectState('live');
  const frames = await player.measureRevealFrames(20);
  await testInfo.attach('reveal-frames.json', { body: JSON.stringify(frames) });
  player.expectWithinBudget(frames, 1, 20);
});
