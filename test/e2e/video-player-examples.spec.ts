// Acceptance tests. Traces to L2-084.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('renders the five adoption examples and plays the custom transport example', async ({
  page,
}) => {
  // L2-084 AC2: the examples show a basic hub player, a custom transport, captions, an i18n
  // override and a themed player.
  const player = new VideoPlayerPage(page);
  await player.openExamples();
  await player.verifyExamples();
  await player.expectNoAccessibilityViolations();
});
