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
