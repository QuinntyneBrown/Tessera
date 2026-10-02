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

// L2-018 AC2, L2-017 AC1
test('collapses the outline behind a toggle on a narrow screen and works by keyboard', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.useViewport(375);
  await player.open({ course: 'multi-sco-12' });

  await player.expectOutlineToggle({ expanded: false });
  await player.expectOutlineVisible(false);

  await player.focusOutlineToggle();
  await player.pressKey('Enter');
  await player.expectOutlineToggle({ expanded: true });
  await player.expectOutlineVisible(true);
  await player.expectNoAccessibilityViolations();

  await player.pressKey('Tab');
  await player.pressKey('Escape');
  await player.expectOutlineToggle({ expanded: false });
  await player.expectOutlineVisible(false);
  await player.expectOutlineToggleFocused();
});

test('keeps the outline in view, without a toggle, on a wide screen', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.useViewport(1280);
  await player.open({ course: 'multi-sco-12' });

  await player.expectNoOutlineToggle();
  await player.expectOutlineVisible(true);
});

// L2-017 AC1, AC2
test('moves focus to the activity heading when the learner opens an activity', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'multi-sco-12' });

  await player.chooseActivity('Lesson two');

  await player.expectActivityHeadingFocused('Lesson two');
});

test('closes the outline and focuses the new activity when chosen on a narrow screen', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.useViewport(375);
  await player.open({ course: 'multi-sco-12' });
  await player.focusOutlineToggle();
  await player.pressKey('Enter');

  await player.chooseActivity('Lesson three');

  await player.expectActivityHeadingFocused('Lesson three');
  await player.expectOutlineToggle({ expanded: false });
});

// L2-018 AC1
for (const width of [320, 576, 768, 992, 1200, 1920]) {
  test(`stays usable without horizontal scrolling at ${width} CSS px`, async ({ page }) => {
    const player = new PlayerPage(page);
    await player.useViewport(width);
    await player.open({ course: 'multi-sco-12' });

    await player.expectNoHorizontalScroll();
    await player.expectControlsUsable();
    await player.expectNoHorizontalScroll();
    await player.expectNoAccessibilityViolations();
  });
}

// L2-018 AC4: a 1280 x 1024 window at 400% zoom is 320 x 256 CSS pixels
test('reflows to one column at 400% zoom in a 1280 x 1024 window', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.useViewport(320, 256);
  await player.open({ course: 'multi-sco-12' });

  await player.expectNoHorizontalScroll();
  await player.expectSingleColumn();
  await player.expectControlsUsable();
});
