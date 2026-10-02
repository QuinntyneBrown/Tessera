import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

const commitPage = (page: string) => [
  ['LMSInitialize', ''],
  ['LMSSetValue', 'cmi.core.lesson_location', page],
  ['LMSCommit', ''],
];

// L2-020 AC3
test('lets the learner exit once all progress is saved', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });
  await player.runScoCalls(commitPage('page 1'));
  await player.expectSaveStatus('Progress saved');

  await player.exit();

  await player.expectHostReceivedExit(true);
  await player.expectNoExitWarning();
});

// L2-020 AC3, L2-017 AC1
test('warns inline and offers retry when exiting with unsaved progress', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', save: 'manual' });
  await player.runScoCalls(commitPage('page 1'));
  await player.failPendingSave();

  await player.exit();

  await player.expectExitWarningFocused();
  await player.expectNoAccessibilityViolations();
  await player.expectNoHostExit();
});

test('exits after a successful retry from the warning and returns focus to the activity', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', save: 'manual' });
  await player.runScoCalls(commitPage('page 1'));
  await player.failPendingSave();
  await player.exit();

  await player.retrySaveFromExitWarning();
  await player.acknowledgePendingSave();

  await player.expectHostReceivedExit(true);
  await player.expectNoExitWarning();
  await player.expectActivityHeadingFocused('Probe');
});

test('exits without saving only when the learner chooses to', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', save: 'manual' });
  await player.runScoCalls(commitPage('page 1'));
  await player.failPendingSave();
  await player.exit();

  await player.exitWithoutSaving();

  await player.expectHostReceivedExit(false);
  await player.expectNoExitWarning();
});
