// Acceptance tests. Traces to L2-057, L2-058, L2-066, L2-070, L2-071.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

test('renders an idle labelled region with an empty live region when no stream is set', async ({
  page,
}) => {
  // L2-066 AC6; L2-070 AC1; L2-071 AC1: Given no stream, when the player renders, then it is an idle,
  // labelled region with hidden native controls and an empty polite live region.
  const player = new VideoPlayerPage(page);
  await player.open('idle');
  await player.expectState('idle');
  await player.expectRegionName('Video player');
  await player.expectNativeControlsHidden();
  await player.expectEmptyLiveRegion();
  await player.expectStateHistory([]);
  await player.expectNoAccessibilityViolations();
});
