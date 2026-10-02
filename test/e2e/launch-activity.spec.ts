import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-004 AC1
test('launches a single-SCO course so that the SCO finds its API before it runs', async ({
  page,
}) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'single-sco-12' });

  await player.expectActivityDiscoveredApi();
  await player.expectNoAccessibilityViolations();
});
