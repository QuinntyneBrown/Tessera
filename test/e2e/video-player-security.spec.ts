// Acceptance tests. Traces to L2-058, L2-078.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

const HOSTILE = '<img src=x onerror="window.__xss=1">';

test('renders a hostile title as literal text in the name, placeholder and announcements', async ({
  page,
}) => {
  // L2-058 AC5; L2-078 AC1: markup in the title appears literally and never runs.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('connecting', { extra: { hostile: true } });
  await player.expectRegionName(`Video player: ${HOSTILE}`);
  await player.expectPlaceholderTitle(HOSTILE);
  await player.expectAnnounced(`Connecting to ${HOSTILE}.`);
  await player.expectNoInjectedMarkup();
  await player.expectNoAccessibilityViolations();
});

test('renders a hostile title as literal text in the ended panel', async ({ page }) => {
  // L2-058 AC5; L2-078 AC1: the ended panel shows the title as text.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { hostile: true, endAfter: 3 } });
  await player.expectState('ended');
  await player.expectEndedTitle(HOSTILE);
  await player.expectNoInjectedMarkup();
});

test('never exposes the access token in the DOM, console, errors or stats', async ({ page }) => {
  // L2-078 AC2: the token reaches only the transport.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectTokenRequests(1);
  await player.failSource();
  await player.expectState('error');
  await player.expectTokenConfined('fixture-token-7f3a');
});

test('passes the hub URL to the transport unchanged and never writes it into the page', async ({
  page,
}) => {
  // L2-078 AC3: any hubUrl string reaches the transport verbatim and is never interpolated.
  const player = new VideoPlayerPage(page);
  const hubUrl = 'https://hub.example/hubs/video?tenant=<b>bold</b>';
  await player.open('connecting', { extra: { hubUrl } });
  await player.expectRegionName('Video player: Lecture hall A');
  await player.expectConfiguredHubUrl(hubUrl);
  await player.expectNotInPlayer('tenant=');
});
