// Acceptance tests. Traces to L2-062, L2-064, L2-069, L2-072, L2-073, L2-074.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

for (const width of [320, 576, 768, 992, 1200, 1920]) {
  test(`wraps the controls without clipping or page scrolling at ${width} CSS px`, async ({
    page,
  }) => {
    // L2-073 AC1, AC4: at each width the bar wraps before any control is clipped, the page never
    // scrolls horizontally, and every control is at least 44 by 44 CSS px.
    const player = new VideoPlayerPage(page);
    await player.stubFullscreen();
    await player.useViewport(width);
    await player.open('live', { realTime: true, extra: { captions: true } });
    await player.expectState('live');
    await player.expectNoHorizontalScroll();
    await player.expectControlsInsidePlayer();
    await player.expectTargetSizes();
    await player.expectNoAccessibilityViolations();
  });
}

test('keeps every control operable in a 320 by 256 CSS px reflow viewport', async ({ page }) => {
  // L2-073 AC3: the automated reflow check for 400% zoom.
  const player = new VideoPlayerPage(page);
  await player.useViewport(320, 256);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectNoHorizontalScroll();
  await player.expectControlsInsidePlayer();
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.clickMute();
  await player.expectMute('Unmute', true);
  await player.expectNoAccessibilityViolations();
});

for (const adjustment of ['200% text', 'text spacing'] as const) {
  test(`keeps elapsed time, LIVE badge, status and error text whole with ${adjustment}`, async ({
    page,
  }) => {
    // L2-073 AC2: with 200% text or WCAG text-spacing overrides, the elapsed time, LIVE badge,
    // status text and error text are neither clipped nor overlapping.
    const player = new VideoPlayerPage(page);
    await player.useViewport(320);
    await player.open('live', { realTime: true });
    if (adjustment === '200% text') await player.enlargeText();
    else await player.applyTextSpacing();
    await player.expectState('live');
    await player.expectBarTextWhole();
    await player.failSource();
    await player.expectError('The video source stopped unexpectedly.');
    await player.expectErrorTextWhole();
    await player.expectNoHorizontalScroll();
  });
}

test('places the bar below the stage and hides the slider in a narrow container', async ({
  page,
}) => {
  // L2-073 AC5; L2-062 AC6: below 47.5em the bar sits below the stage and never auto-hides, the
  // slider is hidden, the elapsed time stays visible, and Arrow Up and Down still change volume.
  const player = new VideoPlayerPage(page);
  await player.open('live', { extra: { containerWidth: 600, volume: 50 } });
  await player.expectState('live');
  await player.expectNarrowLayout(true);
  await player.focusControl('mute');
  await player.pressKey('ArrowUp');
  await player.expectVolume(55);
  await player.blurPlayer();
  await player.restPointerOnStage();
  await player.freezeTime();
  await player.elapse(5000);
  await player.nextFrame();
  await player.expectControlsHidden(false);
  await player.resumeTime();
  await player.expectNoAccessibilityViolations();
});

test('keeps mute reachable and the volume input effective in the narrow layout', async ({
  page,
}) => {
  // L2-074 AC3: with the slider hidden, mute stays reachable and the volume input still applies.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { containerWidth: 600 } });
  await player.expectState('live');
  await player.clickMute();
  await player.expectMute('Unmute', true);
  await player.setHostVolume(40);
  await player.expectVideoAudio({ muted: true, volume: 0.4 });
});

test('preserves playback, state and focus across a resize', async ({ page }) => {
  // L2-073 AC6; L2-069 AC7: a resize keeps playback, state and focus; a focused slider that the
  // narrow layout hides hands focus to the nearest control instead of the page.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { containerWidth: 1000 } });
  await player.expectState('live');
  await player.expectNarrowLayout(false);
  await player.focusControl('mute');
  await player.resizeContainer(600);
  await player.expectNarrowLayout(true);
  await player.resizeContainer(1000);
  await player.expectFocusedControl('mute');
  await player.expectState('live');
  await player.expectPlaybackAdvancing();
  await player.focusVolume();
  await player.resizeContainer(600);
  await player.expectFocusedControl('mute');
  await player.expectNoAccessibilityViolations();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`meets text, icon and focus contrast against the control scrim in ${scheme}`, async ({
    page,
  }) => {
    // L2-072 AC1, AC5; L2-064 AC5: control text 4.5:1, icons and the focus ring 3:1 against the
    // scrim, error text 4.5:1, and caption cues 4.5:1 through the caption tokens, in both themes.
    const player = new VideoPlayerPage(page);
    await page.emulateMedia({ colorScheme: scheme });
    await player.open('live', { realTime: true, extra: { captions: true } });
    await player.expectState('live');
    await player.expectBarContrast();
    await player.expectCaptionContrast();
    await player.failSource();
    await player.expectError('The video source stopped unexpectedly.');
    await player.expectErrorContrast();
  });
}

test('runs no decorative animation under reduced motion while the video plays', async ({
  page,
}) => {
  // L2-072 AC3: under reduced motion the LIVE dot, spinner and control fade do not animate, the
  // spinner is a static ring, and the video itself keeps playing.
  const player = new VideoPlayerPage(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectNoDecorativeMotion();
  await player.expectPlaybackAdvancing();
  await player.stallSource();
  await player.expectSpinner(true);
  await player.expectNoDecorativeMotion();
});

test('animates the LIVE dot when motion is allowed', async ({ page }) => {
  // L2-072 AC3 (contrast case): without the preference the LIVE dot pulses.
  const player = new VideoPlayerPage(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectLiveDotAnimated(true);
});

test('maps the scrim and controls to system colours in forced colours mode', async ({ page }) => {
  // L2-072 AC4: the scrim uses Canvas, controls ButtonText, icons stay visible, and only the LIVE
  // dot opts out with forced-color-adjust: none.
  const player = new VideoPlayerPage(page);
  await page.emulateMedia({ forcedColors: 'active' });
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectForcedColors();
  await player.expectNoAccessibilityViolations();
});
