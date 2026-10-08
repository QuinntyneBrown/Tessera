// Acceptance tests. Traces to L2-061, L2-065, L2-074.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });
test.use({ hasTouch: true });

test('reveals hidden controls on a stage tap without changing playback', async ({ page }) => {
  // L2-061 AC3; L2-065 AC5; L2-074 AC1: a tap on the stage with hidden controls reveals them and
  // playback does not change; a second tap while they are visible toggles playback.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.restPointerOnStage();
  await player.freezeTime();
  await player.elapse(3000);
  await player.nextFrame();
  await player.expectControlsHidden(true);
  await player.tapStage();
  await player.elapse(16);
  await player.expectControlsHidden(false);
  await player.expectState('live');
  await player.tapStage();
  await player.elapse(16);
  await player.expectState('paused');
  await player.resumeTime();
});

test('acts on a tapped control and restarts the hide timer', async ({ page }) => {
  // L2-074 AC2: Given visible controls, when a control is tapped, it acts and the timer restarts.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.freezeTime();
  await player.elapse(2000);
  await player.tapControl('mute');
  await player.elapse(16);
  await player.expectMute('Unmute', true);
  await player.restPointerOnStage();
  await player.elapse(2900);
  await player.expectControlsHidden(false);
  await player.elapse(100);
  await player.nextFrame();
  await player.expectControlsHidden(true);
  await player.resumeTime();
});

test('suppresses the native context menu on the stage only', async ({ page }) => {
  // L2-074 AC4: a long press on the stage shows no native video menu; the page is unaffected.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectContextMenuPrevented('stage', true);
  await player.expectContextMenuPrevented('page', false);
  await player.expectNoAccessibilityViolations();
});
