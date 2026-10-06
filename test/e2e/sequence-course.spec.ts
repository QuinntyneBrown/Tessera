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
