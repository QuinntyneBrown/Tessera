import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-005 AC1, L2-004 AC2
test('opens the chosen item, saving and ending the previous SCO session first', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'multi-sco-12' });
  await player.expectCurrentActivity('Lesson one');
  await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'one-page-3'],
  ]);

  await player.chooseActivity('Lesson two');

  await player.expectCurrentActivity('Lesson two');
  await player.expectHostSavedActivity('item1', { 'cmi.core.lesson_location': 'one-page-3' });
  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSGetValue', 'cmi.core.lesson_location'],
  ]);
  expect(results).toEqual(['true', '']);
  await player.expectNoAccessibilityViolations();
});
