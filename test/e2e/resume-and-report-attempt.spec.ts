import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-011 AC1
test('gives the SCO its saved location and suspend data when the attempt is reopened', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', snapshot: 'saved' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSGetValue', 'cmi.core.lesson_location'],
    ['LMSGetValue', 'cmi.suspend_data'],
    ['LMSGetValue', 'cmi.core.entry'],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 9'],
    ['LMSCommit', ''],
  ]);

  expect(results).toEqual([
    'true',
    'page 8 of attempt-1',
    'chapter=3;answers=ab',
    'resume',
    'true',
    'true',
  ]);
  await player.expectHostSaved({
    'cmi.core.lesson_location': 'page 9',
    'cmi.suspend_data': 'chapter=3;answers=ab',
  });
});

// L2-011 AC2
test('starts a new attempt with no prior state when the host has none', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSGetValue', 'cmi.core.lesson_location'],
    ['LMSGetValue', 'cmi.suspend_data'],
    ['LMSGetValue', 'cmi.core.entry'],
  ]);

  expect(results).toEqual(['true', '', '', 'ab-initio']);
});

// L2-011 AC3
for (const learner of ['learner-a', 'learner-b']) {
  test(`gives ${learner} only the state saved for their own attempt`, async ({ page }) => {
    const player = new PlayerPage(page);
    await player.open({ course: 'probe-12', attempt: learner, snapshot: 'saved' });

    const results = await player.runScoCalls([
      ['LMSInitialize', ''],
      ['LMSGetValue', 'cmi.core.lesson_location'],
    ]);

    expect(results).toEqual(['true', `page 8 of ${learner}`]);
  });
}

// L2-011, L2-014: a snapshot for another attempt is never applied
test('refuses saved state that belongs to a different attempt', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', snapshot: 'foreign' });

  await player.expectErrorMessage(/does not belong to this attempt/i);
  await player.expectHostReceivedErrorCategory('integration');
  player.expectNoLaunchResourceRequested();
});

// L1-005: a read failure never silently starts a new attempt
test('does not start a new attempt when the saved state cannot be read', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', snapshot: 'unreadable' });

  await player.expectErrorMessage(/saved progress could not be read/i);
  await player.expectRetryOffered();
  await player.expectHostReceivedErrorCategory('persistence');
  player.expectNoLaunchResourceRequested();
});

test('reads the saved state again on retry and then resumes it', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12', snapshot: 'flaky' });
  await player.expectErrorMessage(/saved progress could not be read/i);

  await player.retry();

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSGetValue', 'cmi.core.lesson_location'],
  ]);
  expect(results).toEqual(['true', 'page 8 of attempt-1']);
  await player.expectNoErrorMessage();
});

// L2-012 AC1
test('reports the SCORM 1.2 lesson status and score to the host once the save is acknowledged', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.score.raw', '85'],
    ['LMSSetValue', 'cmi.core.lesson_status', 'completed'],
    ['LMSCommit', ''],
  ]);

  await player.expectOutcomeShown({ status: 'completed', score: '85' });
  await player.expectHostReceivedOutcomes([
    {
      status: 'completed',
      completion: 'unknown',
      success: 'unknown',
      score: { raw: 85 },
      progress: 'unknown',
    },
  ]);
  await player.expectNoAccessibilityViolations();
});

// L2-012 AC3
test('shows unknown outcomes as text instead of inventing a percentage', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  await player.expectOutcomeShown({ status: 'Not yet known', score: 'Not yet known' });
  await player.expectNoProgressPercentage();
  await player.expectHostReceivedOutcomes([]);
});
