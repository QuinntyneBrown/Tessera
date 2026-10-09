import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-008 AC1, L2-009 AC1
test('lets a SCORM 2004 SCO initialize through API_1484_11, then write and read a value', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th' });

  const results = await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.location', 'page 3'],
    ['GetValue', 'cmi.location'],
    ['GetLastError'],
  ]);

  expect(results).toEqual(['true', 'true', 'page 3', '0']);
});

// L2-008 AC2
test('reports the SCORM 2004 error for each out-of-sequence call or invalid argument', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th' });

  const results = await player.runScoCalls([
    ['GetValue', 'cmi.location'],
    ['GetLastError'],
    ['Terminate', ''],
    ['GetLastError'],
    ['Initialize', 'unexpected'],
    ['GetLastError'],
    ['Initialize', ''],
    ['Initialize', ''],
    ['GetLastError'],
    ['GetErrorString', '103'],
    ['Commit', 'unexpected'],
    ['GetLastError'],
    ['Terminate', ''],
    ['Initialize', ''],
    ['GetLastError'],
    ['GetValue', 'cmi.location'],
    ['GetLastError'],
    ['SetValue', 'cmi.location', 'late'],
    ['GetLastError'],
    ['Commit', ''],
    ['GetLastError'],
    ['Terminate', ''],
    ['GetLastError'],
  ]);

  expect(results).toEqual([
    '',
    '122',
    'false',
    '112',
    'false',
    '201',
    'true',
    'false',
    '103',
    'Already Initialized',
    'false',
    '201',
    'true',
    'false',
    '104',
    '',
    '123',
    'false',
    '133',
    'false',
    '143',
    'false',
    '113',
  ]);
});

// L2-009 AC1, AC2
test('reads back valid SCORM 2004 writes and refuses to write a read-only element', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th' });

  const results = await player.runScoCalls([
    ['Initialize', ''],
    ['GetValue', 'cmi.completion_status'],
    ['SetValue', 'cmi.completion_status', 'completed'],
    ['GetValue', 'cmi.completion_status'],
    ['SetValue', 'cmi.score.scaled', '0.85'],
    ['GetValue', 'cmi.score.scaled'],
    ['SetValue', 'cmi.credit', 'no-credit'],
    ['GetLastError'],
    ['GetErrorString', '404'],
  ]);

  expect(results).toEqual([
    'true',
    'unknown',
    'true',
    'completed',
    'true',
    '0.85',
    'false',
    '404',
    'Data Model Element Is Read Only',
  ]);
});

// L2-009 AC3
test('rejects invalid SCORM 2004 values without changing the previous valid value', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th' });
  const tooLong = 'x'.repeat(64001);

  const results = await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.score.scaled', '0.5'],
    ['SetValue', 'cmi.score.scaled', '1.5'],
    ['GetLastError'],
    ['SetValue', 'cmi.success_status', 'finished'],
    ['GetLastError'],
    ['GetValue', 'cmi.success_status'],
    ['SetValue', 'cmi.suspend_data', 'chapter=2'],
    ['SetValue', 'cmi.suspend_data', tooLong],
    ['GetLastError'],
    ['GetValue', 'cmi.suspend_data'],
    ['GetValue', 'cmi.score.scaled'],
  ]);

  expect(results).toEqual([
    'true',
    'true',
    'false',
    '407',
    'false',
    '406',
    'unknown',
    'true',
    'false',
    '407',
    'chapter=2',
    '0.5',
  ]);
});

// L2-008 AC3
for (const [edition, suspendData, jump] of [
  ['2nd', ['false', '407'], ['false', '406']],
  ['3rd', ['false', '407'], ['false', '406']],
  ['4th', ['true', '0'], ['true', '0']],
] as const) {
  test(`applies the SCORM 2004 ${edition} Edition rules where the editions differ`, async ({
    page,
  }) => {
    const player = new PlayerPage(page);
    await player.open({ course: `probe-2004-${edition}` });

    const results = await player.runScoCalls([
      ['Initialize', ''],
      ['SetValue', 'cmi.suspend_data', 'x'.repeat(4001)],
      ['GetLastError'],
      ['SetValue', 'adl.nav.request', '{target=item1}jump'],
      ['GetLastError'],
    ]);

    expect(results).toEqual(['true', ...suspendData, ...jump]);
  });
}

// L2-010 AC1, AC2
test('saves a SCORM 2004 SCO state on Commit and its final state on Terminate', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th' });

  await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.location', 'page 4'],
    ['Commit', ''],
  ]);
  await player.expectHostSaved({ 'cmi.location': 'page 4' });

  await player.runScoCalls([
    ['SetValue', 'cmi.location', 'page 5'],
    ['Terminate', ''],
  ]);
  await player.expectHostSaved({ 'cmi.location': 'page 5' });
  await player.expectHostSaveCount(2);
});

// L2-011 AC1
test('gives a SCORM 2004 SCO its saved location and suspend data when the attempt is reopened', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th', snapshot: 'saved' });

  const results = await player.runScoCalls([
    ['Initialize', ''],
    ['GetValue', 'cmi.location'],
    ['GetValue', 'cmi.suspend_data'],
    ['GetValue', 'cmi.entry'],
  ]);

  expect(results).toEqual(['true', 'page 8 of attempt-1', 'chapter=3;answers=ab', 'resume']);
});

// L2-012 AC2
test('reports SCORM 2004 completion and success separately once the save is acknowledged', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-2004-4th' });

  await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.completion_status', 'completed'],
    ['SetValue', 'cmi.success_status', 'failed'],
    ['SetValue', 'cmi.score.scaled', '0.4'],
    ['Commit', ''],
  ]);

  await player.expectOutcomeShown({ completion: 'completed', success: 'failed', score: '0.4' });
  await player.expectHostReceivedOutcomes([
    {
      status: 'unknown',
      completion: 'completed',
      success: 'failed',
      score: { scaled: 0.4 },
      progress: 'unknown',
    },
  ]);
  await player.expectNoAccessibilityViolations();
});
