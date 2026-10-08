// Acceptance tests. Traces to L2-062, L2-063, L2-069.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('Space and K toggle playback from a focused control and prevent the default', async ({
  page,
}) => {
  // L2-069 AC1: Given focus inside the host but not on the slider, when Space or K is pressed,
  // then play/pause toggles and the default action is prevented.
  const player = new VideoPlayerPage(page);
  await player.recordKeyDefaults();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.focusControl('mute');
  await player.pressKey('Space');
  await player.expectState('paused');
  await player.expectLastKeyPrevented(true);
  await player.expectMute('Mute', false);
  await player.pressKey('k');
  await player.expectState('live');
  await player.expectLastKeyPrevented(true);
  await player.expectNoAccessibilityViolations();
});

test('M, F and C toggle mute, fullscreen and captions, ignoring modifier chords', async ({
  page,
}) => {
  // L2-069 AC2; L2-063 AC2: letters are case-insensitive and ignored with Ctrl, Alt or Meta.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.open('live', { realTime: true, extra: { captions: true } });
  await player.expectState('live');
  await player.focusControl('play-pause');
  await player.pressKey('m');
  await player.expectMute('Unmute', true);
  await player.pressKey('Shift+M');
  await player.expectMute('Mute', false);
  await player.pressKey('f');
  await player.expectFullscreen('Exit fullscreen', true);
  await player.pressKey('F');
  await player.expectFullscreen('Fullscreen', false);
  await player.pressKey('c');
  await player.expectCaptions(true);
  for (const chord of ['Control+m', 'Alt+f', 'Meta+c']) await player.pressKey(chord);
  await player.expectMute('Mute', false);
  await player.expectFullscreen('Fullscreen', false);
  await player.expectCaptions(true);
  await player.expectNoAccessibilityViolations();
});

test('Arrow Up and Down change the volume by 5 from a button; Left and Right do nothing', async ({
  page,
}) => {
  // L2-069 AC3; L2-062 AC2: outside the slider, Up and Down step the volume by 5.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { volume: 50 } });
  await player.expectState('live');
  await player.focusControl('mute');
  await player.pressKey('ArrowUp');
  await player.expectVolume(55);
  await player.pressKey('ArrowDown');
  await player.pressKey('ArrowDown');
  await player.expectVolume(45);
  await player.pressKey('ArrowLeft');
  await player.pressKey('ArrowRight');
  await player.expectVolume(45);
  await player.expectNoAccessibilityViolations();
});

test('arrow keys on the slider apply the native step exactly once', async ({ page }) => {
  // L2-069 AC4: on the slider, the native behaviour applies and the component adds nothing.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { volume: 50 } });
  await player.expectState('live');
  await player.focusVolume();
  await player.pressKey('ArrowUp');
  await player.expectVolume(55);
  await player.pressKey('Space');
  await player.expectState('live');
  await player.expectNoAccessibilityViolations();
});

test('Escape exits fullscreen and is otherwise left to the browser', async ({ page }) => {
  // L2-069 AC5: Escape exits fullscreen; outside fullscreen its default is not prevented.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.recordKeyDefaults();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.focusControl('play-pause');
  await player.pressKey('Escape');
  await player.expectLastKeyPrevented(false);
  await player.pressKey('f');
  await player.expectFullscreen('Exit fullscreen', true);
  await player.pressKey('Escape');
  await player.expectFullscreen('Fullscreen', false);
  await player.expectLastKeyPrevented(true);
  await player.expectNoAccessibilityViolations();
});

test('Tab moves through the controls in reading order and skips the stage', async ({ page }) => {
  // L2-069 AC6: the order is play/pause, mute, volume, Live, captions, fullscreen.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.open('live', { realTime: true, extra: { captions: true } });
  await player.expectState('live');
  await player.expectTabOrder(['play-pause', 'mute', 'volume', 'live', 'captions', 'fullscreen']);
  await player.expectStageNotFocusable();
  await player.expectNoAccessibilityViolations();
});

test('moves focus to the nearest control when the focused control is removed', async ({ page }) => {
  // L2-069 AC7: Given a focused control is removed, then focus moves to the nearest enabled
  // control, never to body.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.open('live', { realTime: true, extra: { captions: true } });
  await player.expectState('live');
  await player.focusControl('captions');
  await player.removeCaptionsKeepingFocus();
  // The LIVE badge just before it is aria-disabled at the live edge, so the slider is nearest.
  await player.expectFocusedControl('volume');
  await player.expectNoAccessibilityViolations();
});

test('moves focus to the nearest enabled control when the focused control is disabled', async ({
  page,
}) => {
  // L2-069 AC7: Given the focused play/pause control becomes disabled when the stream ends, then
  // focus moves to the nearest enabled control.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.open('live', { realTime: true, extra: { endAfter: 3 } });
  await player.expectState('live');
  await player.focusControl('play-pause');
  await player.expectState('ended');
  await player.expectFocusedControl('fullscreen');
  await player.expectNoAccessibilityViolations();
});

test('falls back to the player region when no control is enabled', async ({ page }) => {
  // L2-069 AC7: focus never falls to body.
  const player = new VideoPlayerPage(page);
  await player.disableFullscreen();
  await player.open('live', { realTime: true, extra: { endAfter: 3 } });
  await player.expectState('live');
  await player.focusControl('play-pause');
  await player.expectState('ended');
  await player.expectFocusedRegion();
});
