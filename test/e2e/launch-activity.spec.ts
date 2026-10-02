import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-004 AC1
test('launches a single-SCO course so that the SCO finds its API before it runs', async ({
  page,
}) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'single-sco-12' });

  await player.expectActivityDiscoveredApi();
  await player.expectNoAccessibilityViolations();
});

// L2-015 AC1
test('keeps course scripts away from the host DOM, cookies and storage', async ({ page }) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'hostile-12' });

  await player.expectCourseCannotReachHost();
});

// L2-015 AC2, L2-016 AC2
test('ignores bridge messages forged by course content', async ({ page }) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'forger-12' });

  await player.expectForgedMessagesIgnored();
});

// L2-015 AC3
for (const isolation of ['none', 'unavailable'] as const) {
  test(`refuses to launch when the host cannot isolate course delivery (${isolation})`, async ({
    page,
  }) => {
    const player = new PlayerPage(page);

    await player.open({ course: 'single-sco-12', isolation });

    await player.expectErrorMessage(/isolated/i);
    await player.expectHostReceivedErrorCategory('integration');
    player.expectNoLaunchResourceRequested();
  });
}
