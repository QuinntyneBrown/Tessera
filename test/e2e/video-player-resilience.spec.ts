// Acceptance tests. Traces to L2-067, L2-068, L2-071.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('enters reconnecting with a dimmed frame, attempt 1 of 5 and one announcement', async ({
  page,
}) => {
  // L2-067 AC1: Given the connection is lost, when the transport reports reconnecting, then the
  // state is reconnecting, the last frame stays visible and dimmed, the status reads attempt 1 of 5
  // and "Connection lost. Reconnecting." is announced.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.dropConnection();
  await player.expectState('reconnecting');
  await player.expectStatusText('Reconnecting… attempt 1 of 5');
  await player.expectStageDimmed();
  await player.expectAnnouncementHistoryToEndWith('Connection lost. Reconnecting.');
  await player.expectPlayPause('Play', true);
  await player.expectNoAccessibilityViolations();
});

test('advances the attempt counter on the 0, 2, 5, 10, 10 s schedule within 100 ms', async ({
  page,
}) => {
  // L2-067 AC2: Given attempt n fails, when the next delay starts, then the status reads attempt
  // n+1 of 5 and the delay matches the schedule within 100 ms.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.freezeTime();
  await player.dropConnection();
  await player.elapse(1);
  await player.expectStatusText('Reconnecting… attempt 1 of 5');
  for (const [delay, attempt] of [
    [2000, 2],
    [5000, 3],
    [10000, 4],
    [10000, 5],
  ]) {
    await player.elapse(delay - 100);
    await player.expectStatusText(`Reconnecting… attempt ${attempt - 1} of 5`);
    await player.elapse(100);
    await player.expectStatusText(`Reconnecting… attempt ${attempt} of 5`);
  }
  await player.resumeTime();
});

test('re-subscribes on reconnected, rebuilds on the new init chunk and returns live', async ({
  page,
}) => {
  // L2-067 AC3: Given the transport reports reconnected, then Subscribe is invoked again, the
  // pipeline is rebuilt, the state returns to live and "Reconnected. Live." is announced.
  const player = new VideoPlayerPage(page);
  await player.recordMediaSourceCalls();
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.dropConnection();
  await player.expectState('reconnecting');
  await player.restoreConnection();
  await player.expectState('live');
  await player.expectTransportCalls(['configure', 'describe', 'subscribe', 'subscribe']);
  await player.expectMediaSourceUrls({ created: 2, revoked: 1 });
  await player.expectAnnouncementHistoryToEndWith('Reconnected. Live.');
  await player.expectNoAccessibilityViolations();
});

test('returns to paused after reconnecting when the viewer had paused', async ({ page }) => {
  // L2-067 AC3: ... or paused if the viewer had paused.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.dropConnection();
  await player.expectState('reconnecting');
  await player.restoreConnection();
  await player.expectState('paused');
  await player.expectVideoPaused(true);
  await player.expectNoAccessibilityViolations();
});

test('fails with the connection error after five failed attempts', async ({ page }) => {
  // L2-067 AC4: Given five attempts fail, when the transport reports closed, then the state is
  // error with code connection, Retry is offered and the error is in an alert.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.freezeTime();
  await player.dropConnection();
  await player.elapse(27200);
  await player.expectError("The connection was lost and couldn't be restored.");
  await player.expectRetry(true);
  await player.expectErrorOutputs([
    { code: 'connection', message: "The connection was lost and couldn't be restored." },
  ]);
  await player.resumeTime();
  await player.expectNoAccessibilityViolations();
});

test('starts a fresh connection with a fresh token on Retry and resets the schedule', async ({
  page,
}) => {
  // L2-067 AC5: Given Retry is activated, then a fresh connection starts with a fresh token from
  // accessTokenFactory and the schedule resets.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.expectTokenRequests(1);
  await player.freezeTime();
  await player.dropConnection();
  await player.elapse(27200);
  await player.expectState('error');
  await player.resumeTime();
  await player.clickRetry();
  await player.expectState('live');
  await player.expectTokenRequests(2);
  await player.dropConnection();
  await player.expectStatusText('Reconnecting… attempt 1 of 5');
  await player.expectNoAccessibilityViolations();
});

test('runs no further attempts after the player is destroyed during backoff', async ({ page }) => {
  // L2-067 AC6: Given the component is destroyed during the schedule, then no further attempts run.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.freezeTime();
  await player.dropConnection();
  await player.elapse(1);
  await player.expectState('reconnecting');
  await player.unmountPlayer();
  await player.elapse(40000);
  await player.expectPlayerRemoved();
  await player.expectStateHistoryInOrder(['connecting', 'live', 'reconnecting']);
  await player.expectErrorOutputs([]);
  await player.resumeTime();
});
