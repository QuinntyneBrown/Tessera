// Acceptance tests. Traces to L2-081.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('operates a zoneless TestBed player through VideoPlayerHarness', async ({ page }) => {
  // L2-081 AC1-AC7: the harness reads the state, plays and pauses, mutes and sets the volume,
  // toggles captions, reads the LIVE badge, and reads status and error text and retries, using
  // only the public DOM.
  const player = new VideoPlayerPage(page);
  await player.open('connecting', { realTime: true });
  await player.verifyHarnessContract({
    initial: 'live',
    paused: 'paused',
    resumed: 'live',
    muted: true,
    volume: 40,
    captions: true,
    live: true,
    reconnectingStatus: 'Reconnecting… attempt 1 of 5',
    errorMessage: 'The video source stopped unexpectedly.',
    retried: true,
  });
});
