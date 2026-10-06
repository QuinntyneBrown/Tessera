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
