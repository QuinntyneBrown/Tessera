// Acceptance tests. Traces to L2-057, L2-058, L2-066, L2-070, L2-071.
import { expect, test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('renders an idle labelled region with an empty live region when no stream is set', async ({
  page,
}) => {
  // L2-066 AC6; L2-070 AC1; L2-071 AC1: Given no stream, when the player renders, then it is an idle,
  // labelled region with hidden native controls and an empty polite live region.
  const player = new VideoPlayerPage(page);
  await player.open('idle');
  await player.expectState('idle');
  await player.expectRegionName('Video player');
  await player.expectNativeControlsHidden();
  await player.expectEmptyLiveRegion();
  await player.expectStateHistory([]);
  await player.expectNoAccessibilityViolations();
});

test('enters connecting with a Connecting placeholder while Describe is pending', async ({
  page,
}) => {
  // L2-057 AC1; L2-066 AC1, AC6: Given hubUrl and streamId, when the player initialises, then the
  // transport is configured, Describe is awaited before any Subscribe, and the state is connecting.
  const player = new VideoPlayerPage(page);
  await player.open('describe-pending');
  await player.expectState('connecting');
  await player.expectStatusText('Connecting…');
  await player.expectRegionName('Video player');
  await player.expectTransportCalls(['configure', 'describe']);
  await player.expectStateHistory(['connecting']);
  await player.expectNoAccessibilityViolations();
});

test('names the region from the descriptor, announces it and starts the elapsed clock', async ({
  page,
}) => {
  // L2-058 AC1; L2-070 AC5; L2-071 AC2: Given Describe resolves, when the descriptor is applied,
  // then the region is named after the title, the elapsed time counts from startedAt, and
  // "Connecting to {title}." is announced before Subscribe is invoked.
  const player = new VideoPlayerPage(page);
  await player.open('connecting', { extra: { startedAgo: 754 } });
  await player.expectRegionName('Video player: Lecture hall A');
  await player.expectAnnouncement('Connecting to Lecture hall A.');
  await player.expectTransportCalls(['configure', 'describe', 'subscribe']);
  await player.freezeTime();
  const elapsed = await player.elapsedSeconds();
  expect(elapsed).toBeGreaterThanOrEqual(754);
  expect(elapsed).toBeLessThan(760);
  await player.elapse(1000);
  await expect.poll(() => player.elapsedSeconds()).toBe(elapsed + 1);
  await player.expectElapsedHiddenFromAssistiveTech();
  await player.resumeTime();
  await player.expectNoAccessibilityViolations();
});

test('sizes the stage from the descriptor and falls back to 16:9', async ({ page }) => {
  // L2-058 AC3: Given width and height above 0 the stage matches them; otherwise it is 16:9.
  const player = new VideoPlayerPage(page);
  await player.open('connecting');
  await player.expectRegionName('Video player: Lecture hall A');
  await player.expectAspectRatio('1280 / 720');
  await player.open('connecting', { extra: { width: 0, height: 0 } });
  await player.expectRegionName('Video player: Lecture hall A');
  await player.expectAspectRatio('16 / 9');
  await player.expectNoAccessibilityViolations();
});

test('prefers titleOverride over the descriptor title', async ({ page }) => {
  // L2-075 AC1 (titleOverride input); L2-058 AC1: the override replaces the descriptor title.
  const player = new VideoPlayerPage(page);
  await player.open('connecting', { extra: { titleOverride: 'Hall override' } });
  await player.expectRegionName('Video player: Hall override');
  await player.expectAnnouncement('Connecting to Hall override.');
  await player.expectNoAccessibilityViolations();
});

test('shows the unsupported alert with the mime type and no Retry, without subscribing', async ({
  page,
}) => {
  // L2-058 AC2; L2-068 AC1, AC2; L2-071 AC5; L2-078 AC5: Given isTypeSupported(mimeType) is false,
  // when the check runs, then Subscribe is not called, the state is error with code unsupported,
  // the message names the mime type, there is no Retry, and the polite region is empty.
  const player = new VideoPlayerPage(page);
  await player.open('unsupported');
  await player.expectError("This browser can't play this stream (video/unknown).");
  await player.expectState('error');
  await player.expectRetry(false);
  await player.expectTransportCalls(['configure', 'describe']);
  await player.expectErrorOutputs([
    { code: 'unsupported', message: "This browser can't play this stream (video/unknown)." },
  ]);
  await player.expectAnnouncement('');
  await player.expectNoAccessibilityViolations();
});

for (const variant of ['missing MediaSource', 'throwing isTypeSupported'] as const) {
  test(`treats a ${variant} as unsupported`, async ({ page }) => {
    // L2-058 AC2; L2-078 AC5: an undefined MediaSource or an exception from the check is unsupported.
    const player = new VideoPlayerPage(page);
    if (variant === 'missing MediaSource') await player.removeMediaSource();
    else await player.makeTypeCheckThrow();
    await player.open('connecting');
    await player.expectError(
      'This browser can\'t play this stream (video/mp4; codecs="avc1.4d401f,mp4a.40.2").',
    );
    await player.expectTransportCalls(['configure', 'describe']);
    await player.expectNoAccessibilityViolations();
  });
}

test('maps an unknown-stream rejection to not-found with Retry', async ({ page }) => {
  // L2-058 AC4; L2-068 AC2: Given Describe rejects with unknown-stream, then the code is not-found.
  const player = new VideoPlayerPage(page);
  await player.open('not-found');
  await player.expectError("This stream doesn't exist or is no longer available.");
  await player.expectRetry(true);
  await player.expectErrorOutputs([
    { code: 'not-found', message: "This stream doesn't exist or is no longer available." },
  ]);
  await player.expectNoAccessibilityViolations();
});
