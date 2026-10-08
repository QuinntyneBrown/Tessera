// Acceptance tests. Traces to L2-057, L2-075, L2-077, L2-078.
import { expect, test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('consumes the shared semantic tokens of the Tessera theme', async ({ page }) => {
  // L2-077 AC1: scrim, control foreground, focus ring, error and placeholder colours come from the
  // shared --t-* tokens when a theme sets them.
  const player = new VideoPlayerPage(page);
  await player.open('connecting', { extra: { themed: 'shared' } });
  await player.expectThemeColors({
    scrim: 'rgb(10, 20, 30)',
    controlForeground: 'rgb(250, 240, 230)',
    placeholder: 'rgb(40, 50, 60)',
  });
  await player.expectFocusRingColor('rgb(255, 200, 0)');
  await player.expectNoAccessibilityViolations();
});

test('lets a component token override the shared theme', async ({ page }) => {
  // L2-077 AC2: --t-video-player-accent on an ancestor wins over the shared brand token.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { themed: 'component', autoplay: false } });
  await player.expectState('paused');
  await player.expectAccentColor('rgb(4, 5, 6)');
});

test('follows a system colour scheme change without interrupting playback or moving focus', async ({
  page,
}) => {
  // L2-077 AC3: with no explicit theme, a scheme change restyles the player while playback and
  // focus stay as they were.
  const player = new VideoPlayerPage(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.focusControl('mute');
  const light = await player.scrimColor();
  await page.emulateMedia({ colorScheme: 'dark' });
  await player.expectScrimColorNot(light);
  await player.expectFocusedControl('mute');
  await player.expectState('live');
  await player.expectPlaybackAdvancing();
});

test('uses a provided transport instead of opening a SignalR connection', async ({ page }) => {
  // L2-075 AC2: Given a VIDEO_STREAM_TRANSPORT provider, the player uses it and opens no socket.
  const player = new VideoPlayerPage(page);
  const hubTraffic = player.countHubTraffic();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectTransportCalls(['configure', 'describe', 'subscribe']);
  expect(hubTraffic()).toBe(0);
});

test('warns once in development about a remote hub URL without TLS', async ({ page }) => {
  // L2-057 AC6; L2-078 AC3: a remote http: hub URL logs one warning naming only its origin, and
  // the URL reaches the transport unchanged.
  const player = new VideoPlayerPage(page);
  const hubUrl = 'http://hub.example:8080/hubs/video?tenant=<b>';
  await player.open('connecting', { extra: { hubUrl } });
  await player.expectRegionName('Video player: Lecture hall A');
  await player.expectWarningCount('hubUrl', 1);
  await player.expectWarning('http://hub.example:8080');
  await player.expectNoWarning('/hubs/video');
  await player.expectConfiguredHubUrl(hubUrl);
});

for (const hubUrl of ['http://localhost:5180/hubs/video', 'https://hub.example/hubs/video']) {
  test(`does not warn for ${hubUrl}`, async ({ page }) => {
    // L2-057 AC6: localhost and TLS hub URLs are silent.
    const player = new VideoPlayerPage(page);
    await player.open('connecting', { extra: { hubUrl } });
    await player.expectRegionName('Video player: Lecture hall A');
    await player.expectWarningCount('hubUrl', 0);
  });
}
