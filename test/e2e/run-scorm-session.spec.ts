import { expect, test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-007 AC1
test('lets a SCORM 1.2 SCO initialize, then write and read a value', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 3'],
    ['LMSGetValue', 'cmi.core.lesson_location'],
    ['LMSGetLastError'],
  ]);

  expect(results).toEqual(['true', 'true', 'page 3', '0']);
});

// L2-007 AC2
test('reports the SCORM 1.2 error for an invalid call sequence or parameter', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSGetValue', 'cmi.core.lesson_location'],
    ['LMSGetLastError'],
    ['LMSGetErrorString', '301'],
    ['LMSInitialize', ''],
    ['LMSInitialize', ''],
    ['LMSGetLastError'],
    ['LMSGetValue', 'cmi.bogus'],
    ['LMSGetLastError'],
    ['LMSCommit', 'unexpected'],
    ['LMSGetLastError'],
  ]);

  expect(results).toEqual([
    '',
    '301',
    'Not initialized',
    'true',
    'false',
    '101',
    '',
    '201',
    'false',
    '201',
  ]);
});

// L2-007 AC3
test('ends the session on LMSFinish and then applies the terminated-session rules', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 9'],
    ['LMSFinish', ''],
    ['LMSSetValue', 'cmi.core.lesson_location', 'page 10'],
    ['LMSGetLastError'],
  ]);

  expect(results).toEqual(['true', 'true', 'true', 'false', '301']);
});

// L2-009 AC1, AC2
test('reads back valid writes and refuses to write a read-only element', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.score.raw', '85.5'],
    ['LMSGetValue', 'cmi.core.score.raw'],
    ['LMSSetValue', 'cmi.core.credit', 'no-credit'],
    ['LMSGetLastError'],
    ['LMSGetErrorString', '403'],
  ]);

  expect(results).toEqual(['true', 'true', '85.5', 'false', '403', 'Element is read only']);
});

// L2-009 AC3
test('rejects invalid values without changing the previous valid value', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'probe-12' });
  const tooLong = 'x'.repeat(4097);

  const results = await player.runScoCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.score.raw', '90'],
    ['LMSSetValue', 'cmi.core.score.raw', '150'],
    ['LMSGetLastError'],
    ['LMSSetValue', 'cmi.core.lesson_status', 'finished'],
    ['LMSGetValue', 'cmi.core.lesson_status'],
    ['LMSSetValue', 'cmi.suspend_data', tooLong],
    ['LMSGetValue', 'cmi.suspend_data'],
    ['LMSGetValue', 'cmi.core.score.raw'],
  ]);

  expect(results).toEqual([
    'true',
    'true',
    'false',
    '405',
    'false',
    'not attempted',
    'false',
    '',
    '90',
  ]);
});
