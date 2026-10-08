// Acceptance tests. Traces to L2-057, L2-059, L2-060, L2-066, L2-071.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

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
  await player.expectStateHistory(['connecting', 'live']);
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
