import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-008 AC1, L2-009 AC1
test('lets a SCORM 2004 SCO initialize through API_1484_11, then write and read a value', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th' });

  const results = await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.location', 'page 3'],
    ['GetValue', 'cmi.location'],
    ['GetLastError'],
  ]);

  expect(results).toEqual(['true', 'true', 'page 3', '0']);
});
