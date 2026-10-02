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

// L2-003 AC2, L2-020 AC1
test('reports a recoverable loading error when the manifest cannot be fetched', async ({
  page,
}) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'single-sco-12', failFirstManifestRequest: true });

  await player.expectErrorMessage(/course manifest/i);
  await player.expectRetryOffered();
  await player.expectNoAccessibilityViolations();
  await player.expectHostReceivedErrorCategory('loading');

  await player.retry();

  await player.expectCourseTitle('Better conversations at work');
});

test('reports a loading error when the manifest does not exist', async ({ page }) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'no-such-course' });

  await player.expectErrorMessage(/course manifest/i);
  await player.expectHostReceivedErrorCategory('loading');
});

// L2-002 AC2
for (const [course, problem] of [
  ['malformed-xml', 'malformed XML'],
  ['doctype-12', 'a document type declaration'],
] as const) {
  test(`rejects a manifest with ${problem} without launching content`, async ({ page }) => {
    const player = new PlayerPage(page);

    await player.open({ course });

    await player.expectErrorMessage(/not a valid course manifest/i);
    await player.expectHostReceivedErrorCategory('loading');
    player.expectNoLaunchResourceRequested();
  });
}
