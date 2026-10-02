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

// L2-016 AC1
for (const [course, reference] of [
  ['traversal-12', 'a path that escapes the course root'],
  ['external-12', 'a resource on another origin'],
  ['script-scheme-12', 'an executable URL scheme'],
] as const) {
  test(`rejects a manifest that references ${reference}`, async ({ page }) => {
    const player = new PlayerPage(page);

    await player.open({ course });

    await player.expectErrorMessage(/outside the course/i);
    await player.expectHostReceivedErrorCategory('loading');
    player.expectNoLaunchResourceRequested();
  });
}

// L2-001 AC3
for (const [course, edition] of [
  ['single-sco-2004-2nd', 'SCORM 2004 2nd Edition'],
  ['single-sco-2004-3rd', 'SCORM 2004 3rd Edition'],
  ['single-sco-2004-4th', 'SCORM 2004 4th Edition'],
] as const) {
  test(`identifies ${edition} and refuses to launch it until its rules are supported`, async ({
    page,
  }) => {
    const player = new PlayerPage(page);

    await player.open({ course });

    await player.expectErrorMessage(new RegExp(`${edition}.*cannot be launched`, 'i'));
    await player.expectHostReceivedErrorCategory('loading');
    player.expectNoLaunchResourceRequested();
  });
}

test('refuses a course whose SCORM version cannot be identified', async ({ page }) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'unknown-version' });

  await player.expectErrorMessage(/version of this course could not be identified/i);
  await player.expectHostReceivedErrorCategory('loading');
  player.expectNoLaunchResourceRequested();
});

// L2-001 AC1, L2-021 AC2
test('loads a SCORM 1.2 ZIP package and launches it through host delivery', async ({ page }) => {
  const player = new PlayerPage(page);

  await player.openWithPackage('single-sco-12');

  await player.expectCourseTitle('Better conversations at work');
  await player.expectEdition('SCORM 1.2');
  await player.expectActivities(['Start with listening']);
  await player.expectActivityDiscoveredApi();
  await player.expectNoAccessibilityViolations();
});
