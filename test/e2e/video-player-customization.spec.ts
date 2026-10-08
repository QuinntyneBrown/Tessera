// Acceptance tests. Traces to L2-057, L2-070, L2-075, L2-076, L2-077, L2-078.
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

test('uses English defaults without a VIDEO_PLAYER_I18N provider', async ({ page }) => {
  // L2-076 AC1: without a provider, names, status and announcements use the English defaults.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.expectNames({
    region: 'Video player: Lecture hall A',
    controls: 'Player controls',
    playPause: 'Pause',
    mute: 'Mute',
    volume: 'Volume',
    live: 'Live',
  });
  await player.expectLiveBadgeText('LIVE');
});

test('applies a partial override to names, status and announcements', async ({ page }) => {
  // L2-076 AC2, AC4; L2-070 AC7: overridden keys are used everywhere, other keys keep defaults.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { localized: true } });
  await player.expectAnnouncementHistoryToEndWith('En direct.');
  await player.expectNames({
    region: 'Lecteur vidéo : Lecture hall A',
    controls: 'Commandes du lecteur',
    playPause: 'Pause',
    mute: 'Couper le son',
    volume: 'Volume',
    live: 'Direct',
  });
  await player.expectLiveBadgeText('DIRECT');
  await player.expectAnnounced('Connexion à Lecture hall A.');
  await player.expectNoAccessibilityViolations();
});

test('calls number strings with the volume, seconds behind, attempt and duration', async ({
  page,
}) => {
  // L2-076 AC3: unmuted, behindLive, reconnecting and endedAfter (through duration) receive the
  // volume, the seconds behind, the attempt and maximum, and the live duration.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { localized: true, lead: 11 } });
  await player.expectAnnounced('10 s de retard.');
  await player.focusControl('play-pause');
  await player.pressKey('m');
  await player.pressKey('m');
  await player.expectAnnounced('Son à 100 %.');
  await player.dropConnection();
  await player.expectStatusText('Tentative 1 sur 5');
});

test('localises the ended message through the duration string', async ({ page }) => {
  // L2-076 AC3: endedAfter receives the duration produced by the duration string.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', {
    realTime: true,
    extra: { localized: true, endAfter: 3, startedAgo: 125 },
  });
  await player.expectState('ended');
  await player.expectAnnounced('Terminé après 2 min.');
});
