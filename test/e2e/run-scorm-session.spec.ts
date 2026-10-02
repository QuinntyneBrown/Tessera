import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-007 AC1
test('lets a SCORM 1.2 SCO initialize, then write and read a value', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 3'],
    ['LMSGetValue', 'cmi.core.lesson_location'],
    ['LMSGetLastError'],
  ]);

  expect(results).toEqual(['true', 'true', 'page 3', '0']);
});
