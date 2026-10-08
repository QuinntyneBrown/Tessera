// Acceptance tests. Traces to L2-057, L2-059, L2-060, L2-066, L2-068, L2-070, L2-071, L2-075.
import { expect, test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('appends the initialisation segment first and reaches the first frame live', async ({
  page,
}) => {
  // L2-057 AC1; L2-059 AC1, AC2; L2-060 AC1; L2-066 AC6; L2-071 AC2: Given the subscription
  // delivers chunks, when they are appended, then addSourceBuffer is called once, the init bytes
  // are the first append, media is appended in seq order one at a time, playback starts no more
  // than 3 s behind the buffered end, the state becomes live and "Live." is announced.
  const player = new VideoPlayerPage(page);
  await player.recordMediaSourceCalls();
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { rate: 1 } });
  await player.expectFirstFrame();
  await player.expectState('live');
  await player.expectStateHistoryInOrder(['connecting', 'live']);
  await player.expectTransportCalls(['configure', 'describe', 'subscribe']);
  await player.expectSerialisedAppends();
  await player.expectStartedNearLiveEdge();
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.expectNoAccessibilityViolations();
});

test('keeps one growing buffered range across fixture loops', async ({ page }) => {
  // L2-059 AC2: Given a looping live source, when fragments keep arriving in seq order, then the
  // buffered timeline keeps growing past the length of the source file without gaps.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { rate: 6 } });
  await player.expectFirstFrame();
  await player.expectBufferedEndBeyond(12);
  await player.expectState('live');
  await player.expectNoAccessibilityViolations();
});

test('rebuilds the MediaSource and revokes the old object URL on a second initialisation chunk', async ({
  page,
}) => {
  // L2-059 AC4: Given a second kind 0 chunk after a source restart, when it is handled, then the
  // old MediaSource is detached, its object URL revoked, a new one created, and playback resumes.
  const player = new VideoPlayerPage(page);
  await player.recordMediaSourceCalls();
  await player.open('live', { realTime: true, extra: { rate: 4, reinitAt: 3 } });
  await player.expectFirstFrame();
  await player.expectMediaSourceUrls({ created: 2, revoked: 1 });
  await player.expectSourceBuffersAdded(2);
  await player.expectPlaybackAdvancing();
  await player.expectState('live');
  await player.expectNoAccessibilityViolations();
});

test('discards media that arrives before an initialisation chunk with a development warning', async ({
  page,
}) => {
  // L2-059 AC3: Given no initialisation chunk, when media arrives, then it is discarded and a
  // development-mode warning is logged; the player stays connecting without an error.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { rate: 4, skipInit: true } });
  await player.expectWarning('initialisation segment');
  await player.expectState('connecting');
  await player.expectNoAccessibilityViolations();
});

test('enters decode on a media error without raw internals in the message', async ({ page }) => {
  // L2-059 AC6; L2-068 AC2: Given the video element fires error, then the state is error with code
  // decode and the plain-language message, never the MediaError text.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { rate: 4, decodeAt: 2 } });
  await player.expectError("The video couldn't be decoded.");
  await player.expectErrorOutputs([{ code: 'decode', message: "The video couldn't be decoded." }]);
  await player.expectRetry(true);
  await player.expectNoAccessibilityViolations();
});

test('retries an append once after QuotaExceededError and keeps playing', async ({ page }) => {
  // L2-059 AC5: Given appendBuffer throws QuotaExceededError, then the player prunes and retries once.
  const player = new VideoPlayerPage(page);
  await player.failAppendsWithQuota(1);
  await player.open('live', { realTime: true, extra: { rate: 4 } });
  await player.expectFirstFrame();
  await player.expectState('live');
  await player.expectNoAccessibilityViolations();
});

test('enters decode when the retried append also exceeds the quota', async ({ page }) => {
  // L2-059 AC5: a second QuotaExceededError on the retry enters error with code decode.
  const player = new VideoPlayerPage(page);
  await player.failAppendsWithQuota(2);
  await player.open('live', { realTime: true, extra: { rate: 4 } });
  await player.expectError("The video couldn't be decoded.");
  await player.expectNoAccessibilityViolations();
});

test('emits stats every second in active states with latency rounded to 0.1 s', async ({
  page,
}) => {
  // L2-060 AC6; L2-075 AC5: Given an active state, when 1000 ms pass, then stats carries state,
  // latencySeconds (buffered end minus currentTime, 0.1 s), bufferedAheadSeconds, bytesReceived
  // and droppedFrames.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  const before = await player.statsCount();
  await expect
    .poll(() => player.statsCount(), { timeout: 4000 })
    .toBeGreaterThanOrEqual(before + 2);
  await player.expectLastStats();
  await player.expectNoAccessibilityViolations();
});

test('emits no stats once the player is in error', async ({ page }) => {
  // L2-075 AC5: Given the state is error, when 1000 ms pass, then stats does not emit.
  const player = new VideoPlayerPage(page);
  await player.open('unsupported', { realTime: true });
  await player.expectState('error');
  const count = await player.statsCount();
  await page.waitForTimeout(2500);
  expect(await player.statsCount()).toBe(count);
});

test('jumps back to the live edge after two ticks more than 8 s behind', async ({ page }) => {
  // L2-060 AC2; L2-071 AC6: Given live playback falls more than 8 s behind on two consecutive ticks,
  // then currentTime jumps to 3 s behind the buffered end and "Back live." is announced; reaching
  // 10 s behind is announced once.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { lead: 11 } });
  await player.expectFirstFrame();
  await player.expectAnnounced('10 seconds behind live. Press Live to catch up.');
  await player.expectAnnounced('Back live.');
  await player.expectLatencyAtMost(3.6);
  await player.expectNoAccessibilityViolations();
});

test('prunes buffered media behind the playhead to the buffer window', async ({ page }) => {
  // L2-060 AC3: Given more than 60 s is buffered behind currentTime, when an append completes, then
  // media older than 30 s behind the playhead is removed.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { rate: 25 } });
  await player.expectFirstFrame();
  await player.expectBufferWindowPruned();
  await player.expectNoAccessibilityViolations();
});

test('jumps into a new buffered range after a gap in seq without an error', async ({ page }) => {
  // L2-060 AC5: Given a seq gap, when the next chunk lands in a new buffered range, then the
  // playhead jumps to that range's end minus 3 and the player keeps playing.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { rate: 2, gapAt: 2 } });
  await player.expectFirstFrame();
  await player.expectPlayheadInNewestRange();
  await player.expectState('live');
  await player.expectNoAccessibilityViolations();
});

test('renames the LIVE badge behind the edge and catches up when it is activated', async ({
  page,
}) => {
  // L2-070 AC4: at the edge the badge is "Live" and aria-disabled; more than 5 s behind it is
  // "Go to live, {n} seconds behind" and enabled; activating it seeks to the live edge.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectFirstFrame();
  await player.expectLiveBadge('Live', true);
  await player.open('live', { realTime: true, extra: { lead: 7 } });
  await player.expectFirstFrame();
  await player.goToLiveWhenBehind();
  await player.expectLatencyAtMost(3.6);
  await player.expectLiveBadge('Live', true);
  await player.expectNoAccessibilityViolations();
});
