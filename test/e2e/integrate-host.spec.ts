import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-014 AC1, L2-021 AC3
for (const [omitted, message] of [
  ['attempt', /attempt/i],
  ['host', /persistence|host/i],
] as const) {
  test(`refuses to start when the host omits the ${omitted}`, async ({ page }) => {
    const player = new PlayerPage(page);

    await player.open({ omit: omitted });

    await player.expectErrorMessage(message);
    await player.expectNoAccessibilityViolations();
    await player.expectHostReceivedErrorCategory('integration');
    player.expectNoCourseContentRequested();
  });
}
