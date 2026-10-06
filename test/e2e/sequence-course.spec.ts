import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-001 AC1, L2-006
test('shows a SCORM 2004 course outline with its modules and starts at the first lesson', async ({
  page,
}) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'seq-flow-2004' });

  await player.expectOutline([['Module one', ['Lesson one', 'Lesson two']], 'Lesson three']);
  await player.expectCurrentActivity('Lesson one');
  await player.expectNoAccessibilityViolations();
});

// L2-006 AC1, L2-005 AC3, L2-017 AC3
test('blocks choosing a later lesson when the course requires flow, and lets Next follow the rules', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'seq-flow-2004' });

  await player.expectActivityUnavailable('Lesson three', 'Take this course in order using Next.');
  await player.chooseActivity('Lesson three');
  await player.expectCurrentActivity('Lesson one');
  await player.expectNoAccessibilityViolations();

  await player.next();
  await player.expectCurrentActivity('Lesson two');
  await player.next();
  await player.expectCurrentActivity('Lesson three');
  await player.expectNextBlocked('This is the last activity.');
  await player.previous();
  await player.expectCurrentActivity('Lesson two');
});
