// Acceptance tests. Traces to L2-061, L2-066, L2-068, L2-071.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('shows a spinner over the last frame while buffering and returns to live', async ({
  page,
}) => {
  // L2-066 AC2, AC6: Given live, when the video fires waiting, then the state is buffering with a
  // spinner and the frame still visible; when playing fires, the state returns to live. Every
  // transition emits stateChange once and data-state follows it.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.stallSource();
  await player.expectState('buffering');
  await player.expectSpinner(true);
  await player.expectVideoVisible();
  await player.expectNoAccessibilityViolations();
  await player.resumeSource();
  await player.expectState('live');
  await player.expectSpinner(false);
  await player.expectStateHistoryInOrder(['connecting', 'live', 'buffering', 'live']);
});

test('announces Buffering only after 1000 ms of buffering', async ({ page }) => {
  // L2-066 AC3: Given buffering, when 1000 ms pass, then "Buffering." is announced once; shorter
  // buffering is not announced.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live');
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.freezeTime();
  await player.stallUntilVideoWaits();
  await player.elapse(999);
  await player.expectState('buffering');
  await player.expectNotAnnounced('Buffering.');
  await player.elapse(151);
  await player.expectAnnounced('Buffering.');
  await player.resumeTime();
});

test('pauses out of buffering and removes the spinner', async ({ page }) => {
  // L2-061 AC5: Given buffering, when Pause is activated, then the state is paused and the
  // buffering indicator is removed.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.stallSource();
  await player.expectState('buffering');
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.expectSpinner(false);
  await player.expectNoAccessibilityViolations();
});

test('reads Waiting for the source after 10 s and fails with stalled after 30 s', async ({
  page,
}) => {
  // L2-066 AC4; L2-068 AC2: Given no chunk for 10 s, then the status reads "Waiting for the
  // source…" and the state is buffering; after 30 s the state is error stalled with Retry.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.stallSource();
  await player.freezeTime();
  await player.elapse(10000);
  await player.expectStatusText('Waiting for the source…');
  await player.expectState('buffering');
  await player.elapse(20000);
  await player.expectError('The source stopped sending video.');
  await player.expectRetry(true);
  await player.resumeTime();
  await player.expectNoAccessibilityViolations();
});

test('ends with the live duration and disables every control except Fullscreen', async ({
  page,
}) => {
  // L2-066 AC5; L2-071 AC2: Given the subscription completes, when the buffered media has played
  // out, then the state is ended, the stage shows "Stream ended" with the live duration, every
  // control except Fullscreen is aria-disabled, and the duration is announced.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.observeAnnouncements();
  await player.open('live', {
    realTime: true,
    extra: { endAfter: 3, captions: true, startedAgo: 125 },
  });
  await player.expectState('ended');
  await player.expectEndedPanel('Live for 2 minutes');
  await player.expectControlsDisabledExceptFullscreen();
  await player.expectAnnounced('Stream ended. It was live for 2 minutes.');
  await player.expectStateHistoryInOrder(['connecting', 'live', 'ended']);
  await player.expectNoAccessibilityViolations();
});
