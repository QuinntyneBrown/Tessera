// Acceptance tests. Traces to L2-057, L2-070, L2-071.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('exposes a grouped control bar of labelled native buttons and one native slider', async ({
  page,
}) => {
  // L2-070 AC2, AC3: the bar is role group "Player controls"; every control is a type=button
  // button with aria-label, toggles use aria-pressed, disabled controls use aria-disabled and stay
  // focusable, and the volume is a native range input.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.open('live', { realTime: true, extra: { captions: true } });
  await player.expectState('live');
  await player.expectControlCatalogue();
  await player.expectNoAccessibilityViolations();
});

test('gives each player its own live region and its own connection', async ({ page }) => {
  // L2-057 AC5; L2-070 AC1; L2-071 AC1: two players on a page each own one polite live region
  // inside their host and their own transport.
  const player = new VideoPlayerPage(page);
  await player.open('connecting', { extra: { instances: 2 } });
  await player.expectPlayerCount(2);
  await player.expectOwnLiveRegions(['Connecting to Lecture hall A.', 'Connecting to Lab camera.']);
  await player.expectTransportCount(2);
  await player.expectNoAccessibilityViolations();
});

test('never drops control toggle messages written in quick succession', async ({ page }) => {
  // L2-071 AC3: control toggle messages are never dropped.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.focusControl('play-pause');
  await player.pressKey('m');
  await player.pressKey('m');
  await player.expectAnnouncementHistoryToEndWith('Unmuted, volume 100%.');
  await player.expectAnnounced('Muted.');
  await player.expectNoAccessibilityViolations();
});
