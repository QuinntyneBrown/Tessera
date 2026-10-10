// Acceptance tests. Traces to L2-061, L2-063, L2-065, L2-066, L2-068, L2-071.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('shows a spinner over the last frame while buffering and returns to live', async ({
  page,
}) => {
  // L2-066 AC2, AC6: Given live, when the video fires waiting, then the state is buffering with a
  // spinner and the frame still visible; when playing fires, the state returns to live. Every
  // transition emits stateChange once and data-state follows it.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.stallSource();
  await player.expectState('buffering');
  await player.expectSpinner(true);
  await player.expectVideoVisible();
  await player.expectNoAccessibilityViolations();
  await player.resumeSource();
  await player.expectState('live');
  await player.expectSpinner(false);
  await player.expectStateHistoryInOrder(['connecting', 'live', 'buffering', 'live']);
});

test('announces Buffering only after 1000 ms of buffering', async ({ page }) => {
  // L2-066 AC3: Given buffering, when 1000 ms pass, then "Buffering." is announced once; shorter
  // buffering is not announced.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live');
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.freezeTime();
  await player.stallUntilVideoWaits();
  await player.elapse(999);
  await player.expectState('buffering');
  await player.expectNotAnnounced('Buffering.');
  await player.elapse(151);
  await player.expectAnnounced('Buffering.');
  await player.resumeTime();
});

test('pauses out of buffering and removes the spinner', async ({ page }) => {
  // L2-061 AC5: Given buffering, when Pause is activated, then the state is paused and the
  // buffering indicator is removed.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.stallSource();
  await player.expectState('buffering');
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.expectSpinner(false);
  await player.expectNoAccessibilityViolations();
});

test('reads Waiting for the source after 10 s and fails with stalled after 30 s', async ({
  page,
}) => {
  // L2-066 AC4; L2-068 AC2: Given no chunk for 10 s, then the status reads "Waiting for the
  // source…" and the state is buffering; after 30 s the state is error stalled with Retry.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.stallSource();
  await player.freezeTime();
  await player.elapse(10000);
  await player.expectStatusText('Waiting for the source…');
  await player.expectState('buffering');
  await player.elapse(20000);
  await player.expectError('The source stopped sending video.');
  await player.expectRetry(true);
  await player.resumeTime();
  await player.expectNoAccessibilityViolations();
});

test('ends with the live duration and disables every control except Fullscreen', async ({
  page,
}) => {
  // L2-066 AC5; L2-071 AC2: Given the subscription completes, when the buffered media has played
  // out, then the state is ended, the stage shows "Stream ended" with the live duration, every
  // control except Fullscreen is aria-disabled, and the duration is announced.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.observeAnnouncements();
  await player.open('live', {
    realTime: true,
    extra: { endAfter: 3, captions: true, startedAgo: 125 },
  });
  await player.expectState('ended');
  await player.expectEndedPanel('Live for 2 minutes');
  await player.expectControlsDisabledExceptFullscreen();
  await player.expectAnnounced('Stream ended. It was live for 2 minutes.');
  await player.expectStateHistoryInOrder(['connecting', 'live', 'ended']);
  await player.expectNoAccessibilityViolations();
});

test('hides the control bar 3000 ms after the pointer rests while live, keeping it focusable', async ({
  page,
}) => {
  // L2-065 AC1: while live, 3000 ms after the pointer rests over the stage, the control bar gets its
  // hidden class, stays in the DOM, keeps its controls focusable, and never gets aria-hidden.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.freezeTime();
  await player.restPointerOnStage();
  await player.elapse(2999);
  await player.expectControlsHidden(false);
  await player.elapse(1);
  await player.nextFrame();
  await player.expectControlsHidden(true);
  await player.resumeTime();
  await player.expectNoAccessibilityViolations();
});

for (const reveal of ['pointer', 'key', 'focus'] as const) {
  test(`reveals hidden controls on ${reveal} and restarts the timer`, async ({ page }) => {
    // L2-065 AC2: pointer movement, a key press or focus on a control shows the controls and
    // restarts the 3000 ms timer.
    const player = new VideoPlayerPage(page);
    await player.open('live');
    await player.expectState('live');
    await player.restPointerOnStage();
    await player.freezeTime();
    await player.elapse(3000);
    await player.nextFrame();
    await player.expectControlsHidden(true);
    if (reveal === 'pointer') await player.movePointerOverStage();
    else if (reveal === 'key') {
      await player.focusRegion();
      await player.pressKey('Shift');
    } else await player.focusControl('mute');
    await player.elapse(16);
    await player.expectControlsHidden(false);
    if (reveal !== 'focus') {
      await player.elapse(2900);
      await player.expectControlsHidden(false);
      await player.elapse(100);
      await player.nextFrame();
      await player.expectControlsHidden(true);
    }
    await player.resumeTime();
  });
}

for (const keep of ['focus', 'hover'] as const) {
  test(`keeps the controls visible while ${keep === 'focus' ? 'a control has focus' : 'the pointer is over them'}`, async ({
    page,
  }) => {
    // L2-065 AC3: with focus in the bar or the pointer over it, the controls stay visible.
    const player = new VideoPlayerPage(page);
    await player.open('live');
    await player.expectState('live');
    if (keep === 'focus') await player.focusControl('mute');
    else await player.hoverControlBar();
    await player.freezeTime();
    await player.elapse(5000);
    await player.expectControlsHidden(false);
    await player.resumeTime();
  });
}

test('keeps the controls visible whenever the player is not live', async ({ page }) => {
  // L2-065 AC4: in paused (and every other non-live state) the controls are always visible.
  const player = new VideoPlayerPage(page);
  await player.open('live');
  await player.expectState('live');
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.restPointerOnStage();
  await player.freezeTime();
  await player.elapse(5000);
  await player.expectControlsHidden(false);
  await player.resumeTime();
});

test('fades the controls over the design system base duration when motion is allowed', async ({
  page,
}) => {
  const player = new VideoPlayerPage(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectControlsTransition('0.2s');
});

test('shows and hides the controls instantly under reduced motion', async ({ page }) => {
  // L2-065 AC6: Given prefers-reduced-motion: reduce, the change is instant.
  const player = new VideoPlayerPage(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectControlsTransition('0s');
});

test('hides the pointer over the stage in fullscreen while the controls are hidden', async ({
  page,
}) => {
  // L2-063 AC4: Given fullscreen, when the controls auto-hide, then the cursor is hidden over the
  // stage until the pointer moves.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.open('live');
  await player.expectState('live');
  await player.clickFullscreen();
  await player.expectFullscreen('Exit fullscreen', true);
  await player.restPointerOnStage();
  await player.freezeTime();
  await player.elapse(3000);
  await player.nextFrame();
  await player.expectStageCursor('none');
  await player.movePointerOverStage();
  await player.elapse(16);
  await player.expectStageCursor('auto');
  await player.resumeTime();
});
