import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// Design operate-player (ScormPlayerHarness), L2-021
test('lets a consumer test operate and read real players through the public harness', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.openHarnessContract();

  await player.expectHarnessContractResult({
    title: 'Three lessons',
    activities: [
      { title: 'Lesson one', current: true, available: true, reason: null },
      { title: 'Lesson two', current: false, available: true, reason: null },
      { title: 'Lesson three', current: false, available: true, reason: null },
    ],
    previousReason: 'This is the first activity.',
    afterChoice: 'Lesson two',
    afterNext: 'Lesson three',
    nextReason: 'This is the last activity.',
    afterPrevious: 'Lesson two',
    outcome: { Status: 'Not yet known', Score: 'Not yet known' },
    missing: true,
    otherError: {
      heading: 'Course cannot start',
      text: 'The course cannot start because the host did not supply an authorized attempt.',
    },
    otherTitle: null,
  });
});
