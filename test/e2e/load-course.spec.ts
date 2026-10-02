import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-001 AC2, L2-003 AC1
test('shows the version, title and activities of an extracted SCORM 1.2 course', async ({
  page,
}) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'single-sco-12' });

  await player.expectCourseTitle('Better conversations at work');
  await player.expectEdition('SCORM 1.2');
  await player.expectActivities(['Start with listening']);
  await player.expectNoAccessibilityViolations();
});
