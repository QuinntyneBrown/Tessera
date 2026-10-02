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

// L2-005 AC2, L2-017 AC3
test('blocks Previous on the first and Next on the last activity and explains why', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'multi-sco-12' });

  await player.expectPreviousBlocked('This is the first activity.');
  await player.previous();
  await player.expectCurrentActivity('Lesson one');
  await player.expectNoAccessibilityViolations();

  await player.next();
  await player.expectCurrentActivity('Lesson two');
  await player.expectPreviousAvailable();
  await player.expectNextAvailable();

  await player.next();
  await player.expectCurrentActivity('Lesson three');
  await player.expectNextBlocked('This is the last activity.');
  await player.next();
  await player.expectCurrentActivity('Lesson three');

  await player.previous();
  await player.expectCurrentActivity('Lesson two');
});
