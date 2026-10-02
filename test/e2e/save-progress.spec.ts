import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-013 AC1, L2-010 AC1
test('saves the current SCO values to the host when the SCO commits', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 4'],
    ['LMSCommit', ''],
  ]);

  expect(results).toEqual(['true', 'true', 'true']);
  await player.expectHostSaved({ 'cmi.core.lesson_location': 'page 4' });
  await player.expectHostSaveCount(1);
  await player.expectSaveStatus('Progress saved');
  await player.expectNoAccessibilityViolations();
});
