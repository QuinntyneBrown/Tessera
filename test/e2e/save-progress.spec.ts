import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-013 AC1, L2-010 AC1
test('saves the current SCO values to the host when the SCO commits', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 4'],
    ['LMSCommit', ''],
  ]);

  expect(results).toEqual(['true', 'true', 'true']);
  await player.expectHostSaved({ 'cmi.core.lesson_location': 'page 4' });
  await player.expectHostSaveCount(1);
  await player.expectSaveStatus('Progress saved');
  await player.expectNoAccessibilityViolations();
});

// L2-010 AC2
test('saves the final state when the SCO finishes without a separate commit', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 7'],
    ['LMSFinish', ''],
  ]);

  await player.expectHostSaved({ 'cmi.core.lesson_location': 'page 7' });
  await player.expectHostSaveCount(1);
});

// L2-009 (host-side validation), L2-016 AC2
test('ignores forged operations that the SCORM data model would reject', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'forged-ops-12' });

  await player.expectHostSavedOnly({ 'cmi.core.lesson_location': 'legitimate' });
});

// L2-013 AC2, AC3
test('keeps the state, announces the failure and retries the latest values', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', save: 'manual' });
  await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 2'],
    ['LMSCommit', ''],
  ]);

  await player.failPendingSave();

  await player.expectErrorMessage(/progress was not saved/i);
  await player.expectRetryOffered();
  await player.expectNoAccessibilityViolations();
  await player.expectHostReceivedErrorCategory('persistence');

  await player.retry();
  await player.acknowledgePendingSave();

  await player.expectHostSaved({ 'cmi.core.lesson_location': 'page 2' });
  await player.expectSaveStatus('Progress saved');
  await player.expectNoErrorMessage();
});
