import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-011 AC1
test('gives the SCO its saved location and suspend data when the attempt is reopened', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', snapshot: 'saved' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSGetValue', 'cmi.core.lesson_location'],
    ['LMSGetValue', 'cmi.suspend_data'],
    ['LMSGetValue', 'cmi.core.entry'],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 9'],
    ['LMSCommit', ''],
  ]);

  expect(results).toEqual([
    'true',
    'page 8 of attempt-1',
    'chapter=3;answers=ab',
    'resume',
    'true',
    'true',
  ]);
  await player.expectHostSaved({
    'cmi.core.lesson_location': 'page 9',
    'cmi.suspend_data': 'chapter=3;answers=ab',
  });
});
