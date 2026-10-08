// Acceptance tests. Traces to L2-057, L2-063, L2-080.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine; the cycle test needs longer still.
test.describe.configure({ timeout: 60_000 });

test('describes and subscribes again on the same connection when streamId changes', async ({
  page,
}) => {
  // L2-057 AC2: the previous subscription is disposed, the media pipeline is rebuilt, and Describe
  // then Subscribe run for the new identifier on the same connection.
  const player = new VideoPlayerPage(page);
  await player.recordMediaSourceCalls();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.changeStream();
  await player.expectState('live');
  await player.expectTransportLog([
    'configure',
    'describe:lecture-hall-a',
    'subscribe:lecture-hall-a',
    'unsubscribe',
    'configure',
    'describe:lab-camera',
    'subscribe:lab-camera',
  ]);
  await player.expectMediaSourceUrls({ created: 2, revoked: 1 });
  await player.expectNoAccessibilityViolations();
});

test('stops the connection and returns to idle when streamId is cleared', async ({ page }) => {
  // L2-057 AC3: the subscription is disposed, the hub connection stopped, and the state is idle.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.clearStream();
  await player.expectState('idle');
  await player.expectRegionName('Video player');
  await player.expectTransportLog([
    'configure',
    'describe:lecture-hall-a',
    'subscribe:lecture-hall-a',
    'unsubscribe',
    'stop',
  ]);
  await player.expectNoAccessibilityViolations();
});

test('ignores a Describe that resolves after the player is destroyed', async ({ page }) => {
  // L2-057 AC4: no state change, output or DOM write follows a late Describe.
  const player = new VideoPlayerPage(page);
  await player.open('describe-pending');
  await player.expectState('connecting');
  await player.unmountPlayer();
  await player.expectPlayerRemoved();
  await player.resolvePendingDescribe();
  await player.expectTransportLog(['configure', 'describe:lecture-hall-a', 'stop']);
  await player.expectStateHistoryInOrder(['connecting']);
  await player.expectErrorOutputs([]);
});

test('releases the stream, connection, MediaSource and listeners on destroy', async ({ page }) => {
  // L2-080 AC2, AC5; L2-063 AC5: destroying a live player disposes the subscription, stops the
  // connection, revokes the object URL, and removes every document and window listener, so a later
  // fullscreenchange reaches no component code.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.recordMediaSourceCalls();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.unmountPlayer();
  await player.expectPlayerRemoved();
  const baseline = await player.documentListenerCount();
  await player.mountPlayer();
  await player.expectState('live');
  await player.unmountPlayer();
  await player.expectPlayerRemoved();
  await player.expectMediaSourceUrls({ created: 2, revoked: 2 });
  await player.expectActiveSubscriptions(0);
  await player.expectDocumentListenerCount(baseline);
  await player.exitFullscreenExternally();
  await player.expectErrorOutputs([]);
});

test('returns to the warm baseline after 100 create-and-destroy cycles', async ({ page }) => {
  // L2-080 AC4: connections, object URLs and listeners return to the one-cycle baseline.
  test.setTimeout(240_000);
  const player = new VideoPlayerPage(page);
  await player.recordMediaSourceCalls();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.unmountPlayer();
  await player.expectPlayerRemoved();
  const baseline = await player.documentListenerCount();
  for (let cycle = 0; cycle < 100; cycle++) {
    await player.mountPlayer();
    await player.expectStateOneOf(['connecting', 'live']);
    await player.unmountPlayer();
    await player.expectPlayerRemoved();
  }
  await player.expectOpenConnections(0);
  await player.expectActiveSubscriptions(0);
  await player.expectLiveMediaSourceUrls(0);
  await player.expectDocumentListenerCount(baseline);
});

test('reflects play, pause, mute and reconnect without zone.js', async ({ page }) => {
  // L2-080 AC1: under zoneless change detection the UI reflects every change.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectZoneless();
  await player.expectState('live');
  await player.clickPlayPause();
  await player.expectPlayPause('Play', false);
  await player.clickPlayPause();
  await player.expectPlayPause('Pause', false);
  await player.clickMute();
  await player.expectMute('Unmute', true);
  await player.dropConnection();
  await player.expectStatusText('Reconnecting… attempt 1 of 5');
  await player.restoreConnection();
  await player.expectState('live');
});
